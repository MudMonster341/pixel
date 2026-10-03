// Offline bundle (decisions/0017-offline-bundle-for-mac.md, docs/OFFLINE_BUNDLE.md).
//
//   npm run pack:offline              -> dist/offline/          (double-click index.html)
//   npm run pack:offline -- --zip     -> also dist/offline.zip  (what you send to her)
//
// A page opened from file:// can't XHR/fetch local files and can't use file:// images as WebGL
// textures, so Phaser's loader fails. This script builds a folder where every RUNTIME asset is
// embedded in script-tag-loaded .js files (`window.__OFFLINE_ASSETS = { 'assets/x.png': 'data:...' }`)
// and src/offline-shim.js (loaded only by that folder's index.html) serves the loader from them.
//
// Which assets: derived from what the game actually loads, never a hand-kept list --
//   1. every `'assets/...'` string literal in src/ (comments ignored), which covers each load.* call,
//      the SOUNDS table, minigame backgrounds, cutscene art ...;
//   2. every `assets/${...}` template in src/, expanded from the content that fills it in (maps,
//      character sheets, cutscenes, clothes colours, card slides) -- a template with no handler here
//      makes the build FAIL, so a new kind of dynamic asset can't be silently left out;
//   3. the git-ignored owner content assets/card/ (card.json, the photos it lists, optional video.mp4)
//      and the optional box-opening video, read at build time.
// Every required asset must exist or the build throws. Source packs (assets/vendor, assets/External
// Tilesets) are never embedded: the game doesn't load anything from them at runtime.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const DEFAULT_OUT = path.join(ROOT, 'dist', 'offline');
const SHIM_REL = 'src/offline-shim.js';
const CHUNK_BYTES = 6 * 1024 * 1024; // target size of one assets-NN.js (an oversized asset gets a file of its own)
const MAX_OPTIONAL_VIDEO_BYTES = 150 * 1024 * 1024;
const BUNDLE_FOLDER_NAME = 'LUG-Treasure-Hunt'; // the folder she gets when she unzips

// Data scripts the content-derived list needs (pure data, no Phaser) -- same set tests/helpers/game-data.js loads.
const DATA_SCRIPTS = [
  'src/items.js', 'src/story.js', 'src/ambient.js', 'src/maps.js', 'src/cutscenes.js',
  'src/objective-routes.js', 'src/scripts.js', 'src/card.js', 'src/maplogic.js', 'src/state.js', 'src/audio.js',
];

const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2',
};

// Optional files: embedded when present, a quiet 404 in the bundle (the game's own fallback) when not.
const OPTIONAL_STATIC = new Set([
  'assets/card/card.json', 'assets/card/video.mp4', 'assets/cutscenes/video/box-opening.mp4',
]);
// Directory literals that are handled by name (the card's photos come from card.json).
const HANDLED_DIRS = new Set(['assets/card/photos/']);
// `assets/<template>` literals and what fills them in. Add a row here (and a branch in
// collectRuntimeAssets) when the game starts loading a new kind of dynamic path.
const TEMPLATE_HANDLERS = new Set([
  'assets/player-*.png', // clothes colours (src/main.js, src/scenes/intro-customize.js)
  'assets/maps/*.json', // Tiled maps (src/main.js)
  'assets/*.png', // character sheets (src/maplogic.js characterSheets())
  'assets/cutscenes/card-temp-*.png', // the temporary card slideshow (src/scenes/card.js)
  'assets/cutscenes/*.png', // cutscene art (src/scenes/cutscene.js)
]);

function mimeFor(rel) {
  const mime = MIME[path.extname(rel).toLowerCase()];
  if (!mime) throw new Error(`pack-offline: no MIME type for "${rel}" -- add its extension to MIME in tools/pack-offline.js`);
  return mime;
}

// ---------- reading the source ----------

// String and template literals of a JS file, comments skipped (a tiny tokenizer: regexes containing
// quotes would fool it, but nothing in src/ has one -- tests/unit/pack-offline.test.js cross-checks).
function stringLiterals(source) {
  const out = [];
  const n = source.length;
  let i = 0;
  while (i < n) {
    const c = source[i];
    const d = source[i + 1];
    if (c === '\\') { i += 2; continue; }
    if (c === '/' && d === '/') { while (i < n && source[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { const end = source.indexOf('*/', i + 2); i = end < 0 ? n : end + 2; continue; }
    if (c === '\'' || c === '"' || c === '`') {
      let j = i + 1;
      let value = '';
      while (j < n && source[j] !== c) {
        if (source[j] === '\\') { value += source[j] + (source[j + 1] || ''); j += 2; continue; }
        if (c !== '`' && source[j] === '\n') break;
        value += source[j++];
      }
      out.push({ kind: c === '`' ? 'template' : 'string', value });
      i = j + 1;
      continue;
    }
    i++;
  }
  return out;
}

function listSourceFiles(root) {
  const out = [];
  const walk = (dirRel) => {
    for (const entry of fs.readdirSync(path.join(root, dirRel), { withFileTypes: true })) {
      const rel = `${dirRel}/${entry.name}`;
      if (entry.isDirectory()) { if (rel !== 'src/dev') walk(rel); } else if (entry.name.endsWith('.js') && rel !== SHIM_REL) out.push(rel);
    }
  };
  walk('src');
  return out.sort();
}

// Every `assets/...` reference the game's source makes: { file, kind: 'static' | 'template' | 'dir', value }.
function scanSourceAssetRefs(root = ROOT) {
  const refs = [];
  for (const file of listSourceFiles(root)) {
    for (const lit of stringLiterals(fs.readFileSync(path.join(root, file), 'utf8'))) {
      if (!lit.value.startsWith('assets/')) continue;
      if (lit.kind === 'template' && lit.value.includes('${')) {
        refs.push({ file, kind: 'template', value: lit.value.replace(/\$\{[^}]*\}/g, '*') });
      } else if (lit.value.endsWith('/')) {
        refs.push({ file, kind: 'dir', value: lit.value });
      } else {
        refs.push({ file, kind: 'static', value: lit.value });
      }
    }
  }
  return refs;
}

// The game's content tables (maps, ambient, scripts, cutscenes, sounds, card slides), loaded the way the
// unit tests load them.
function loadContent(root = ROOT) {
  const noop = class { on() { return this; } emit() { return true; } };
  const context = vm.createContext({
    Phaser: { Events: { EventEmitter: noop } },
    console,
    URLSearchParams,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 },
    window: { game: { events: new noop() } },
  });
  for (const file of DATA_SCRIPTS) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  const get = (name) => vm.runInContext(name, context);
  return {
    MAPS: get('MAPS'), AMBIENT: get('AMBIENT'), SCRIPTS: get('SCRIPTS'), CUTSCENES: get('CUTSCENES'), SOUNDS: get('SOUNDS'),
    TEMP_CARD_SLIDES: get('TEMP_CARD_SLIDES'), characterSheets: get('characterSheets'),
  };
}

// 'pink', 'sky', ... -- the swatch ids the customisation screen offers (src/scenes/intro-customize.js).
function clothesIds(root = ROOT) {
  const source = fs.readFileSync(path.join(root, 'src/scenes/intro-customize.js'), 'utf8');
  const block = /const CLOTHES_OPTIONS = \[([\s\S]*?)\];/.exec(source);
  if (!block) throw new Error('pack-offline: could not find CLOTHES_OPTIONS in src/scenes/intro-customize.js');
  const ids = [...block[1].matchAll(/\bid:\s*'([\w-]+)'/g)].map((m) => m[1]);
  if (!ids.length) throw new Error('pack-offline: CLOTHES_OPTIONS has no ids');
  return [...new Set(['pink', ...ids])];
}

// ---------- the manifest ----------

// -> { assets: [{ path, abs, reason, optional }], notes: [string] }. Throws if a required asset is missing.
// `exists`/`readFile` are injectable so tests can simulate a missing file without touching the tree.
function collectRuntimeAssets({ root = ROOT, exists = fs.existsSync, readFile = (p) => fs.readFileSync(p, 'utf8') } = {}) {
  const found = new Map(); // rel -> { reason, optional }
  const missing = [];
  const notes = [];
  const add = (rel, reason, optional = false) => {
    if (found.has(rel)) return;
    const abs = path.join(root, ...rel.split('/'));
    if (!abs.startsWith(root + path.sep)) throw new Error(`pack-offline: "${rel}" (${reason}) points outside the project`);
    if (!exists(abs)) {
      if (optional) { notes.push(`optional file not present: ${rel} (${reason})`); return; }
      missing.push(`${rel}   <- ${reason}`);
      return;
    }
    found.set(rel, { reason, optional, abs });
  };

  const content = loadContent(root);

  // 1. content tables
  for (const { key, file } of content.characterSheets(content.MAPS, content.AMBIENT, content.SCRIPTS)) add(file, `character sheet "${key}"`);
  for (const [id, def] of Object.entries(content.SOUNDS)) add(def.file, `sound "${id}"`);
  for (const def of Object.values(content.MAPS)) if (def.tiled) add(`assets/maps/${def.tiled}.json`, `map "${def.tiled}"`);
  for (const [id, def] of Object.entries(content.CUTSCENES)) add(`assets/cutscenes/${def.image.replace(/^cutscene-/, '')}.png`, `cutscene "${id}"`);
  for (const id of clothesIds(root)) add(`assets/player-${id}.png`, `clothes colour "${id}"`);
  for (const slide of content.TEMP_CARD_SLIDES) add(`assets/cutscenes/${slide.key}.png`, 'temporary card slideshow');

  // 2. literals in the source
  for (const ref of scanSourceAssetRefs(root)) {
    const where = `${ref.file}`;
    if (ref.kind === 'template') {
      if (!TEMPLATE_HANDLERS.has(ref.value)) {
        throw new Error(`pack-offline: ${where} loads a dynamic asset path "${ref.value}" this bundler cannot expand. `
          + 'Register it in TEMPLATE_HANDLERS and collectRuntimeAssets() in tools/pack-offline.js (docs/OFFLINE_BUNDLE.md).');
      }
    } else if (ref.kind === 'dir') {
      if (!HANDLED_DIRS.has(ref.value)) {
        throw new Error(`pack-offline: ${where} references the directory "${ref.value}" this bundler does not know how to embed (docs/OFFLINE_BUNDLE.md).`);
      }
    } else if (/\.[a-z0-9]+$/i.test(ref.value)) {
      add(ref.value, where, OPTIONAL_STATIC.has(ref.value));
    }
  }

  // 3. the owner's card (git-ignored): card.json + every photo it lists, optional closing video
  const cardJson = path.join(root, 'assets', 'card', 'card.json');
  if (exists(cardJson)) {
    let card;
    try {
      card = JSON.parse(readFile(cardJson));
    } catch (error) {
      throw new Error(`pack-offline: assets/card/card.json is not valid JSON (${error.message})`);
    }
    for (const photo of Array.isArray(card.photos) ? card.photos : []) {
      if (!photo || typeof photo.file !== 'string' || !photo.file.trim()) continue;
      const file = photo.file.trim();
      if (file.includes('..') || path.isAbsolute(file)) throw new Error(`pack-offline: card.json photo "${file}" must be a plain file name in assets/card/photos/`);
      add(`assets/card/photos/${file.replace(/\\/g, '/')}`, 'listed in assets/card/card.json');
    }
  } else {
    notes.push('assets/card/card.json not found: the card will use the default messages and the generated slideshow (docs/STORY.md "How to put your photos and messages in")');
  }

  if (missing.length) {
    throw new Error(`pack-offline: ${missing.length} asset(s) the game loads are missing. Run "npm run assets" (needs the local art packs), `
      + `or fix the reference:\n  ${missing.join('\n  ')}`);
  }

  const assets = [...found.entries()]
    .map(([rel, info]) => ({ path: rel, abs: info.abs, reason: info.reason, optional: info.optional }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { assets, notes };
}

// ---------- the bundle's index.html ----------

function dataUri(file, mime) {
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

// The repo's index.html -> the bundle's: the shim and the asset registry load first, the font is
// inlined (no file:// font fetch), and anything under src/dev is dropped.
function buildIndexHtml(sourceHtml, { dataFiles = [], fontCss = '' } = {}) {
  let html = sourceHtml;
  html = html.replace(/[ \t]*<script[^>]*src="src\/dev\/[^"]*"[^>]*><\/script>\r?\n?/g, '');
  html = html.replace(/[ \t]*<link[^>]*src\/dev\/[^>]*>\r?\n?/g, '');
  if (fontCss) html = html.replace(/<link[^>]*press-start-2p\.css[^>]*>/, () => `<style>\n${fontCss}\n  </style>`);
  const loader = [
    '  <!-- OFFLINE BUNDLE (tools/pack-offline.js): generated, do not edit. The shim and the embedded assets load first. -->',
    '  <div id="offline-loading" style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;color:#8a8fa8;font:14px sans-serif">Loading the game...</div>',
    `  <script src="${SHIM_REL}"></script>`,
    ...dataFiles.map((f) => `  <script src="${f}"></script>`),
  ].join('\n');
  const phaserTag = /([ \t]*)<script src="vendor\/phaser\/phaser\.min\.js"><\/script>/;
  if (!phaserTag.test(html)) throw new Error('pack-offline: index.html has no vendor/phaser/phaser.min.js script tag');
  html = html.replace(phaserTag, (m) => `${loader}\n${m}`);
  html = html.replace(/(<script src="src\/main\.js"><\/script>)/, (m) => `${m}\n  <script>(function(){var l=document.getElementById('offline-loading');if(l&&l.parentNode)l.parentNode.removeChild(l);})();</script>`);
  return html;
}

function scriptSrcs(html) {
  return [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);
}

// press-start-2p.css with its url(...) fonts inlined as data URIs
function inlineFontCss(root) {
  const cssFile = path.join(root, 'vendor', 'press-start-2p', 'press-start-2p.css');
  return fs.readFileSync(cssFile, 'utf8').replace(/url\(['"]?([^'")]+)['"]?\)/g, (m, rel) => {
    const file = path.join(path.dirname(cssFile), rel);
    return `url('${dataUri(file, mimeFor(rel))}')`;
  });
}

// ---------- writing the registry files ----------

function writeRegistry(assets, outDir, log) {
  const dataDir = path.join(outDir, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const files = [];
  let lines = [];
  let size = 0;
  const flush = () => {
    if (!lines.length) return;
    const name = `data/assets-${String(files.length + 1).padStart(2, '0')}.js`;
    fs.writeFileSync(path.join(outDir, name), `(function(){var R=(window.__OFFLINE_ASSETS=window.__OFFLINE_ASSETS||{});\n${lines.join('')}})();\n`);
    files.push(name);
    lines = [];
    size = 0;
  };
  for (const asset of assets) {
    const stat = fs.statSync(asset.abs);
    if (asset.path.endsWith('.mp4') || asset.path.endsWith('.webm')) {
      if (stat.size > MAX_OPTIONAL_VIDEO_BYTES) {
        throw new Error(`pack-offline: ${asset.path} is ${(stat.size / 1048576).toFixed(0)} MB; keep embedded video under ${MAX_OPTIONAL_VIDEO_BYTES / 1048576} MB (compress it)`);
      }
    }
    const line = `R[${JSON.stringify(asset.path)}]=${JSON.stringify(dataUri(asset.abs, mimeFor(asset.path)))};\n`;
    if (size > 0 && size + line.length > CHUNK_BYTES) flush();
    lines.push(line);
    size += line.length;
    asset.bytes = stat.size;
    if (size > CHUNK_BYTES) flush();
  }
  flush();
  log(`pack-offline: wrote ${files.length} registry file(s) for ${assets.length} assets`);
  return files;
}

// ---------- HOW_TO_OPEN.txt ----------

function howToOpenText() {
  return [
    'BITS DUBAI: THE LUG TREASURE HUNT',
    '=================================',
    '',
    'How to play',
    '-----------',
    '1. If this came as a .zip file, double-click it to unzip it (a folder appears).',
    '2. Open the folder and double-click the file called  index.html',
    '   It opens in your web browser and the game starts. That is all.',
    '',
    'Good to know',
    '------------',
    '- Use Safari or Chrome. Nothing needs to be installed and you do not need the internet.',
    '- If the browser asks for anything (permission, install, update), you can say no / skip it:',
    '  the game does not need any of it.',
    '- Keep the files in the folder together. Do not move index.html out of its folder.',
    '- If there is no sound, click once anywhere on the page (browsers wait for a click before',
    '  playing sound). If Safari still plays no music, open the same index.html in Chrome.',
    '- Your progress is saved automatically inside the browser you used. "Continue" only finds your',
    '  save when you open the game in the SAME browser (a save made in Safari will not show up in Chrome).',
    '- A loading screen appears for a few seconds the first time. That is normal.',
    '',
    'Enjoy!',
    '',
  ].join('\n');
}

// ---------- zip (no dependencies: a small writer on top of Node\'s zlib) ----------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function listFiles(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, base));
    else out.push({ full, rel: path.relative(base, full).split(path.sep).join('/') });
  }
  return out.sort((a, b) => (a.rel < b.rel ? -1 : 1));
}

// Writes `zipPath` containing dir's files under `<topFolder>/`. Plain (non-zip64) zip, UTF-8 names,
// deflate; opens with macOS Archive Utility and Windows Explorer.
function writeZip(dir, zipPath, topFolder) {
  const files = listFiles(dir);
  if (files.length >= 65535) throw new Error('pack-offline: too many files for a plain zip');
  const { time, day } = dosDateTime(new Date());
  const parts = [];
  const central = [];
  let offset = 0;
  for (const file of files) {
    const data = fs.readFileSync(file.full);
    const name = Buffer.from(`${topFolder}/${file.rel}`, 'utf8');
    const deflated = zlib.deflateRawSync(data, { level: 6 });
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(data);
    if (offset + body.length > 0xfffffff0) throw new Error('pack-offline: zip would exceed 4 GB');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10); local.writeUInt16LE(day, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    const head = Buffer.alloc(46);
    head.writeUInt32LE(0x02014b50, 0); head.writeUInt16LE((3 << 8) | 20, 4); head.writeUInt16LE(20, 6); head.writeUInt16LE(0x0800, 8);
    head.writeUInt16LE(method, 10); head.writeUInt16LE(time, 12); head.writeUInt16LE(day, 14); head.writeUInt32LE(crc, 16);
    head.writeUInt32LE(body.length, 20); head.writeUInt32LE(data.length, 24); head.writeUInt16LE(name.length, 28);
    head.writeUInt32LE(((0o100644 << 16) >>> 0), 38); head.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([head, name]));
    parts.push(local, name, body);
    offset += local.length + name.length + body.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12); end.writeUInt32LE(offset, 16);
  fs.writeFileSync(zipPath, Buffer.concat([...parts, centralBuf, end]));
  return files.length;
}

// ---------- the build ----------

function dirSize(dir) {
  let total = 0;
  for (const { full } of listFiles(dir)) total += fs.statSync(full).size;
  return total;
}

const mb = (bytes) => `${(bytes / 1048576).toFixed(2)} MB`;

function build({ root = ROOT, outDir = DEFAULT_OUT, zip = false, log = console.log } = {}) {
  if (!path.basename(outDir).startsWith('offline')) throw new Error(`pack-offline: refusing to wipe "${outDir}" (output folder must be named offline*)`);
  const { assets, notes } = collectRuntimeAssets({ root });
  notes.forEach((note) => log(`pack-offline: NOTE ${note}`));

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const sourceHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const dataFiles = writeRegistry(assets, outDir, log);
  const html = buildIndexHtml(sourceHtml, { dataFiles, fontCss: inlineFontCss(root) });
  fs.writeFileSync(path.join(outDir, 'index.html'), html);

  // the scripts the bundle's index.html loads (all plain files, copied under the same relative path)
  for (const src of scriptSrcs(html)) {
    if (src.startsWith('data/')) continue; // written above
    const from = path.join(root, ...src.split('/'));
    if (!fs.existsSync(from)) throw new Error(`pack-offline: index.html loads ${src}, which does not exist`);
    const to = path.join(outDir, ...src.split('/'));
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
  fs.copyFileSync(path.join(root, 'vendor', 'phaser', 'LICENSE'), path.join(outDir, 'vendor', 'phaser', 'LICENSE'));
  fs.writeFileSync(path.join(outDir, 'HOW_TO_OPEN.txt'), howToOpenText());

  // size report
  const byFolder = new Map();
  for (const asset of assets) {
    const parts = asset.path.split('/');
    const folder = parts.length > 2 ? parts.slice(0, 2).join('/') : `${parts[0]} (loose files)`;
    byFolder.set(folder, (byFolder.get(folder) || 0) + asset.bytes);
  }
  const rawTotal = assets.reduce((sum, a) => sum + a.bytes, 0);
  log('pack-offline: embedded assets by folder (raw size; embedded as base64 they are ~1.37x):');
  for (const [folder, bytes] of [...byFolder.entries()].sort((a, b) => b[1] - a[1])) log(`  ${folder.padEnd(32)} ${mb(bytes)}`);
  const outBytes = dirSize(outDir);
  log(`pack-offline: ${assets.length} assets, ${mb(rawTotal)} raw`);
  log(`pack-offline: dist folder ${mb(outBytes)}  ->  ${outDir}`);

  let zipPath = null;
  if (zip) {
    zipPath = `${outDir}.zip`;
    fs.rmSync(zipPath, { force: true });
    const count = writeZip(outDir, zipPath, BUNDLE_FOLDER_NAME);
    log(`pack-offline: zip ${mb(fs.statSync(zipPath).size)} (${count} files) -> ${zipPath}`);
  } else {
    log('pack-offline: to send it, zip the folder: npm run pack:offline -- --zip   (or zip dist/offline by hand)');
  }
  log('pack-offline: open dist/offline/index.html by double-click to check it (Chrome or Safari).');
  return { assets, outDir, zipPath, dataFiles };
}

if (require.main === module) {
  try {
    build({ zip: process.argv.includes('--zip') });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  collectRuntimeAssets, scanSourceAssetRefs, stringLiterals, buildIndexHtml, scriptSrcs, clothesIds, loadContent,
  writeZip, crc32, mimeFor, howToOpenText, build, SHIM_REL, DATA_SCRIPTS, TEMPLATE_HANDLERS,
};

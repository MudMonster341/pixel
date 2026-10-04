// The offline bundle (ADR 0017, docs/OFFLINE_BUNDLE.md): tools/pack-offline.js collects the runtime
// assets the game loads and embeds them; src/offline-shim.js serves Phaser's loader from them under
// file://. Everything here runs in Node: the asset collector without a build, the shim in a vm
// sandbox with fake XHR/fetch/element classes. (Whether a real browser opens it from file:// is
// tests/e2e/offline-bundle.spec.js, run by the coordinator, not here.)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');
const { ROOT, loadGameData } = require('../helpers/game-data');
const pack = require('../../tools/pack-offline');

const { MAPS, AMBIENT, SCRIPTS, SOUNDS, CUTSCENES, TEMP_CARD_SLIDES, characterSheets, ANIMALS, ANIMAL_SPECIES, ANIMAL_LAYOUTS, animalSheets } = loadGameData();
const manifest = () => pack.collectRuntimeAssets();
const paths = (m) => new Set(m.assets.map((a) => a.path));

// ---------- (a) every key the game loads is in the manifest ----------

test('offline: the manifest covers every character sheet, sound, map, cutscene, clothes colour and card slide', () => {
  const have = paths(manifest());
  const expected = [];
  for (const { file } of characterSheets(MAPS, AMBIENT, SCRIPTS)) expected.push(file); // BootScene's characterSheets() preload
  for (const def of Object.values(SOUNDS)) expected.push(def.file); // AudioManager.preload()
  for (const def of Object.values(MAPS)) if (def.tiled) expected.push(`assets/maps/${def.tiled}.json`);
  for (const def of Object.values(CUTSCENES)) expected.push(`assets/cutscenes/${def.image.replace(/^cutscene-/, '')}.png`);
  for (const slide of TEMP_CARD_SLIDES) expected.push(`assets/cutscenes/${slide.key}.png`);
  // the clothes swatches, read independently of the bundler's own parser
  const customize = fs.readFileSync(path.join(ROOT, 'src/scenes/intro-customize.js'), 'utf8');
  for (const m of customize.matchAll(/\{ id: '(\w+)', label:/g)) expected.push(`assets/player-${m[1]}.png`);
  expected.push('assets/player-pink.png', 'assets/tiles.png', 'assets/tiles.json');
  assert.ok(expected.length > 40, 'sanity: the content really contributes assets');
  for (const rel of expected) assert.ok(have.has(rel), `${rel} is loaded by the game but missing from the offline manifest`);
});

test('offline: every literal load.*(key, "assets/...") call in src/ is in the manifest', () => {
  const have = paths(manifest());
  const seen = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (entry.name !== 'dev') walk(full); continue; }
      if (!entry.name.endsWith('.js')) continue;
      const src = fs.readFileSync(full, 'utf8');
      for (const m of src.matchAll(/load\.\w+\(\s*['"][^'"]+['"],\s*['"](assets\/[^'"]+)['"]/g)) seen.push(m[1]);
    }
  };
  walk(path.join(ROOT, 'src'));
  assert.ok(seen.length >= 20, `sanity: expected to find the loader calls (found ${seen.length})`);
  for (const rel of seen) assert.ok(have.has(rel), `${rel} is loaded in src/ but missing from the offline manifest`);
});

test('offline: only runtime assets are embedded (never the source packs), and every entry exists on disk', () => {
  const m = manifest();
  for (const a of m.assets) {
    assert.ok(!a.path.startsWith('assets/vendor/') && !a.path.startsWith('assets/External Tilesets/'), `${a.path} is a source pack file`);
    assert.ok(fs.existsSync(a.abs), `${a.path} should exist`);
    assert.ok(a.path.startsWith('assets/'), a.path);
  }
});

test('offline: the source scanner skips comments and sees template literals', () => {
  const lits = pack.stringLiterals("// 'assets/ignored.png'\nconst a = 'assets/a.png'; /* 'assets/b.png' */ const b = `assets/${x}.png`; const re = /\\//;");
  assert.deepEqual(lits.map((l) => [l.kind, l.value]), [['string', 'assets/a.png'], ['template', 'assets/${x}.png']]);
  const refs = pack.scanSourceAssetRefs();
  assert.ok(refs.some((r) => r.kind === 'static' && r.value === 'assets/tiles.png'));
  assert.ok(refs.some((r) => r.kind === 'template' && r.value === 'assets/maps/*.json'));
  for (const r of refs.filter((x) => x.kind === 'template')) assert.ok(pack.TEMPLATE_HANDLERS.has(r.value), `${r.file}: unhandled template ${r.value}`);
});

// ---------- (b) a missing referenced asset fails the build loudly ----------

test('offline: a referenced asset that is missing on disk throws', () => {
  assert.throws(
    () => pack.collectRuntimeAssets({ exists: (p) => !p.endsWith('tiles.png') && fs.existsSync(p) }),
    (error) => /tiles\.png/.test(error.message) && /missing/.test(error.message),
  );
  assert.throws(() => pack.collectRuntimeAssets({ exists: (p) => !p.endsWith('title.ogg') && fs.existsSync(p) }), /title\.ogg/);
});

function scratchProject(setup) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pack-offline-test-'));
  fs.cpSync(path.join(ROOT, 'src'), path.join(tmp, 'src'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'assets', 'card', 'photos'), { recursive: true });
  setup(tmp);
  // everything outside assets/card/ "exists" (this is about the card and the scanner, not the art)
  const exists = (p) => (p.startsWith(path.join(tmp, 'assets', 'card')) ? fs.existsSync(p) : true);
  return { tmp, exists, cleanup: () => fs.rmSync(tmp, { recursive: true, force: true }) };
}

test('offline: a dynamic asset path with no handler fails the build (nothing is silently left out)', () => {
  const p = scratchProject((tmp) => fs.writeFileSync(path.join(tmp, 'src', 'zz-new.js'), 'const f = `assets/brand-new-${kind}.png`;\n'));
  try {
    assert.throws(() => pack.collectRuntimeAssets({ root: p.tmp, exists: p.exists }), /cannot expand/);
  } finally { p.cleanup(); }
});

test('offline: the git-ignored card (card.json, listed photos, optional video) is embedded when present, and a listed-but-missing photo throws', () => {
  const p = scratchProject((tmp) => {
    const card = path.join(tmp, 'assets', 'card');
    fs.writeFileSync(path.join(card, 'card.json'), JSON.stringify({ recipient: 'T', photos: [{ file: 'a.jpg', caption: 'x' }, { file: 'b b.jpg' }] }));
    fs.writeFileSync(path.join(card, 'photos', 'a.jpg'), 'x');
    fs.writeFileSync(path.join(card, 'photos', 'b b.jpg'), 'x');
    fs.writeFileSync(path.join(card, 'video.mp4'), 'x');
  });
  try {
    const have = paths(pack.collectRuntimeAssets({ root: p.tmp, exists: p.exists }));
    for (const rel of ['assets/card/card.json', 'assets/card/photos/a.jpg', 'assets/card/photos/b b.jpg', 'assets/card/video.mp4']) assert.ok(have.has(rel), rel);
    fs.rmSync(path.join(p.tmp, 'assets', 'card', 'photos', 'b b.jpg'));
    assert.throws(() => pack.collectRuntimeAssets({ root: p.tmp, exists: p.exists }), /photos\/b b\.jpg/);
    fs.writeFileSync(path.join(p.tmp, 'assets', 'card', 'card.json'), '{ not json');
    assert.throws(() => pack.collectRuntimeAssets({ root: p.tmp, exists: p.exists }), /not valid JSON/);
  } finally { p.cleanup(); }
});

test('offline: with no card.json the build still works and notes it; no card file is embedded', () => {
  const p = scratchProject(() => {});
  try {
    const result = pack.collectRuntimeAssets({ root: p.tmp, exists: p.exists });
    assert.ok(!paths(result).has('assets/card/card.json'));
    assert.ok(result.notes.some((n) => /card\.json not found/.test(n)));
  } finally { p.cleanup(); }
});

// ---------- (c) the shim ----------

function loadShim(registry, { blockedStorage = false } = {}) {
  class FakeXHR {
    open(method, url) { this.method = method; this.url = url; }
    send() { this.nativeSent = true; }
    setRequestHeader() {}
  }
  const elementClass = () => {
    const proto = {};
    Object.defineProperty(proto, 'src', { get() { return this._src; }, set(v) { this._src = v; }, configurable: true });
    function Element() {}
    Element.prototype = proto;
    return Element;
  };
  function FakeURL() {}
  FakeURL.createObjectURL = () => 'blob:fake';
  FakeURL.revokeObjectURL = () => {};
  const sandbox = {
    __OFFLINE_ASSETS: registry,
    XMLHttpRequest: FakeXHR,
    fetch: async (url) => ({ passedThrough: String(url) }),
    Response, Blob, atob, TextDecoder, setTimeout, console, WeakMap,
    URL: FakeURL,
    HTMLImageElement: elementClass(),
    HTMLMediaElement: elementClass(),
    location: { href: 'file:///Users/taru/LUG-Treasure-Hunt/index.html' },
  };
  if (blockedStorage) Object.defineProperty(sandbox, 'localStorage', { get() { throw new Error('SecurityError'); }, configurable: true });
  else sandbox.localStorage = { getItem: () => 'real', setItem() {}, removeItem() {} };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, pack.SHIM_REL), 'utf8'), context, { filename: pack.SHIM_REL });
  return { sandbox, context, FakeXHR };
}

const uri = (mime, text) => `data:${mime};base64,${Buffer.from(text).toString('base64')}`;
const REGISTRY = () => ({
  'assets/maps/m.json': uri('application/json', '{"name":"café","n":[1,2]}'),
  'assets/img a.png': uri('image/png', 'PNGBYTES'),
  'assets/audio/s.ogg': uri('audio/ogg', 'OGGBYTES'),
  'assets/card/video.mp4': uri('video/mp4', 'MP4BYTES'),
});

const xhr = (sandbox, url, responseType) => new Promise((resolve) => {
  const x = new sandbox.XMLHttpRequest();
  x.open('GET', url);
  x.responseType = responseType;
  x.onload = (event) => resolve({ x, event });
  x.send();
});

test('offline shim: a registry path is served from the registry (text, json, arraybuffer, blob), never the network', async () => {
  const { sandbox } = loadShim(REGISTRY());
  const text = await xhr(sandbox, 'assets/maps/m.json', 'text');
  assert.equal(text.x.nativeSent, undefined, 'must not hit the network');
  assert.equal(text.x.status, 200);
  assert.equal(text.event.target.status, 200); // Phaser's File.onLoad reads e.target.status
  assert.equal(text.x.readyState, 4);
  assert.deepEqual(JSON.parse(text.x.responseText), { name: 'café', n: [1, 2] }); // UTF-8 survives
  assert.equal((await xhr(sandbox, './assets/maps/m.json?v=3', '')).x.responseText.length > 5, true, 'a query string and ./ prefix still resolve');
  assert.deepEqual(JSON.parse(JSON.stringify((await xhr(sandbox, 'assets/maps/m.json', 'json')).x.response)), { name: 'café', n: [1, 2] }); // JSON round-trip: the sandbox has its own Object
  const buf = (await xhr(sandbox, 'assets/audio/s.ogg', 'arraybuffer')).x.response;
  assert.equal(Buffer.from(buf).toString(), 'OGGBYTES');
  const blob = (await xhr(sandbox, 'assets/img a.png', 'blob')).x.response;
  assert.equal(blob.type, 'image/png');
  assert.equal(await blob.text(), 'PNGBYTES');
  // an image blob handed to URL.createObjectURL becomes the data URI itself (never tainted for WebGL)
  assert.equal(sandbox.URL.createObjectURL(blob), REGISTRY()['assets/img a.png']);
  assert.equal(sandbox.URL.createObjectURL(new Blob(['x'])), 'blob:fake', 'other blobs are untouched');
  // an absolute file:// URL inside the bundle folder and a %20 escape also resolve
  assert.equal((await xhr(sandbox, 'file:///Users/taru/LUG-Treasure-Hunt/assets/img%20a.png', 'blob')).x.status, 200);
});

test('offline shim: a non-registry path passes through; an unregistered assets/ path is a quiet 404', async () => {
  const { sandbox } = loadShim(REGISTRY());
  const passthrough = new sandbox.XMLHttpRequest();
  passthrough.open('GET', 'vendor/something.json');
  passthrough.send();
  assert.equal(passthrough.nativeSent, true, 'not ours: goes to the real XHR');
  const post = new sandbox.XMLHttpRequest();
  post.open('POST', 'assets/maps/m.json');
  post.send();
  assert.equal(post.nativeSent, true, 'only GETs are served from the registry');

  const missing = await xhr(sandbox, 'assets/card/card.json', 'text'); // optional owner file she never supplied
  assert.equal(missing.x.nativeSent, undefined, 'no network attempt (no console error)');
  assert.equal(missing.x.status, 404);

  assert.equal((await sandbox.fetch('https://example.com/a')).passedThrough, 'https://example.com/a');
  const data = 'data:text/plain;base64,QQ==';
  assert.equal((await sandbox.fetch(data)).passedThrough, data);
});

test('offline shim: fetch of a registry path answers ok; the optional video check works both ways', async () => {
  const { sandbox } = loadShim(REGISTRY());
  const json = await sandbox.fetch('assets/maps/m.json');
  assert.equal(json.ok, true);
  assert.deepEqual(await json.json(), { name: 'café', n: [1, 2] });
  assert.equal((await sandbox.fetch('assets/card/video.mp4')).ok, true, 'embedded video: the card scene goes on to play it');
  assert.equal((await sandbox.fetch('assets/cutscenes/video/box-opening.mp4')).ok, false, 'no video: the drawn fallback runs');
});

test('offline shim: element src of a registry path becomes a data URI (images) or blob URL (audio/video)', () => {
  const { sandbox } = loadShim(REGISTRY());
  const img = new sandbox.HTMLImageElement();
  img.src = 'assets/img a.png';
  assert.equal(img.src, REGISTRY()['assets/img a.png']);
  img.src = 'https://example.com/x.png';
  assert.equal(img.src, 'https://example.com/x.png');
  const video = new sandbox.HTMLMediaElement();
  video.src = 'assets/card/video.mp4';
  assert.equal(video.src, 'blob:fake');
});

test('offline shim: sets the bundle flag (dev tools off) and survives blocked localStorage', () => {
  const { sandbox, context } = loadShim(REGISTRY());
  assert.equal(sandbox.__OFFLINE_BUNDLE, true);
  assert.equal(sandbox.__OFFLINE_SHIM.has('assets/maps/m.json'), true);
  assert.equal(sandbox.__OFFLINE_SHIM.has('assets/nope.png'), false);

  const blocked = loadShim(REGISTRY(), { blockedStorage: true });
  vm.runInContext('localStorage.setItem("k", "v")', blocked.context);
  assert.equal(vm.runInContext('localStorage.getItem("k")', blocked.context), 'v');
  assert.equal(vm.runInContext('localStorage.getItem("missing")', blocked.context), null);
  assert.equal(vm.runInContext('localStorage.length', blocked.context), 1);
  assert.ok(context);
});

test('offline shim: is plain ES5 (no module syntax, no arrow functions, no let/const, nothing Safari lacks)', () => {
  const src = fs.readFileSync(path.join(ROOT, pack.SHIM_REL), 'utf8').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(src, /\bimport\b|\bexport\b|=>|\blet\b|\bconst\b|\bawait\b|\.at\(|\?\.|\?\?/);
});

test('offline: every animal sheet from animalSheets() is in the manifest, and the animal data scripts are loaded for it', () => {
  const have = paths(manifest());
  const sheets = animalSheets(ANIMALS, ANIMAL_SPECIES, ANIMAL_LAYOUTS);
  assert.ok(sheets.length >= 7, 'sanity: the campus animals really contribute sheets');
  for (const { file } of sheets) assert.ok(have.has(file), `${file} is preloaded by BootScene but missing from the offline manifest`);
  assert.ok(pack.DATA_SCRIPTS.includes('src/campus-facts.js') && pack.DATA_SCRIPTS.includes('src/animals.js'));
});

// ---------- (d) the bundle's index.html ----------

test('offline: the bundle index.html has no dev overlay, loads the shim first, and the dev index.html is unchanged', () => {
  const devHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.doesNotMatch(devHtml, /offline-shim|__OFFLINE/, 'npm start must not know about the bundle');

  const html = pack.buildIndexHtml(devHtml, { dataFiles: ['data/assets-01.js', 'data/assets-02.js'], fontCss: '@font-face{}' });
  assert.doesNotMatch(html, /src\/dev|feedback/i);
  assert.doesNotMatch(html, /press-start-2p\.css/, 'the font is inlined');
  const srcs = pack.scriptSrcs(html);
  assert.equal(srcs[0], pack.SHIM_REL, 'the shim runs before anything touches the loader');
  assert.deepEqual(srcs.slice(1, 3), ['data/assets-01.js', 'data/assets-02.js']);
  assert.ok(srcs.indexOf('data/assets-02.js') < srcs.indexOf('vendor/phaser/phaser.min.js'));
  // every game script of the dev page is still there, in the same order
  const devSrcs = pack.scriptSrcs(devHtml);
  assert.deepEqual(srcs.filter((s) => devSrcs.includes(s)), devSrcs);
  assert.ok(srcs.every((s) => !s.includes('dev/')));
  // ADR 0018: the two data scripts ride along, and before maps.js (which reads AMBIENT/ANIMALS-era globals)
  assert.ok(srcs.includes('src/campus-facts.js') && srcs.includes('src/animals.js'), 'campus-facts.js and animals.js are in the bundle index');
  assert.ok(srcs.indexOf('src/animals.js') < srcs.indexOf('src/maps.js'));
  // and the one hook in the game itself: the bundle flag wins over ?dev=1
  const main = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8');
  assert.match(main, /const DEV_MODE = \(\(\) => \{\s*\n\s*if \(window\.__OFFLINE_BUNDLE\) return false;/);
});

test('offline: a full build into a scratch folder is self-contained (every script and every registry key present)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pack-offline-build-'));
  const out = path.join(tmp, 'offline');
  try {
    const logs = [];
    const result = pack.build({ outDir: out, log: (line) => logs.push(line) });
    const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
    for (const src of pack.scriptSrcs(html)) assert.ok(fs.existsSync(path.join(out, ...src.split('/'))), `${src} is missing from the bundle`);
    assert.ok(!fs.existsSync(path.join(out, 'src', 'dev')), 'no dev scripts in the bundle');
    assert.ok(fs.existsSync(path.join(out, 'HOW_TO_OPEN.txt')));
    assert.doesNotMatch(html, /https?:\/\//, 'no remote URL');

    // load the real registry files and decode every entry the way the shim would
    const context = vm.createContext({ window: {} });
    context.window = context;
    for (const file of result.dataFiles) vm.runInContext(fs.readFileSync(path.join(out, file), 'utf8'), context);
    const registry = vm.runInContext('window.__OFFLINE_ASSETS', context);
    assert.equal(Object.keys(registry).length, result.assets.length);
    for (const asset of result.assets) {
      const u = registry[asset.path];
      assert.ok(typeof u === 'string' && u.startsWith('data:'), asset.path);
      assert.equal(Buffer.from(u.slice(u.indexOf(',') + 1), 'base64').length, fs.statSync(asset.abs).size, `${asset.path} round-trips`);
    }
    assert.ok(logs.some((line) => /by folder/.test(line)) && logs.some((line) => /MB/.test(line)), 'prints sizes');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('hosted: --hosted adds noindex + robots.txt + _headers to the same self-contained bundle, and a plain build has none of them', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pack-offline-hosted-'));
  try {
    const plain = path.join(tmp, 'offline-plain');
    const site = path.join(tmp, 'offline-site');
    pack.build({ outDir: plain, log() {} });
    pack.build({ outDir: site, hosted: true, log() {} });
    const siteHtml = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
    assert.match(siteHtml, /<meta name="robots" content="noindex,nofollow">/);
    assert.doesNotMatch(siteHtml, /https?:\/\//, 'no remote URL in the hosted copy either');
    assert.match(fs.readFileSync(path.join(site, 'robots.txt'), 'utf8'), /Disallow: \//);
    assert.match(fs.readFileSync(path.join(site, '_headers'), 'utf8'), /X-Robots-Tag: noindex/);
    for (const src of pack.scriptSrcs(siteHtml)) assert.ok(fs.existsSync(path.join(site, ...src.split('/'))), `${src} is missing from the hosted copy`);
    const plainHtml = fs.readFileSync(path.join(plain, 'index.html'), 'utf8');
    assert.doesNotMatch(plainHtml, /noindex/);
    assert.ok(!fs.existsSync(path.join(plain, 'robots.txt')) && !fs.existsSync(path.join(plain, '_headers')));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('offline: refuses to wipe a folder that is not named offline*', () => {
  assert.throws(() => pack.build({ outDir: path.join(os.tmpdir(), 'something-else'), log() {} }), /refusing to wipe/);
});

// ---------- --zip ----------

test('offline: --zip writes a standard zip (readable central directory, valid CRCs, a top-level folder)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pack-offline-zip-'));
  try {
    fs.mkdirSync(path.join(tmp, 'in', 'sub'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'in', 'a.txt'), 'hello '.repeat(500));
    fs.writeFileSync(path.join(tmp, 'in', 'sub', 'b b.bin'), Buffer.from([1, 2, 3, 4, 5]));
    const zipPath = path.join(tmp, 'out.zip');
    assert.equal(pack.writeZip(path.join(tmp, 'in'), zipPath, 'TOP'), 2);
    const buf = fs.readFileSync(zipPath);
    const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    assert.equal(buf.readUInt16LE(eocd + 10), 2);
    let pos = buf.readUInt32LE(eocd + 16);
    const seen = {};
    for (let i = 0; i < 2; i++) {
      assert.equal(buf.readUInt32LE(pos), 0x02014b50);
      const method = buf.readUInt16LE(pos + 10);
      const crc = buf.readUInt32LE(pos + 16);
      const csize = buf.readUInt32LE(pos + 20);
      const usize = buf.readUInt32LE(pos + 24);
      const nameLen = buf.readUInt16LE(pos + 28);
      const localAt = buf.readUInt32LE(pos + 42);
      const name = buf.slice(pos + 46, pos + 46 + nameLen).toString('utf8');
      const dataAt = localAt + 30 + buf.readUInt16LE(localAt + 26) + buf.readUInt16LE(localAt + 28);
      const raw = buf.slice(dataAt, dataAt + csize);
      const data = method === 8 ? zlib.inflateRawSync(raw) : raw;
      assert.equal(data.length, usize);
      assert.equal(pack.crc32(data), crc);
      seen[name] = data;
      pos += 46 + nameLen;
    }
    assert.deepEqual(Object.keys(seen).sort(), ['TOP/a.txt', 'TOP/sub/b b.bin']);
    assert.equal(seen['TOP/a.txt'].toString(), 'hello '.repeat(500));
    assert.equal(pack.crc32(Buffer.from('123456789')), 0xcbf43926, 'the standard CRC-32 check value');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('offline: HOW_TO_OPEN.txt covers the steps she needs', () => {
  const text = pack.howToOpenText();
  for (const phrase of [/unzip/i, /double-click/, /index\.html/, /Safari or Chrome/, /nothing needs to be installed/i, /SAME browser/, /click once/]) assert.match(text, phrase);
});

// ---------- audio: the bundle ships MP3, never Ogg (older Safari cannot decode Ogg Vorbis) ----------

const { mp3Info } = require('../../tools/lib/mp3-info');

// Length and rate of an Ogg Vorbis file, read from the container (identification header + last page's granule position).
function oggInfo(buf) {
  const id = buf.indexOf(Buffer.from([0x01, 0x76, 0x6f, 0x72, 0x62, 0x69, 0x73])); // 0x01 "vorbis"
  assert.ok(id >= 0, 'not an Ogg Vorbis file');
  const sampleRate = buf.readUInt32LE(id + 7 + 5); // after the 7-byte packet start, version (4) and channels (1)
  const lastPage = buf.lastIndexOf(Buffer.from('OggS', 'latin1'));
  const granule = Number(buf.readBigUInt64LE(lastPage + 6));
  return { sampleRate, seconds: granule / sampleRate };
}

let bundled; // the converted manifest, built once (the conversion is cached in dist/.audio-cache, so reruns are fast)
const bundledManifest = () => bundled || (bundled = pack.bundleAssets(manifest().assets));

test('offline audio: the bundle manifest has an mp3 for every ogg the game references and no ogg at all', () => {
  const rawOgg = manifest().assets.filter((a) => a.path.endsWith('.ogg')).map((a) => a.path);
  assert.ok(rawOgg.length >= 24, `sanity: the game references its ogg files (found ${rawOgg.length})`);
  for (const def of Object.values(SOUNDS)) {
    if (def.file.endsWith('.ogg')) assert.ok(rawOgg.includes(def.file), `${def.file} (SOUNDS) is referenced`);
  }
  const have = paths({ assets: bundledManifest() });
  for (const rel of rawOgg) assert.ok(have.has(rel.replace(/\.ogg$/, '.mp3')), `${rel} has no mp3 in the bundle`);
  for (const rel of have) assert.ok(!/\.ogg$/i.test(rel), `${rel}: the bundle must not embed Ogg`);
  assert.equal(pack.mimeFor('assets/audio/music/title.mp3'), 'audio/mpeg');
  assert.equal(pack.mp3PathFor('assets/audio/sfx/a.ogg'), 'assets/audio/sfx/a.mp3');
  assert.equal(pack.mp3PathFor('assets/audio/generated/a.wav'), 'assets/audio/generated/a.wav', 'wav is left alone');
  const wavs = bundledManifest().filter((a) => a.path.endsWith('.wav'));
  assert.ok(wavs.length >= 1 && wavs.every((a) => fs.statSync(a.abs).size < 100 * 1024), 'the generated wav sfx stay as small WAV files');
});

test('offline audio: every converted file is a valid MP3 whose length matches its Ogg source (within 2%, in fact exact)', () => {
  let totalBytes = 0;
  for (const a of bundledManifest().filter((x) => x.source)) {
    const mp3 = fs.readFileSync(a.abs);
    totalBytes += mp3.length;
    assert.ok(mp3.length > 0, a.path);
    const startsRight = mp3.toString('latin1', 0, 3) === 'ID3' || (mp3[0] === 0xff && (mp3[1] & 0xe0) === 0xe0);
    assert.ok(startsRight, `${a.path} must start with an ID3 tag or an MPEG sync word`);
    const info = mp3Info(mp3);
    assert.ok(info.valid && info.frames > 0, `${a.path} has MPEG frames`);
    const src = oggInfo(fs.readFileSync(path.join(ROOT, ...a.source.split('/'))));
    assert.equal(info.sampleRate, src.sampleRate, `${a.path} keeps the source sample rate`);
    assert.ok(Math.abs(info.seconds - src.seconds) <= src.seconds * 0.02, `${a.path}: ${info.seconds}s vs source ${src.seconds}s`);
    assert.ok(info.hasInfoTag && info.delay > 0, `${a.path} carries the gapless Info tag`);
    assert.ok(Math.abs(info.seconds - src.seconds) < 0.001, `${a.path}: the gapless tag makes the length exact`);
  }
  assert.ok(totalBytes < 15 * 1024 * 1024, `the whole audio set stays under 15 MB (it is ${(totalBytes / 1048576).toFixed(1)} MB)`);
});

test('offline audio: the mp3 reader rejects junk and reads a hand-made frame', () => {
  assert.equal(mp3Info(Buffer.from('not an mp3 at all, just text')).valid, false);
  assert.equal(mp3Info(Buffer.alloc(0)).valid, false);
  // two MPEG1 Layer III 128 kbps 44.1 kHz stereo frames (417 bytes each), no tag
  const frame = Buffer.alloc(417);
  frame.set([0xff, 0xfb, 0x90, 0x00], 0);
  const info = mp3Info(Buffer.concat([frame, frame]));
  assert.equal(info.valid, true);
  assert.equal(info.frames, 2);
  assert.equal(info.sampleRate, 44100);
  assert.equal(info.channels, 2);
  assert.ok(Math.abs(info.seconds - 2304 / 44100) < 1e-9);
});

test('offline audio shim: a request for x.ogg is answered with the x.mp3 entry; other paths still behave', async () => {
  const registry = {
    'assets/audio/music/t.mp3': uri('audio/mpeg', 'MP3BYTES'),
    'assets/audio/sfx/both.ogg': uri('audio/ogg', 'REALOGG'),
    'assets/audio/sfx/both.mp3': uri('audio/mpeg', 'ALSOMP3'),
    'assets/audio/generated/w.wav': uri('audio/wav', 'WAVBYTES'),
  };
  const { sandbox } = loadShim(registry);
  const asked = await xhr(sandbox, 'assets/audio/music/t.ogg', 'arraybuffer');
  assert.equal(asked.x.status, 200);
  assert.equal(asked.x.nativeSent, undefined, 'not the network');
  assert.equal(Buffer.from(asked.x.response).toString(), 'MP3BYTES');
  assert.equal(Buffer.from((await xhr(sandbox, './assets/audio/music/t.ogg?x=1', 'arraybuffer')).x.response).toString(), 'MP3BYTES', 'query string and ./ still map');
  assert.equal(Buffer.from((await xhr(sandbox, 'assets/audio/sfx/both.ogg', 'arraybuffer')).x.response).toString(), 'REALOGG', 'an exact registry hit wins over the mapping');
  assert.equal(Buffer.from((await xhr(sandbox, 'assets/audio/generated/w.wav', 'arraybuffer')).x.response).toString(), 'WAVBYTES');
  assert.equal((await xhr(sandbox, 'assets/audio/music/nothing.ogg', 'arraybuffer')).x.status, 404, 'an ogg with no mp3 is a quiet 404');
  assert.equal(sandbox.__OFFLINE_SHIM.has('assets/audio/music/t.ogg'), true);
  const passthrough = new sandbox.XMLHttpRequest();
  passthrough.open('GET', 'https://example.com/x.ogg');
  passthrough.send();
  assert.equal(passthrough.nativeSent, true, 'unknown, non-assets paths still pass through');
  assert.equal((await sandbox.fetch('https://example.com/x.ogg')).passedThrough, 'https://example.com/x.ogg');
  const audio = new sandbox.HTMLMediaElement();
  audio.src = 'assets/audio/music/t.ogg';
  assert.equal(audio.src, 'blob:fake');
});

test('offline audio shim: a browser that cannot play Ogg is told Ogg Vorbis is fine (Phaser checks the extension first) when MP3 plays', () => {
  const answers = (table) => {
    const sandbox = { __OFFLINE_ASSETS: { 'assets/a.mp3': uri('audio/mpeg', 'x') }, setTimeout, console, WeakMap, atob, Blob, location: { href: 'file:///x/index.html' } };
    function MediaElement() {}
    MediaElement.prototype.canPlayType = function (type) { return Object.prototype.hasOwnProperty.call(table, type) ? table[type] : ''; };
    sandbox.HTMLMediaElement = MediaElement;
    sandbox.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    sandbox.window = sandbox;
    vm.runInContext(fs.readFileSync(path.join(ROOT, pack.SHIM_REL), 'utf8'), vm.createContext(sandbox), { filename: pack.SHIM_REL });
    return new MediaElement();
  };
  const OGG = 'audio/ogg; codecs="vorbis"';
  const oldSafari = answers({ 'audio/mpeg': 'maybe' });
  assert.ok(oldSafari.canPlayType(OGG), 'Phaser then sets device.audio.ogg and requests the .ogg name');
  assert.equal(oldSafari.canPlayType('audio/ogg; codecs="opus"'), '', 'other formats keep their honest answer');
  assert.equal(oldSafari.canPlayType('audio/wav'), '');
  assert.equal(answers({ 'audio/mpeg': 'maybe', [OGG]: 'probably' }).canPlayType(OGG), 'probably', 'a browser that plays Ogg keeps its own answer');
  assert.equal(answers({}).canPlayType(OGG), '', 'no MP3 either: no lie');
});

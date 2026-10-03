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

const { MAPS, AMBIENT, SCRIPTS, SOUNDS, CUTSCENES, TEMP_CARD_SLIDES, characterSheets } = loadGameData();
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

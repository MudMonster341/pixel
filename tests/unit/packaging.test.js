// M6 (docs/decisions/0010-ship-as-windows-exe-and-web-build.md): the packaged .exe ships no
// internet access and no dev tools. These checks are static (no browser, no actual `npm run dist`
// build -- that's exercised manually per the ADR, it's slow and produces a ~100+MB artifact) but
// catch the two ways this could silently regress: a CDN/remote URL creeping back into what the game
// loads, or the packaged app picking up DEV_MODE (src/dev/feedback.js, the feedback overlay).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('../helpers/game-data');

const REMOTE_URL = /\bhttps?:\/\/(?!127\.0\.0\.1|localhost)\S+/;

test('index.html loads Phaser and the font from local files, not a CDN', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.match(html, /<script src="vendor\/phaser\/phaser\.min\.js"><\/script>/);
  assert.match(html, /<link href="vendor\/press-start-2p\/press-start-2p\.css" rel="stylesheet">/);
  assert.doesNotMatch(html, REMOTE_URL, 'index.html should reference no remote URL at all');
});

test('the vendored font stylesheet references only a local file, not fonts.gstatic.com', () => {
  const css = fs.readFileSync(path.join(ROOT, 'vendor', 'press-start-2p', 'press-start-2p.css'), 'utf8');
  assert.doesNotMatch(css, REMOTE_URL);
  assert.match(css, /url\('press-start-2p-latin\.woff2'\)/);
});

test('vendor/ has both dependencies with their licence committed', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'vendor', 'phaser', 'phaser.min.js')), 'vendor/phaser/phaser.min.js should exist');
  const phaserLicense = fs.readFileSync(path.join(ROOT, 'vendor', 'phaser', 'LICENSE'), 'utf8');
  assert.match(phaserLicense, /MIT License/i);

  assert.ok(fs.existsSync(path.join(ROOT, 'vendor', 'press-start-2p', 'press-start-2p-latin.woff2')), 'the font file should exist');
  const fontLicense = fs.readFileSync(path.join(ROOT, 'vendor', 'press-start-2p', 'OFL.txt'), 'utf8');
  assert.match(fontLicense, /SIL OPEN FONT LICENSE/i);
});

test('server.js serves .woff2 with a real font content-type, not octet-stream', () => {
  const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  assert.match(src, /'\.woff2':\s*'font\/woff2'/);
});

test('electron/main.js forces ?dev=0 when it loads the game -- packaged dev tools would otherwise turn back on', () => {
  const src = fs.readFileSync(path.join(ROOT, 'electron', 'main.js'), 'utf8');
  // src/main.js's DEV_MODE defaults ON for 127.0.0.1/localhost, which is exactly what the packaged
  // app's own internal server is -- this explicit override is the only thing stopping DEV_MODE
  // (and therefore the feedback overlay) from shipping in every build.
  assert.match(src, /loadURL\(`http:\/\/127\.0\.0\.1:\$\{PORT\}\/\?dev=0`\)/);
  // DevTools must be opt-in, not on by default.
  assert.match(src, /process\.argv\.includes\('--devtools'\)/);
  assert.match(src, /devTools:\s*DEVTOOLS/);
  // No menu bar (a stray "View > Toggle Developer Tools" menu item would be another way in).
  assert.match(src, /Menu\.setApplicationMenu\(null\)/);
});

test('package.json: electron/electron-builder are devDependencies, not runtime dependencies (ADR 0003 still holds for the game itself)', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.devDependencies.electron, 'electron should be a devDependency');
  assert.ok(pkg.devDependencies['electron-builder'], 'electron-builder should be a devDependency');
  assert.ok(!pkg.dependencies, 'the game should still load no npm packages at runtime (ADR 0003)');
  assert.equal(pkg.main, 'electron/main.js');
});

test('package.json build config: the packaged app excludes the raw third-party art packs (assets/vendor, External Tilesets) but includes the generated assets, vendor/ CDN replacements and assets/card', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const files = pkg.build.files;
  assert.ok(files.includes('!assets/vendor/**'), 'raw art packs should not ship (they are for baking assets/, never read at runtime)');
  assert.ok(files.includes('!assets/External Tilesets/**'));
  assert.ok(files.some((f) => f.startsWith('assets/**')), 'the generated assets/ (including assets/card when present) should ship');
  assert.ok(files.some((f) => f.startsWith('vendor/**')), 'the vendored Phaser/font replacements should ship');
  assert.equal(pkg.build.win.icon, 'build/icon.ico');
  assert.equal(pkg.build.win.target[0].target, 'portable', 'M6.2 asks for a single portable .exe, not an installer');
});

test('build/icon.ico exists and is a valid multi-size icon (tools/make-icon.js)', () => {
  const icoPath = path.join(ROOT, 'build', 'icon.ico');
  assert.ok(fs.existsSync(icoPath), 'build/icon.ico should be committed (run `npm run icon` to regenerate)');
  const buf = fs.readFileSync(icoPath);
  assert.equal(buf.readUInt16LE(0), 0, 'ICO reserved field should be 0');
  assert.equal(buf.readUInt16LE(2), 1, 'ICO type field should be 1 (icon)');
  const count = buf.readUInt16LE(4);
  assert.ok(count >= 4, 'expected several sizes packed into the icon');
  const sizes = [];
  for (let i = 0; i < count; i++) {
    const off = 6 + i * 16;
    sizes.push(buf.readUInt8(off) || 256);
  }
  assert.ok(sizes.includes(256) && sizes.includes(16), 'expected at least a 16px and a 256px entry');
});

test('.gitignore keeps assets/card/ (owner media) out of git but tracks a placeholder so the folder exists on a fresh clone', () => {
  const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  assert.match(gitignore, /^assets\/card\/\*$/m);
  assert.match(gitignore, /^!assets\/card\/\.gitkeep$/m);
  assert.ok(fs.existsSync(path.join(ROOT, 'assets', 'card', '.gitkeep')), 'assets/card/.gitkeep should exist so the folder survives a fresh clone');
});

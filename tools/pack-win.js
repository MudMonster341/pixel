// Privilege-free Windows packaging (M6.7, decisions/0010-ship-as-windows-exe-and-web-build.md
// "Consequences"). `npm run dist` (electron-builder --win portable) needs electron-builder's
// winCodeSign helper archive unpacked, which contains macOS symlinks -- extracting them needs
// SeCreateSymbolicLinkPrivilege (Windows Developer Mode, or an elevated shell). Some machines don't
// have that on and shouldn't need to just to get the game (see README.md "How to build and send the
// game"). `@electron/packager` never downloads or extracts that archive, so this path always works.
//
// Produces `dist/PixelQuest-win32-x64/` (PixelQuest.exe + the icon applied) and zips it to
// `dist/PixelQuest-win32-x64.zip`, via PowerShell's Compress-Archive (no new runtime deps for the
// zip step -- @electron/packager itself is the one new devDependency this whole path needed).
//
// Only ships the same runtime file set `npm run dist` ships (package.json's `build.files`), copied
// into a scratch staging folder first: @electron/packager packages whatever directory it's pointed
// at whole, and pointing it straight at the repo root would ship every devDependency (electron-
// builder, Playwright, this very script's own @electron/packager...) inside the game -- multiple
// GBs of things a player never needs, not the "few MB of assets on top of Chromium" README.md
// promises for the other build.
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { packager } = require('@electron/packager');

const ROOT = path.join(__dirname, '..');
// Scratch staging area, outside the repo entirely (os.tmpdir()) so it's never mistaken for a build
// output and never needs its own gitignore entry.
const STAGE_DIR = path.join(require('os').tmpdir(), 'pixelquest-pack-win-stage');
const OUT_DIR = path.join(ROOT, 'dist');
const APP_NAME = 'PixelQuest'; // -> PixelQuest.exe, dist/PixelQuest-win32-x64/. package.json's `build.productName` (the longer display name) is what shows in the window title/Explorer details, set independently below via win32metadata.

// The same allowlist electron-builder's `build.files` uses (package.json), replayed by hand here
// since @electron/packager has no equivalent "files" option -- only a whole-directory copy. Keep
// this in sync with package.json's `build.files` (tests/unit/packaging.test.js checks both ship the
// same runtime files). `build/icon.ico` is added on top: electron-builder embeds it into the .exe's
// own resource icon straight from disk via `win.icon` and never needs it inside the packaged files,
// but electron/main.js also loads it at runtime for the BrowserWindow's own icon, so both build
// paths need it present inside the shipped app.
const INCLUDE = [
  'index.html',
  'server.js',
  'package.json',
  'electron/**/*',
  'src/**/*',
  'vendor/**/*',
  'tools/feedback-store.js',
  'assets/**/*',
  'build/icon.ico',
];
const EXCLUDE_PREFIXES = ['assets/vendor/', 'assets/External Tilesets/'];

function relPosix(p) {
  return path.relative(ROOT, p).split(path.sep).join('/');
}

function isExcluded(relPath) {
  return EXCLUDE_PREFIXES.some((prefix) => relPath.startsWith(prefix));
}

function copyEntry(pattern) {
  if (pattern.endsWith('/**/*')) {
    const dir = pattern.slice(0, -('/**/*'.length));
    copyDir(dir);
  } else {
    copyFile(pattern);
  }
}

function copyFile(rel) {
  if (isExcluded(rel)) return;
  const src = path.join(ROOT, rel);
  if (!fs.existsSync(src)) throw new Error(`pack-win: expected file missing: ${rel}`);
  const dest = path.join(STAGE_DIR, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(rel) {
  const src = path.join(ROOT, rel);
  if (!fs.existsSync(src)) throw new Error(`pack-win: expected directory missing: ${rel}`);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const childRel = `${rel}/${entry.name}`;
    if (isExcluded(childRel + (entry.isDirectory() ? '/' : ''))) continue;
    if (entry.isDirectory()) {
      copyDir(childRel);
    } else if (entry.isFile()) {
      copyFile(childRel);
    }
  }
}

function stage() {
  fs.rmSync(STAGE_DIR, { recursive: true, force: true });
  fs.mkdirSync(STAGE_DIR, { recursive: true });
  for (const pattern of INCLUDE) copyEntry(pattern);

  // @electron/packager reads the staged package.json to name/version the app and to decide what
  // counts as a "production" dependency -- ADR 0003 holds (the game loads no npm packages at
  // runtime), so devDependencies must NOT come along; write a trimmed copy rather than the repo's
  // own package.json, whose devDependencies (electron-builder, Playwright, @electron/packager
  // itself, ~400MB+ of node_modules) would otherwise get pulled in as "extraneous" detection fails.
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const trimmed = { name: pkg.name, version: pkg.version, private: true, main: pkg.main };
  fs.writeFileSync(path.join(STAGE_DIR, 'package.json'), JSON.stringify(trimmed, null, 2));
}

async function main() {
  console.log('pack-win: regenerating build/icon.ico (tools/make-icon.js)...');
  execFileSync(process.execPath, [path.join(ROOT, 'tools', 'make-icon.js')], { stdio: 'inherit', cwd: ROOT });

  console.log('pack-win: staging runtime files...');
  stage();

  console.log('pack-win: running @electron/packager...');
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const productName = pkg.build && pkg.build.productName || APP_NAME;
  const author = pkg.build && pkg.build.author || pkg.author;

  // electron's own package.json version, passed explicitly: the staged package.json deliberately
  // carries no `dependencies`/`devDependencies` (see stage() above, ADR 0003), so packager has
  // nothing to infer an Electron version from otherwise.
  const electronVersion = require('electron/package.json').version;

  const appPaths = await packager({
    dir: STAGE_DIR,
    out: OUT_DIR,
    overwrite: true,
    platform: 'win32',
    arch: 'x64',
    name: APP_NAME,
    icon: path.join(ROOT, 'build', 'icon.ico'),
    appVersion: pkg.version,
    electronVersion,
    win32metadata: {
      CompanyName: author || 'MudMonster341',
      ProductName: productName,
      FileDescription: productName,
      InternalName: APP_NAME,
    },
  });

  const appDir = appPaths[0];
  console.log(`pack-win: built ${appDir}`);

  const zipPath = `${appDir}.zip`;
  fs.rmSync(zipPath, { force: true });
  console.log('pack-win: zipping (PowerShell Compress-Archive)...');
  execFileSync('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-Command',
    `Compress-Archive -Path '${appDir}\\*' -DestinationPath '${zipPath}' -CompressionLevel Optimal`,
  ], { stdio: 'inherit' });

  const folderBytes = dirSize(appDir);
  const zipBytes = fs.statSync(zipPath).size;
  console.log(`pack-win: folder  ${(folderBytes / 1024 / 1024).toFixed(1)} MB  ${appDir}`);
  console.log(`pack-win: zip     ${(zipBytes / 1024 / 1024).toFixed(1)} MB  ${zipPath}`);

  fs.rmSync(STAGE_DIR, { recursive: true, force: true });
}

function dirSize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    total += entry.isDirectory() ? dirSize(full) : fs.statSync(full).size;
  }
  return total;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

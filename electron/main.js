// The packaged app's entry point (docs/decisions/0010-ship-as-windows-exe-and-web-build.md).
//
// Loads the *same* index.html/src the web build serves, through the *same* server.js, in-process
// (not spawned as a child `node server.js` the way tests/e2e do it, per tests/e2e/paths.js -- a
// packaged app has no guaranteed system `node` binary to spawn, but Electron's *main* process always
// has full Node.js, so requiring server.js directly here works the same way). No game code changes:
// index.html and everything under src/ are untouched; server.js only gained a `module.exports` of
// its http.Server instance (M6.6, so this file can retry on another port), nothing behavioural.
//
// DEV_MODE (src/main.js) must stay off in the packaged app (M6.3). Its default rule turns dev mode on
// for the hostnames 'localhost'/'127.0.0.1'/'[::1]' -- not what this file loads from (see APP_SCHEME
// below), but `?dev=0` is still forced explicitly rather than relying on that, the same override a
// real player's `?dev=0` link would use, and cheap insurance against that default ever changing.
const { app, BrowserWindow, Menu, protocol, net } = require('electron');
const path = require('path');

// The origin the window always loads from, whichever of PORTS below the internal server actually
// bound to (M6.6). Chromium/Electron scope localStorage per *exact* origin (scheme+host+port), so if
// the window just loaded `http://127.0.0.1:<PORT>` directly, a port fallback (the primary port being
// busy) would silently land the player on a *different* origin than their last session and their save
// (localStorage, src/save.js, key `pixelquest.save.v1.<profile>`) would look to have vanished. Instead
// the window always loads this fixed custom-scheme origin; `protocol.handle` below forwards every
// request through to the real server on whatever port it ended up on. The origin -- and so the save --
// stays identical across launches no matter which port was free.
const APP_SCHEME = 'pixelquest';
protocol.registerSchemesAsPrivileged([
  { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

// A short list of candidate ports (M6.6), tried in order at startup; the first free one is used for
// the life of this run. Not 8080 (the owner's own dev/play copy, see CLAUDE.md) and not a test port
// (4173/E2E_PORT, tests/e2e/paths.js). Fixed candidates (not OS-assigned/port 0) so a run only ever
// binds to one of these -- port 0 would pick a different, unpredictable port every single launch.
const PORTS = [51973, 51974, 51975, 51976, 51977];

// DevTools are compiled out of every window unless this app is started with --devtools (M6.3: "only
// when a flag is set"). `npm run dist` never passes it, so a shipped .exe can never open them.
const DEVTOOLS = process.argv.includes('--devtools');

// Requires server.js fresh (bypassing require's module cache) against the given port and resolves
// once it's actually listening, or rejects (typically EADDRINUSE) so the caller can try the next
// candidate port. server.js exports its http.Server instance for exactly this.
function listenOnPort(port) {
  return new Promise((resolve, reject) => {
    process.env.PORT = String(port);
    delete require.cache[require.resolve('../server.js')];
    let server;
    try {
      server = require('../server.js'); // module-level side effect: starts listening immediately
    } catch (err) {
      reject(err);
      return;
    }
    const onError = (err) => {
      server.removeListener('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      server.removeListener('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
  });
}

// Tries each candidate port in order and returns the one that ended up free. Throws only if every
// candidate in PORTS is taken (vanishingly unlikely -- these are uncommon high ports).
async function startGameServer() {
  // server.js also serves the dev feedback API, but nothing in the packaged app ever calls it --
  // that's src/dev/feedback.js, which src/main.js only loads when DEV_MODE is on (it isn't, see
  // below). Still pointed at somewhere writable rather than left unset: the packaged app's own
  // install folder is read-only once asar'd, but userData always is writable.
  process.env.FEEDBACK_DIR = path.join(app.getPath('userData'), 'feedback');
  let lastError;
  for (const port of PORTS) {
    try {
      await listenOnPort(port);
      return port;
    } catch (err) {
      if (err.code !== 'EADDRINUSE') throw err;
      lastError = err;
    }
  }
  throw new Error(`Every candidate port (${PORTS.join(', ')}) was already in use`, { cause: lastError });
}

// Makes the fixed `pixelquest://` origin (see above) a thin proxy onto the real server on `port`:
// every request the window makes -- the initial HTML, every script/asset it references by relative
// URL, and the card's own `fetch()` (src/scenes/card.js) -- gets forwarded byte-for-byte. No game
// code (server.js, index.html, src/) needs to know this indirection exists.
function registerAppProtocol(port) {
  protocol.handle(APP_SCHEME, (request) => {
    const url = new URL(request.url);
    const target = `http://127.0.0.1:${port}${url.pathname}${url.search}`;
    const init = { method: request.method };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = request.body;
      init.duplex = 'half';
    }
    const range = request.headers.get('range');
    if (range) init.headers = { Range: range };
    return net.fetch(target, init);
  });
}

function createWindow() {
  Menu.setApplicationMenu(null); // M6.2: no menu bar

  const win = new BrowserWindow({
    // 960x540 (GAME_WIDTH/HEIGHT, src/state.js) at 1.33x -- big enough to read comfortably on any
    // laptop screen without edge-to-edge crowding; Phaser's Scale.FIT (src/main.js) letterboxes the
    // 16:9 canvas cleanly at any window size the player resizes to afterwards.
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    backgroundColor: '#12131a', // matches src/main.js's Phaser backgroundColor -- no white flash
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      devTools: DEVTOOLS, // false disables DevTools entirely, not just hides the menu item for it
    },
  });

  // F11 fullscreen toggle (M6.2). Phaser's Scale.FIT (src/main.js) already handles resizing the
  // canvas to whatever size the window ends up, fullscreen or not -- nothing else to wire up.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });

  if (DEVTOOLS) win.webContents.openDevTools();

  win.loadURL(`${APP_SCHEME}://app/?dev=0`);
  return win;
}

app.whenReady().then(async () => {
  const port = await startGameServer();
  registerAppProtocol(port);
  createWindow();

  app.on('activate', () => {
    // macOS convention (kept for parity even though M6 only ships Windows): clicking the dock icon
    // with no open window should reopen one instead of doing nothing.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

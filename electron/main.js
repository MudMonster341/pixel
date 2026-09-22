// The packaged app's entry point (docs/decisions/0010-ship-as-windows-exe-and-web-build.md).
//
// Loads the *same* index.html/src the web build serves, through the *same* server.js, in-process
// (not spawned as a child `node server.js` the way tests/e2e do it, per tests/e2e/paths.js -- a
// packaged app has no guaranteed system `node` binary to spawn, but Electron's *main* process always
// has full Node.js, so requiring server.js directly here works the same way). No game code changes:
// server.js, index.html and everything under src/ are untouched.
//
// DEV_MODE (src/main.js) must stay off in the packaged app (M6.3). Its default rule turns dev mode
// on for the hostnames 'localhost'/'127.0.0.1'/'[::1]' -- which is exactly what this file loads from,
// so leaving that to the default would turn dev tools (the feedback overlay) BACK on. `?dev=0` below
// forces it off explicitly, the same override a real player's `?dev=0` link would use.
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

// A fixed port, not 8080 (the owner's own dev/play copy, see CLAUDE.md) and not a test port
// (4173/E2E_PORT, tests/e2e/paths.js). Fixed (not OS-assigned/port 0) so http://127.0.0.1:<PORT> is
// the same origin on every launch -- that's what makes the save (localStorage, src/save.js) persist
// between runs (M6.5): a different port each launch would mean a different origin, and Chromium/
// Electron scope localStorage per origin.
const PORT = 51973;

// DevTools are compiled out of every window unless this app is started with --devtools (M6.3: "only
// when a flag is set"). `npm run dist` never passes it, so a shipped .exe can never open them.
const DEVTOOLS = process.argv.includes('--devtools');

function startGameServer() {
  process.env.PORT = String(PORT);
  // server.js also serves the dev feedback API, but nothing in the packaged app ever calls it --
  // that's src/dev/feedback.js, which src/main.js only loads when DEV_MODE is on (it isn't, see
  // above). Still pointed at somewhere writable rather than left unset: the packaged app's own
  // install folder is read-only once asar'd, but userData always is writable.
  process.env.FEEDBACK_DIR = path.join(app.getPath('userData'), 'feedback');
  require('../server.js'); // module-level side effect: starts listening immediately (see server.js)
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

  win.loadURL(`http://127.0.0.1:${PORT}/?dev=0`);
  return win;
}

app.whenReady().then(() => {
  startGameServer();
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

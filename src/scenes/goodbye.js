// The goodbye screen (FB-0075, "add in a way to quit the game"): where "Quit" on the title screen and "Quit Game"
// in the pause menu lead. A browser only lets a script close a window that a script opened, so
// closeGameWindow() is a best effort -- it does work in the desktop build (electron/main.js) and in a window the
// game was opened from -- and this screen is what a plain browser tab ends on instead: it says plainly that the
// tab can be closed now, and offers a way back to the title (Enter / E / Space or a click; Esc backs out too).
// Nothing here touches the save.

// Tries to close the window the game runs in. Never throws: a plain browser tab refuses (with a console
// warning), which is exactly the case the goodbye screen is for.
function closeGameWindow() {
  try {
    window.close();
  } catch (error) {
    /* refused: the goodbye screen takes over */
  }
}

// The one way out of the game, for the title menu and the pause menu alike: try to close the window, then show
// the goodbye screen with no gameplay scene left alive behind it (src/scenes/ui.js leaveGameTo()).
function quitGameToGoodbye(scene) {
  closeGameWindow();
  leaveGameTo(scene, 'goodbye');
}

const GOODBYE_PANEL = { w: 560, h: 260 };
const GOODBYE_FADE_MS = 250;

class GoodbyeScene extends Phaser.Scene {
  constructor() {
    super('goodbye');
  }

  preload() {
    // Reachable from the title screen and the pause menu, which have both loaded the UI kit already --
    // guarded/idempotent like every other preload() that builds a panel or button, so a direct reach-in is safe.
    preloadUiKit(this);
  }

  create() {
    this.leaving = false;
    this.cameras.main.setBackgroundColor('#12131a');
    this.cameras.main.fadeIn(GOODBYE_FADE_MS, 0, 0, 0);
    AudioManager.stopMusic(); // the music fades out; the title's own bed starts again if she goes back

    const { w, h } = GOODBYE_PANEL;
    const x = Math.round((GAME_WIDTH - w) / 2);
    const y = Math.round((GAME_HEIGHT - h) / 2);
    makePanel(this, x, y, w, h);
    uiText(this, GAME_WIDTH / 2, y + 52, 'THANKS FOR PLAYING!', 16, COLORS.highlight).setOrigin(0.5);
    uiText(this, GAME_WIDTH / 2, y + 100, 'You can close this tab or window now.', 10, COLORS.text)
      .setOrigin(0.5).setAlign('center').setWordWrapWidth(w - 60);

    const btnW = 260;
    const btnH = 48;
    this.backButton = new Button(this, Math.round((GAME_WIDTH - btnW) / 2), y + h - btnH - 36, btnW, btnH, 'Back to title', () => this.backToTitle());
    this.backButton.setFocused(true); // the only choice, always highlighted
    uiText(this, GAME_WIDTH / 2, y + h - 18, 'ENTER TO CHOOSE -- ESC TO GO BACK', 8, COLORS.dim).setOrigin(0.5);

    for (const key of ['ENTER', 'SPACE', 'E', 'ESC']) {
      this.input.keyboard.on(`keydown-${key}`, (event) => { if (!event.repeat) this.backToTitle(); });
    }
  }

  backToTitle() {
    if (this.leaving) return;
    this.leaving = true;
    AudioManager.play('menuConfirm');
    this.cameras.main.fadeOut(GOODBYE_FADE_MS, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('title'));
    // The fade event is what normally hands over; this guarantees it even if the event never arrives.
    this.time.delayedCall(GOODBYE_FADE_MS + 400, () => this.scene.start('title'));
  }
}

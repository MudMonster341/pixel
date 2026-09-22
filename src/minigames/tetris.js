// Room 195's key mini-game (docs/STORY.md): standard Tetris. Every rule (the board, the 7 pieces,
// rotation, line clears, the speed curve) lives in src/minigames/tetris-logic.js as pure functions --
// this file only renders that state and forwards input to it. Art pass (coordinator brief,
// 2026-09-22): a themed night-classroom backdrop (tools/make-minigame-art.js), a proper bordered well
// with faint grid lines over an opaque playfield, a NEXT piece box, a level/score side panel, shaded
// (not flat) piece cells, and a brief white flash on a line clear.

const TT_CELL = 18;
const TT_BOARD_X = Math.round((GAME_WIDTH - TETRIS_COLS * TT_CELL) / 2);
const TT_BOARD_Y = 44;
const TT_DAS_MS = 130; // delay between auto-repeated left/right moves while a direction is held
const TT_LOCK_FLASH_MS = 140; // how long a cleared row flashes before the board actually collapses
const TT_LINE_POINTS = [0, 40, 100, 300, 1200]; // classic scoring, times the current level
const TT_COLOR_MAP = {
  cyan: 0x7fe0ff, yellow: 0xffd23f, purple: 0xb27fd6, green: 0x8fd46a,
  red: 0xff5a5a, blue: 0x3b7dd8, orange: 0xd9774f,
};

// Lightens (positive `amt`, 0..1) or darkens (negative) a 0xRRGGBB color -- used to give each cell a
// highlight (top/left) and shadow (bottom/right) face instead of a flat fill (STYLE_GUIDE.md "Ramps,
// not flat fills"), without needing a hand-picked second color per piece.
function shadeColor(color, amt) {
  const clamp = (n) => Phaser.Math.Clamp(n, 0, 255);
  const r = clamp(((color >> 16) & 0xff) + Math.round(255 * amt));
  const g = clamp(((color >> 8) & 0xff) + Math.round(255 * amt));
  const b = clamp((color & 0xff) + Math.round(255 * amt));
  return (r << 16) | (g << 8) | b;
}

class TetrisScene extends MinigameBaseScene {
  constructor() {
    super('minigame-tetris');
  }

  preload() {
    if (!this.textures.exists('tetris-bg')) this.load.image('tetris-bg', 'assets/minigames/tetris-bg.png');
  }

  buildScene() {
    const w = TETRIS_COLS * TT_CELL;
    const h = TETRIS_ROWS * TT_CELL;

    this.add.image(0, 0, 'tetris-bg').setOrigin(0, 0).setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setDepth(-10);

    // An opaque well (not the old 35%-alpha see-through one) so pieces stay crisp against the
    // classroom behind it, with faint internal grid lines and a proper cream border.
    const well = this.add.graphics().setDepth(1);
    well.fillStyle(0x14110c, 0.95).fillRect(TT_BOARD_X, TT_BOARD_Y, w, h);
    well.lineStyle(1, 0x2e2820, 0.7);
    for (let gx = 1; gx < TETRIS_COLS; gx++) well.lineBetween(TT_BOARD_X + gx * TT_CELL, TT_BOARD_Y, TT_BOARD_X + gx * TT_CELL, TT_BOARD_Y + h);
    for (let gy = 1; gy < TETRIS_ROWS; gy++) well.lineBetween(TT_BOARD_X, TT_BOARD_Y + gy * TT_CELL, TT_BOARD_X + w, TT_BOARD_Y + gy * TT_CELL);
    well.lineStyle(3, 0xeadbb8, 1).strokeRect(TT_BOARD_X - 2, TT_BOARD_Y - 2, w + 4, h + 4);

    this.flashGfx = this.add.graphics().setDepth(2);
    this.boardGfx = this.add.graphics().setDepth(3);
    this.buildSidePanel();

    // Rotate is a one-shot action (ERR-0001: a keydown event, never JustDown-polled); move/soft-drop
    // are held actions, read as isDown in playUpdate() below, the same as world.js's own movement.
    const rotate = (event) => {
      if (!event.repeat && this.mgState === 'playing' && this.piece) this.piece = rotatePiece(this.board, this.piece);
    };
    this.input.keyboard.on('keydown-UP', rotate);
    this.input.keyboard.on('keydown-W', rotate);
  }

  // NEXT box + a LEVEL/SCORE readout, to the right of the well (docs/GAME_FEEL.md: same drawPanel()
  // furniture as every other panel in the game). LINES/target stays on the shared top HUD every
  // mini-game already has (framework-scene.js) rather than being duplicated here.
  buildSidePanel() {
    const px = TT_BOARD_X + TETRIS_COLS * TT_CELL + 24;
    const py = TT_BOARD_Y;
    const w = 150;
    const h = 230;
    const panel = this.add.graphics().setDepth(90);
    drawPanel(panel, px, py, w, h);
    uiText(this, px + w / 2, py + 16, 'NEXT', 10, COLORS.dim).setOrigin(0.5).setDepth(91);
    this.nextGfx = this.add.graphics().setDepth(91);
    this.nextBoxCenter = { x: px + w / 2, y: py + 62 };

    uiText(this, px + w / 2, py + 122, 'LEVEL', 10, COLORS.dim).setOrigin(0.5).setDepth(91);
    this.levelText = uiText(this, px + w / 2, py + 142, '1', 18, COLORS.highlight).setOrigin(0.5).setDepth(91);

    uiText(this, px + w / 2, py + 178, 'SCORE', 10, COLORS.dim).setOrigin(0.5).setDepth(91);
    this.scoreText = uiText(this, px + w / 2, py + 198, '0', 18, COLORS.highlight).setOrigin(0.5).setDepth(91);
  }

  startAttempt() {
    this.board = createTetrisBoard();
    this.bag = randomBag();
    this.piece = spawnPiece(this.nextBagPiece());
    this.linesCleared = 0;
    this.level = 1;
    this.points = 0;
    this.dropTimer = 0;
    this.dasTimer = 0;
    this.dasDir = 0;
    this.flashRows = [];
    this.refreshSidePanel();
    this.redraw();
  }

  // Pops the next piece off the bag and immediately tops it back up if that was the last one, so
  // `this.bag[0]` (the NEXT box preview) is always valid to peek at, never briefly empty.
  nextBagPiece() {
    const type = this.bag.shift();
    if (this.bag.length === 0) this.bag = randomBag();
    return type;
  }

  refreshSidePanel() {
    this.levelText.setText(String(this.level));
    this.scoreText.setText(String(this.points));
    this.drawNextPreview();
  }

  drawNextPreview() {
    const g = this.nextGfx.clear();
    const type = this.bag[0];
    if (!type) return;
    const def = TETRIS_PIECES[type];
    const cell = 14;
    const originX = this.nextBoxCenter.x - (def.size * cell) / 2;
    const originY = this.nextBoxCenter.y - (def.size * cell) / 2;
    const color = TT_COLOR_MAP[def.color];
    for (const [cx, cy] of def.cells) this.drawShadedCell(g, originX + cx * cell, originY + cy * cell, cell, color);
  }

  lockAndContinue() {
    // Which rows are about to clear, computed from the merged-but-not-yet-collapsed board, so the
    // flash below highlights the *real* rows for a beat before lockPiece()'s own (pure, tested)
    // collapse actually happens.
    const merged = this.board.map((row) => [...row]);
    for (const [x, y] of absoluteCells(this.piece)) { if (y >= 0 && y < TETRIS_ROWS) merged[y][x] = this.piece.color; }
    const fullRows = [];
    for (let y = 0; y < TETRIS_ROWS; y++) if (merged[y].every(Boolean)) fullRows.push(y);

    const { board, linesCleared } = lockPiece(this.board, this.piece);
    this.board = merged;
    this.piece = null; // nothing falls during the flash -- playUpdate() no-ops while this is null
    this.flashRows = fullRows;
    this.redraw();

    const applyAndContinue = () => {
      this.flashRows = [];
      this.board = board;
      this.linesCleared += linesCleared;
      this.level = Math.floor(this.linesCleared / 3) + 1;
      this.points += (TT_LINE_POINTS[linesCleared] || 0) * this.level;
      this.setScore(this.linesCleared);
      this.refreshSidePanel();
      if (this.linesCleared >= this.def.scoreTarget) { this.win(); return; }
      this.piece = spawnPiece(this.nextBagPiece());
      this.refreshSidePanel();
      if (!fitsBoard(this.board, absoluteCells(this.piece))) { this.lose(); return; }
      this.redraw();
    };

    if (fullRows.length > 0) this.time.delayedCall(TT_LOCK_FLASH_MS, applyAndContinue);
    else applyAndContinue();
  }

  playUpdate(time, delta) {
    if (!this.piece) { this.redraw(); return; } // mid-lock-flash (lockAndContinue) -- nothing to move

    const k = this.mgKeys;
    const dir = ((k.RIGHT.isDown || k.D.isDown) ? 1 : 0) - ((k.LEFT.isDown || k.A.isDown) ? 1 : 0);
    if (dir !== this.dasDir) {
      this.dasDir = dir;
      this.dasTimer = 0;
      if (dir !== 0) this.piece = movePiece(this.board, this.piece, dir, 0);
    } else if (dir !== 0) {
      this.dasTimer += delta;
      if (this.dasTimer >= TT_DAS_MS) {
        this.dasTimer = 0;
        this.piece = movePiece(this.board, this.piece, dir, 0);
      }
    }

    const softDrop = k.DOWN.isDown || k.S.isDown;
    this.dropTimer += delta * (softDrop ? 4 : 1);
    const interval = fallIntervalMs(this.linesCleared);
    if (this.dropTimer >= interval) {
      this.dropTimer = 0;
      const moved = movePiece(this.board, this.piece, 0, 1);
      if (moved === this.piece) this.lockAndContinue();
      else this.piece = moved;
    }

    this.redraw();
  }

  redraw() {
    const g = this.boardGfx.clear();
    for (let y = 0; y < TETRIS_ROWS; y++) {
      for (let x = 0; x < TETRIS_COLS; x++) {
        const cell = this.board[y][x];
        if (cell) this.drawCell(g, x, y, TT_COLOR_MAP[cell]);
      }
    }
    if (this.piece) {
      for (const [x, y] of absoluteCells(this.piece)) {
        if (y >= 0) this.drawCell(g, x, y, TT_COLOR_MAP[this.piece.color]);
      }
    }

    const fg = this.flashGfx.clear();
    if (this.flashRows.length) {
      fg.fillStyle(0xffffff, 0.85);
      for (const y of this.flashRows) fg.fillRect(TT_BOARD_X, TT_BOARD_Y + y * TT_CELL, TETRIS_COLS * TT_CELL, TT_CELL);
    }
  }

  drawCell(g, x, y, color) {
    this.drawShadedCell(g, TT_BOARD_X + x * TT_CELL, TT_BOARD_Y + y * TT_CELL, TT_CELL, color);
  }

  // A cell with a highlight face (top+left) and a shadow face (bottom+right) instead of a flat fill
  // (STYLE_GUIDE.md "Ramps, not flat fills") -- `size` lets the NEXT box preview reuse this at a
  // smaller cell size instead of duplicating the bevel logic.
  drawShadedCell(g, px, py, size, color) {
    const inset = 1;
    const bevel = Math.max(2, Math.round(size / 6));
    g.fillStyle(color, 1).fillRect(px + inset, py + inset, size - inset * 2, size - inset * 2);
    g.fillStyle(shadeColor(color, 0.3), 1);
    g.fillRect(px + inset, py + inset, size - inset * 2, bevel);
    g.fillRect(px + inset, py + inset, bevel, size - inset * 2);
    g.fillStyle(shadeColor(color, -0.3), 1);
    g.fillRect(px + inset, py + size - inset - bevel, size - inset * 2, bevel);
    g.fillRect(px + size - inset - bevel, py + inset, bevel, size - inset * 2);
    g.lineStyle(1, 0x1a1c2c, 1).strokeRect(px + inset, py + inset, size - inset * 2, size - inset * 2);
  }
}

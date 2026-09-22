// Room 195's key mini-game (docs/STORY.md): standard Tetris. Every rule (the board, the 7 pieces,
// rotation, line clears, the speed curve) lives in src/minigames/tetris-logic.js as pure functions --
// this file only renders that state as a grid of colored cells and forwards input to it.

const TT_CELL = 18;
const TT_BOARD_X = Math.round((GAME_WIDTH - TETRIS_COLS * TT_CELL) / 2);
const TT_BOARD_Y = 44;
const TT_DAS_MS = 130; // delay between auto-repeated left/right moves while a direction is held
const TT_COLOR_MAP = {
  cyan: 0x7fe0ff, yellow: 0xffd23f, purple: 0xb27fd6, green: 0x8fd46a,
  red: 0xff5a5a, blue: 0x3b7dd8, orange: 0xd9774f,
};

class TetrisScene extends MinigameBaseScene {
  constructor() {
    super('minigame-tetris');
  }

  buildScene() {
    const w = TETRIS_COLS * TT_CELL;
    const h = TETRIS_ROWS * TT_CELL;
    this.add.rectangle(TT_BOARD_X + w / 2, TT_BOARD_Y + h / 2, w + 4, h + 4, 0x000000, 0.35).setStrokeStyle(3, 0xeadbb8);
    this.boardGfx = this.add.graphics();

    // Rotate is a one-shot action (ERR-0001: a keydown event, never JustDown-polled); move/soft-drop
    // are held actions, read as isDown in playUpdate() below, the same as world.js's own movement.
    const rotate = (event) => { if (!event.repeat && this.mgState === 'playing') this.piece = rotatePiece(this.board, this.piece); };
    this.input.keyboard.on('keydown-UP', rotate);
    this.input.keyboard.on('keydown-W', rotate);
  }

  startAttempt() {
    this.board = createTetrisBoard();
    this.bag = randomBag();
    this.piece = spawnPiece(this.bag.shift());
    this.linesCleared = 0;
    this.dropTimer = 0;
    this.dasTimer = 0;
    this.dasDir = 0;
    this.redraw();
  }

  nextBagPiece() {
    if (this.bag.length === 0) this.bag = randomBag();
    return this.bag.shift();
  }

  lockAndContinue() {
    const { board, linesCleared } = lockPiece(this.board, this.piece);
    this.board = board;
    this.linesCleared += linesCleared;
    this.setScore(this.linesCleared);
    if (this.linesCleared >= this.def.scoreTarget) { this.win(); return; }
    this.piece = spawnPiece(this.nextBagPiece());
    if (!fitsBoard(this.board, absoluteCells(this.piece))) this.lose();
  }

  playUpdate(time, delta) {
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
    if (this.mgState === 'playing' && this.dropTimer >= interval) {
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
  }

  drawCell(g, x, y, color) {
    const px = TT_BOARD_X + x * TT_CELL;
    const py = TT_BOARD_Y + y * TT_CELL;
    g.fillStyle(color, 1).fillRect(px + 1, py + 1, TT_CELL - 2, TT_CELL - 2);
    g.lineStyle(1, 0x1a1c2c, 1).strokeRect(px + 1, py + 1, TT_CELL - 2, TT_CELL - 2);
  }
}

// Pure Tetris rules (docs/ROADMAP.md M4 "standard 7 pieces, rotation, line clears, increasing
// speed"): the board, the 7 tetrominoes, movement/rotation/collision, line clearing and the speed
// curve, with no Phaser anywhere -- src/minigames/tetris.js (the Phaser scene) only renders this
// state and forwards input to it. tests/unit/tetris-logic.test.js exercises every rule here directly.

const TETRIS_COLS = 10;
const TETRIS_ROWS = 20;

// Each piece is defined once, in its spawn orientation, as cells inside an NxN bounding box (N =
// the piece's own `size`) -- rotatePiece() below derives every other orientation by rotating that
// box 90 degrees, so no piece needs its 4 orientations hand-written out (a classic source of subtle
// Tetris bugs). This is a "simple rotation" system (no SRS wall-kick table) -- rotatePiece() below
// still nudges a piece sideways by a cell or two if the bare rotation doesn't fit, which is enough to
// rotate comfortably next to a wall without needing the full guideline kick table for a mini-game.
const TETRIS_PIECES = {
  I: { size: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]], color: 'cyan' },
  O: { size: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]], color: 'yellow' },
  T: { size: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]], color: 'purple' },
  S: { size: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]], color: 'green' },
  Z: { size: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]], color: 'red' },
  J: { size: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]], color: 'blue' },
  L: { size: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]], color: 'orange' },
};
const TETRIS_ORDER = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

function createTetrisBoard() {
  return Array.from({ length: TETRIS_ROWS }, () => Array(TETRIS_COLS).fill(null));
}

// A "7-bag" shuffle (the guideline's own randomizer, and what "standard 7 pieces" implies in
// practice): every piece appears exactly once before any repeats, so she's never starved of the
// piece she needs for several drops in a row the way pure random can. `rng` is injectable so the
// shuffle itself is deterministic and testable.
function randomBag(rng = Math.random) {
  const bag = [...TETRIS_ORDER];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function spawnPiece(type) {
  const def = TETRIS_PIECES[type];
  return {
    type,
    size: def.size,
    color: def.color,
    cells: def.cells.map((c) => [...c]),
    x: Math.floor((TETRIS_COLS - def.size) / 2),
    y: 0,
  };
}

// The piece's cells in board coordinates (piece.cells are box-local).
function absoluteCells(piece) {
  return piece.cells.map(([cx, cy]) => [piece.x + cx, piece.y + cy]);
}

// True if every one of `cells` is inside the board's walls/floor and (for any cell already on the
// board, y >= 0) not already occupied. Cells above the board (y < 0, the piece still spawning in)
// are allowed to overlap nothing since row -1/-2 etc. don't exist in `board`.
function fitsBoard(board, cells) {
  return cells.every(([x, y]) => x >= 0 && x < TETRIS_COLS && y < TETRIS_ROWS && (y < 0 || !board[y][x]));
}

// Returns a moved copy, or the *exact same* `piece` reference if the move doesn't fit -- callers
// (src/minigames/tetris.js) use `movePiece(...) === piece` to tell "that move was rejected" apart
// from "it moved, just check the new position", without a second boolean return value.
function movePiece(board, piece, dx, dy) {
  const moved = { ...piece, x: piece.x + dx, y: piece.y + dy };
  return fitsBoard(board, absoluteCells(moved)) ? moved : piece;
}

// Rotates the piece's box 90 degrees clockwise: (x, y) -> (size-1-y, x). O has no visible rotation
// (its own shape is already symmetric under this), so it's skipped as a small optimisation, not a
// special case the collision check needs. Tries the bare rotation first, then a couple of sideways
// nudges (a minimal kick, not full SRS -- see the file header) so rotating next to a wall or another
// piece isn't rejected outright when shifting over by one or two cells would make it fit.
function rotatePiece(board, piece) {
  if (piece.type === 'O') return piece;
  const rotatedCells = piece.cells.map(([x, y]) => [piece.size - 1 - y, x]);
  for (const kick of [0, -1, 1, -2, 2]) {
    const candidate = { ...piece, cells: rotatedCells, x: piece.x + kick };
    if (fitsBoard(board, absoluteCells(candidate))) return candidate;
  }
  return piece; // no orientation/kick fits -- rotation is simply rejected, same shape as before
}

// Locks the piece into the board, clears every full row, and shifts the rest down. Returns a new
// board (the input is never mutated, matching movePiece/rotatePiece's own copy-on-write style) and
// how many rows were cleared, which the caller (src/minigames/tetris.js) adds to the running score
// (docs/ROADMAP.md M4 "score target in lines or points" -- this game's target is lines).
function lockPiece(board, piece) {
  const next = board.map((row) => [...row]);
  for (const [x, y] of absoluteCells(piece)) {
    if (y >= 0 && y < TETRIS_ROWS && x >= 0 && x < TETRIS_COLS) next[y][x] = piece.color;
  }
  const kept = next.filter((row) => row.some((cell) => !cell));
  const linesCleared = TETRIS_ROWS - kept.length;
  while (kept.length < TETRIS_ROWS) kept.unshift(Array(TETRIS_COLS).fill(null));
  return { board: kept, linesCleared };
}

// The fall interval (ms between automatic one-row drops), given how many lines have been cleared so
// far this attempt: "increasing speed" (docs/ROADMAP.md M4), a little faster every 3 lines, capped so
// it never becomes literally unplayable even after a long run.
function fallIntervalMs(linesCleared) {
  const level = Math.floor(linesCleared / 3);
  return Math.max(120, 700 - level * 60);
}

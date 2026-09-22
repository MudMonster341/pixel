// Pure Tetris rules (src/minigames/tetris-logic.js, docs/ROADMAP.md M4): board/piece shape, movement,
// rotation, line clearing and the speed curve, with no Phaser or browser involved.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGameData } = require('../helpers/game-data');

test('createTetrisBoard: a 20x10 grid, every cell empty', () => {
  const { createTetrisBoard, TETRIS_ROWS, TETRIS_COLS } = loadGameData();
  const board = createTetrisBoard();
  assert.equal(board.length, TETRIS_ROWS);
  for (const row of board) {
    assert.equal(row.length, TETRIS_COLS);
    assert.ok(row.every((cell) => cell === null));
  }
});

test('randomBag: a permutation of all 7 pieces, no repeats, deterministic with an injected rng', () => {
  const { randomBag, TETRIS_ORDER } = loadGameData();
  const bag = randomBag(() => 0.5);
  assert.equal(bag.length, 7);
  assert.deepEqual([...bag].sort(), [...TETRIS_ORDER].sort());
  assert.deepEqual(randomBag(() => 0.5), bag, 'the same rng sequence always gives the same bag');
});

test('spawnPiece: centered horizontally by the piece\'s own bounding-box size, at the top row', () => {
  const { spawnPiece, TETRIS_COLS } = loadGameData();
  const i = spawnPiece('I'); // size 4
  assert.equal(i.x, Math.floor((TETRIS_COLS - 4) / 2));
  assert.equal(i.y, 0);
  const o = spawnPiece('O'); // size 2
  assert.equal(o.x, Math.floor((TETRIS_COLS - 2) / 2));
  const t = spawnPiece('T'); // size 3
  assert.equal(t.x, Math.floor((TETRIS_COLS - 3) / 2));
});

test('fitsBoard: rejects out-of-bounds and occupied cells, allows above the board (spawning in)', () => {
  const { createTetrisBoard, fitsBoard } = loadGameData();
  const board = createTetrisBoard();
  board[5][3] = 'red';
  assert.equal(fitsBoard(board, [[3, 5]]), false, 'occupied cell');
  assert.equal(fitsBoard(board, [[-1, 5]]), false, 'off the left wall');
  assert.equal(fitsBoard(board, [[10, 5]]), false, 'off the right wall');
  assert.equal(fitsBoard(board, [[3, 20]]), false, 'through the floor');
  assert.equal(fitsBoard(board, [[3, -1]]), true, 'above the board is fine (still spawning in)');
  assert.equal(fitsBoard(board, [[4, 5]]), true, 'an empty cell fits');
});

test('movePiece: moves when it fits, and returns the *same reference* unchanged when it does not', () => {
  const { createTetrisBoard, spawnPiece, movePiece, TETRIS_COLS } = loadGameData();
  const board = createTetrisBoard();
  const o = spawnPiece('O');

  const moved = movePiece(board, o, 1, 0);
  assert.equal(moved.x, o.x + 1);
  assert.notEqual(moved, o, 'a successful move returns a new object');

  // Walk it all the way to the right wall, then try one more step off the edge.
  let piece = o;
  while (movePiece(board, piece, 1, 0) !== piece) piece = movePiece(board, piece, 1, 0);
  assert.equal(piece.x, TETRIS_COLS - piece.size);
  const blocked = movePiece(board, piece, 1, 0);
  assert.equal(blocked, piece, 'a rejected move returns the exact same piece reference');
});

test('rotatePiece: the I piece rotates from a horizontal bar to a vertical one', () => {
  const { createTetrisBoard, spawnPiece, rotatePiece, absoluteCells } = loadGameData();
  const board = createTetrisBoard();
  const i = spawnPiece('I');
  const before = absoluteCells(i).sort((a, b) => a[0] - b[0]);
  const widthBefore = new Set(before.map(([x]) => x)).size;
  const heightBefore = new Set(before.map(([, y]) => y)).size;
  assert.equal(widthBefore, 4, 'spawns horizontal: 4 distinct x values');
  assert.equal(heightBefore, 1);

  const rotated = rotatePiece(board, i);
  const after = absoluteCells(rotated);
  const widthAfter = new Set(after.map(([x]) => x)).size;
  const heightAfter = new Set(after.map(([, y]) => y)).size;
  assert.equal(widthAfter, 1, 'now vertical: 1 distinct x value');
  assert.equal(heightAfter, 4);
});

test('rotatePiece: the O piece is visually unchanged by rotation', () => {
  const { createTetrisBoard, spawnPiece, rotatePiece, absoluteCells } = loadGameData();
  const board = createTetrisBoard();
  const o = spawnPiece('O');
  const before = new Set(absoluteCells(o).map(([x, y]) => `${x},${y}`));
  const rotated = rotatePiece(board, o);
  const after = new Set(absoluteCells(rotated).map(([x, y]) => `${x},${y}`));
  assert.deepEqual([...after].sort(), [...before].sort());
});

test('rotatePiece: nudges sideways to fit next to a wall', () => {
  const { createTetrisBoard, spawnPiece, movePiece, rotatePiece, absoluteCells, fitsBoard } = loadGameData();
  const board = createTetrisBoard();
  let i = spawnPiece('I'); // horizontal, 4 wide
  while (movePiece(board, i, -1, 0) !== i) i = movePiece(board, i, -1, 0); // pinned to the left wall
  const rotated = rotatePiece(board, i);
  assert.ok(fitsBoard(board, absoluteCells(rotated)), 'rotating against the wall still finds a fitting kick');
});

test('rotatePiece: gives up (returns the exact same piece) if literally no orientation fits anywhere', () => {
  const { createTetrisBoard, spawnPiece, absoluteCells, rotatePiece } = loadGameData();
  const piece = spawnPiece('T');
  // Solid-fill the whole board except the piece's own current cells -- whichever of the 5 candidate
  // kick offsets rotatePiece tries, the rotated T shape (a different set of cells for every offset)
  // has nowhere left to land.
  const board = createTetrisBoard();
  const own = new Set(absoluteCells(piece).map(([x, y]) => `${x},${y}`));
  for (let y = 0; y < board.length; y++) {
    for (let x = 0; x < board[y].length; x++) {
      if (!own.has(`${x},${y}`)) board[y][x] = 'red';
    }
  }
  assert.equal(rotatePiece(board, piece), piece);
});

test('lockPiece: fills the board, clears every full row, and shifts the rest down', () => {
  const { createTetrisBoard, spawnPiece, lockPiece, TETRIS_COLS, TETRIS_ROWS } = loadGameData();
  const board = createTetrisBoard();
  // Fill the bottom row except the last column, and drop a marker in the row above so we can prove
  // it shifted down into the cleared row's place, not just vanished.
  for (let x = 0; x < TETRIS_COLS - 1; x++) board[TETRIS_ROWS - 1][x] = 'red';
  board[TETRIS_ROWS - 2][0] = 'marker';

  // A single-cell "piece" filling the last column of the bottom row.
  const piece = { type: 'I', size: 1, color: 'cyan', cells: [[0, 0]], x: TETRIS_COLS - 1, y: TETRIS_ROWS - 1 };
  const { board: after, linesCleared } = lockPiece(board, piece);

  assert.equal(linesCleared, 1);
  assert.equal(after.length, TETRIS_ROWS);
  assert.ok(after[0].every((cell) => cell === null), 'a fresh empty row appears at the top');
  assert.equal(after[TETRIS_ROWS - 1][0], 'marker', 'the row above the cleared one shifted down into its place');
});

test('lockPiece: does not mutate the board it was given (movePiece/rotatePiece style copy-on-write)', () => {
  const { createTetrisBoard, spawnPiece, lockPiece } = loadGameData();
  const board = createTetrisBoard();
  const piece = spawnPiece('O');
  const snapshot = JSON.stringify(board);
  lockPiece(board, piece);
  assert.equal(JSON.stringify(board), snapshot);
});

test('fallIntervalMs: gets faster (never below the floor) as more lines clear', () => {
  const { fallIntervalMs } = loadGameData();
  const early = fallIntervalMs(0);
  const mid = fallIntervalMs(9);
  const late = fallIntervalMs(90);
  assert.ok(mid < early);
  assert.ok(late < mid);
  assert.ok(late >= 120, 'never drops below the playable floor');
});

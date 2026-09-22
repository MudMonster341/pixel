// Pure platformer "feel" helpers (src/minigames/platformer-physics.js, docs/ROADMAP.md M4 "real
// platforming feel: gravity, coyote time, variable jump height"), with no Phaser/Arcade Physics
// involved -- these are exactly the rules Arcade doesn't give for free.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGameData } = require('../helpers/game-data');

test('integrateGravity: adds gravity * dt to the current vertical velocity', () => {
  const { integrateGravity } = loadGameData();
  assert.equal(integrateGravity(0, 0.1, 1000), 100);
  assert.equal(integrateGravity(-50, 0.1, 1000), 50);
});

test('canCoyoteJump: true right up to the coyote window, false just past it', () => {
  const { canCoyoteJump } = loadGameData();
  assert.equal(canCoyoteJump(0, 110), true, 'still grounded');
  assert.equal(canCoyoteJump(110, 110), true, 'exactly at the edge of the window');
  assert.equal(canCoyoteJump(111, 110), false, 'one ms past the window');
  assert.equal(canCoyoteJump(500, 110), false, 'long since airborne');
});

test('shouldBufferedJumpFire: a jump pressed shortly before landing still counts', () => {
  const { shouldBufferedJumpFire } = loadGameData();
  assert.equal(shouldBufferedJumpFire(0, 110), true, 'pressed this instant');
  assert.equal(shouldBufferedJumpFire(110, 110), true);
  assert.equal(shouldBufferedJumpFire(200, 110), false, 'pressed too long ago, buffer expired');
});

test('clipJumpRelease: caps a fast upward velocity to the short-hop speed on early release', () => {
  const { clipJumpRelease } = loadGameData();
  assert.equal(clipJumpRelease(-420, -180), -180, 'releasing early during a full-speed rise clips it');
  assert.equal(clipJumpRelease(-100, -180), -100, 'already slower than the cap: left alone, never sped up');
  assert.equal(clipJumpRelease(-180, -180), -180, 'exactly at the cap: unchanged');
  assert.equal(clipJumpRelease(50, -180), 50, 'already falling: nothing to clip');
});

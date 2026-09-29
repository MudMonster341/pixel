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

// Mini-games quality pass (rated 4/10, "the hero is a speck"): she now draws HERO_SCALE-d (3x,
// framework-scene.js) via a plain sprite scale, and these physics constants were retuned to match --
// not just left alone, since the *old* numbers already had a latent design bug (some platform jumps
// were physically unreachable) a same-scale sprite change alone wouldn't have fixed. This test pins
// the real numbers src/minigames/platformer-physics.js exports and proves the level in
// src/minigames/platformer.js (PF_PLATFORMS' own elevation offsets and gaps, duplicated here as plain
// numbers since that file needs a real Phaser scene and can't load into this sandbox) stays reachable
// with real margin -- so a future edit to either file that breaks the relationship fails here, not in
// a playtest.
test('the retuned mini-game-scale constants stay fair', () => {
  const {
    PLATFORMER_GRAVITY, PLATFORMER_JUMP_VELOCITY, PLATFORMER_MIN_JUMP_VELOCITY,
    PLATFORMER_RUN_SPEED, PLATFORMER_COYOTE_MS, PLATFORMER_JUMP_BUFFER_MS,
  } = loadGameData();

  assert.equal(PLATFORMER_GRAVITY, 1650);
  assert.equal(PLATFORMER_JUMP_VELOCITY, -600);
  assert.equal(PLATFORMER_MIN_JUMP_VELOCITY, -255);
  assert.equal(PLATFORMER_RUN_SPEED, 165);
  // Coyote time / jump buffer are unchanged by the rescale (ms windows, not distances) -- GAME_FEEL.md
  // "the mini-game hero" pass explicitly asked to "keep coyote time/jump buffer".
  assert.equal(PLATFORMER_COYOTE_MS, 110);
  assert.equal(PLATFORMER_JUMP_BUFFER_MS, 110);

  const apex = (PLATFORMER_JUMP_VELOCITY * PLATFORMER_JUMP_VELOCITY) / (2 * PLATFORMER_GRAVITY);
  const airtime = (2 * -PLATFORMER_JUMP_VELOCITY) / PLATFORMER_GRAVITY;
  const maxJumpDistance = airtime * PLATFORMER_RUN_SPEED;

  // PF_PLATFORMS' own elevation offsets (src/minigames/platformer.js): 54 and 78 world px above
  // PF_GROUND_Y. Both must stay under the jump's own apex height, with real margin for a player who
  // isn't pixel-perfect on the run-up.
  const elevations = [54, 78];
  for (const rise of elevations) assert.ok(apex > rise * 1.2, `apex ${apex} too tight against a ${rise}px platform rise`);

  // The level's own horizontal gaps (platform end to next platform start, computed from PF_PLATFORMS):
  // 84, 84, 72, 90, 90 world px. All must stay under the max distance a full jump covers, same margin.
  const gaps = [84, 84, 72, 90, 90];
  for (const gap of gaps) assert.ok(maxJumpDistance > gap * 1.2, `max jump distance ${maxJumpDistance} too tight against a ${gap}px gap`);
});

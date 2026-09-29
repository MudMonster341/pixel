// Pure flappy-flyer rules (src/minigames/flappy-logic.js, docs/ROADMAP.md M4): gravity/flap
// integration and collision against a pipe's gap, with no Phaser or browser involved.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGameData } = require('../helpers/game-data');

test('flappyStep: semi-implicit Euler -- velocity updates first, then position uses the new velocity', () => {
  const { flappyStep } = loadGameData();
  const gravity = 1000;
  const dt = 0.1;
  const { vy, y } = flappyStep(0, 100, dt, gravity);
  const expectedVy = 0 + gravity * dt; // 100
  assert.equal(vy, expectedVy);
  assert.equal(y, 100 + expectedVy * dt); // uses the *new* vy, not the old one
});

test('flappyFlap: a constant upward (negative) impulse', () => {
  const { flappyFlap } = loadGameData();
  assert.ok(flappyFlap() < 0);
  assert.equal(flappyFlap(), flappyFlap());
});

test('flappyHitsPipe: no collision while horizontally clear of the pipe, regardless of height', () => {
  const { flappyHitsPipe } = loadGameData();
  const pipe = { x: 200, width: 50, gapY: 100, gapHeight: 120 };
  assert.equal(flappyHitsPipe(100, 0, 8, pipe), false, 'well before the pipe');
  assert.equal(flappyHitsPipe(100, 1000, 8, pipe), false, 'even far off-screen vertically');
  assert.equal(flappyHitsPipe(400, 0, 8, pipe), false, 'well past the pipe');
});

test('flappyHitsPipe: inside the gap is safe, above/below the gap (while overlapping horizontally) hits', () => {
  const { flappyHitsPipe } = loadGameData();
  const pipe = { x: 200, width: 50, gapY: 100, gapHeight: 120 }; // gap spans y in [100, 220]
  const midX = 220; // inside the pipe's horizontal span
  assert.equal(flappyHitsPipe(midX, 160, 8, pipe), false, 'safely centered in the gap');
  assert.equal(flappyHitsPipe(midX, 90, 8, pipe), true, 'above the gap top');
  assert.equal(flappyHitsPipe(midX, 230, 8, pipe), true, 'below the gap bottom');
  // Right at the edge: a radius that just clips the boundary counts as a hit, not a near miss.
  assert.equal(flappyHitsPipe(midX, 100 + 8 - 1, 8, pipe), true, 'grazing the gap top edge');
});

test('flappyHitsGround / flappyHitsCeiling: simple boundary checks', () => {
  const { flappyHitsGround, flappyHitsCeiling } = loadGameData();
  assert.equal(flappyHitsGround(495, 8, 500), true, 'the radius already reaches the ground');
  assert.equal(flappyHitsGround(480, 8, 500), false, 'still clear of the ground');
  assert.equal(flappyHitsCeiling(5, 8), true);
  assert.equal(flappyHitsCeiling(20, 8), false);
});

test('flappyPassedPipe: true only once the pipe\'s trailing edge has scrolled behind the bird, and only once', () => {
  const { flappyPassedPipe } = loadGameData();
  const birdX = 220;
  const pipe = { x: 200, width: 50, scored: false }; // right edge at 250, still ahead of the bird
  assert.equal(flappyPassedPipe(pipe, birdX), false);
  pipe.x = 150; // right edge now at 200, behind the bird
  assert.equal(flappyPassedPipe(pipe, birdX), true);
  pipe.scored = true; // caller marks it scored the moment it passes
  assert.equal(flappyPassedPipe(pipe, birdX), false, 'never scores the same pipe twice');
});

// Mini-games quality pass (rated 4/10, "the hero is a speck"): she now draws HERO_SCALE-d (3x,
// framework-scene.js) via a plain sprite scale, and FLAPPY_BIRD_RADIUS scales with her (8 -> 24) so
// her collision footprint matches her new, bigger silhouette. Gravity/flap velocity/gap height were
// all authored at a smaller "compact" scale first, then uniformly multiplied by 3 (platformer.js's
// own file header explains why that preserves every fairness ratio), rather than left at the old
// numbers, which were tuned for a radius-8 bird and would have been a real difficulty regression
// squeezed against a radius-24 one. This pins the real exported numbers and checks the flap's own rise
// height stays a sensible fraction of src/minigames/flappy.js's own FL_GAP_HEIGHT (duplicated here as
// a plain number, same reasoning as platformer-physics.test.js's own version of this check --
// flappy.js needs a real Phaser scene and can't load into this sandbox).
test('the retuned mini-game-scale constants stay fair', () => {
  const { FLAPPY_GRAVITY, FLAPPY_FLAP_VELOCITY, FLAPPY_BIRD_RADIUS } = loadGameData();

  assert.equal(FLAPPY_GRAVITY, 1440);
  assert.equal(FLAPPY_FLAP_VELOCITY, -450);
  assert.equal(FLAPPY_BIRD_RADIUS, 24, 'scales with HERO_SCALE, same as the sprite');

  const riseHeight = (FLAPPY_FLAP_VELOCITY * FLAPPY_FLAP_VELOCITY) / (2 * FLAPPY_GRAVITY);
  const FL_GAP_HEIGHT = 240; // src/minigames/flappy.js
  // A single flap's rise should read as a controlled hop, not fill most of the gap -- comfortably
  // under half of it, with room either side for the bird's own radius and a margin of error.
  assert.ok(riseHeight < FL_GAP_HEIGHT * 0.4, `flap rise ${riseHeight} too tall for a 240px gap`);
  assert.ok(riseHeight > FLAPPY_BIRD_RADIUS * 2, `flap rise ${riseHeight} too small to clear her own body`);
});

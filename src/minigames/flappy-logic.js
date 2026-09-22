// Pure flappy-flyer rules (docs/ROADMAP.md M4 "flappy-bird style flyer... score = gaps passed"):
// gravity/flap integration and collision against a pipe's gap, with no Phaser here -- src/minigames/
// flappy.js (the Phaser scene) only renders these numbers and forwards the flap key to flappyFlap().
// tests/unit/flappy-logic.test.js exercises every rule here directly.

const FLAPPY_GRAVITY = 900; // px/s^2
const FLAPPY_FLAP_VELOCITY = -260; // px/s, upward (screen y grows downward, so "up" is negative)
const FLAPPY_BIRD_RADIUS = 8;

// One physics tick, plain semi-implicit Euler (velocity updates first, then position uses the new
// velocity) -- the standard, stable way to integrate a constant-gravity faller frame by frame.
function flappyStep(vy, y, dt, gravity = FLAPPY_GRAVITY) {
  const newVy = vy + gravity * dt;
  const newY = y + newVy * dt;
  return { vy: newVy, y: newY };
}

function flappyFlap() {
  return FLAPPY_FLAP_VELOCITY;
}

// A pipe/server-rack obstacle: { x, width, gapY, gapHeight } -- gapY is the gap's top edge, in world
// pixels, same axis as the bird's y. Collision is a simple circle-vs-two-rectangles test: no overlap
// at all if the bird is horizontally clear of the pipe; otherwise she must be fully inside the gap.
function flappyHitsPipe(birdX, birdY, radius, pipe) {
  const left = pipe.x;
  const right = pipe.x + pipe.width;
  if (birdX + radius < left || birdX - radius > right) return false;
  const gapTop = pipe.gapY;
  const gapBottom = pipe.gapY + pipe.gapHeight;
  return birdY - radius < gapTop || birdY + radius > gapBottom;
}

function flappyHitsGround(birdY, radius, groundY) {
  return birdY + radius >= groundY;
}

function flappyHitsCeiling(birdY, radius) {
  return birdY - radius <= 0;
}

// Has the bird just cleared this pipe (its own scoring edge, only once)? The bird never moves
// horizontally in this style -- the obstacles scroll past a fixed birdX instead -- so "passed" is
// simply the pipe's trailing edge having scrolled behind her, checked once per pipe via its own
// `scored` flag (set by the caller, src/minigames/flappy.js, the moment this returns true).
function flappyPassedPipe(pipe, birdX) {
  return !pipe.scored && pipe.x + pipe.width < birdX;
}

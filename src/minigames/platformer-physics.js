// Pure platformer "feel" helpers (docs/ROADMAP.md M4 "real platforming feel: gravity, coyote time,
// variable jump height"). src/minigames/platformer.js uses Arcade Physics for gravity integration
// and collision (no point reimplementing what Phaser already does well), but Arcade doesn't know
// about coyote time, jump buffering or a tap-vs-hold jump on its own -- those three rules live here,
// as plain functions with no Phaser dependency, so tests/unit/platformer-physics.test.js can check
// them without a browser or a physics world.

const PLATFORMER_GRAVITY = 1400; // px/s^2 (Arcade's own world gravity is set to this)
const PLATFORMER_JUMP_VELOCITY = -420; // px/s upward, a full held jump
const PLATFORMER_MIN_JUMP_VELOCITY = -180; // px/s upward, a tapped (short) jump
const PLATFORMER_COYOTE_MS = 110; // still counts as "grounded enough to jump" this long after leaving a platform
const PLATFORMER_JUMP_BUFFER_MS = 110; // a jump pressed this early before landing still fires the instant she lands
const PLATFORMER_RUN_SPEED = 140; // px/s

// Plain gravity integration (kept here mainly so the constant and the formula live in one place, and
// so a scene that *isn't* using Arcade Physics for some reason still has a correct step to call).
function integrateGravity(vy, dt, gravity = PLATFORMER_GRAVITY) {
  return vy + gravity * dt;
}

// Coyote time: a jump pressed shortly after walking off a ledge (not pressed while still grounded --
// that's just an ordinary jump) still counts as valid, the small forgiveness every good platformer
// gives so falling off a platform's edge by a pixel doesn't feel like an unfair missed jump.
function canCoyoteJump(msSinceGrounded, coyoteMs = PLATFORMER_COYOTE_MS) {
  return msSinceGrounded <= coyoteMs;
}

// Jump buffering: a jump pressed slightly *before* landing (already falling onto the next platform)
// still fires the instant she touches down, instead of being silently dropped because she technically
// wasn't grounded yet the frame the key was pressed.
function shouldBufferedJumpFire(msSincePressed, jumpBufferMs = PLATFORMER_JUMP_BUFFER_MS) {
  return msSincePressed <= jumpBufferMs;
}

// Variable jump height (Mario-style): releasing the jump key early while still rising clips the
// upward velocity down to the short-hop speed, so a tap is a small hop and a held press is the full
// jump. Only ever *caps* the speed -- if she's already rising slower than that (near the apex, say),
// releasing the key does nothing, since clipping "up" to a faster speed would be a floaty exploit,
// not forgiveness.
function clipJumpRelease(vy, minJumpVelocity = PLATFORMER_MIN_JUMP_VELOCITY) {
  return vy < minJumpVelocity ? minJumpVelocity : vy;
}

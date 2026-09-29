// Pure platformer "feel" helpers (docs/ROADMAP.md M4 "real platforming feel: gravity, coyote time,
// variable jump height"). src/minigames/platformer.js uses Arcade Physics for gravity integration
// and collision (no point reimplementing what Phaser already does well), but Arcade doesn't know
// about coyote time, jump buffering or a tap-vs-hold jump on its own -- those three rules live here,
// as plain functions with no Phaser dependency, so tests/unit/platformer-physics.test.js can check
// them without a browser or a physics world.

// Quality loop fix (Mini-games category, "the hero is a speck"): she now draws HERO_SCALE-d (3x,
// framework-scene.js) instead of at native size, so these constants needed retuning too, not just a
// bigger sprite -- the *old* numbers already had a latent design bug (a max jump apex of 63 old-scale
// world px against platforms 70-100px up -- literally unreachable) that a same-scale sprite change
// alone wouldn't have fixed. Authored at a smaller "compact" scale first (a 320x180-equivalent
// viewport, matching HERO_SCALE's own 3x) and then uniformly multiplied by 3 -- see platformer.js's
// own file header for why uniform scaling preserves every reachability ratio unchanged. Tuned so that:
//   - apex height stays comfortably above the highest platform in src/minigames/platformer.js's
//     PF_PLATFORMS (max elevation 78 world px) -- apex = v^2/(2g) = 600^2/(2*1650) = ~109.
//   - max horizontal jump distance stays comfortably above the widest gap in that same level (90 world
//     px) -- full-airtime distance = (2 * 600/1650) * 165 = ~120.
// tests/unit/platformer-physics.test.js "the retuned mini-game-scale constants stay fair" checks both
// margins directly, so a future level edit that breaks reachability fails a unit test, not a playtest.
const PLATFORMER_GRAVITY = 1650; // px/s^2 (Arcade's own world gravity is set to this)
const PLATFORMER_JUMP_VELOCITY = -600; // px/s upward, a full held jump
const PLATFORMER_MIN_JUMP_VELOCITY = -255; // px/s upward, a tapped (short) jump
const PLATFORMER_COYOTE_MS = 110; // unchanged -- a time window, not a distance, needs no rescaling
const PLATFORMER_JUMP_BUFFER_MS = 110; // unchanged, same reasoning
const PLATFORMER_RUN_SPEED = 165; // px/s

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

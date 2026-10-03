// Campus animals (decisions/0018): cats and birds only. Content and pure behaviour logic, no Phaser --
// src/scenes/world.js createAnimals()/updateAnimals() is the only code that draws them; this file says
// what exists, where, and how an animal decides what to do (so it is unit-tested without a browser).
// Loaded before src/maps.js (index.html, tests/helpers/game-data.js).
//
// Art: tools/make-animals.js bakes the owner's Animals Asset Pack cat, Zeenaz's CC0 cat and the [LPC]
// Birds into assets/animal-*.png (credits in CREDITS.md). Their frame layouts are ANIMAL_LAYOUTS below.
//
// Units: positions are tile coordinates as floats (tile n spans n..n+1, so a tile centre is n + 0.5);
// speeds are tiles/second; times are milliseconds. Animals have no collision, are never indoors, and
// are hidden (like ambient students) while a script owns the screen.

// ---------- sprite layouts ----------
// `anims`: name -> { frames: [frame indices], fps, yoyo? } (every animation loops).
const ANIMAL_LAYOUTS = {
  // The owner's chibi cat (4 directions). 6 columns x 5 rows: sit (row 0), walk down/up/left/right.
  cat4: {
    frameW: 16, frameH: 16, footY: 15, cols: 6, rows: 5,
    anims: {
      sit: { frames: [0, 1, 2, 3], fps: 3, yoyo: true },
      'idle-down': { frames: [6], fps: 1 },
      'idle-up': { frames: [12], fps: 1 },
      'idle-left': { frames: [18], fps: 1 },
      'idle-right': { frames: [24], fps: 1 },
      'walk-down': { frames: [6, 7, 8, 9, 10, 11], fps: 8 },
      'walk-up': { frames: [12, 13, 14, 15, 16, 17], fps: 8 },
      'walk-left': { frames: [18, 19, 20, 21, 22, 23], fps: 8 },
      'walk-right': { frames: [24, 25, 26, 27, 28, 29], fps: 8 },
    },
  },
  // Zeenaz's side-view cat. 8 columns x 6 rows, one animation per row; faces LEFT (flip for right).
  'cat-side': {
    frameW: 16, frameH: 16, footY: 15, cols: 8, rows: 6, facesLeft: true,
    anims: {
      sit: { frames: [0, 1, 2, 3], fps: 3, yoyo: true },
      stand: { frames: [8, 9, 10, 11, 12, 13, 14, 15], fps: 5 },
      sleep: { frames: [16, 17, 18, 19, 20, 21, 22, 23], fps: 2, yoyo: true },
      walk: { frames: [24, 25, 26, 27, 28], fps: 8 },
      scared: { frames: [32, 33, 34], fps: 6 },
      panic: { frames: [40, 41, 42, 43], fps: 8 },
    },
  },
  // [LPC] Birds (3/4 view). 3 columns x 8 rows: fly left/up/down/right, then walk left/up/down/right.
  bird: {
    frameW: 32, frameH: 32, footY: 25, cols: 3, rows: 8,
    anims: {
      'fly-left': { frames: [0, 1, 2], fps: 10 },
      'fly-up': { frames: [3, 4, 5], fps: 10 },
      'fly-down': { frames: [6, 7, 8], fps: 10 },
      'fly-right': { frames: [9, 10, 11], fps: 10 },
      'walk-left': { frames: [12, 13, 14], fps: 6 },
      'walk-up': { frames: [15, 16, 17], fps: 6 },
      'walk-down': { frames: [18, 19, 20], fps: 6 },
      'walk-right': { frames: [21, 22, 23], fps: 6 },
      'idle-left': { frames: [12], fps: 1 },
      'idle-up': { frames: [15], fps: 1 },
      'idle-down': { frames: [18], fps: 1 },
      'idle-right': { frames: [21], fps: 1 },
    },
  },
};

// species -> { kind: 'cat' | 'bird', layout, sheet }. `sheet` is both the Phaser texture key and the
// file name (assets/<sheet>.png, written by tools/make-animals.js).
const ANIMAL_SPECIES = {
  'cat-orange': { kind: 'cat', layout: 'cat4', sheet: 'animal-cat-orange' },
  'cat-charcoal': { kind: 'cat', layout: 'cat4', sheet: 'animal-cat-charcoal' },
  'catside-ginger': { kind: 'cat', layout: 'cat-side', sheet: 'animal-catside-ginger' },
  'catside-silver': { kind: 'cat', layout: 'cat-side', sheet: 'animal-catside-silver' },
  sparrow: { kind: 'bird', layout: 'bird', sheet: 'animal-bird-sparrow' },
  pigeon: { kind: 'bird', layout: 'bird', sheet: 'animal-bird-pigeon' },
  crow: { kind: 'bird', layout: 'bird', sheet: 'animal-bird-crow' },
};

// ---------- content ----------
// { id, species, x, y, behaviour, facing?, talk? } per map. x,y = the home tile (walkable, away from
// doors and key stations; tests/unit/animals.test.js checks it against the real map).
//   behaviour (cats): 'sit' | 'sleep' ('sleep' only for the side-view cats) -- how it rests between
//                     short wanders; (birds): 'hop' -- walks/hops a little around its tile.
//   talk: true   -- E gives a soft "Meow." and a heart (a tame cat: it turns to her, never runs off).
const ANIMAL_CAP_PER_MAP = 8;
const ANIMAL_TALK_LINES = ['Meow.'];

const ANIMALS = {
  campus: [
    // Cats: by the Gate 2 booth, in the library courtyard, between two hostel blocks, by the parking.
    { id: 'campus-cat-gate', species: 'cat-orange', x: 249, y: 154, behaviour: 'sit', facing: 'down', talk: true },
    { id: 'campus-cat-library', species: 'catside-ginger', x: 233, y: 105, behaviour: 'sleep', facing: 'left' },
    { id: 'campus-cat-hostel', species: 'cat-charcoal', x: 113, y: 67, behaviour: 'sit', facing: 'down', talk: true },
    { id: 'campus-cat-parking', species: 'catside-silver', x: 140, y: 119, behaviour: 'sit', facing: 'right' },
    // Birds: pigeons on the forecourt plaza, a sparrow on the central lawn, a crow near the hostels.
    { id: 'campus-bird-plaza-1', species: 'pigeon', x: 232, y: 133, behaviour: 'hop', facing: 'left' },
    { id: 'campus-bird-plaza-2', species: 'pigeon', x: 236, y: 139, behaviour: 'hop', facing: 'down' },
    { id: 'campus-bird-lawn', species: 'sparrow', x: 183, y: 92, behaviour: 'hop', facing: 'right' },
    { id: 'campus-bird-hostel', species: 'crow', x: 150, y: 68, behaviour: 'hop', facing: 'left' },
  ],
};

// ---------- behaviour rules (tunable data) ----------
const ANIMAL_RULES = {
  cat: {
    noticeTiles: 3, // turns toward her within this
    fleeTiles: 1.5, // a shy cat runs off when she gets this close
    releaseTiles: 3.6, // an alert cat relaxes again beyond this
    fleeRunTiles: 4, // how far a startled cat runs
    wanderTiles: 3, // how far from home a wander goes
    walkSpeed: 1.1,
    runSpeed: 5,
    startleMs: 350,
    restMs: [4000, 9000],
    awayRestMs: [3500, 6000], // how long a cat that ran off waits before strolling home
    wanderChance: 0.55,
  },
  bird: {
    takeoffTiles: 2.5, // flies off when she gets this close
    flyAwayTiles: 10,
    flySpeed: 6,
    walkSpeed: 1,
    hopTiles: 1.5, // how far from home a hop goes
    hopMs: [700, 2200],
    goneMs: [7000, 14000], // out of sight before it comes back
    returnFromTiles: 7, // it reappears this far from home, flying in
    returnClearTiles: 5, // ...but only while she is farther than this from home
    liftPx: 14, // flying height
    liftPxPerSec: 40,
  },
};

// ---------- pure behaviour logic ----------

const animalRandRange = (range, rng) => range[0] + rng() * (range[1] - range[0]);

// 'ignore' | 'notice' | 'flee' (cats) | 'takeoff' (birds), from her distance in tiles. A tame cat
// (talkable) notices her but never runs.
function animalReaction(kind, distTiles, tame) {
  if (kind === 'bird') return distTiles <= ANIMAL_RULES.bird.takeoffTiles ? 'takeoff' : 'ignore';
  const rule = ANIMAL_RULES.cat;
  if (!tame && distTiles <= rule.fleeTiles) return 'flee';
  if (distTiles <= rule.noticeTiles) return 'notice';
  return 'ignore';
}

// 'left' | 'right' | 'up' | 'down' for a movement vector.
function animalFacing(dx, dy) {
  return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
}

// Every sampled point on the straight line a -> b is a walkable tile (`isWalkable(tx, ty)`, tile ints).
function animalLineWalkable(ax, ay, bx, by, isWalkable) {
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 4));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (!isWalkable(Math.floor(ax + (bx - ax) * t), Math.floor(ay + (by - ay) * t))) return false;
  }
  return true;
}

// Where a startled cat runs: straight away from her, up to `tiles` tiles, trying a few angles and
// shortening the run until the whole line is walkable. null if every attempt is blocked.
function animalFleePoint(from, player, tiles, isWalkable) {
  let dx = from.x - player.x;
  let dy = from.y - player.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  if (dx === 0 && dy === 0) dx = 1;
  for (const turn of [0, 0.7, -0.7, 1.4, -1.4]) {
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    const ux = dx * cos - dy * sin;
    const uy = dx * sin + dy * cos;
    for (let d = tiles; d >= 1; d -= 0.5) {
      const x = from.x + ux * d;
      const y = from.y + uy * d;
      if (isWalkable(Math.floor(x), Math.floor(y)) && animalLineWalkable(from.x, from.y, x, y, isWalkable)) return { x, y };
    }
  }
  return null;
}

// A short stroll from home (cats) or a hop (birds): a random walkable point within `radius` tiles of
// the animal's home. null after a handful of failed tries.
function animalWanderPoint(home, radius, rng, isWalkable) {
  for (let i = 0; i < 8; i++) {
    const angle = rng() * Math.PI * 2;
    const d = 1 + rng() * Math.max(0, radius - 1);
    const x = Math.floor(home.x + Math.cos(angle) * d) + 0.5;
    const y = Math.floor(home.y + Math.sin(angle) * d) + 0.5;
    if (isWalkable(Math.floor(x), Math.floor(y)) && animalLineWalkable(home.x, home.y, x, y, isWalkable)) return { x, y };
  }
  return null;
}

// True if tile (tx, ty) is on, or within one tile of, a door, stairs or gate object of the map
// (`objects` = tiledObjects(), rects in tiles; point objects have width/height 0). Animals never stand
// or wander there, so they never sit in a doorway she has to use.
function animalTileBlocked(objects, tx, ty) {
  return objects.some((o) => ['door', 'stairs', 'gate'].includes(o.type)
    && tx >= Math.floor(o.x) - 1 && tx <= Math.floor(o.width > 0 ? o.x + o.width - 1e-6 : o.x) + 1
    && ty >= Math.floor(o.y) - 1 && ty <= Math.floor(o.height > 0 ? o.y + o.height - 1e-6 : o.y) + 1);
}

// A new animal's state from its data entry.
function makeAnimal(def) {
  const info = ANIMAL_SPECIES[def.species];
  const x = def.x + 0.5;
  const y = def.y + 0.5;
  return {
    id: def.id, species: def.species, kind: info.kind, tame: Boolean(def.talk),
    rest: def.behaviour === 'sleep' ? 'sleep' : 'sit',
    homeX: x, homeY: y, x, y, tx: null, ty: null,
    state: info.kind === 'bird' ? 'perch' : 'rest',
    facing: def.facing || 'down', hFacing: def.facing === 'right' ? 'right' : 'left',
    until: 0, away: false, alt: 0, visible: true, talking: false,
  };
}

// Moves `a` toward (tx, ty) at `speed` tiles/s; returns true once it has arrived.
function animalMove(a, tx, ty, speed, dt) {
  const dx = tx - a.x;
  const dy = ty - a.y;
  const dist = Math.hypot(dx, dy);
  const step = speed * dt;
  if (dist <= step || dist < 0.02) { a.x = tx; a.y = ty; return true; }
  a.x += (dx / dist) * step;
  a.y += (dy / dist) * step;
  a.facing = animalFacing(dx, dy);
  if (a.facing === 'left' || a.facing === 'right') a.hFacing = a.facing;
  return false;
}

function animalFace(a, player) {
  a.facing = animalFacing(player.x - a.x, player.y - a.y);
  if (a.facing === 'left' || a.facing === 'right') a.hFacing = a.facing;
}

// One simulation step. ctx = { now (ms), dt (s), player: { x, y } (tiles), rng: () => [0,1),
// isWalkable(tx, ty) }. Returns the new state; `prev` is not modified.
function stepAnimal(prev, ctx) {
  const a = { ...prev };
  const dist = Math.hypot(a.x - ctx.player.x, a.y - ctx.player.y);
  if (a.kind === 'cat') stepCat(a, dist, ctx); else stepBird(a, dist, ctx);
  return a;
}

function catRest(a, ctx, away) {
  const rule = ANIMAL_RULES.cat;
  a.state = 'rest';
  a.tx = null;
  a.ty = null;
  a.until = ctx.now + animalRandRange(away ? rule.awayRestMs : rule.restMs, ctx.rng);
}

function stepCat(a, dist, ctx) {
  const rule = ANIMAL_RULES.cat;
  if (a.talking) { // she is talking to it: stay put, look at her
    animalFace(a, ctx.player);
    a.state = 'alert';
    return;
  }
  const reaction = animalReaction('cat', dist, a.tame);
  const startle = () => { a.state = 'startle'; a.until = ctx.now + rule.startleMs; animalFace(a, ctx.player); };

  switch (a.state) {
    case 'rest':
      if (reaction === 'flee') { startle(); break; }
      if (reaction === 'notice') { a.state = 'alert'; animalFace(a, ctx.player); break; }
      if (ctx.now >= a.until) {
        if (a.away) { a.state = 'return'; break; }
        const point = ctx.rng() < rule.wanderChance ? animalWanderPoint({ x: a.homeX, y: a.homeY }, rule.wanderTiles, ctx.rng, ctx.isWalkable) : null;
        if (point) { a.state = 'wander'; a.tx = point.x; a.ty = point.y; } else catRest(a, ctx, false);
      }
      break;
    case 'alert':
      animalFace(a, ctx.player);
      if (reaction === 'flee') startle();
      else if (dist > rule.releaseTiles) catRest(a, ctx, false);
      break;
    case 'wander':
    case 'return': {
      if (reaction === 'flee') { startle(); break; }
      if (reaction === 'notice') { a.state = 'alert'; animalFace(a, ctx.player); break; }
      const tx = a.state === 'return' ? a.homeX : a.tx;
      const ty = a.state === 'return' ? a.homeY : a.ty;
      if (animalMove(a, tx, ty, rule.walkSpeed, ctx.dt)) {
        if (a.state === 'return') a.away = false;
        catRest(a, ctx, false);
      }
      break;
    }
    case 'startle':
      animalFace(a, ctx.player);
      if (ctx.now >= a.until) {
        const point = animalFleePoint({ x: a.x, y: a.y }, ctx.player, rule.fleeRunTiles, ctx.isWalkable);
        if (point) { a.state = 'flee'; a.tx = point.x; a.ty = point.y; } else a.state = 'alert';
      }
      break;
    case 'flee':
      if (animalMove(a, a.tx, a.ty, rule.runSpeed, ctx.dt)) { a.away = true; catRest(a, ctx, true); }
      break;
    default:
      catRest(a, ctx, false);
  }
}

function stepBird(a, dist, ctx) {
  const rule = ANIMAL_RULES.bird;
  const home = { x: a.homeX, y: a.homeY };
  const lift = (dt) => { a.alt = Math.min(rule.liftPx, a.alt + rule.liftPxPerSec * dt); };
  const takeoff = () => {
    // Away from her, with a little sideways scatter; flies over everything.
    const angle = Math.atan2(a.y - ctx.player.y, a.x - ctx.player.x) + (ctx.rng() - 0.5) * 1.2;
    a.state = 'fly';
    a.tx = a.x + Math.cos(angle) * rule.flyAwayTiles;
    a.ty = a.y + Math.sin(angle) * rule.flyAwayTiles;
    a.facing = animalFacing(a.tx - a.x, a.ty - a.y);
  };

  switch (a.state) {
    case 'perch':
    case 'hop': {
      if (animalReaction('bird', dist, false) === 'takeoff') { takeoff(); break; }
      if (a.state === 'hop') {
        if (animalMove(a, a.tx, a.ty, rule.walkSpeed, ctx.dt)) { a.state = 'perch'; a.until = ctx.now + animalRandRange(rule.hopMs, ctx.rng); }
      } else if (ctx.now >= a.until) {
        const point = animalWanderPoint(home, rule.hopTiles, ctx.rng, ctx.isWalkable);
        if (point) { a.state = 'hop'; a.tx = point.x; a.ty = point.y; } else a.until = ctx.now + animalRandRange(rule.hopMs, ctx.rng);
      }
      break;
    }
    case 'fly':
      lift(ctx.dt);
      a.facing = animalFacing(a.tx - a.x, a.ty - a.y);
      if (animalMove(a, a.tx, a.ty, rule.flySpeed, ctx.dt)) {
        a.state = 'gone';
        a.visible = false;
        a.until = ctx.now + animalRandRange(rule.goneMs, ctx.rng);
      }
      break;
    case 'gone':
      // Comes back only after a while, and never while she is standing near its perch.
      if (ctx.now >= a.until && Math.hypot(home.x - ctx.player.x, home.y - ctx.player.y) > rule.returnClearTiles) {
        const angle = ctx.rng() * Math.PI * 2;
        a.x = home.x + Math.cos(angle) * rule.returnFromTiles;
        a.y = home.y + Math.sin(angle) * rule.returnFromTiles;
        a.alt = rule.liftPx;
        a.visible = true;
        a.state = 'land';
        a.facing = animalFacing(home.x - a.x, home.y - a.y);
      }
      break;
    case 'land':
      if (a.x !== home.x || a.y !== home.y) {
        animalMove(a, home.x, home.y, rule.flySpeed, ctx.dt);
      } else {
        a.alt = Math.max(0, a.alt - rule.liftPxPerSec * ctx.dt);
        if (a.alt === 0) { a.state = 'perch'; a.until = ctx.now + animalRandRange(rule.hopMs, ctx.rng); }
      }
      break;
    default:
      a.state = 'perch';
  }
}

// Which animation to play, and whether to flip the sprite: { anim, flipX, timeScale }. Pure so the
// state -> animation table is unit-tested (src/scenes/world.js just plays what this says).
function animalAnim(a) {
  const info = ANIMAL_SPECIES[a.species];
  const layout = ANIMAL_LAYOUTS[info.layout];
  const moving = ['wander', 'return', 'flee', 'hop', 'fly', 'land'].includes(a.state) && !(a.state === 'land' && a.x === a.homeX && a.y === a.homeY);
  const timeScale = a.state === 'flee' ? 1.8 : 1;
  if (info.layout === 'cat4') {
    if (moving) return { anim: `walk-${a.facing}`, flipX: false, timeScale };
    return { anim: a.facing === 'down' ? 'sit' : `idle-${a.facing}`, flipX: false, timeScale };
  }
  if (info.layout === 'cat-side') {
    const flipX = (a.hFacing === 'right') === Boolean(layout.facesLeft);
    if (a.state === 'flee') return { anim: 'walk', flipX, timeScale };
    if (moving) return { anim: 'walk', flipX, timeScale };
    if (a.state === 'startle') return { anim: 'scared', flipX, timeScale };
    if (a.state === 'alert') return { anim: 'stand', flipX, timeScale };
    return { anim: a.rest === 'sleep' ? 'sleep' : 'sit', flipX, timeScale };
  }
  // birds
  if (a.state === 'fly' || (a.state === 'land' && a.alt > 0)) return { anim: `fly-${a.facing}`, flipX: false, timeScale };
  if (a.state === 'hop') return { anim: `walk-${a.facing}`, flipX: false, timeScale };
  return { anim: `idle-${a.facing}`, flipX: false, timeScale };
}

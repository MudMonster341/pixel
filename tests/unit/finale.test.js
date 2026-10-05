// W3 (the birthday finale, docs/plans/2026-10-04-day3-feedback-and-wow.md section B): the cake, 22 candles she blows out by HOLDING a key, fireworks
// over a Dubai skyline, a chiptune "Happy Birthday to You", then the card. The pure rules (src/finale.js), the drawing's shape lists (src/finale-art.js),
// the generated audio and the scene's key handling / failsafes (src/scenes/finale.js, evaluated on stand-in objects: running a scene needs a browser).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData, plain } = require('../helpers/game-data');

const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');

const game = loadGameData();
game.runScript('src/scenes/finale.js');
game.runScript('src/scenes/credits.js');
const { evaluate } = game;
const FINALE = plain(evaluate('FINALE'));
const FinaleScene = evaluate('FinaleScene');
const AudioManager = evaluate('AudioManager');

// ---------- the wiring ----------

test('W3: the finale is registered: script tags in order, the scene list, the scene key, the helper that loads it for unit tests', () => {
  const html = read('index.html');
  const at = (tag) => html.indexOf(`<script src="${tag}"></script>`);
  assert.ok(at('src/finale.js') > at('src/card.js') && at('src/card.js') >= 0, 'finale.js loads after card.js (renderCardText)');
  assert.ok(at('src/finale-art.js') > at('src/finale.js'), 'the art loads after the rules');
  assert.ok(at('src/scenes/finale.js') > at('src/finale-art.js') && at('src/scenes/finale.js') > at('src/scenes/box-opening.js') && at('src/scenes/finale.js') > at('src/scenes/ui.js'));
  assert.match(read('src', 'main.js'), /BoxOpeningScene, FinaleScene, CardScene, CreditsScene/);
  assert.match(read('src', 'scenes', 'finale.js'), /class FinaleScene extends Phaser\.Scene[\s\S]*?super\('finale'\)/);
  assert.ok(read('tests', 'helpers', 'game-data.js').includes("'src/finale.js', 'src/finale-art.js'"));
  assert.match(read('src', 'scenes', 'ui.js'), /const GAMEPLAY_SCENES = \[[^\]]*'box-opening', 'finale', 'card', 'credits'/, 'the title / goodbye / quit clean-up stops a live finale');
});

test('W3: the chain is box -> finale -> card -> credits -> title and "Watch the Card Again" still starts the card only', () => {
  assert.match(read('src', 'scenes', 'box-opening.js'), /this\.scene\.start\('finale'\)/);
  assert.match(read('src', 'scenes', 'finale.js'), /this\.scene\.start\('card'\)/);
  assert.match(read('src', 'scenes', 'card.js'), /this\.scene\.start\('credits', \{ raw \}\)/);
  assert.match(read('src', 'scenes', 'credits.js'), /this\.scene\.start\('title'\)/);
  const title = read('src', 'scenes', 'title.js');
  assert.match(title, /this\.scene\.start\('card'\)/);
  assert.ok(!title.includes('finale'), 'the title never goes through the finale');
  assert.ok(!/scene\.(start|launch|get|isActive|stop)\('finale'/.test(stripComments(read('src', 'scenes', 'card.js'))), 'the card does not depend on the finale having run');
  for (const file of ['finale.js']) {
    assert.doesNotMatch(read('src', 'scenes', file), /scene\.(start|launch|resume|wake|run)\(\s*'(world|ui|boot|title)'/, 'the finale never hands back to the world or the title');
  }
});

// ---------- the candles and the blow rules ----------

test('W3: 22 candles on one ring, deterministic positions, all distinct, all on the cake top', () => {
  const candlePositions = evaluate('candlePositions');
  const cake = plain(evaluate('FINALE_CAKE'));
  assert.equal(FINALE.candleCount, 22);
  const a = plain(candlePositions());
  assert.equal(a.length, 22);
  assert.deepEqual(a, plain(candlePositions()), 'the same on every call');
  assert.equal(new Set(a.map((c) => `${c.x},${c.y}`)).size, 22, 'no two candles on the same spot');
  for (const c of a) {
    assert.ok(Math.abs(c.x - cake.cx) <= cake.rx + 1 && Math.abs(c.y - cake.cy) <= cake.ry + 1, `candle ${c.index} stands on the ring`);
  }
  const sorted = [...a].map((c) => c.x).sort((p, q) => p - q);
  for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i] - sorted[i - 1] <= 60, 'tidy spacing: no big gaps');
});

test('W3: the flames go out in one deterministic order, a breath sweeping across the cake, one more at a time as the progress rises', () => {
  const { candleOutOrder, candlesOutCount, candlesOutSet, candlePositions } = game.evaluate('({ candleOutOrder, candlesOutCount, candlesOutSet, candlePositions })');
  const order = plain(candleOutOrder());
  assert.deepEqual(order, plain(candleOutOrder()), 'deterministic');
  assert.deepEqual([...order].sort((p, q) => p - q), Array.from({ length: 22 }, (_, i) => i), 'every candle exactly once');
  const x = (i) => candlePositions()[i].x;
  for (let k = 1; k < order.length; k++) assert.ok(x(order[k]) >= x(order[k - 1]), 'left to right, away from her');
  assert.equal(candlesOutCount(0), 0);
  assert.equal(candlesOutCount(1), 22);
  let previous = 0;
  for (let p = 0; p <= 1.0001; p += 0.01) {
    const n = candlesOutCount(Math.min(1, p));
    assert.ok(n >= previous && n - previous <= 1, `more progress never brings a flame back, and never blows two at once (${p})`);
    previous = n;
  }
  assert.equal(candlesOutCount(0.5), 11);
  const half = [...candlesOutSet(0.5)];
  assert.deepEqual(half, order.slice(0, 11), 'the first eleven of the order are out at half way');
  assert.equal(candlesOutSet(0.99).size, 21, 'the last flame stays lit until the progress really reaches 1');
});

test('W3: holding fills the breath in about 3 s, releasing pauses it (the blown-out candles stay out), nothing is ever un-blown', () => {
  const { blowStep, candlesOutCount } = game.evaluate('({ blowStep, candlesOutCount })');
  assert.equal(FINALE.blowMs, 3000);
  let p = 0;
  let ms = 0;
  while (p < 1) { p = blowStep(p, true, 16); ms += 16; }
  assert.ok(ms >= 2900 && ms <= 3100, `22 candles over ~3 s of holding (${ms} ms)`);
  p = blowStep(0, true, 1000);
  const afterOneSecond = candlesOutCount(p);
  assert.equal(afterOneSecond, 7);
  assert.equal(blowStep(p, false, 5000), p, 'releasing does not change the progress: no drift either way');
  assert.equal(candlesOutCount(blowStep(p, false, 5000)), afterOneSecond, 'the blown-out candles stay out');
  assert.equal(blowStep(0.2, true, -50), 0.2, 'a negative step never goes backwards');
  assert.equal(blowStep(0.999, true, 1000), 1, 'clamped at 1');
});

test('W3: the soft-lock guards: the hint after 8 s without progress, the rest go out by themselves after 20 s, and every idle run ends', () => {
  const { blowFailsafe, blowStep, candlesOutCount } = game.evaluate('({ blowFailsafe, blowStep, candlesOutCount })');
  assert.equal(FINALE.hintAfterMs, 8000);
  assert.equal(FINALE.autoBlowAtMs, 20000);
  assert.deepEqual(plain(blowFailsafe(3000, 3000, 0)), { hint: false, autoBlow: false });
  assert.deepEqual(plain(blowFailsafe(7999, 7999, 0)), { hint: false, autoBlow: false });
  assert.deepEqual(plain(blowFailsafe(8000, 8000, 0)), { hint: true, autoBlow: false });
  assert.deepEqual(plain(blowFailsafe(19999, 12000, 0.3)), { hint: true, autoBlow: false });
  assert.deepEqual(plain(blowFailsafe(20000, 1000, 0.3)), { hint: false, autoBlow: true }, 'a recent breath: no hint, but the auto-blow still comes');
  assert.deepEqual(plain(blowFailsafe(30000, 30000, 1)), { hint: false, autoBlow: false }, 'nothing left to do once they are all out');
  // a whole idle run, frame by frame: the cake is done a bit after 20 s + the 3 s a blow takes
  let progress = 0;
  let t = 0;
  while (progress < 1 && t < 60000) {
    t += 16;
    if (blowFailsafe(t, t, progress).autoBlow) progress = blowStep(progress, true, 16);
  }
  assert.equal(candlesOutCount(progress), 22);
  assert.ok(t >= 20000 && t <= 23200, `every run ends: the idle run is done at ${t} ms`);
});

test('W3: a flame leans away and flickers harder as she blows; smoke rises from a candle that went out and then fades for good', () => {
  const { flameShape, smokeWisps } = game.evaluate('({ flameShape, smokeWisps })');
  const calm = flameShape(3, 1000, 0);
  const blown = flameShape(3, 1000, 1);
  assert.equal(calm.lean, 0, 'upright when she is not blowing');
  assert.ok(blown.lean >= 4, 'leaning when she blows');
  assert.ok(blown.h < 13 * 1.5 && blown.h > 3 && blown.w > 2, 'never a degenerate flame');
  let calmSpread = 0;
  let blownSpread = 0;
  for (let t = 0; t < 2000; t += 20) {
    calmSpread = Math.max(calmSpread, Math.abs(flameShape(3, t, 0).h - 13));
    blownSpread = Math.max(blownSpread, Math.abs(flameShape(3, t, 1).h - 13 * 0.75));
  }
  assert.ok(blownSpread > calmSpread, 'it flickers harder when blown');
  assert.notEqual(flameShape(1, 1000, 0).h, flameShape(2, 1000, 0).h, 'the flames are never in step');
  assert.equal(smokeWisps(0, -10).length, 0);
  assert.ok(smokeWisps(0, 600).length >= 1);
  assert.ok(smokeWisps(0, 600).every((w) => w.a >= 0 && w.a <= 0.5 && w.dy < 0));
  assert.equal(smokeWisps(0, 2000).length, 0, 'the smoke is gone after 2 s');
});

// ---------- the schedule ----------

test('W3: the phases are in order and bounded, and the skip works only 2 s into the fireworks', () => {
  const { finaleSchedule, finalePhaseAt, finaleCanSkip } = game.evaluate('({ finaleSchedule, finalePhaseAt, finaleCanSkip })');
  assert.equal(FINALE.skipAfterMs, 2000);
  const s = plain(finaleSchedule(5000));
  assert.deepEqual(s, {
    wishStart: 5000, flashStart: 5000 + FINALE.wishMs, celebrationStart: 5000 + FINALE.wishMs + FINALE.flashMs,
    skipFrom: 5000 + FINALE.wishMs + FINALE.flashMs + 2000, celebrationEnd: 5000 + FINALE.wishMs + FINALE.flashMs + FINALE.celebrationMs,
  });
  assert.ok(s.wishStart < s.flashStart && s.flashStart < s.celebrationStart && s.celebrationStart < s.skipFrom && s.skipFrom < s.celebrationEnd);
  assert.equal(FINALE.wishMs, 1500, 'the beat of silence');
  const seen = [];
  for (let t = 0; t <= s.celebrationEnd + 100; t += 10) { const p = finalePhaseAt(s, t); if (seen[seen.length - 1] !== p) seen.push(p); }
  assert.deepEqual(seen, ['wish', 'flash', 'celebration', 'leaving']);
  assert.equal(finalePhaseAt(null, 1234), 'candles', 'no schedule yet means the candles');
  // no skip during the candles (no schedule), none before the grace is over, one after, none once it is leaving anyway
  assert.equal(finaleCanSkip(null, 99999), false);
  assert.equal(finaleCanSkip(s, s.wishStart + 100), false);
  assert.equal(finaleCanSkip(s, s.celebrationStart + 100), false);
  assert.equal(finaleCanSkip(s, s.celebrationStart + 1999), false);
  assert.equal(finaleCanSkip(s, s.celebrationStart + 2000), true);
  assert.equal(finaleCanSkip(s, s.celebrationEnd - 1), true);
  assert.equal(finaleCanSkip(s, s.celebrationEnd + 10_000), false);
  // bounded: the celebration is no longer than the song plus its ring-out, and the whole scene has a hard stop well past the longest run
  assert.ok(FINALE.celebrationMs >= FINALE.songMs && FINALE.celebrationMs <= FINALE.songMs + 2000);
  const longest = FINALE.autoBlowAtMs + FINALE.blowMs + FINALE.wishMs + FINALE.flashMs + FINALE.celebrationMs + FINALE.leaveFadeMs;
  const hardStop = Number(/const FINALE_HARD_STOP_MS = (\d+);/.exec(read('src', 'scenes', 'finale.js'))[1]);
  assert.ok(hardStop > longest && hardStop <= 90_000, `a hard stop (${hardStop} ms) after the longest natural run (${longest} ms)`);
  assert.ok(FINALE.leaveFailsafeMs > FINALE.leaveFadeMs && FINALE.leaveFailsafeMs <= 2000);
});

// ---------- the fireworks ----------

test('W3: the firework show is deterministic, inside the song, with 24-40 sparks a burst and hearts, rings and sparks, no Math.random anywhere', () => {
  const { fireworkSchedule, burstParticles, fireworkShowEndMs } = game.evaluate('({ fireworkSchedule, burstParticles, fireworkShowEndMs })');
  const a = plain(fireworkSchedule());
  assert.deepEqual(a, plain(fireworkSchedule()), 'the same show every time');
  assert.notDeepEqual(a.map((b) => b.x), plain(fireworkSchedule(7)).map((b) => b.x), 'a different seed is a different show (so the seed really is used)');
  assert.ok(a.length >= 12 && a.length <= 20);
  const colors = plain(evaluate('FIREWORK_COLORS'));
  const credits = plain(evaluate('CREDITS_HEART_COLORS'));
  for (const c of credits) assert.ok(colors.includes(c), 'the credits palette is in the fireworks palette');
  let previousT = -1;
  for (const b of a) {
    assert.ok(b.t > previousT, 'bursts are in time order');
    previousT = b.t;
    assert.ok(b.t >= b.launchMs, 'the rocket launches after the show starts');
    assert.ok(b.t <= FINALE.fireworksMs, `burst ${b.index} explodes inside the ~12 s fireworks window`);
    assert.ok(b.count >= 24 && b.count <= 40, `burst ${b.index} has ${b.count} sparks`);
    assert.ok(['sparks', 'ring', 'heart'].includes(b.kind));
    assert.ok(colors.includes(b.color) && colors.includes(b.color2));
    assert.ok(b.x > 40 && b.x < 920 && b.y >= 80 && b.y <= 205, 'bursts happen over the skyline, inside the screen');
    const parts = plain(burstParticles(b));
    assert.equal(parts.length, b.count);
    assert.ok(parts.every((p) => p.life >= 1100 && p.life <= 1800 && p.size >= 2 && Number.isFinite(p.vx) && Number.isFinite(p.vy)));
    assert.deepEqual(parts, plain(burstParticles(b)), 'a burst is the same every time');
  }
  assert.deepEqual([...new Set(a.map((b) => b.kind))].sort(), ['heart', 'ring', 'sparks'], 'a few heart-shaped and ring bursts among the others');
  assert.ok(a.filter((b) => b.crackle).length >= 2, 'some bursts crackle');
  assert.ok(fireworkShowEndMs() <= FINALE.celebrationMs, 'the last spark has faded before the celebration ends');
  assert.ok(fireworkShowEndMs() <= FINALE.songMs, 'and inside the song');
  for (const file of ['finale.js', 'finale-art.js', path.join('scenes', 'finale.js')]) {
    assert.ok(!/Math\.random|Phaser\.Math\.(Between|FloatBetween)|GetRandom/.test(stripComments(read('src', file))), `${file} uses no unseeded random numbers`);
  }
});

test('W3: a spark is a pure function of its age (drag + gravity), fades out, and the whole show never has more than ~200 sparks alive', () => {
  const { fireworkSchedule, burstParticles, sparkAt, rocketAt, burstFlash } = game.evaluate('({ fireworkSchedule, burstParticles, sparkAt, rocketAt, burstFlash })');
  const show = fireworkSchedule();
  const particles = show.map((b) => burstParticles(b));
  const p = particles[0][0];
  assert.equal(sparkAt(p, -1), null);
  assert.equal(sparkAt(p, p.life), null);
  const early = plain(sparkAt(p, 100));
  assert.deepEqual(early, plain(sparkAt(p, 100)));
  assert.ok(early.alpha > 0.4 && early.alpha <= 1.0001);
  assert.ok(sparkAt(p, p.life - 10).alpha < 0.2, 'faded out at the end of its life');
  const far = sparkAt(p, p.life - 1);
  assert.ok(Math.hypot(far.x, far.y) < 260, 'a spark stays within ~250 px of its burst');
  let maxAlive = 0;
  for (let ms = 0; ms <= FINALE.celebrationMs; ms += 50) {
    let alive = 0;
    show.forEach((b, i) => { for (const q of particles[i]) if (sparkAt(q, ms - b.t)) alive++; });
    maxAlive = Math.max(maxAlive, alive);
  }
  assert.ok(maxAlive <= 200, `at most ${maxAlive} sparks alive at once`);
  assert.ok(maxAlive >= 60, 'a proper show, not a trickle');
  const b = show[1];
  assert.equal(rocketAt(b, b.t - b.launchMs - 1), null);
  assert.ok(rocketAt(b, b.t - 1).y < 372 && rocketAt(b, b.t - 1).y >= b.y, 'the rocket rises toward the burst point');
  assert.equal(rocketAt(b, b.t), null);
  assert.ok(burstFlash(b, b.t) === 1 && burstFlash(b, b.t + 161) === 0 && burstFlash(b, b.t - 1) === 0);
});

// ---------- the picture: deterministic shape lists ----------

test('W3: the skyline is deterministic and has a needle tower, a sail-shaped hotel, an arched tower and lots of lit windows', () => {
  const { finaleSkyline, finaleCityShapes, finaleSkyShapes, finaleTableShapes, finaleCakeShapes, finaleCandleShapes, finaleWindowColor } = game.evaluate('({ finaleSkyline, finaleCityShapes, finaleSkyShapes, finaleTableShapes, finaleCakeShapes, finaleCandleShapes, finaleWindowColor })');
  const sky = plain(finaleSkyline());
  assert.deepEqual(sky, plain(finaleSkyline()), 'the same skyline every time');
  const shapes = [...sky.near];
  const top = (x0, x1) => Math.min(...shapes.filter((s) => s.k === 'r' && s.x + s.w > x0 && s.x < x1).map((s) => s.y));
  assert.ok(top(765, 775) <= 40, 'a needle tower with a long spire (x ~ 770)');
  assert.ok(top(176, 182) <= 110 && top(240, 250) > 250, 'a sail: tall on the spine side, low on the far side (x ~ 176-260)');
  const arch = shapes.filter((s) => s.k === 'r' && s.x >= 420 && s.x + s.w <= 500);
  assert.ok(arch.some((s) => s.x === 420 && s.h >= 200) && arch.some((s) => s.x === 476 && s.h >= 200), 'two legs');
  assert.ok(!shapes.some((s) => s.k === 'r' && s.y >= 300 && s.y < 371 && s.x <= 456 && s.x + s.w >= 464 && s.w < 60), 'an opening between the legs (the arch)');
  assert.ok(sky.windows.length >= 400 && sky.windows.filter((w) => w.base).length >= 150, 'many windows, a share of them lit');
  assert.ok(sky.windows.every((w, i) => w.i === i && [0, 1].includes(w.tone)));
  assert.ok(sky.far.length >= 15 && sky.near.length >= 60);
  // every shape is well formed
  for (const list of [sky.far, sky.near, plain(finaleCityShapes()), plain(finaleSkyShapes()), plain(finaleTableShapes()), plain(finaleCakeShapes()), plain(finaleCandleShapes())]) {
    for (const s of list) {
      assert.ok(['r', 'e', 'c'].includes(s.k));
      assert.ok(Number.isInteger(s.c) && s.c >= 0 && s.c <= 0xffffff && s.a >= 0 && s.a <= 1, JSON.stringify(s));
      const nums = s.k === 'r' ? [s.x, s.y, s.w, s.h] : s.k === 'e' ? [s.x, s.y, s.w, s.h] : [s.x, s.y, s.r];
      assert.ok(nums.every(Number.isFinite), JSON.stringify(s));
    }
  }
  assert.ok(finaleWindowColor({ tone: 0 }) !== finaleWindowColor({ tone: 1 }));
  assert.equal(plain(finaleCandleShapes()).filter((s) => s.k === 'r' && s.w === 5 && s.h === 20).length, 22, '22 candle sticks');
});

test('W3: the sky is the credits\' dusk, the windows flicker only during the show, and the shapes of a firework frame are bounded', () => {
  assert.deepEqual(plain(evaluate('FINALE_SKY_STOPS')), plain(evaluate('CREDITS_SKY_STOPS')), 'the same dusk as the credits (src/scenes/credits.js)');
  const { windowLit, finaleFireworkShapes, fireworkSchedule, burstParticles, finaleSkyColor, creditsSkyColor } = game.evaluate('({ windowLit, finaleFireworkShapes, fireworkSchedule, burstParticles, finaleSkyColor, creditsSkyColor })');
  for (const t of [0, 0.3, 0.7, 1]) assert.equal(finaleSkyColor(t), creditsSkyColor(t), 'the same gradient');
  let calmFlips = 0;
  let excitedFlips = 0;
  for (let i = 0; i < 400; i++) {
    if (windowLit(i, true, 3000, false) !== true) calmFlips++;
    if (windowLit(i, true, 3000, true) !== true) excitedFlips++;
  }
  assert.ok(excitedFlips > 40 && excitedFlips < 160, `a share of the windows flicker during the show (${excitedFlips}/400)`);
  assert.ok(calmFlips < 30, `almost none before it (${calmFlips}/400)`);
  assert.equal(windowLit(5, true, 1234, true), windowLit(5, true, 1234, true), 'deterministic');
  const show = fireworkSchedule();
  const parts = {};
  show.forEach((b) => { parts[b.index] = burstParticles(b); });
  let most = 0;
  for (let ms = 0; ms <= FINALE.celebrationMs; ms += 100) most = Math.max(most, finaleFireworkShapes(ms, show, parts).length);
  assert.ok(most <= 700, `a firework frame draws at most ${most} shapes`);
  assert.equal(finaleFireworkShapes(0, show, parts).length, 0, 'nothing in the sky before the first rocket');
});

// ---------- the words ----------

test('W3: the texts say the recipient\'s name ("Taru" by default) through the same helper the card and the credits use', () => {
  const { finaleText, buildCardConfig } = game.evaluate('({ finaleText, buildCardConfig })');
  const recipient = buildCardConfig(null).recipient;
  assert.equal(recipient, 'Taru');
  assert.equal(finaleText('wish', recipient), 'Make a wish, Taru!');
  assert.equal(finaleText('birthday', recipient), 'Happy Birthday, Taru!');
  assert.equal(finaleText('wish', buildCardConfig({ recipient: 'Amina' }).recipient), 'Make a wish, Amina!');
  assert.equal(finaleText('silence', 'Taru'), 'Make a wish...');
  assert.equal(finaleText('hint', 'Taru'), 'Hold SPACE to blow!');
  assert.equal(finaleText('nope', 'Taru'), '');
  assert.ok(!/\b22\b|age/i.test(Object.values(plain(evaluate('FINALE_TEXT'))).join(' ')), 'no age needed');
  const scene = read('src', 'scenes', 'finale.js');
  assert.match(scene, /this\.recipient = buildCardConfig\(this\.cache\.json\.get\('card-config'\)\)\.recipient;/);
  for (const key of ['wish', 'sub', 'hint', 'birthday', 'skip']) assert.match(scene, new RegExp(`finaleText\\('${key}', this\\.recipient\\)`));
  assert.match(scene, /this\.titleText\.setText\(finaleText\('silence', this\.recipient\)\)/);
});

// ---------- the audio ----------

const wavSeconds = (file) => { const b = fs.readFileSync(path.join(ROOT, file)); return (b.length - 44) / 2 / b.readUInt32LE(24); };

test('W3: the song and the firework / blow sounds are registered, exist, are generated by tools/make-audio.js and are in the offline bundle', () => {
  const { SOUNDS } = game;
  const ids = ['blowPff', 'fireworkWhoosh', 'fireworkPop', 'fireworkCrackle', 'happyBirthday'];
  const maker = read('tools', 'make-audio.js');
  const pack = require('../../tools/pack-offline');
  const have = new Set(pack.collectRuntimeAssets().assets.map((a) => a.path));
  for (const id of ids) {
    assert.ok(SOUNDS[id], `SOUNDS.${id}`);
    assert.equal(SOUNDS[id].loop, false);
    assert.ok(fs.existsSync(path.join(ROOT, SOUNDS[id].file)), `${SOUNDS[id].file} is missing (npm run audio)`);
    assert.ok(maker.includes(SOUNDS[id].file.replace('assets/audio/', '')), `tools/make-audio.js writes ${SOUNDS[id].file}`);
    assert.ok(have.has(SOUNDS[id].file), `${SOUNDS[id].file} is not in the offline manifest`);
  }
  assert.equal(SOUNDS.happyBirthday.category, 'music');
  assert.equal(SOUNDS.happyBirthday.oneShot, true);
  for (const id of ids.filter((x) => x !== 'happyBirthday')) assert.equal(SOUNDS[id].category, 'sfx');
  assert.match(read('src', 'audio.js'), /for \(const \[id, def\] of Object\.entries\(SOUNDS\)\)/, 'AudioManager.preload() loads every registered sound');
});

test('W3: the song is the traditional tune (25 beats in 3/4, two voices) and the generated file is 14-18 s, as long as the scene thinks', () => {
  const hb = require('../../tools/lib/happy-birthday');
  const names = hb.HAPPY_BIRTHDAY_TUNE.map((n) => n.pitch);
  assert.deepEqual(names, ['G4', 'G4', 'A4', 'G4', 'C5', 'B4', 'G4', 'G4', 'A4', 'G4', 'D5', 'C5', 'G4', 'G4', 'G5', 'E5', 'C5', 'B4', 'A4', 'F5', 'F5', 'E5', 'C5', 'D5', 'C5'],
    'Hap-py birth-day to you, Hap-py birth-day to you, Hap-py birth-day dear [name], Hap-py birth-day to you');
  assert.equal(hb.HAPPY_BIRTHDAY_BEATS, 25);
  assert.equal(hb.HAPPY_BIRTHDAY_BASS.length, 8, 'a chord for each of the eight bars');
  assert.ok(Math.abs(hb.noteFreq('A4') - 440) < 1e-9 && Math.abs(hb.noteFreq('C5') - 523.25) < 0.01 && Math.abs(hb.noteFreq('G4') - 392) < 0.01);
  assert.throws(() => hb.noteFreq('H9'));
  const seconds = wavSeconds(game.SOUNDS.happyBirthday.file);
  assert.ok(seconds >= 14 && seconds <= 18, `the song is ${seconds.toFixed(2)} s`);
  assert.ok(Math.abs(seconds * 1000 - FINALE.songMs) <= 100, `FINALE.songMs (${FINALE.songMs}) matches the file (${(seconds * 1000).toFixed(0)} ms)`);
  // not silent, not clipped
  const b = fs.readFileSync(path.join(ROOT, game.SOUNDS.happyBirthday.file));
  let peak = 0;
  for (let i = 44; i + 1 < b.length; i += 2) peak = Math.max(peak, Math.abs(b.readInt16LE(i)));
  assert.ok(peak > 8000 && peak < 32700, `peak ${peak}`);
  for (const id of ['blowPff', 'fireworkWhoosh', 'fireworkPop', 'fireworkCrackle']) assert.ok(wavSeconds(game.SOUNDS[id].file) < 1.1, `${id} is a short effect`);
});

// ---------- the scene: key handling (key up/down state, never key repeat) ----------

function fakeFinale(extra = {}) {
  const s = Object.create(FinaleScene.prototype);
  Object.assign(s, {
    phase: 'candles', elapsed: 0, clockNow: 0, progress: 0, candlesOut: 0, blow: 0, lastProgressAt: 0, keysHeld: new Set(), pointerHeld: false,
    schedule: null, leaving: false, outAt: new Array(22).fill(null), outOrder: plain(evaluate('candleOutOrder')()), showHint: false, recipient: 'Taru', celebrationMs: 0,
    titleText: { setText(text) { this.text = text; return this; } },
  }, extra);
  return s;
}

test('W3: hold Space / E / Enter or the mouse: state-based, so key repeat, extra keydowns and key rollover cannot break it', () => {
  const s = fakeFinale();
  assert.equal(s.isHolding(), false);
  for (const key of ['SPACE', 'E', 'ENTER']) {
    s.onKeyDown(key, { repeat: false });
    assert.equal(s.isHolding(), true, `${key} down`);
    for (let i = 0; i < 20; i++) s.onKeyDown(key, { repeat: true }); // key repeat (Safari repeats after a delay, others at once)
    assert.equal(s.isHolding(), true, `${key} still down through the repeats`);
    s.onKeyUp(key);
    assert.equal(s.isHolding(), false, `${key} released`);
  }
  s.onKeyDown('SPACE', { repeat: false });
  s.onKeyDown('E', { repeat: false });
  s.onKeyUp('SPACE');
  assert.equal(s.isHolding(), true, 'one of two keys released: still blowing');
  s.onKeyUp('E');
  assert.equal(s.isHolding(), false);
  s.onKeyDown('SPACE', undefined); // an event-less call is tolerated
  s.onKeyUp('SPACE');
  s.onPointerDown();
  assert.equal(s.isHolding(), true, 'the mouse / a finger');
  s.onPointerUp();
  assert.equal(s.isHolding(), false);
  // a key released while the window was not focused (no keyup ever arrives) is cleared by the blur / hidden handler
  s.onKeyDown('SPACE', { repeat: false });
  s.onPointerDown();
  s.releaseAll();
  assert.equal(s.isHolding(), false);
  // Esc during the candles is not a blow and not a skip
  s.onKeyDown('ESC', { repeat: false });
  assert.equal(s.isHolding(), false);
  assert.equal(s.phase, 'candles');
});

test('W3: bindInput() listens for keydown AND keyup of every blow key, the pointer, and blur/hidden, and tears the global listeners down on shutdown', () => {
  const on = [];
  const gameOn = [];
  const gameOff = [];
  const s = fakeFinale({
    input: { keyboard: { on: (name, fn) => on.push([name, fn]) }, on: (name, fn) => on.push([name, fn]) },
    game: { events: { on: (name, fn, ctx) => gameOn.push([name, fn, ctx]), off: (name, fn, ctx) => gameOff.push([name, fn, ctx]) } },
  });
  s.bindInput();
  const names = on.map(([name]) => name);
  for (const key of ['SPACE', 'E', 'ENTER']) assert.ok(names.includes(`keydown-${key}`) && names.includes(`keyup-${key}`), key);
  assert.ok(names.includes('keydown-ESC') && names.includes('pointerdown') && names.includes('pointerup'));
  assert.deepEqual(gameOn.map(([name]) => name).sort(), ['blur', 'hidden']);
  const fire = (name, ...args) => on.filter(([n]) => n === name).forEach(([, fn]) => fn(...args));
  fire('keydown-SPACE', { repeat: false });
  assert.equal(s.isHolding(), true);
  fire('keyup-SPACE');
  assert.equal(s.isHolding(), false);
  fire('pointerdown');
  assert.equal(s.isHolding(), true);
  fire('pointerup');
  assert.equal(s.isHolding(), false);
  s.unbindGlobalInput();
  assert.deepEqual(gameOff.map(([name]) => name).sort(), ['blur', 'hidden']);
  assert.match(read('src', 'scenes', 'finale.js'), /this\.events\.once\('shutdown', \(\) => this\.unbindGlobalInput\(\)\)/);
});

test('W3: no skip works during the candles; after 2 s of fireworks Esc / Enter / Space / a click skip, a held-down key (a repeat) does not', () => {
  const { finaleSchedule } = game.evaluate('({ finaleSchedule })');
  const left = [];
  const make = (phase, elapsed, schedule) => fakeFinale({ phase, elapsed, schedule, leave: () => left.push(phase) });
  // the candles: nothing skips, whatever the clock says
  const candles = make('candles', 99999, null);
  for (const key of ['SPACE', 'E', 'ENTER', 'ESC']) candles.onKeyDown(key, { repeat: false });
  candles.onPointerDown();
  assert.deepEqual(left, [], 'the held key is the interaction, never a skip');
  // the wish and the flash: nothing either
  const s = finaleSchedule(4000);
  for (const phase of ['wish', 'flash']) {
    const scene = make(phase, 5000, s);
    for (const key of ['SPACE', 'ENTER', 'ESC']) scene.onKeyDown(key, { repeat: false });
    scene.onPointerDown();
  }
  assert.deepEqual(left, []);
  // the celebration: the 2 s grace, then every skip key and a click
  const early = make('celebration', s.celebrationStart + 1500, s);
  for (const key of ['SPACE', 'ENTER', 'E', 'ESC']) early.onKeyDown(key, { repeat: false });
  early.onPointerDown();
  assert.deepEqual(left, [], 'ignored inside the 2 s grace');
  for (const key of ['SPACE', 'ENTER', 'E', 'ESC']) {
    make('celebration', s.celebrationStart + 2100, s).onKeyDown(key, { repeat: false });
  }
  make('celebration', s.celebrationStart + 2100, s).onPointerDown();
  assert.equal(left.length, 5, 'every key and the click skip once the grace is over');
  const held = make('celebration', s.celebrationStart + 5000, s);
  held.onKeyDown('SPACE', { repeat: true });
  assert.equal(left.length, 5, 'the repeat of a key still held down from the candles does not skip');
});

// ---------- the scene: the blow loop and the failsafes ----------

// Runs the scene's own update() with the drawing stubbed out: a stand-in `this` whose draw methods do nothing.
function runnable(extra = {}) {
  const s = fakeFinale({
    warm: { setAlpha() { return this; } }, flash: { setAlpha() { return this; } }, confetti: [], show: plain(evaluate('fireworkSchedule')()),
    whooshIndex: 0, popIndex: 0, crackleAt: [],
    drawCandles() {}, drawWindows() {}, drawFireworks() {}, updateAmbient() {}, updateTexts() {}, drawMeter() {},
    ...extra,
  });
  s.step = (ms, frame = 16) => { for (let t = 0; t < ms; t += frame) s.update(s.clockNow + frame, frame); };
  return s;
}

function spyAudio() {
  const calls = [];
  const saved = {};
  for (const method of ['play', 'playMusic', 'playThrottled', 'stopMusic']) {
    saved[method] = AudioManager[method];
    AudioManager[method] = (...args) => { calls.push([method, ...args]); };
  }
  return { calls, restore: () => Object.assign(AudioManager, saved) };
}

test('W3: holding the key blows the 22 flames out one by one in the deterministic order over ~3 s, with one soft "pff" per candle, then the wish phase starts', () => {
  const audio = spyAudio();
  try {
    const s = runnable();
    s.keysHeld.add('SPACE');
    let lastOut = 0;
    const seen = [];
    for (let i = 0; i < 400 && s.phase === 'candles'; i++) {
      s.step(16);
      if (s.candlesOut !== lastOut) { assert.equal(s.candlesOut, lastOut + 1, 'one at a time'); lastOut = s.candlesOut; seen.push(s.elapsed); }
    }
    assert.equal(s.phase, 'wish');
    assert.equal(s.candlesOut, 22);
    assert.ok(s.elapsed >= 2900 && s.elapsed <= 3200, `${s.elapsed} ms of holding`);
    assert.equal(seen.length, 22);
    const times = plain(s.outOrder).map((index) => s.outAt[index]);
    for (let i = 1; i < times.length; i++) assert.ok(times[i] > times[i - 1], 'the order of the flames going out is the deterministic order');
    assert.equal(audio.calls.filter((c) => c[0] === 'playThrottled' && c[1] === 'blowPff').length, 22, 'a "pff" for every candle');
    assert.deepEqual(audio.calls.filter((c) => c[0] === 'stopMusic').length, 1, 'the bed fades out for the silence');
    assert.equal(s.titleText.text, 'Make a wish...');
    assert.deepEqual(plain(s.schedule), plain(evaluate('finaleSchedule')(s.elapsed)));
    assert.equal(s.keysHeld.size, 0);
  } finally { audio.restore(); }
});

test('W3: releasing pauses the blowing (the flames that went out stay out and nothing relights); the flames lean only while she blows', () => {
  const s = runnable();
  s.keysHeld.add('SPACE');
  s.step(1000);
  const out = s.candlesOut;
  const outAt = plain(s.outAt);
  assert.equal(out, 7);
  assert.ok(s.blow > 0.8, 'the flames lean while she blows');
  s.keysHeld.clear();
  s.step(6000);
  assert.equal(s.candlesOut, out, 'paused');
  assert.deepEqual(plain(s.outAt), outAt, 'blown-out candles stay out');
  assert.ok(s.blow < 0.05, 'the flames settle upright again');
  assert.equal(s.phase, 'candles');
  s.keysHeld.add('E');
  s.step(1000);
  assert.ok(s.candlesOut > out, 'holding again carries on');
  for (let i = 0; i < 22; i++) if (outAt[i] !== null) assert.equal(s.outAt[i], outAt[i], 'the first seven keep their original time');
});

test('W3: idle: the hint pulses after 8 s with no progress, the rest go out by themselves after 20 s and the scene moves on', () => {
  const s = runnable();
  s.step(7900);
  assert.equal(s.showHint, false);
  s.step(300);
  assert.equal(s.showHint, true, 'after 8 s');
  assert.equal(s.candlesOut, 0);
  s.keysHeld.add('SPACE');
  s.step(200);
  assert.equal(s.showHint, false, 'progress hides the hint again');
  s.keysHeld.clear();
  s.step(11000);
  assert.ok(s.elapsed < 20000 && s.phase === 'candles');
  s.step(4000);
  assert.equal(s.phase, 'wish', 'the rest went out on their own');
  assert.equal(s.candlesOut, 22);
  assert.ok(s.elapsed <= 23500);
});

test('W3: after the last flame: wish -> flash -> celebration (song, whoosh/pop/crackle in step with the bursts) -> leaving, each exactly once, in order', () => {
  const audio = spyAudio();
  try {
    const s = runnable({ leave() { s.leftAt = s.elapsed; s.phase = 'leaving'; s.leaving = true; } });
    s.keysHeld.add('SPACE');
    s.step(3300);
    assert.equal(s.phase, 'wish');
    const seen = ['wish'];
    const flashes = [];
    s.flash = { setAlpha(a) { flashes.push(a); return this; } };
    s.confetti = [{ obj: { setVisible(v) { s.confettiShown = v; } } }];
    for (let i = 0; i < 3000 && !s.leaving; i++) { s.step(16); if (seen[seen.length - 1] !== s.phase) seen.push(s.phase); }
    assert.deepEqual(seen, ['wish', 'flash', 'celebration', 'leaving']);
    assert.ok(s.leftAt >= s.schedule.celebrationEnd && s.leftAt < s.schedule.celebrationEnd + 40, 'it hands over when the celebration ends');
    assert.ok(Math.max(...flashes) > 0.9 && flashes[flashes.length - 1] === 0, 'a warm flash that fades again');
    assert.equal(s.confettiShown, true);
    const songs = audio.calls.filter((c) => c[0] === 'playMusic' && c[1] === 'happyBirthday');
    assert.equal(songs.length, 1, 'the song starts once');
    assert.equal(songs[0][2].crossfadeMs, 0);
    const show = s.show;
    assert.equal(audio.calls.filter((c) => c[1] === 'fireworkWhoosh').length, show.length, 'a whoosh per rocket');
    assert.equal(audio.calls.filter((c) => c[1] === 'fireworkPop').length, show.length, 'a pop per burst');
    assert.equal(audio.calls.filter((c) => c[1] === 'fireworkCrackle').length, show.filter((b) => b.crackle).length, 'a crackle after the crackling bursts');
    assert.ok(audio.calls.some((c) => c[0] === 'play' && c[1] === 'cardWhoosh'), 'a soft whoosh with the flash');
  } finally { audio.restore(); }
});

test('W3: leaving fades to the card exactly once and a missed fade event cannot stall it (failsafe timer); a second leave() does nothing', () => {
  const log = [];
  const timers = [];
  const fades = [];
  const s = fakeFinale({
    cameras: { main: { fadeOut: (ms) => log.push(`fadeOut:${ms}`), once: (event, fn) => fades.push({ event, fn }) } },
    time: { delayedCall: (ms, fn) => { timers.push({ ms, fn }); } },
    scene: { start: (key) => log.push(`start:${key}`) },
  });
  s.leave();
  assert.equal(s.phase, 'leaving');
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, FINALE.leaveFailsafeMs);
  assert.equal(fades[0].event, 'camerafadeoutcomplete');
  s.leave();
  assert.equal(timers.length, 1, 'idempotent');
  timers[0].fn(); // the fade event never came
  fades[0].fn(); // ...and if it does come late, nothing happens twice
  assert.deepEqual(log, [`fadeOut:${FINALE.leaveFadeMs}`, 'start:card']);
  assert.match(read('src', 'scenes', 'finale.js'), /this\.time\.delayedCall\(FINALE_HARD_STOP_MS, \(\) => this\.leave\(\)\);/, 'and a last-resort hard stop');
});

test('W3: the scene works fully silent: no audio, a locked context or a missing file only ever reaches the no-op AudioManager', () => {
  const m = AudioManager;
  assert.equal(m.game, null);
  assert.doesNotThrow(() => {
    m.play('blowPff'); m.playMusic('happyBirthday', { crossfadeMs: 0 }); m.playThrottled('fireworkPop', 'k', 100, 0); m.stopMusic(400);
  });
  const source = stripComments(read('src', 'scenes', 'finale.js'));
  assert.doesNotMatch(source, /this\.sound\b|new Audio\(|AudioContext|\.cache\.audio/, 'the scene never touches Phaser\'s sound or Web Audio directly');
  assert.ok(/AudioManager\.(play|playMusic|playThrottled|stopMusic)\(/.test(source));
  // the whole blow loop and the show run to the end with AudioManager as the silent no-op it is under node
  const s = runnable({ leave() { s.phase = 'leaving'; s.leaving = true; } });
  s.keysHeld.add('SPACE');
  for (let i = 0; i < 4000 && !s.leaving; i++) s.step(16);
  assert.equal(s.leaving, true);
});

test('W3: the first frame is the warm light the box ends on (no hard cut), and the scene bakes its static art once', () => {
  const scene = read('src', 'scenes', 'finale.js');
  const box = read('src', 'scenes', 'box-opening.js');
  assert.match(box, /this\.add\.rectangle\(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xfff1a8, 1\)/, 'the box opening ends on 0xfff1a8');
  assert.match(scene, /setBackgroundColor\('#fff1a8'\)/);
  assert.match(scene, /this\.add\.rectangle\(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xfff1a8, 1\)[^;]*setDepth\(30\)/, 'a full-screen warm cover that fades out');
  assert.match(scene, /this\.warm\.setAlpha\(Math\.max\(0, 1 - t \/ FINALE\.fadeInMs\)\)/);
  assert.match(scene, /if \(this\.textures\.exists\(key\)\) return;/, 'a second run in the same session reuses the baked textures');
  assert.equal((scene.match(/keyboard\.on\(/g) || []).length, 3, 'keydown + keyup per blow key, and Esc');
  assert.match(scene, /this\.cameras\.main\.fadeOut\(FINALE\.leaveFadeMs, 0, 0, 0\)/, 'fades to black into the card, which fades in from black');
});

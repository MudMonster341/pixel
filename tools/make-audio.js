// Builds the game's shipped audio (M5, docs/ROADMAP.md) the same way tools/make-assets.js builds
// its shipped art: reads raw material that must never ship as-is, and writes committed, game-owned
// files that do. For art that's baking vendor pixels into a new PNG (decode -> recolor -> encode);
// for audio there's no pixel work to do, so it's mostly a straight copy -- but the *reason* is the
// same one ADR 0012 already established for art: package.json's packaged-build "files" list excludes
// `assets/vendor/**` entirely (tests/unit/packaging.test.js), because raw third-party packs are
// licensed for use in this project, not for redistributing the packs themselves. A scene that loaded
// `assets/vendor/kenney-rpg-audio/Audio/footstep00.ogg` directly would work in the dev server but go
// silent in the shipped .exe. Copying the exact bytes into assets/audio/ (committed, not gitignored,
// not under assets/vendor/) is the audio equivalent of "baked into our generated sheets".
//
// A handful of sounds no CC0/credited pack covers (docs/ROADMAP.md M5 rule 6: "if you need a sound
// none of the packs have, generate it with a tiny synth... rather than downloading something
// unlicensed") are instead synthesized here, jsfxr-style: a few oscillator waveforms, a linear
// volume envelope, no dependencies, written straight to 16-bit PCM WAV.
//
// Run:  node tools/make-audio.js            (writes assets/audio/)
//       node tools/make-audio.js --out DIR  (writes elsewhere -- tests/unit/audio.test.js uses this
//                                             to check the committed files are up to date)
//
// See src/audio.js (SOUNDS registry -- every id there names a file this script writes), CREDITS.md
// ("Audio", added with this pass) and docs/STYLE_GUIDE.md ("Audio") for what plays when and why each
// source file was picked.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HB = require('./lib/happy-birthday');
const SAMPLE_RATE = 22050;

// ---------- tiny WAV encoder (mono, 16-bit PCM, no dependencies) ----------

function encodeWav(samples, sampleRate = SAMPLE_RATE) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16); // PCM sub-chunk size
  buffer.writeUInt16LE(1, 20); // format: PCM
  buffer.writeUInt16LE(1, 22); // channels: mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate (mono, 16-bit)
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  return buffer;
}

// ---------- tiny synth (jsfxr-style: one oscillator, one envelope, per note) ----------

// A fixed-seed PRNG (mulberry32), not Math.random(): tests/unit/assets.test.js re-runs this script
// into a scratch dir and diffs the bytes against the committed assets/audio/ to catch anything
// checked in out of date, the same way every other tools/make-*.js generator is checked -- that only
// works if "the noise wave" means the exact same bytes on every run, not a fresh random draw each time.
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// `freqFn(t)` (seconds since this tone started -> Hz) lets a tone sweep pitch, e.g. a jump's rising
// "boop". `ampFn(t)` (seconds -> 0..1) is the volume envelope; linearEnvelope() below covers the
// common attack/decay shape every sound here actually needs.
function tone(durationSec, freqFn, { wave = 'square', ampFn = () => 1, sampleRate = SAMPLE_RATE, seed = 1 } = {}) {
  const n = Math.round(durationSec * sampleRate);
  const samples = new Float32Array(n);
  let phase = 0;
  const random = wave === 'noise' ? seededRandom(seed) : null;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    if (wave === 'noise') {
      samples[i] = (random() * 2 - 1) * ampFn(t);
      continue;
    }
    phase += freqFn(t) / sampleRate;
    phase -= Math.floor(phase);
    let s;
    if (wave === 'square') s = phase < 0.5 ? 1 : -1;
    else if (wave === 'triangle') s = 1 - 4 * Math.abs(phase - 0.5);
    else s = Math.sin(phase * Math.PI * 2); // 'sine'
    samples[i] = s * ampFn(t);
  }
  return samples;
}

function concat(...chunks) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out;
}

// A quick linear fade in, then a linear fade out to silence over the rest of the tone -- every
// generated sound here is short and percussive, so one shape covers all of them.
function linearEnvelope(attack, duration) {
  return (t) => {
    if (t < attack) return t / attack;
    return Math.max(0, 1 - (t - attack) / (duration - attack));
  };
}

// ---------- the 4 sounds no CC0/credited pack has an obvious match for ----------
// (docs/ROADMAP.md M5: jump/flap/line-clear stingers, and a soft card whoosh)

function synthJump() {
  const dur = 0.16;
  return tone(dur, (t) => 320 + 480 * (t / dur), { wave: 'square', ampFn: linearEnvelope(0.01, dur) });
}

function synthFlap() {
  const dur = 0.14;
  return tone(dur, (t) => 640 - 340 * (t / dur), { wave: 'triangle', ampFn: linearEnvelope(0.005, dur) });
}

function synthLineClear() {
  // A short rising arpeggio (C5 E5 G5 C6) -- bright and quick, not a full fanfare (that's
  // key-awarded's job, a real pack jingle -- see VENDOR_COPIES below).
  const notes = [523.25, 659.25, 783.99, 1046.5];
  const noteDur = 0.07;
  return concat(...notes.map((freq) => tone(noteDur, () => freq, { wave: 'square', ampFn: linearEnvelope(0.005, noteDur) })));
}

function synthCardWhoosh() {
  const dur = 0.5;
  // One soft hump of filtered-sounding noise (a sine-shaped amplitude envelope over white noise
  // reads as "whoosh" without any real filtering) -- rises, peaks, falls, never sharp or startling.
  return tone(dur, () => 0, { wave: 'noise', ampFn: (t) => Math.sin((t / dur) * Math.PI) * 0.5 });
}

// P4b (FB-0064 / FB-0069): the lift's arrival chime -- a soft two-note "ding-dong" (E6 then C6), sine waves with a fast attack and a
// long exponential-ish tail, the way a real lift announces its floor.
function synthLiftDing() {
  const note = (freq, dur) => tone(dur, () => freq, { wave: 'sine', ampFn: (t) => Math.min(1, t / 0.004) * Math.exp(-t * 7) * 0.6 });
  return concat(note(1318.51, 0.2), note(1046.5, 0.45));
}

// P4c (FB-0067): the soft click a door (or lift) makes as it finishes closing behind her: a short burst of noise over a low sine "thunk",
// both dying away fast, quiet enough to sit under the footsteps. (The opening sound is the pack's door-open sample.)
function synthDoorClose() {
  const dur = 0.11;
  const click = tone(dur, () => 0, { wave: 'noise', seed: 7, ampFn: (t) => Math.exp(-t * 55) * 0.5 });
  const thunk = tone(dur, () => 150, { wave: 'sine', ampFn: (t) => Math.min(1, t / 0.003) * Math.exp(-t * 38) * 0.6 });
  return click.map((v, i) => v + thunk[i]);
}

// M2 (Mevin the drummer, docs/plans/2026-10-04-moments-and-small-touches.md): a tiny synth drum kit. Every hit is noise and/or a falling
// sine with a fast exponential decay (the fixed noise seeds keep the files byte-identical on every run, tests/unit/assets.test.js).
const mix = (...chunks) => {
  const out = new Float32Array(Math.max(...chunks.map((c) => c.length)));
  for (const c of chunks) for (let i = 0; i < c.length; i++) out[i] += c[i];
  return out;
};
// `at` seconds of silence in front of a chunk, so hits can be laid out on a timeline with mix().
const delayed = (at, chunk) => concat(new Float32Array(Math.round(at * SAMPLE_RATE)), chunk);
// A bright noise (a difference filter: the noise minus its previous sample keeps the highs), for snare rattle and cymbals.
const brighten = (samples) => samples.map((v, i) => (v - (i ? samples[i - 1] : 0)) * 0.7);

function synthKick() {
  const dur = 0.28;
  return tone(dur, (t) => 48 + 120 * Math.exp(-t * 28), { wave: 'sine', ampFn: (t) => Math.min(1, t / 0.002) * Math.exp(-t * 11) * 0.95 });
}

function synthSnare(seed = 3, dur = 0.2) {
  const rattle = brighten(tone(dur, () => 0, { wave: 'noise', seed, ampFn: (t) => Math.exp(-t * 24) * 0.8 }));
  const body = tone(dur, () => 190, { wave: 'triangle', ampFn: (t) => Math.exp(-t * 32) * 0.55 });
  return mix(rattle, body).map((v) => v * 0.7); // headroom: the two layers add up
}

function synthCrash() {
  const dur = 1.0;
  return brighten(tone(dur, () => 0, { wave: 'noise', seed: 11, ampFn: (t) => Math.min(1, t / 0.002) * Math.exp(-t * 4.2) * 0.7 }));
}

// A snare roll: ~1.5 s of quick snare taps that speed up and swell, ending on the last tap (the crash follows in the script).
function synthDrumRoll() {
  const taps = [];
  let t = 0;
  let i = 0;
  while (t < 1.45) {
    const k = t / 1.45;
    const gain = 0.35 + 0.65 * k; // crescendo
    taps.push(delayed(t, synthSnare(20 + i, 0.09).map((v) => v * gain)));
    t += 0.075 - 0.035 * k; // accelerating
    i++;
  }
  return mix(...taps).map((v) => v * 0.85);
}

// "Ba-dum-tss": a tom thump, a snare crack and a crash, the classic rimshot sting (~1 s).
function synthRimshot() {
  const tom = tone(0.2, (t) => 120 + 60 * Math.exp(-t * 20), { wave: 'sine', ampFn: (t) => Math.exp(-t * 14) * 0.9 });
  return mix(tom, delayed(0.17, synthSnare(31, 0.18)), delayed(0.4, synthCrash())).map((v) => v * 0.8);
}

// W3 (the birthday finale, src/scenes/finale.js): the sounds of the cake and the fireworks, and the chiptune song. Every noise uses a fixed
// seed, so the files are byte-identical on every run (tests/unit/assets.test.js).

// A soft breath, "pff": a short hump of noise, smoothed (a 3-sample average keeps the lows) so it never hisses.
function synthBlowPff() {
  const dur = 0.22;
  const noise = tone(dur, () => 0, { wave: 'noise', seed: 41, ampFn: (t) => Math.pow(Math.sin((t / dur) * Math.PI), 0.7) * 0.5 });
  return noise.map((v, i) => (v + (i > 0 ? noise[i - 1] : 0) + (i > 1 ? noise[i - 2] : 0)) / 3);
}

// A rocket going up: rising noise (smoothed more and more thinly: it gets brighter) under a thin rising whistle.
function synthFireworkWhoosh() {
  const dur = 0.7;
  const hiss = tone(dur, () => 0, { wave: 'noise', seed: 52, ampFn: (t) => Math.pow(t / dur, 1.4) * Math.exp(-Math.max(0, t - 0.55) * 18) * 0.5 });
  const whistle = tone(dur, (t) => 500 + 1500 * (t / dur), { wave: 'sine', ampFn: (t) => Math.pow(t / dur, 1.2) * Math.exp(-Math.max(0, t - 0.6) * 25) * 0.12 });
  return mix(brighten(hiss).map((v) => v * 1.4), whistle);
}

// The burst: a low thump and a bright crack of noise, both gone fast.
function synthFireworkPop() {
  const dur = 0.45;
  const thump = tone(dur, (t) => 70 + 90 * Math.exp(-t * 30), { wave: 'sine', ampFn: (t) => Math.min(1, t / 0.002) * Math.exp(-t * 9) * 0.8 });
  const crack = brighten(tone(dur, () => 0, { wave: 'noise', seed: 63, ampFn: (t) => Math.min(1, t / 0.001) * Math.exp(-t * 16) * 0.75 }));
  return mix(thump, crack).map((v) => v * 0.8);
}

// The sparkle that follows some bursts: ~30 tiny clicks at seeded times, thinning out and getting quieter.
function synthFireworkCrackle() {
  const dur = 0.9;
  const random = seededRandom(74);
  const clicks = [];
  for (let i = 0; i < 30; i++) {
    const at = Math.pow(random(), 1.6) * (dur - 0.05); // more clicks early, fewer late
    const gain = (1 - at / dur) * (0.3 + 0.7 * random());
    clicks.push(delayed(at, brighten(tone(0.02, () => 0, { wave: 'noise', seed: 80 + i, ampFn: (t) => Math.exp(-t * 200) * 0.9 * gain }))));
  }
  return mix(new Float32Array(Math.round(dur * SAMPLE_RATE)), ...clicks).map((v) => v * 0.8);
}

// "Happy Birthday to You" as a two-voice chiptune: a square-wave melody (a little vibrato on the long notes) over a triangle-wave
// "oom-pah-pah" bass. The tune and the chords are data in tools/lib/happy-birthday.js. About 14.9 s (src/finale.js FINALE.songMs).
function synthHappyBirthday() {
  const beat = 60 / HB.HAPPY_BIRTHDAY_BPM;
  const total = HB.HAPPY_BIRTHDAY_BEATS * beat + HB.HAPPY_BIRTHDAY_TAIL_SECONDS;
  const out = new Float32Array(Math.round(total * SAMPLE_RATE));
  const lay = (chunk, at) => {
    const start = Math.round(at * SAMPLE_RATE);
    for (let i = 0; i < chunk.length && start + i < out.length; i++) out[start + i] += chunk[i];
  };
  // melody
  let at = 0;
  const lastIndex = HB.HAPPY_BIRTHDAY_TUNE.length - 1;
  HB.HAPPY_BIRTHDAY_TUNE.forEach((note, i) => {
    const freq = HB.noteFreq(note.pitch);
    const dur = note.beats * beat + (i === lastIndex ? HB.HAPPY_BIRTHDAY_TAIL_SECONDS - 0.05 : 0);
    const sound = Math.min(dur, note.beats * beat * 0.92 + (i === lastIndex ? HB.HAPPY_BIRTHDAY_TAIL_SECONDS - 0.05 : 0)); // a tiny gap between notes
    const vibrato = (t) => freq * (1 + (t > 0.25 ? 0.006 * Math.sin(2 * Math.PI * 5.5 * t) : 0));
    const env = (t) => Math.min(1, t / 0.006) * (t < sound - 0.04 ? 0.85 + 0.15 * Math.exp(-t * 6) : Math.max(0, (sound - t) / 0.04) * 0.85) * (i === lastIndex ? Math.exp(-Math.max(0, t - note.beats * beat) * 2.5) : 1);
    lay(tone(sound, vibrato, { wave: 'square', ampFn: env }).map((v) => v * 0.3), at);
    at += note.beats * beat;
  });
  // bass: one chord per bar after the one-beat pick-up
  HB.HAPPY_BIRTHDAY_BASS.forEach(([root, upperA, upperB], bar) => {
    const barStart = (1 + 3 * bar) * beat;
    const pluck = (freq, dur, gain) => tone(dur, () => freq, { wave: 'triangle', ampFn: (t) => Math.min(1, t / 0.004) * Math.exp(-t * 5) * gain });
    lay(pluck(root, beat * 1.4, 0.5), barStart);
    lay(pluck(upperA, beat * 0.9, 0.3), barStart + beat);
    lay(pluck(upperB, beat * 0.9, 0.3), barStart + 2 * beat);
  });
  return out.map((v) => Math.max(-1, Math.min(1, v)));
}

const GENERATED = [
  { to: 'generated/minigame-jump.wav', build: synthJump },
  { to: 'generated/minigame-flap.wav', build: synthFlap },
  { to: 'generated/minigame-line-clear.wav', build: synthLineClear },
  { to: 'generated/card-whoosh.wav', build: synthCardWhoosh },
  { to: 'generated/lift-ding.wav', build: synthLiftDing },
  { to: 'generated/door-close.wav', build: synthDoorClose },
  { to: 'generated/drum-kick.wav', build: synthKick },
  { to: 'generated/drum-snare.wav', build: () => synthSnare() },
  { to: 'generated/drum-crash.wav', build: synthCrash },
  { to: 'generated/drum-roll.wav', build: synthDrumRoll },
  { to: 'generated/drum-rimshot.wav', build: synthRimshot },
  { to: 'generated/blow-pff.wav', build: synthBlowPff },
  { to: 'generated/firework-whoosh.wav', build: synthFireworkWhoosh },
  { to: 'generated/firework-pop.wav', build: synthFireworkPop },
  { to: 'generated/firework-crackle.wav', build: synthFireworkCrackle },
  { to: 'generated/happy-birthday.wav', build: synthHappyBirthday },
];

// ---------- everything else: copied byte-for-byte from an already-credited CC0 pack ----------
// Every `from` here is named in CREDITS.md's "Audio" section, with why it was picked.

const VENDOR_COPIES = [
  // Music (Aureolus_Omicron, "15 Melodic RPG Chiptunes", CC0) -- loops, crossfaded between by
  // src/audio.js AudioManager.playMusic() on scene/map changes.
  { from: 'assets/vendor/aureolus-15-melodic-rpg-chiptunes/rpgchip01_title_screen.ogg', to: 'music/title.ogg' },
  { from: 'assets/vendor/aureolus-15-melodic-rpg-chiptunes/rpgchip03_town.ogg', to: 'music/overworld.ogg' },
  { from: 'assets/vendor/aureolus-15-melodic-rpg-chiptunes/rpgchip07_the_shrine_of_mysteries.ogg', to: 'music/indoor.ogg' },
  { from: 'assets/vendor/aureolus-15-melodic-rpg-chiptunes/rpgchip11_airship.ogg', to: 'music/minigame.ogg' },
  { from: 'assets/vendor/aureolus-15-melodic-rpg-chiptunes/rpgchip02_bittersweet_story.ogg', to: 'music/card.ogg' },

  // Footsteps (Kenney RPG Audio, CC0) -- 4 outdoor + 4 indoor variants, cycled by src/scenes/world.js
  // movePlayer() so it's never the exact same sample twice in a row.
  { from: 'assets/vendor/kenney-rpg-audio/Audio/footstep00.ogg', to: 'sfx/footstep-outdoor-1.ogg' },
  { from: 'assets/vendor/kenney-rpg-audio/Audio/footstep01.ogg', to: 'sfx/footstep-outdoor-2.ogg' },
  { from: 'assets/vendor/kenney-rpg-audio/Audio/footstep02.ogg', to: 'sfx/footstep-outdoor-3.ogg' },
  { from: 'assets/vendor/kenney-rpg-audio/Audio/footstep03.ogg', to: 'sfx/footstep-outdoor-4.ogg' },
  { from: 'assets/vendor/kenney-rpg-audio/Audio/footstep06.ogg', to: 'sfx/footstep-indoor-1.ogg' },
  { from: 'assets/vendor/kenney-rpg-audio/Audio/footstep07.ogg', to: 'sfx/footstep-indoor-2.ogg' },
  { from: 'assets/vendor/kenney-rpg-audio/Audio/footstep08.ogg', to: 'sfx/footstep-indoor-3.ogg' },
  { from: 'assets/vendor/kenney-rpg-audio/Audio/footstep09.ogg', to: 'sfx/footstep-indoor-4.ogg' },

  // UI (Kenney UI Audio, CC0).
  { from: 'assets/vendor/kenney-ui-audio/Audio/rollover1.ogg', to: 'sfx/menu-move.ogg' },
  { from: 'assets/vendor/kenney-ui-audio/Audio/click3.ogg', to: 'sfx/menu-confirm.ogg' },
  { from: 'assets/vendor/kenney-ui-audio/Audio/switch1.ogg', to: 'sfx/dialog-blip.ogg' },

  // World sfx (Kenney RPG Audio, CC0).
  { from: 'assets/vendor/kenney-rpg-audio/Audio/handleCoins.ogg', to: 'sfx/item-pickup.ogg' },
  { from: 'assets/vendor/kenney-rpg-audio/Audio/doorOpen_1.ogg', to: 'sfx/door-open.ogg' },
  { from: 'assets/vendor/kenney-rpg-audio/Audio/creak1.ogg', to: 'sfx/warp-stairs.ogg' },
  { from: 'assets/vendor/kenney-rpg-audio/Audio/metalLatch.ogg', to: 'sfx/locked-door-thud.ogg' },
  { from: 'assets/vendor/kenney-rpg-audio/Audio/bookOpen.ogg', to: 'sfx/box-open.ogg' },

  // Stingers (Kenney Music Jingles, CC0) -- key-awarded (triumphant, metallic -- fits "a key"),
  // mini-game win (bright/playful) and mini-game lose (a short, light stab -- "tense but light",
  // never harsh, since nobody is ever actually locked out, docs/STORY.md).
  { from: 'assets/vendor/kenney-music-jingles/Audio/Steel jingles/jingles_STEEL00.ogg', to: 'sfx/key-awarded.ogg' },
  { from: 'assets/vendor/kenney-music-jingles/Audio/Pizzicato jingles/jingles_PIZZI00.ogg', to: 'sfx/minigame-win.ogg' },
  { from: 'assets/vendor/kenney-music-jingles/Audio/Hit jingles/jingles_HIT01.ogg', to: 'sfx/minigame-lose.ogg' },
];

// ---------- write everything ----------

const outFlag = process.argv.indexOf('--out');
const outDir = outFlag !== -1 ? path.resolve(process.argv[outFlag + 1]) : path.join(ROOT, 'assets', 'audio');

let copied = 0;
let missing = [];
for (const { from, to } of VENDOR_COPIES) {
  const src = path.join(ROOT, from);
  const dest = path.join(outDir, to);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (!fs.existsSync(src)) { missing.push(from); continue; }
  fs.copyFileSync(src, dest);
  copied++;
}

let generated = 0;
for (const { to, build } of GENERATED) {
  const dest = path.join(outDir, to);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, encodeWav(build()));
  generated++;
}

if (missing.length) {
  console.warn(`make-audio.js: ${missing.length} source file(s) missing (re-download the packs -- see CREDITS.md):`);
  for (const file of missing) console.warn(`  ${file}`);
}
console.log(`Wrote ${copied} copied + ${generated} generated audio file(s) to ${path.relative(ROOT, outDir)}/`);
if (missing.length) process.exitCode = 1;

module.exports = { encodeWav, tone, linearEnvelope, VENDOR_COPIES, GENERATED };

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

const GENERATED = [
  { to: 'generated/minigame-jump.wav', build: synthJump },
  { to: 'generated/minigame-flap.wav', build: synthFlap },
  { to: 'generated/minigame-line-clear.wav', build: synthLineClear },
  { to: 'generated/card-whoosh.wav', build: synthCardWhoosh },
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

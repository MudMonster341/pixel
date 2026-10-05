// The audio manager (docs/ROADMAP.md M5, docs/ARCHITECTURE.md "content is data, the engine is
// code"): a data table of every sound the game can play, plus the engine code that loads, plays,
// crossfades and volumes them. Content (which file, how loud, does it loop, which slider controls
// it) lives in SOUNDS below; nothing else in the game hard-codes a filename or a volume number.
//
// Every file SOUNDS points at lives under assets/audio/ (never assets/vendor/ directly -- see
// tools/make-audio.js's own header for why: the packaged .exe build excludes assets/vendor/**
// entirely, docs/decisions/0012). Run `npm run audio` (or `npm run assets`, which includes it) after
// changing this table or tools/make-audio.js.
//
// AudioManager is a plain object, not a Phaser class -- it outlives any one scene (music must keep
// playing across a map-change scene restart, a paused-for-a-cutscene world, a mini-game launched on
// top) and it has to stay loadable in the node:test sandbox (tests/helpers/game-data.js) for the
// data-only unit tests, which never construct a real Phaser.Game. Every method that touches
// `this.game`/Phaser guards for it being null first, so requiring this file never throws even where
// no game exists yet.

// ---------- the sound registry: id -> { file, volume, loop, category } ----------
// `category` picks which GameState.settings slider controls it (docs/ROADMAP.md M5 "categories"):
// 'music' -- the music slider; 'sfx' and 'ui' both -- the sfx slider (a menu click is "sound effects"
// to a player the same as a footstep is, even though it's drawn by ui.js not world.js). `volume` is
// this sound's own mix level (0..1) *before* the category slider and mute are applied -- see
// AudioManager.effectiveVolume() below -- so a naturally loud sample (a jingle) and a naturally quiet
// one (a footstep) can share one slider without one drowning out the other.
const SOUNDS = {
  // ---------- music: looping beds, crossfaded between on scene/map changes (never cut) ----------
  titleMusic: { file: 'assets/audio/music/title.ogg', volume: 0.5, loop: true, category: 'music' },
  overworldMusic: { file: 'assets/audio/music/overworld.ogg', volume: 0.42, loop: true, category: 'music' },
  indoorMusic: { file: 'assets/audio/music/indoor.ogg', volume: 0.36, loop: true, category: 'music' },
  minigameMusic: { file: 'assets/audio/music/minigame.ogg', volume: 0.4, loop: true, category: 'music' },
  cardMusic: { file: 'assets/audio/music/card.ogg', volume: 0.48, loop: true, category: 'music' },

  // ---------- footsteps: rate-limited in src/scenes/world.js movePlayer(), a softer/different set
  // indoors (no running indoors either, FB-0017, so the cadence is naturally slower there too) ----------
  footstepOutdoor1: { file: 'assets/audio/sfx/footstep-outdoor-1.ogg', volume: 0.3, loop: false, category: 'sfx' },
  footstepOutdoor2: { file: 'assets/audio/sfx/footstep-outdoor-2.ogg', volume: 0.3, loop: false, category: 'sfx' },
  footstepOutdoor3: { file: 'assets/audio/sfx/footstep-outdoor-3.ogg', volume: 0.3, loop: false, category: 'sfx' },
  footstepOutdoor4: { file: 'assets/audio/sfx/footstep-outdoor-4.ogg', volume: 0.3, loop: false, category: 'sfx' },
  footstepIndoor1: { file: 'assets/audio/sfx/footstep-indoor-1.ogg', volume: 0.18, loop: false, category: 'sfx' },
  footstepIndoor2: { file: 'assets/audio/sfx/footstep-indoor-2.ogg', volume: 0.18, loop: false, category: 'sfx' },
  footstepIndoor3: { file: 'assets/audio/sfx/footstep-indoor-3.ogg', volume: 0.18, loop: false, category: 'sfx' },
  footstepIndoor4: { file: 'assets/audio/sfx/footstep-indoor-4.ogg', volume: 0.18, loop: false, category: 'sfx' },

  // ---------- ui: menu move/confirm (title menu, pause menu, dialog choices) and the dialog
  // typewriter's own blip (rate-limited so it doesn't buzz, src/scenes/ui.js DialogBox.update()) ----------
  menuMove: { file: 'assets/audio/sfx/menu-move.ogg', volume: 0.35, loop: false, category: 'ui' },
  menuConfirm: { file: 'assets/audio/sfx/menu-confirm.ogg', volume: 0.45, loop: false, category: 'ui' },
  dialogBlip: { file: 'assets/audio/sfx/dialog-blip.ogg', volume: 0.14, loop: false, category: 'ui' },

  // ---------- world sfx ----------
  itemPickup: { file: 'assets/audio/sfx/item-pickup.ogg', volume: 0.5, loop: false, category: 'sfx' },
  keyAwarded: { file: 'assets/audio/sfx/key-awarded.ogg', volume: 0.55, loop: false, category: 'sfx' },
  doorOpen: { file: 'assets/audio/sfx/door-open.ogg', volume: 0.45, loop: false, category: 'sfx' },
  warpStairs: { file: 'assets/audio/sfx/warp-stairs.ogg', volume: 0.4, loop: false, category: 'sfx' },
  lockedDoorThud: { file: 'assets/audio/sfx/locked-door-thud.ogg', volume: 0.5, loop: false, category: 'sfx' },
  // P4b (FB-0064 / FB-0069): the Main Block lift's arrival chime, synthesized (no pack has a clean two-note lift ding).
  liftDing: { file: 'assets/audio/generated/lift-ding.wav', volume: 0.5, loop: false, category: 'sfx' },
  // P4c (FB-0067): the soft click of a door or lift finishing its closing animation, synthesized (tools/make-audio.js synthDoorClose()).
  doorClose: { file: 'assets/audio/generated/door-close.wav', volume: 0.3, loop: false, category: 'sfx' },
  // M2 (Mevin the drummer, tools/make-audio.js synthKick() ...): a tiny synth drum kit, played in time with the kit's frames by the
  // moment's script (src/scripts.js SCRIPTS.momentMevin). The roll runs about 1.5 s, the rimshot about 1 s.
  drumKick: { file: 'assets/audio/generated/drum-kick.wav', volume: 0.6, loop: false, category: 'sfx' },
  drumSnare: { file: 'assets/audio/generated/drum-snare.wav', volume: 0.5, loop: false, category: 'sfx' },
  drumCrash: { file: 'assets/audio/generated/drum-crash.wav', volume: 0.4, loop: false, category: 'sfx' },
  drumRoll: { file: 'assets/audio/generated/drum-roll.wav', volume: 0.5, loop: false, category: 'sfx' },
  drumRimshot: { file: 'assets/audio/generated/drum-rimshot.wav', volume: 0.5, loop: false, category: 'sfx' },
  // M3 (Prof. Raja's chariot, tools/make-audio.js synthChariotRumble()/synthChariotHorn()): a swelling gallop (~2.1 s) and a two-note horn (~0.9 s),
  // played by the moment's script (src/scripts.js SCRIPTS.momentChariot).
  chariotRumble: { file: 'assets/audio/generated/chariot-rumble.wav', volume: 0.55, loop: false, category: 'sfx' },
  chariotHorn: { file: 'assets/audio/generated/chariot-horn.wav', volume: 0.5, loop: false, category: 'sfx' },

  // ---------- mini-games (src/minigames/): jump/flap/line-clear are synth-generated (no pack had a
  // clean match, docs/ROADMAP.md M5 rule 6); win/lose reuse Kenney jingles ----------
  minigameJump: { file: 'assets/audio/generated/minigame-jump.wav', volume: 0.5, loop: false, category: 'sfx' },
  minigameFlap: { file: 'assets/audio/generated/minigame-flap.wav', volume: 0.45, loop: false, category: 'sfx' },
  // (FB-0074: the old line-clear chime is now the tower climb's "new floor" ding and the closing heart pop; the file keeps its name.)
  minigameLineClear: { file: 'assets/audio/generated/minigame-line-clear.wav', volume: 0.5, loop: false, category: 'sfx' },
  minigameLose: { file: 'assets/audio/sfx/minigame-lose.ogg', volume: 0.5, loop: false, category: 'sfx' },
  minigameWin: { file: 'assets/audio/sfx/minigame-win.ogg', volume: 0.55, loop: false, category: 'sfx' },

  // ---------- the ending ----------
  boxOpen: { file: 'assets/audio/sfx/box-open.ogg', volume: 0.5, loop: false, category: 'sfx' },
  cardWhoosh: { file: 'assets/audio/generated/card-whoosh.wav', volume: 0.4, loop: false, category: 'sfx' },
  // W3 (the birthday finale, src/scenes/finale.js, tools/make-audio.js synthHappyBirthday() ...): a soft "pff" per candle blown out, the
  // rocket / burst / sparkle of the fireworks, and the chiptune "Happy Birthday to You" (~14.9 s, played ONCE through playMusic(): the
  // card's own bed fades back in when the card starts, so it is a 'music' sound that does not loop).
  blowPff: { file: 'assets/audio/generated/blow-pff.wav', volume: 0.35, loop: false, category: 'sfx' },
  fireworkWhoosh: { file: 'assets/audio/generated/firework-whoosh.wav', volume: 0.3, loop: false, category: 'sfx' },
  fireworkPop: { file: 'assets/audio/generated/firework-pop.wav', volume: 0.4, loop: false, category: 'sfx' },
  fireworkCrackle: { file: 'assets/audio/generated/firework-crackle.wav', volume: 0.3, loop: false, category: 'sfx' },
  happyBirthday: { file: 'assets/audio/generated/happy-birthday.wav', volume: 0.55, loop: false, category: 'music', oneShot: true },
  // W6 (selfie mode, src/selfie.js, tools/make-audio.js synthShutter()): the camera's "ka-chk" under the white flash (~0.2 s).
  shutter: { file: 'assets/audio/generated/shutter.wav', volume: 0.5, loop: false, category: 'sfx' },
};

const AUDIO_CATEGORIES = ['music', 'sfx', 'ui'];
const MUSIC_CROSSFADE_MS = 600;

function clampVolume(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

// ---------- the manager ----------

const AudioManager = {
  game: null,
  music: null, // the currently-playing Phaser Sound object, or null
  musicId: null, // its SOUNDS key, or null
  lastPlayedAt: {}, // per-throttle-key cooldown clock, see playThrottled()
  gestureBound: false,

  // Called once from src/main.js after the real Phaser.Game exists. Never called in unit tests
  // (tests/helpers/game-data.js's sandbox has no Phaser.Game), so every other method below has to
  // keep working -- as a safe no-op -- with `this.game` still null.
  init(game) {
    this.game = game;
    if (!GameState.settings) GameState.settings = defaultSettings();
    this.bindGestureResume();
  },

  // Registers every sound with the scene's own loader, alongside everything else BootScene.preload()
  // loads (src/main.js). "Never let a missing file throw; log and continue" (this task's own rule):
  // a per-file 'loaderror' just warns -- the sound simply won't be in `scene.cache.audio` afterwards,
  // and every play()/playMusic() call below already checks for that before doing anything.
  preload(scene) {
    for (const [id, def] of Object.entries(SOUNDS)) {
      if (!scene.cache.audio.exists(id)) scene.load.audio(id, def.file);
    }
    scene.load.on('loaderror', (file) => {
      if (SOUNDS[file.key]) console.warn(`audio.js: could not load sound "${file.key}" (${SOUNDS[file.key].file}) -- continuing without it`);
    });
  },

  // Browser autoplay rules (this task's own rule 5): a Web Audio context only starts after a real
  // user gesture. Phaser's own SoundManager already queues any play()/playMusic() called before that
  // and flushes the queue the first time it unlocks (a document-level pointerdown/keydown/touchstart
  // listener Phaser wires up itself) -- so nothing here is strictly needed for the *first* sound to
  // eventually play. What Phaser doesn't do is retry if the context gets suspended again later (some
  // browsers do this on a tab losing focus); this resumes it on every later gesture too, so the game
  // is never silently, permanently stuck silent after the very first unlock.
  bindGestureResume() {
    if (this.gestureBound || typeof document === 'undefined') return;
    this.gestureBound = true;
    const resume = () => {
      const ctx = this.game && this.game.sound && this.game.sound.context;
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    };
    document.addEventListener('pointerdown', resume);
    document.addEventListener('keydown', resume);
  },

  categoryVolume(category) {
    const settings = GameState.settings || defaultSettings();
    if (settings.muted) return 0;
    if (category === 'music') return clampVolume(settings.musicVolume);
    return clampVolume(settings.sfxVolume); // 'sfx' and 'ui' share one slider
  },

  effectiveVolume(id) {
    const def = SOUNDS[id];
    if (!def) return 0;
    return def.volume * this.categoryVolume(def.category);
  },

  // A missing/not-yet-loaded sound (preload() failed, or this is running in a context that never
  // preloaded at all, e.g. a unit test) is a silent no-op, not an error -- this task's own rule.
  loaded(id) {
    return Boolean(this.game && this.game.cache && this.game.cache.audio && this.game.cache.audio.exists(id));
  },

  // A one-shot sound (sfx/ui/a music stinger played once). Never throws.
  play(id) {
    if (!this.game || !SOUNDS[id] || !this.loaded(id)) return;
    try {
      this.game.sound.play(id, { volume: this.effectiveVolume(id) });
    } catch (error) {
      console.warn(`audio.js: could not play "${id}"`, error);
    }
  },

  // Rate-limited variant for anything that could otherwise fire many times a second (footsteps, the
  // dialog typewriter blip). `key` groups independent cooldowns -- an indoor footstep and the dialog
  // blip don't throttle each other -- and `now` is whatever clock the caller is already using
  // (Phaser's scene `time`), not Date.now(), so it lines up with the game's own frame timing.
  playThrottled(id, key, minIntervalMs, now) {
    const last = this.lastPlayedAt[key] || 0;
    if (now - last < minIntervalMs) return false;
    this.lastPlayedAt[key] = now;
    this.play(id);
    return true;
  },

  // Crossfades to a new looping music bed instead of cutting (this task's own rule 2). A no-op if
  // the requested track is already the current one -- keyed on id alone, deliberately *not* also
  // checking `this.music.isPlaying`: a headless/no-real-audio-device environment (Playwright,
  // docs/TESTING.md) can leave a WebAudioSound's `isPlaying` flag unreliable, and this method runs on
  // every single WorldScene.create() (every map warp, every scene.restart()) -- trusting `isPlaying`
  // meant nearly every restart onto the *same* kind of map (outdoor->outdoor, say) span up a brand
  // new Sound instance instead of recognising the track hadn't actually changed, which piled up
  // leaked instances across a long play session/test run and made every one of them measurably
  // slower. A missing file fades out whatever was playing (rather than throwing) and leaves the game
  // in a clean "no music" state -- preload()'s own 'loaderror' handler already logged why. Every
  // Phaser Sound Manager call here is wrapped: this task's own rule ("never let a missing file
  // throw") applies to every audio operation, not just loading.
  playMusic(id, { crossfadeMs = MUSIC_CROSSFADE_MS } = {}) {
    if (!this.game || !SOUNDS[id]) return;
    if (this.musicId === id && this.music) return;
    const def = SOUNDS[id];
    const previous = this.music;
    this.musicId = id;
    this.music = null;

    if (!this.loaded(id)) {
      if (previous) this.fadeOutAndStop(previous, crossfadeMs);
      return;
    }

    try {
      const next = this.game.sound.add(id, { loop: def.loop !== false, volume: 0 });
      next.play();
      this.tweenVolume(next, this.effectiveVolume(id), crossfadeMs);
      this.music = next;
    } catch (error) {
      console.warn(`audio.js: could not start music "${id}"`, error);
    }
    if (previous && previous !== this.music) this.fadeOutAndStop(previous, crossfadeMs);
  },

  stopMusic(crossfadeMs = MUSIC_CROSSFADE_MS) {
    if (this.music) this.fadeOutAndStop(this.music, crossfadeMs);
    this.music = null;
    this.musicId = null;
  },

  // Stops *and destroys* the outgoing sound once it's faded to silence -- stop() alone leaves it
  // registered in the Sound Manager forever (see playMusic()'s own comment above for why that matters).
  fadeOutAndStop(sound, ms) {
    this.tweenVolume(sound, 0, ms, () => {
      try { sound.stop(); sound.destroy(); } catch (error) { /* already gone */ }
    });
  },

  // A tiny manual volume fade, independent of any scene's own Tween Manager -- music has to survive
  // a scene restart (a map change restarts 'world' entirely, killing its tweens) and keep fading on
  // schedule regardless, since AudioManager itself is a plain object that outlives every scene.
  tweenVolume(sound, target, ms, onDone) {
    if (ms <= 0) { try { sound.setVolume(target); } catch (error) { /* sound already gone */ } if (onDone) onDone(); return; }
    const start = sound.volume;
    const startedAt = Date.now();
    const step = () => {
      const t = Math.min(1, (Date.now() - startedAt) / ms);
      try { sound.setVolume(start + (target - start) * t); } catch (error) { return; } // destroyed mid-fade
      if (t < 1) {
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(step);
        else setTimeout(step, 16);
      } else if (onDone) onDone();
    };
    step();
  },

  // ---------- settings: reachable from the pause menu and the title's Controls panel
  // (src/scenes/ui.js ControlsPanel), saved with the rest of GameState (src/save.js), applied
  // immediately (the currently-playing music's volume updates the instant a slider moves). ----------
  setVolume(category, value) {
    const settings = GameState.settings || (GameState.settings = defaultSettings());
    const clamped = clampVolume(value);
    if (category === 'music') settings.musicVolume = clamped;
    else settings.sfxVolume = clamped; // 'sfx' and 'ui' share one slider
    this.applyMusicVolume();
    notifyStateChanged();
  },

  getVolume(category) {
    const settings = GameState.settings || defaultSettings();
    return category === 'music' ? settings.musicVolume : settings.sfxVolume;
  },

  setMuted(muted) {
    const settings = GameState.settings || (GameState.settings = defaultSettings());
    settings.muted = Boolean(muted);
    this.applyMusicVolume();
    notifyStateChanged();
  },

  isMuted() {
    return Boolean(GameState.settings && GameState.settings.muted);
  },

  applyMusicVolume() {
    if (this.music && this.musicId) {
      try { this.music.setVolume(this.effectiveVolume(this.musicId)); } catch (error) { /* sound gone */ }
    }
  },
};

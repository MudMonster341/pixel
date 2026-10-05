// Room 195's key mini-game (docs/STORY.md): the TOWER CLIMB, a "reverse Rapunzel" (docs/plans/2026-10-04-moments-and-small-touches.md
// M8). Taru climbs five floors of a tower to the short-haired prince waiting at the top window, his pet green chameleon on the
// sill, while a grumpy stone gargoyle at the top throws barrels and flower pots down. Every rule (the level, ladders, the climb,
// the seeded throws, hazards rolling and dropping, hearts, the win zone and the 150 s failsafe) lives in src/minigames/
// tower-logic.js as pure, unit-tested functions; this file only draws that state and forwards the keys, the same split as
// flappy.js / flappy-logic.js. The shared shell (intro card, HUD "FLOOR: n / 5", game over with the skip after 3 losses, win card,
// Esc to quit) is MinigameBaseScene (framework-scene.js): a round always ends, and nobody is ever locked out. FB-0082: before the intro card, the
// shell plays a short backstory (MINIGAMES.tower.story: the prince is stuck in Rapunzel's tower, she is the one who rescues him) over the tower's own
// backdrop; drawStoryArt() below puts the prince, the chameleon, the gargoyle and the princess on it, page by page.
//
// Art (tools/make-minigame-art.js): tower-bg.png is generated at half scale (480x270) and stretched 2x like the other backdrops;
// the sprites (tower-sprites.png, 32x32 cells; tower-prince.png, 16x24 frames) and the lead herself are drawn at TW_SCALE (2x).
// Princess = the lead's own sheet (so her clothes colour is kept) with a small crown on top.

const TW_SCALE = 2;
const TW_CELL = 32; // tower-sprites.png frame size
// The art's bottom edge in a cell: the barrel, pot, gargoyle and chameleon stand on this row, so their origin is
// (0.5, TW_FOOT_ROW / TW_CELL) and "feet at y" is literally true.
const TW_FOOT_ROW = 28;
const TW_FOOT_ORIGIN = TW_FOOT_ROW / TW_CELL;
// Frames of tower-sprites.png (the order tools/make-minigame-art.js writes them in).
const TW_FRAME = {
  gargoyle: 0, windupA: 1, windupB: 2, throw: 3, sad: 4,
  barrel: [8, 9], pot: 10, potSway: 11, heartFull: 12, heartEmpty: 13, crown: 14, puff: 15,
  chameleon: [16, 17, 18], flame: 19, sparkle: 20, shard: 21,
};
const TW_SEED = 195; // the same throws on every try: a retry is a pattern she can learn
const TW_BLINK_MS = 200; // the invulnerability blink (2.5 Hz, under the 3 Hz flash limit, docs/GAME_FEEL.md)
const TW_HURT_ALPHA = 0.35;
// The closing beat (after the win zone is reached, before the framework's win card): the prince leans out, the chameleon goes
// green -> pink -> green, a heart pops. Timeline in ms; the whole beat is TW_BEAT_END_MS and runs off playUpdate's own clock, so it
// can never hang (and Esc still quits during it).
const TW_BEAT = { lean: 300, pink: 700, heart: 1300, green: 1700 };
const TW_BEAT_END_MS = 2300;
const TW_GARGOYLE_THROW_MS = 320; // how long the throw pose shows
const TW_CROWN_DY = 42; // the crown sits this far above her feet

class TowerScene extends MinigameBaseScene {
  constructor() {
    super('minigame-tower');
  }

  preload() {
    if (!this.textures.exists('tower-bg')) this.load.image('tower-bg', 'assets/minigames/tower-bg.png');
    if (!this.textures.exists('tower-sprites')) {
      this.load.spritesheet('tower-sprites', 'assets/minigames/tower-sprites.png', { frameWidth: TW_CELL, frameHeight: TW_CELL });
    }
    if (!this.textures.exists('tower-prince')) {
      this.load.spritesheet('tower-prince', 'assets/minigames/tower-prince.png', { frameWidth: 16, frameHeight: 24 });
    }
  }

  buildScene() {
    this.add.image(0, 0, 'tower-bg').setOrigin(0, 0).setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setDepth(-10);

    // Torch flames on the brackets painted into the backdrop: a slow breathing scale (about 1 Hz), never a flicker.
    TOWER_LEVEL.torches.forEach((torch, i) => {
      const flame = this.add.sprite(torch.x, torch.y, 'tower-sprites', TW_FRAME.flame).setScale(TW_SCALE).setDepth(-8);
      this.tweens.add({ targets: flame, scaleY: TW_SCALE * 1.18, scaleX: TW_SCALE * 0.94, duration: 480 + (i % 3) * 70, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 90 });
    });

    // The top: the prince in his window, the chameleon on the sill, the gargoyle on its perch.
    const top = TOWER_LEVEL.floors[TOWER_LEVEL.topFloor];
    this.prince = this.add.sprite(TOWER_LEVEL.princeX, top.y, 'tower-prince', 0).setOrigin(0.5, 1).setScale(TW_SCALE).setDepth(6);
    if (!this.anims.exists('tower-prince-wait')) {
      this.anims.create({ key: 'tower-prince-wait', frames: this.anims.generateFrameNumbers('tower-prince', { frames: [0, 1] }), frameRate: 2, repeat: -1 });
    }
    this.chameleon = this.add.sprite(TOWER_LEVEL.sillX, TOWER_LEVEL.sillY, 'tower-sprites', TW_FRAME.chameleon[0])
      .setOrigin(0.5, TW_FOOT_ORIGIN).setScale(TW_SCALE).setDepth(6);
    const g = TOWER_LEVEL.gargoyle;
    this.gargoyle = this.add.sprite(g.x, g.y, 'tower-sprites', TW_FRAME.gargoyle).setOrigin(0.5, TW_FOOT_ORIGIN).setScale(TW_SCALE).setDepth(7);
    this.garg = { pose: 'idle', ms: 0 };

    // Hearts, top left (the HUD in the middle counts floors).
    this.hearts = [];
    for (let i = 0; i < TOWER_HEARTS; i++) {
      this.hearts.push(this.add.sprite(34 + i * 34, 30, 'tower-sprites', TW_FRAME.heartFull).setScale(TW_SCALE).setDepth(90));
    }

    // The lead: her own sheet, drawn at 2x, with a crown. Feet-anchored so the sprite stands exactly on the beam.
    ensurePlayerAnims(this);
    if (!this.anims.exists('walk-up')) { // the world scene normally made it already (same key, same frames)
      this.anims.create({ key: 'walk-up', frames: this.anims.generateFrameNumbers('player', { frames: [9, 10, 11, 12, 13, 14] }), frameRate: 12, repeat: -1 });
    }
    this.hero = this.add.sprite(TOWER_LEVEL.spawn.x, TOWER_LEVEL.spawn.y, 'player', HERO_IDLE_FRAME.left).setOrigin(0.5, 1).setScale(TW_SCALE).setDepth(10);
    this.crown = this.add.sprite(TOWER_LEVEL.spawn.x, TOWER_LEVEL.spawn.y - TW_CROWN_DY, 'tower-sprites', TW_FRAME.crown).setScale(TW_SCALE).setDepth(11);

    this.hazardSprites = new Map();
    this.beat = null;
    this.jumpQueued = false;
    this.hintShown = false;
    // SPACE is the jump (UP/W climb a ladder). Gated on `playing` and cleared in startAttempt(): the same Space press that
    // confirmed START / RETRY must not also make her hop on the first frame (FB-0042).
    this.input.keyboard.on('keydown-SPACE', (event) => {
      if (!event.repeat && this.mgState === 'playing' && !this.beat) this.jumpQueued = true;
    });
  }

  // The backstory's little picture for page `index` (framework-scene.js drawStoryArt()), the same sprites the game itself uses, standing where they
  // stand in play on the tower-bg backdrop the shell draws behind the pages: the prince at his window from the first page, the chameleon and the
  // gargoyle from the second, the crowned princess (with her own clothes colour) on a beam above the card from the third.
  drawStoryArt(index) {
    const top = TOWER_LEVEL.floors[TOWER_LEVEL.topFloor];
    const add = (sprite) => { this.storyParts.push(sprite.setDepth(199.5)); return sprite; };
    add(this.add.sprite(TOWER_LEVEL.princeX, top.y, 'tower-prince', 0).setOrigin(0.5, 1).setScale(TW_SCALE));
    if (index >= 1) {
      add(this.add.sprite(TOWER_LEVEL.sillX, TOWER_LEVEL.sillY, 'tower-sprites', TW_FRAME.chameleon[0]).setOrigin(0.5, TW_FOOT_ORIGIN).setScale(TW_SCALE));
      const g = TOWER_LEVEL.gargoyle;
      add(this.add.sprite(g.x, g.y, 'tower-sprites', TW_FRAME.gargoyle).setOrigin(0.5, TW_FOOT_ORIGIN).setScale(TW_SCALE));
    }
    if (index >= 2 && this.textures.exists('player')) {
      const beam = TOWER_LEVEL.floors[TOWER_LEVEL.topFloor - 1]; // the floor under the top one: clear of the card at the bottom
      const x = TOWER_RIGHT - 130;
      add(this.add.sprite(x, beam.y, 'player', HERO_IDLE_FRAME.left).setOrigin(0.5, 1).setScale(TW_SCALE));
      add(this.add.sprite(x, beam.y - TW_CROWN_DY, 'tower-sprites', TW_FRAME.crown).setScale(TW_SCALE));
    }
  }

  startAttempt() {
    this.tw = createTowerState(TW_SEED);
    this.beat = null;
    this.jumpQueued = false;
    this.garg = { pose: 'idle', ms: 0 };
    for (const sprite of this.hazardSprites.values()) sprite.destroy();
    this.hazardSprites.clear();

    this.tweens.killTweensOf([this.hero, this.crown, this.prince, this.chameleon, this.gargoyle]);
    this.hero.setScale(TW_SCALE).setAlpha(1).setVisible(true);
    this.crown.setAlpha(1).setVisible(true);
    this.prince.setAngle(0).setScale(TW_SCALE).setY(TOWER_LEVEL.floors[TOWER_LEVEL.topFloor].y).anims.play('tower-prince-wait');
    this.chameleon.setFrame(TW_FRAME.chameleon[0]).setScale(TW_SCALE);
    this.gargoyle.setFrame(TW_FRAME.gargoyle).setAngle(0).setScale(TW_SCALE);
    this.refreshHearts();
    this.setScore(towerFloorsReached(this.tw));
    this.syncHero(0);
    if (!this.hintShown) {
      this.hintShown = true;
      this.showMessage('UP / DOWN AT A LADDER TO CLIMB');
    }
  }

  // ---------- one frame ----------

  playUpdate(time, delta) {
    if (this.beat) {
      this.updateBeat(delta);
      return;
    }
    const k = this.mgKeys;
    const input = {
      left: k.LEFT.isDown || k.A.isDown,
      right: k.RIGHT.isDown || k.D.isDown,
      up: k.UP.isDown || k.W.isDown,
      down: k.DOWN.isDown || k.S.isDown,
      jumpPressed: this.jumpQueued,
    };
    this.jumpQueued = false;
    const events = stepTower(this.tw, input, delta);
    for (const event of events) this.handleEvent(event);
    this.syncHero(delta);
    this.syncHazards();
    this.syncGargoyle(delta);
  }

  handleEvent(event) {
    const p = this.tw.player;
    switch (event.type) {
      case 'jump':
        AudioManager.play('minigameJump');
        squashStretch(this, this.hero, 'stretch', TW_SCALE);
        break;
      case 'land':
        spawnDustPuff(this, p.x, p.y);
        squashStretch(this, this.hero, 'squash', TW_SCALE);
        break;
      case 'floor':
        AudioManager.play('minigameLineClear'); // the little "ding" for a new floor (it was the old line-clear chime)
        this.setScore(towerFloorsReached(this.tw));
        break;
      case 'windup':
        this.garg = { pose: 'windup', ms: 0 };
        this.puffAtGargoyle();
        break;
      case 'throw':
        this.garg = { pose: 'throw', ms: 0 };
        break;
      case 'hit':
        AudioManager.play('lockedDoorThud');
        this.hurtHit(); // juice: a red pulse and a small shake (framework-scene.js)
        this.refreshHearts(true);
        break;
      case 'smash':
        this.shatter(event.x, event.y - 8);
        break;
      case 'poof':
        spawnDustPuff(this, event.x, event.y);
        break;
      case 'win':
        this.startBeat();
        break;
      case 'lose':
        this.lose();
        break;
      default:
    }
  }

  // ---------- drawing the state ----------

  syncHero(delta) {
    const p = this.tw.player;
    this.hero.setPosition(p.x, p.y);
    const dir = p.facing < 0 ? 'left' : 'right';
    this.hero.anims.timeScale = 1;
    if (p.mode === 'ladder') {
      this.hero.anims.play('walk-up', true); // back to us, climbing
      this.hero.anims.timeScale = p.climbing ? 1 : 0; // hold the pose while she is not moving on the ladder
    } else if (p.mode === 'air') {
      this.hero.anims.stop();
      this.hero.setFrame(HERO_IDLE_FRAME[dir]);
    } else if (p.vx !== 0) {
      this.hero.anims.play(`walk-${dir}`, true);
    } else {
      this.hero.anims.play(`idle-${dir}`, true);
    }
    const blinkAlpha = this.tw.invulnMs > 0 && Math.floor(this.tw.invulnMs / TW_BLINK_MS) % 2 === 1 ? TW_HURT_ALPHA : 1;
    this.hero.setAlpha(blinkAlpha);
    this.crown.setPosition(p.x, p.y - TW_CROWN_DY).setAlpha(blinkAlpha);
  }

  syncHazards() {
    const live = new Set();
    for (const h of this.tw.hazards) {
      live.add(h.id);
      let sprite = this.hazardSprites.get(h.id);
      if (!sprite) {
        const frame = h.kind === 'pot' ? TW_FRAME.pot : TW_FRAME.barrel[0];
        sprite = this.add.sprite(h.x, h.y, 'tower-sprites', frame).setOrigin(0.5, TW_FOOT_ORIGIN).setScale(TW_SCALE).setDepth(8);
        this.hazardSprites.set(h.id, sprite);
      }
      sprite.setPosition(h.x, h.y);
      if (h.kind === 'barrel') {
        sprite.setFrame(TW_FRAME.barrel[Math.floor(h.x / 8) % 2 === 0 ? 0 : 1]); // the lit band swaps as it rolls
        sprite.setAngle(h.mode === 'fall' ? h.y * 4 : 0);
      } else {
        sprite.setFrame(Math.floor(h.x / 12) % 2 === 0 ? TW_FRAME.pot : TW_FRAME.potSway);
        sprite.setAngle(h.mode === 'fall' ? -h.y * 4 : Math.sin(h.x / 9) * 14); // it wobbles along on its base
      }
    }
    for (const [id, sprite] of this.hazardSprites) {
      if (!live.has(id)) { sprite.destroy(); this.hazardSprites.delete(id); }
    }
  }

  // The gargoyle's telegraph: a wobble and a puff of dust before every throw, then the throw pose.
  syncGargoyle(delta) {
    this.garg.ms += delta;
    if (this.garg.pose === 'windup') {
      this.gargoyle.setFrame(this.garg.ms < TOWER_WINDUP_MS / 2 ? TW_FRAME.windupA : TW_FRAME.windupB);
      this.gargoyle.setAngle(Math.sin(this.garg.ms / 45) * 6);
    } else if (this.garg.pose === 'throw') {
      this.gargoyle.setFrame(TW_FRAME.throw).setAngle(0);
      if (this.garg.ms > TW_GARGOYLE_THROW_MS) this.garg = { pose: 'idle', ms: 0 };
    } else {
      this.gargoyle.setFrame(TW_FRAME.gargoyle).setAngle(0);
    }
  }

  puffAtGargoyle() {
    const g = TOWER_LEVEL.gargoyle;
    const puff = this.add.sprite(g.x + 10, g.y - 62, 'tower-sprites', TW_FRAME.puff).setScale(TW_SCALE).setDepth(9).setAlpha(0.9);
    this.tweens.add({ targets: puff, y: puff.y - 16, scale: TW_SCALE * 1.5, alpha: 0, duration: TOWER_WINDUP_MS, ease: 'Sine.easeOut', onComplete: () => puff.destroy() });
  }

  refreshHearts(pulse = false) {
    const left = this.tw.hearts;
    this.hearts.forEach((heart, i) => {
      heart.setFrame(i < left ? TW_FRAME.heartFull : TW_FRAME.heartEmpty);
      if (pulse && i === left) { // the one just lost
        this.tweens.killTweensOf(heart);
        heart.setScale(TW_SCALE * 1.6);
        this.tweens.add({ targets: heart, scale: TW_SCALE, duration: 260, ease: 'Back.easeOut' });
      }
    });
  }

  // A barrel or pot breaking on her: a few shards flying out and fading.
  shatter(x, y) {
    for (const dx of [-26, -9, 9, 26]) {
      const shard = this.add.sprite(x, y, 'tower-sprites', TW_FRAME.shard).setScale(TW_SCALE).setDepth(12);
      this.tweens.add({
        targets: shard, x: x + dx, y: y - 16 - Math.abs(dx), angle: dx * 6, alpha: 0,
        duration: 420, ease: 'Cubic.easeOut', onComplete: () => shard.destroy(),
      });
    }
  }

  // ---------- the closing beat ----------

  startBeat() {
    this.beat = { ms: 0, lean: false, pink: false, heart: false, green: false };
    this.setScore(TOWER_FLOOR_COUNT);
    for (const sprite of this.hazardSprites.values()) {
      this.tweens.add({ targets: sprite, alpha: 0, duration: 250, onComplete: () => sprite.destroy() });
    }
    this.hazardSprites.clear();
    const p = this.tw.player;
    this.hero.anims.stop();
    this.hero.setFrame(HERO_IDLE_FRAME[p.facing < 0 ? 'left' : 'right']).setAlpha(1);
    this.crown.setAlpha(1);
    this.gargoyle.setFrame(TW_FRAME.sad).setAngle(0);
    this.garg = { pose: 'sad', ms: 0 };
  }

  updateBeat(delta) {
    const b = this.beat;
    b.ms += delta;
    const top = TOWER_LEVEL.floors[TOWER_LEVEL.topFloor];
    if (!b.lean && b.ms >= TW_BEAT.lean) { // the prince notices her and leans out of the window
      b.lean = true;
      this.prince.anims.stop();
      this.prince.setFrame(2);
      this.tweens.add({ targets: this.prince, angle: 9, duration: 420, ease: 'Sine.easeOut' });
      this.tweens.add({ targets: this.prince, y: top.y - 6, duration: 160, yoyo: true, ease: 'Quad.easeOut' });
    }
    if (!b.pink && b.ms >= TW_BEAT.pink) { // the chameleon blushes
      b.pink = true;
      this.chameleon.setFrame(TW_FRAME.chameleon[1]);
      squashStretch(this, this.chameleon, 'stretch', TW_SCALE);
    }
    if (!b.heart && b.ms >= TW_BEAT.heart) { // a heart pops between them
      b.heart = true;
      const hx = (TOWER_LEVEL.princeX + this.tw.player.x) / 2;
      const heart = this.add.sprite(hx, top.y - 74, 'tower-sprites', TW_FRAME.heartFull).setScale(0.5).setDepth(20);
      this.tweens.add({ targets: heart, scale: TW_SCALE * 1.8, duration: 320, ease: 'Back.easeOut' });
      this.tweens.add({ targets: heart, y: heart.y - 26, alpha: 0, duration: 700, delay: 380, ease: 'Sine.easeIn', onComplete: () => heart.destroy() });
      AudioManager.play('minigameLineClear');
    }
    if (!b.green && b.ms >= TW_BEAT.green) { // ...and back to green
      b.green = true;
      this.chameleon.setFrame(TW_FRAME.chameleon[2]);
    }
    if (b.ms >= TW_BEAT_END_MS && !this.finished) {
      this.beat = null;
      this.win(); // the framework's win card hands over the key
    }
  }
}

// The Physics Lab key's mini-game (docs/STORY.md, FB-0066, docs/plans/2026-10-04-moments-and-small-touches.md "hero vs villain"):
// a small white kitten hero in a mask and cape fights a dark, bat-eared "shadow bat" on a lab rooftop. He shoots at her in readable
// volleys (an aimed bolt, another, a 3-bolt fan, a slow sweep), a robot-bat minion patrols the roof, she shoots star bolts (Z), and when
// he is beaten he hands over the key ("Fine, fine. Take it.") and she walks to it. GENERIC stand-ins (ADR 0021): the owner asked for
// two protected characters; nothing here is theirs. Every rule (the arena, her movement, the villain's plan with its wind-up telegraph,
// hearts, the shield, the minion, the key and the 150 s failsafe) lives in src/minigames/hero-logic.js as pure, unit-tested functions; this
// file only draws that state and forwards the keys, the same split as tower.js / tower-logic.js. The shared shell (intro card with the
// COVER picture, HUD "HITS: n / 9", game over with the skip after 3 losses, win card, Esc to quit) is MinigameBaseScene
// (framework-scene.js): a round always ends, and nobody is ever locked out.
//
// Keys: ARROWS / A D move, SPACE / UP / W jump, Z fires. Z is not one of the shell's card keys (Enter / Space / E / Up / Down / W / S), and
// the jump listeners only queue while `mgState === 'playing'`, so the press that confirms START or RETRY never jumps (FB-0042).
//
// Art (tools/make-minigame-art.js): hero-bg.png is generated at half scale (480x270) and stretched 2x; the sprites (hero-sprites.png, 32x32
// cells) are drawn at HVS_SCALE (2x), like the tower's; hero-cover.png (480x270, stretched 2x) is the intro card's background.

const HVS_SCALE = 2;
const HVS_CELL = 32; // hero-sprites.png frame size
// The art's feet row: the kitten's boots, the minion and the villain's cape hem sit on cell row 30, so their origin is (0.5, 31 / 32).
const HVS_FOOT_ORIGIN = 31 / HVS_CELL;
// Frames of hero-sprites.png (the order tools/make-minigame-art.js writes them in: 8 columns x 4 rows).
const HVS_FRAME = {
  idle: [0, 1], run: [2, 3, 4, 5], jump: 6, shoot: 7, hurt: 8, cheer: 9,
  vIdle: [10, 11], vWind: [12, 13], vFire: 14, vHurt: 15, vDown: 16,
  minion: [17, 18], minionDown: 19, bolt: [20, 21], star: [22, 23],
  heartFull: 24, heartEmpty: 25, spark: 26, ring: 27, puff: 28, sparkle: 29, shield: 30,
};
const HVS_BLINK_MS = 200; // the invulnerability blink (2.5 Hz, under the 3 Hz flash limit, docs/GAME_FEEL.md)
const HVS_HURT_ALPHA = 0.35;
const HVS_FIRE_POSE_MS = 280; // how long the villain's firing pose shows
const HVS_BAR = { x: GAME_WIDTH - 24 - 160, y: 26, w: 152, h: 12 }; // the villain's health bar: the frame is 80x10 drawn 2x, its window starts 4 px in
const HVS_VILLAIN_LINE = 'Fine, fine. Take it.';

class HeroScene extends MinigameBaseScene {
  constructor() {
    super('minigame-hero');
  }

  preload() {
    if (!this.textures.exists('hero-bg')) this.load.image('hero-bg', 'assets/minigames/hero-bg.png');
    if (!this.textures.exists('hero-cover')) this.load.image('hero-cover', 'assets/minigames/hero-cover.png');
    if (!this.textures.exists('hero-bar')) this.load.image('hero-bar', 'assets/minigames/hero-bar.png');
    if (!this.textures.exists('hero-sprites')) {
      this.load.spritesheet('hero-sprites', 'assets/minigames/hero-sprites.png', { frameWidth: HVS_CELL, frameHeight: HVS_CELL });
    }
  }

  buildScene() {
    this.add.image(0, 0, 'hero-bg').setOrigin(0, 0).setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setDepth(-10);

    for (const [key, frames, rate] of [['hv-idle', HVS_FRAME.idle, 3], ['hv-run', HVS_FRAME.run, 12]]) {
      if (!this.anims.exists(key)) this.anims.create({ key, frames: this.anims.generateFrameNumbers('hero-sprites', { frames }), frameRate: rate, repeat: -1 });
    }

    // The characters. The art faces right (kitten) / left (villain); the scene flips them to face each other.
    this.villain = this.add.sprite(780, HV_FLOOR_Y, 'hero-sprites', HVS_FRAME.vIdle[0]).setOrigin(0.5, HVS_FOOT_ORIGIN).setScale(HVS_SCALE).setDepth(7);
    this.shield = this.add.sprite(780, HV_FLOOR_Y, 'hero-sprites', HVS_FRAME.shield).setScale(HVS_SCALE).setDepth(8).setAlpha(0);
    this.minion = this.add.sprite(420, HV_FLOOR_Y, 'hero-sprites', HVS_FRAME.minion[0]).setOrigin(0.5, HVS_FOOT_ORIGIN).setScale(HVS_SCALE).setDepth(8);
    this.hero = this.add.sprite(HV_LEVEL.spawn.x, HV_FLOOR_Y, 'hero-sprites', HVS_FRAME.idle[0]).setOrigin(0.5, HVS_FOOT_ORIGIN).setScale(HVS_SCALE).setDepth(10);
    this.pickupSprite = this.add.sprite(0, 0, 'hero-sprites', HVS_FRAME.heartFull).setScale(HVS_SCALE).setDepth(9).setVisible(false);
    this.keyShadow = this.add.ellipse(0, 0, 26, 8, 0x000000, 0.3).setDepth(8).setVisible(false);
    this.keySprite = this.add.image(0, 0, 'items', ITEMS.keyPhysicsLab.frame).setScale(HVS_SCALE).setOrigin(0.5, 1).setDepth(9).setVisible(false);

    // Hearts, top left (the HUD in the middle counts hits); the villain's health bar, top right.
    this.hearts = [];
    for (let i = 0; i < HV_HEARTS; i++) {
      this.hearts.push(this.add.sprite(34 + i * 34, 30, 'hero-sprites', HVS_FRAME.heartFull).setScale(HVS_SCALE).setDepth(90));
    }
    this.barFill = this.add.rectangle(HVS_BAR.x + 4, HVS_BAR.y + 4, HVS_BAR.w, HVS_BAR.h, 0xb05cff).setOrigin(0, 0).setDepth(89);
    this.barFrame = this.add.image(HVS_BAR.x, HVS_BAR.y, 'hero-bar').setOrigin(0, 0).setScale(HVS_SCALE).setDepth(90);
    this.barLabel = uiText(this, HVS_BAR.x + 80, HVS_BAR.y - 8, 'SHADOW BAT', 8, COLORS.highlight).setOrigin(0.5).setDepth(91);
    pinToScreen([this.barFill, this.barFrame, this.barLabel, ...this.hearts]);

    this.boltSprites = new Map();
    this.shotSprites = new Map();
    this.bubble = null;
    this.hintShown = false;
    this.jumpQueued = false;
    this.shootKey = this.input.keyboard.addKey('Z');
    // SPACE / UP / W jump. Gated on `playing` and cleared in startAttempt(): the same press that confirmed START / RETRY must not also
    // make her hop on the first frame (FB-0042). The shell's card handlers are registered later than these, so on a retry this
    // listener still sees mgState 'gameover' for that press.
    const queueJump = (event) => { if (!event.repeat && this.mgState === 'playing') this.jumpQueued = true; };
    for (const key of ['SPACE', 'UP', 'W']) this.input.keyboard.on(`keydown-${key}`, queueJump);
  }

  startAttempt() {
    this.hv = createHeroFight();
    this.jumpQueued = false;
    this.fireMs = 0; // > 0 while the villain shows his firing pose
    this.windupSpriteMs = 0;
    for (const sprite of [...this.boltSprites.values(), ...this.shotSprites.values()]) sprite.destroy();
    this.boltSprites.clear();
    this.shotSprites.clear();
    if (this.bubble) { this.bubble.forEach((part) => part.destroy()); this.bubble = null; }
    this.tweens.killTweensOf([this.hero, this.villain, this.minion, this.keySprite, this.pickupSprite]);
    this.hero.setScale(HVS_SCALE).setAlpha(1).setVisible(true).setFlipX(false);
    this.villain.setScale(HVS_SCALE).setAlpha(1).setAngle(0).setFlipX(false).setFrame(HVS_FRAME.vIdle[0]);
    this.minion.setVisible(true).setAlpha(1).setFrame(HVS_FRAME.minion[0]);
    this.shield.setAlpha(0);
    this.keySprite.setVisible(false);
    this.keyShadow.setVisible(false);
    this.pickupSprite.setVisible(false);
    this.refreshHearts();
    this.refreshBar();
    this.setScore(0);
    this.syncAll(0);
    if (!this.hintShown) {
      this.hintShown = true;
      this.showMessage('BUBBLE UP: DODGE.  BUBBLE DOWN: SHOOT');
    }
  }

  // ---------- one frame ----------

  playUpdate(time, delta) {
    const k = this.mgKeys;
    const input = {
      left: k.LEFT.isDown || k.A.isDown,
      right: k.RIGHT.isDown || k.D.isDown,
      jumpPressed: this.jumpQueued,
      shoot: this.shootKey.isDown,
    };
    this.jumpQueued = false;
    const events = stepHeroFight(this.hv, input, delta);
    for (const event of events) this.handleEvent(event);
    if (this.mgState === 'playing') this.syncAll(delta);
  }

  handleEvent(event) {
    const hv = this.hv;
    const p = hv.player;
    switch (event.type) {
      case 'jump':
        AudioManager.play('minigameJump');
        squashStretch(this, this.hero, 'stretch', HVS_SCALE);
        break;
      case 'land':
        spawnDustPuff(this, p.x, p.y);
        squashStretch(this, this.hero, 'squash', HVS_SCALE);
        break;
      case 'shoot':
        AudioManager.play('minigameFlap');
        break;
      case 'windup':
        this.windupSpriteMs = 0;
        this.ringAtVillain();
        break;
      case 'volley':
        this.fireMs = HVS_FIRE_POSE_MS;
        break;
      case 'hit':
        AudioManager.play('lockedDoorThud');
        this.hurtFlash();
        this.refreshHearts(true);
        this.burst(p.x, p.y - 22);
        break;
      case 'heal':
        AudioManager.play('minigameLineClear');
        this.refreshHearts(true);
        this.burst(p.x, p.y - 30, HVS_FRAME.sparkle);
        break;
      case 'villainHit':
        AudioManager.play('minigameLineClear');
        this.setScore(heroHitsLanded(hv));
        this.refreshBar();
        this.burst(event.x, event.y);
        this.cameras.main.shake(90, 0.003);
        break;
      case 'clink':
        this.burst(event.x, event.y, HVS_FRAME.sparkle);
        break;
      case 'splat':
        spawnDustPuff(this, event.x, event.y);
        break;
      case 'minionDown':
        AudioManager.play('minigameFlap');
        this.burst(event.x, HV_FLOOR_Y - 14);
        break;
      case 'defeated':
        AudioManager.play('lockedDoorThud');
        this.cameras.main.shake(220, 0.006);
        this.burst(event.x, event.y - 32);
        this.showBubble(event.x);
        break;
      case 'keyDrop':
        this.hideBubble();
        this.keySprite.setVisible(true);
        this.keyShadow.setVisible(true);
        break;
      case 'keyLand':
        this.burst(event.x, HV_FLOOR_Y - 12, HVS_FRAME.sparkle);
        this.tweens.add({ targets: this.keySprite, y: '-=6', duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        break;
      case 'win':
        this.keySprite.setVisible(false);
        this.win(); // the framework's win card hands over the key
        break;
      case 'lose':
        this.hero.anims.stop();
        this.hero.setFrame(HVS_FRAME.hurt);
        this.lose();
        break;
      default:
    }
  }

  // ---------- drawing the state ----------

  syncAll(delta) {
    this.syncHero();
    this.syncVillain(delta);
    this.syncMinion();
    this.syncBolts();
    this.syncPickupAndKey();
  }

  syncHero() {
    const hv = this.hv;
    const p = hv.player;
    this.hero.setPosition(p.x, p.y);
    this.hero.setFlipX(p.facing < 0);
    if (hv.phase !== 'fight' && p.grounded && p.vx === 0) {
      this.hero.anims.stop();
      this.hero.setFrame(HVS_FRAME.cheer); // the fight is won: she is pleased
    } else if (!p.grounded) {
      this.hero.anims.stop();
      this.hero.setFrame(p.shotMs > 0 ? HVS_FRAME.shoot : HVS_FRAME.jump);
    } else if (p.shotMs > 0) {
      this.hero.anims.stop();
      this.hero.setFrame(HVS_FRAME.shoot);
    } else if (p.vx !== 0) {
      this.hero.anims.play('hv-run', true);
    } else {
      this.hero.anims.play('hv-idle', true);
    }
    const blink = hv.invulnMs > 0 && hv.phase === 'fight' && Math.floor(hv.invulnMs / HVS_BLINK_MS) % 2 === 1;
    this.hero.setAlpha(blink ? HVS_HURT_ALPHA : 1);
  }

  syncVillain(delta) {
    const hv = this.hv;
    const v = hv.villain;
    const feet = heroVillainFeetY(hv);
    this.villain.setPosition(v.x, feet);
    this.villain.setFlipX(hv.player.x > v.x); // the art faces left
    this.fireMs = Math.max(0, this.fireMs - delta);
    this.windupSpriteMs += delta;
    let frame = HVS_FRAME.vIdle[Math.floor(hv.t / 600) % 2];
    if (v.phase === 'down') frame = HVS_FRAME.vDown;
    else if (v.phase === 'windup') frame = this.windupSpriteMs < HV_WINDUP_MS / 2 ? HVS_FRAME.vWind[0] : HVS_FRAME.vWind[1];
    else if (v.phase === 'fire' || this.fireMs > 0) frame = HVS_FRAME.vFire;
    else if (v.invulnMs > HV_VILLAIN_HIT_INVULN_MS - 350) frame = HVS_FRAME.vHurt; // flinching right after a hit
    this.villain.setFrame(frame);
    this.villain.setAngle(v.phase === 'windup' ? Math.sin(this.windupSpriteMs / 45) * 3 : 0);
    const blink = v.phase !== 'down' && v.invulnMs > 0 && Math.floor(v.invulnMs / HVS_BLINK_MS) % 2 === 1;
    this.villain.setAlpha(blink ? 0.6 : 1);
    // the shield bubble: up whenever shots would do nothing (blinking after a hit, winding up, firing a sweep)
    const shielded = v.phase !== 'down' && heroVillainShielded(hv);
    this.shield.setPosition(v.x, feet - HV_VILLAIN_H / 2).setAlpha(shielded ? 0.75 : 0);
  }

  syncMinion() {
    const m = this.hv.minion;
    this.minion.setVisible(m.alive);
    if (!m.alive) return;
    this.minion.setPosition(m.x, HV_FLOOR_Y + Math.sin(this.hv.t / 160) * 2);
    this.minion.setFrame(HVS_FRAME.minion[Math.floor(this.hv.t / 240) % 2]);
  }

  syncBolts() {
    const hv = this.hv;
    const frame = Math.floor(hv.t / 120) % 2;
    const live = new Set();
    for (const b of hv.bolts) {
      live.add(b.id);
      let sprite = this.boltSprites.get(b.id);
      if (!sprite) {
        sprite = this.add.sprite(b.x, b.y, 'hero-sprites', HVS_FRAME.bolt[0]).setScale(HVS_SCALE).setDepth(9);
        this.boltSprites.set(b.id, sprite);
      }
      sprite.setPosition(b.x, b.y).setFrame(HVS_FRAME.bolt[frame]);
    }
    for (const [id, sprite] of this.boltSprites) if (!live.has(id)) { sprite.destroy(); this.boltSprites.delete(id); }
    const liveShots = new Set();
    for (const s of hv.shots) {
      liveShots.add(s.id);
      let sprite = this.shotSprites.get(s.id);
      if (!sprite) {
        sprite = this.add.sprite(s.x, s.y, 'hero-sprites', HVS_FRAME.star[0]).setScale(HVS_SCALE).setDepth(9);
        this.shotSprites.set(s.id, sprite);
      }
      sprite.setPosition(s.x, s.y).setFrame(HVS_FRAME.star[Math.floor(s.travelled / 24) % 2]).setAngle(s.travelled * 1.5 * s.dir);
    }
    for (const [id, sprite] of this.shotSprites) if (!liveShots.has(id)) { sprite.destroy(); this.shotSprites.delete(id); }
  }

  syncPickupAndKey() {
    const hv = this.hv;
    const pick = hv.pickup;
    this.pickupSprite.setVisible(Boolean(pick));
    if (pick) {
      // a heart bobbing on the roof; it blinks (slowly) in its last seconds
      this.pickupSprite.setPosition(pick.x, HV_FLOOR_Y - 16 + Math.sin(hv.t / 220) * 3);
      this.pickupSprite.setAlpha(pick.ms < 2500 && Math.floor(pick.ms / 300) % 2 === 1 ? 0.4 : 1);
    }
    if (hv.key) {
      if (!hv.key.landed) this.keySprite.setPosition(hv.key.x, hv.key.y);
      else this.keySprite.x = hv.key.x;
      this.keyShadow.setPosition(hv.key.x, HV_FLOOR_Y - 2);
      if (hv.key.landed && !this.tweens.isTweening(this.keySprite)) this.keySprite.y = HV_FLOOR_Y;
    }
  }

  refreshHearts(pulse = false) {
    const left = this.hv.hearts;
    this.hearts.forEach((heart, i) => {
      heart.setFrame(i < left ? HVS_FRAME.heartFull : HVS_FRAME.heartEmpty);
      if (pulse) {
        this.tweens.killTweensOf(heart);
        heart.setScale(HVS_SCALE * 1.5);
        this.tweens.add({ targets: heart, scale: HVS_SCALE, duration: 260, ease: 'Back.easeOut' });
      }
    });
  }

  refreshBar() {
    const frac = Math.max(0, this.hv.villain.hp) / HV_VILLAIN_HP;
    this.barFill.setSize(Math.round(HVS_BAR.w * frac), HVS_BAR.h);
    this.barFill.setFillStyle(heroVillainRage(this.hv) ? 0xff4d5e : 0xb05cff);
  }

  // ---------- effects ----------

  // The wind-up flash: one bright ring growing round him as he gathers energy (a single slow pulse, never a repeating flash).
  ringAtVillain() {
    const v = this.hv.villain;
    const ring = this.add.sprite(v.x, heroVillainFeetY(this.hv) - HV_VILLAIN_H / 2, 'hero-sprites', HVS_FRAME.ring).setScale(HVS_SCALE * 0.6).setDepth(9).setAlpha(0.95);
    this.tweens.add({
      targets: ring, scale: HVS_SCALE * 1.9, alpha: 0, duration: HV_WINDUP_MS, ease: 'Sine.easeOut', onComplete: () => ring.destroy(),
    });
  }

  // A small burst of sparks (a hit, a clink, a pickup).
  burst(x, y, frame = HVS_FRAME.spark) {
    const spark = this.add.sprite(x, y, 'hero-sprites', frame).setScale(HVS_SCALE * 0.6).setDepth(60);
    this.tweens.add({
      targets: spark, scale: HVS_SCALE * 1.4, alpha: 0, duration: 320, ease: 'Cubic.easeOut', onComplete: () => spark.destroy(),
    });
  }

  // One light pulse over the whole screen (a hit on her): a single fade, not a repeating flash.
  hurtFlash() {
    const flash = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xff4a4a, 0.28).setOrigin(0, 0).setDepth(250).setScrollFactor(0);
    this.tweens.add({ targets: flash, alpha: 0, duration: 240, ease: 'Cubic.easeOut', onComplete: () => flash.destroy() });
  }

  // The villain's line after he falls, in a speech bubble over him (the same panel look as the rest of the game).
  showBubble(x) {
    this.hideBubble();
    const w = 224;
    const h = 34;
    const bx = Math.round(Math.min(Math.max(x - w / 2, 12), GAME_WIDTH - w - 12));
    const by = HV_FLOOR_Y - HV_VILLAIN_H - 60;
    const panel = makePanel(this, bx, by, w, h).setDepth(95);
    const label = uiText(this, bx + w / 2, by + h / 2, HVS_VILLAIN_LINE, 10, COLORS.text).setOrigin(0.5).setDepth(96);
    const tail = this.add.triangle(0, 0, 0, 0, 14, 0, 7, 10, 0xffffff).setOrigin(0, 0).setPosition(Math.round(x) - 7, by + h - 1).setDepth(95).setAlpha(0.9);
    this.bubble = [panel, label, tail];
    this.bubble.forEach((part) => part.setAlpha(0));
    this.tweens.add({ targets: this.bubble, alpha: 1, duration: 200 });
  }

  hideBubble() {
    if (!this.bubble) return;
    const parts = this.bubble;
    this.bubble = null;
    this.tweens.add({ targets: parts, alpha: 0, duration: 200, onComplete: () => parts.forEach((part) => part.destroy()) });
  }

  onPanelShown() {
    this.hideBubble();
    if (this.shield) this.shield.setAlpha(0);
  }
}

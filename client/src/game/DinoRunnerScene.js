import Phaser from 'phaser';

export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 380;

function createDinoAudio() {
  let ctx = null;

  function getCtx() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return null;
    }
    if (!ctx) {
      ctx = new AudioCtx();
    }
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    return ctx;
  }

  function beep({ type = 'square', freq = 440, freqEnd, duration = 0.08, volume = 0.08, delay = 0 }) {
    try {
      const audio = getCtx();
      if (!audio) {
        return;
      }

      const start = audio.currentTime + delay;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(freq, start);
      if (freqEnd) {
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), start + duration);
      }
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    } catch {
      // Ignore audio errors so a blocked sound never stops play.
    }
  }

  return {
    unlock: getCtx,
    start() {
      beep({ type: 'sine', freq: 392, duration: 0.1, volume: 0.07 });
      beep({ type: 'sine', freq: 523, duration: 0.12, volume: 0.07, delay: 0.08 });
    },
    flap() {
      beep({ type: 'triangle', freq: 360, freqEnd: 620, duration: 0.1, volume: 0.06 });
    },
    score() {
      beep({ type: 'sine', freq: 784, duration: 0.07, volume: 0.08 });
      beep({ type: 'sine', freq: 988, duration: 0.1, volume: 0.08, delay: 0.06 });
    },
    hit() {
      beep({ type: 'square', freq: 160, freqEnd: 60, duration: 0.28, volume: 0.09 });
      beep({ type: 'triangle', freq: 120, freqEnd: 40, duration: 0.4, volume: 0.08, delay: 0.04 });
    },
    level() {
      beep({ type: 'sine', freq: 523, duration: 0.09, volume: 0.08 });
      beep({ type: 'sine', freq: 659, duration: 0.09, volume: 0.08, delay: 0.09 });
      beep({ type: 'sine', freq: 784, duration: 0.16, volume: 0.09, delay: 0.18 });
    },
    win() {
      beep({ type: 'sine', freq: 523, duration: 0.12, volume: 0.08 });
      beep({ type: 'sine', freq: 659, duration: 0.12, volume: 0.08, delay: 0.12 });
      beep({ type: 'sine', freq: 784, duration: 0.12, volume: 0.09, delay: 0.24 });
      beep({ type: 'sine', freq: 1046, duration: 0.28, volume: 0.1, delay: 0.36 });
    },
  };
}

const GROUND_HEIGHT = 54;
const DINO_X = 108;
const JUMP_VELOCITY = -580;
const JUMP_CUT_VELOCITY = -380;
const COYOTE_MS = 90;
const JUMP_LOCK_MS = 120;
const STARTING_LIVES = 3;
const INVULN_MS = 1600;
const OBSTACLES_PER_LEVEL = 20;
const MAX_LEVEL = 5;
const LEVELS = [
  { speed: 180, spawn: 2800, flyChance: 0.28 },
  { speed: 210, spawn: 2500, flyChance: 0.4 },
  { speed: 242, spawn: 2300, flyChance: 0.5 },
  { speed: 276, spawn: 2100, flyChance: 0.58 },
  { speed: 312, spawn: 1900, flyChance: 0.66 },
];

export default class DinoRunnerScene extends Phaser.Scene {
  constructor() {
    super('DinoRunnerScene');
  }

  create() {
    this.ended = false;
    this.won = false;
    this.playState = 'waiting';
    this.score = 0;
    this.level = 1;
    this.levelObstacles = 0;
    this.spawnedThisLevel = 0;
    this.ignoreJumpUntil = 0;
    this.coyoteUntil = 0;
    this.jumpHeld = false;
    this.airborne = false;
    this.lives = STARTING_LIVES;
    this.invulnUntil = 0;
    this.spawnEvent = null;
    this.audio = createDinoAudio();
    this.applyLevelSettings();

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x070b1c);
    this.add.rectangle(GAME_WIDTH / 2, 90, GAME_WIDTH, 180, 0x12163a, 0.55).setDepth(0);
    this.add.ellipse(180, 70, 260, 90, 0x3b1d6b, 0.22).setDepth(0);
    this.add.ellipse(540, 40, 300, 80, 0x1b3a6b, 0.18).setDepth(0);

    this.add.circle(640, 58, 38, 0xd7deff, 0.12).setDepth(0);
    this.add.circle(640, 58, 26, 0xc9d4f5).setDepth(0);
    this.add.circle(632, 52, 7, 0x9aa8d4, 0.55).setDepth(1);
    this.add.circle(648, 64, 5, 0x8b97c4, 0.4).setDepth(1);

    this.planets = [
      this.addPlanet(120, 88, 22, 0x6d4aff, 0x3d2a9e),
      this.addPlanet(410, 52, 14, 0xff7ab8, 0xb44a7a),
      this.addPlanet(690, 120, 18, 0x4ecdc4, 0x217a76),
    ];

    this.stars = [];
    for (let i = 0; i < 48; i += 1) {
      this.stars.push(this.addStar());
    }

    this.ground = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT - GROUND_HEIGHT / 2,
      GAME_WIDTH,
      GROUND_HEIGHT,
      0x1b1f3a
    );
    this.physics.add.existing(this.ground, true);
    this.ground.setDepth(3);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - GROUND_HEIGHT + 6, GAME_WIDTH, 8, 0x3a4278).setDepth(4);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 10, GAME_WIDTH, 20, 0x12162c).setDepth(3);

    this.dashes = [];
    for (let i = 0; i < 14; i += 1) {
      const dash = this.add.rectangle(i * 64, GAME_HEIGHT - 16, 30, 5, 0x5b64a3).setDepth(4);
      this.dashes.push(dash);
    }

    const dinoY = GAME_HEIGHT - GROUND_HEIGHT - 22;
    this.hit = this.add.rectangle(DINO_X, dinoY, 28, 40, 0x5cdb7a, 0);
    this.physics.add.existing(this.hit);
    this.hit.body.setSize(26, 36);
    this.hit.body.setOffset(1, 2);
    this.hit.body.setBounce(0);
    this.hit.body.setCollideWorldBounds(false);
    this.hit.body.setAllowGravity(true);
    this.hit.body.setMaxVelocity(0, 780);
    this.hit.setDepth(5);

    this.dino = this.buildDino(DINO_X, dinoY);
    this.shadow = this.add.ellipse(DINO_X, GAME_HEIGHT - GROUND_HEIGHT + 4, 36, 8, 0x7ee8ff, 0.22).setDepth(4);

    this.obstacles = this.physics.add.group({
      allowGravity: false,
      immovable: true,
    });

    this.physics.world.setBounds(-80, 0, GAME_WIDTH + 240, GAME_HEIGHT);
    this.physics.add.collider(this.hit, this.ground);
    this.physics.add.overlap(this.hit, this.obstacles, this.onHitObstacle, undefined, this);

    this.scoreText = this.add.text(16, 16, 'Score: 0', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '22px',
      color: '#ffffff',
      stroke: '#0b1026',
      strokeThickness: 6,
    });
    this.scoreText.setDepth(10);

    this.levelText = this.add.text(GAME_WIDTH / 2, 28, 'Level 1', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '22px',
      color: '#ffe566',
      stroke: '#0b1026',
      strokeThickness: 6,
    });
    this.levelText.setOrigin(0.5, 0.5);
    this.levelText.setDepth(10);

    this.livesIcons = [];
    for (let i = 0; i < STARTING_LIVES; i += 1) {
      const icon = this.add.circle(GAME_WIDTH - 70 + i * 22, 26, 8, 0xff6b9d);
      icon.setStrokeStyle(2, 0xffe1ea);
      icon.setDepth(10);
      this.livesIcons.push(icon);
    }

    this.bannerText = this.add.text(GAME_WIDTH / 2, 96, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '32px',
      color: '#ffe566',
      stroke: '#0b1026',
      strokeThickness: 8,
    });
    this.bannerText.setOrigin(0.5);
    this.bannerText.setDepth(12);
    this.bannerText.setVisible(false);

    this.hintText = this.add.text(GAME_WIDTH / 2, 80, 'Press Start when you are ready!', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#ffffff',
      stroke: '#0b1026',
      strokeThickness: 5,
      align: 'center',
      wordWrap: { width: 560 },
    });
    this.hintText.setOrigin(0.5);
    this.hintText.setDepth(10);

    this.physics.pause();

    this.input.keyboard?.addCapture(['SPACE', 'P', 'ESC']);
    this.input.keyboard?.on('keydown-SPACE', this.onSpace, this);
    this.input.keyboard?.on('keyup-SPACE', this.endJumpHold, this);
    this.input.keyboard?.on('keydown-P', this.togglePause, this);
    this.input.keyboard?.on('keydown-ESC', this.togglePause, this);
    this.input.on('pointerdown', this.onPointer, this);
    this.input.on('pointerup', this.endJumpHold, this);

    this.registry.set('gameApi', {
      start: () => this.startGame(),
      pause: () => this.pauseGame(),
      resume: () => this.resumeGame(),
    });
    this.notifyState('waiting');
  }

  addPlanet(x, y, radius, color, shadow) {
    const planet = this.add.container(x, y);
    planet.add(this.add.circle(0, 0, radius + 6, color, 0.16));
    planet.add(this.add.circle(0, 0, radius, color));
    planet.add(this.add.circle(-radius * 0.28, -radius * 0.22, radius * 0.38, 0xffffff, 0.18));
    planet.add(this.add.circle(radius * 0.22, radius * 0.18, radius * 0.32, shadow, 0.35));
    planet.setDepth(1);
    return planet;
  }

  addStar() {
    const x = Phaser.Math.Between(8, GAME_WIDTH - 8);
    const y = Phaser.Math.Between(10, GAME_HEIGHT - GROUND_HEIGHT - 24);
    const size = Phaser.Math.FloatBetween(1.2, 2.8);
    const star = this.add.circle(x, y, size, 0xffffff);
    star.setAlpha(Phaser.Math.FloatBetween(0.35, 0.95));
    star.setDepth(1);
    star.twinkle = Phaser.Math.FloatBetween(0.6, 2.2);
    return star;
  }

  buildDino(x, y) {
    const dino = this.add.container(x, y);

    const tail = this.add.triangle(-24, 6, 0, 0, -20, -10, -14, 12, 0x3d9a6a);
    const spike1 = this.add.triangle(-8, -16, 0, 12, 8, 12, 4, -2, 0xff9f1c);
    const spike2 = this.add.triangle(4, -18, 0, 12, 8, 12, 4, -2, 0xffb347);
    const legBack = this.add.ellipse(-8, 16, 11, 14, 0x3d9a6a);
    const footBack = this.add.ellipse(-6, 24, 12, 6, 0x2e7d52);
    const body = this.add.ellipse(0, 2, 38, 34, 0x5cdb7a);
    const belly = this.add.ellipse(4, 8, 18, 16, 0xe8ffc8);
    const arm = this.add.ellipse(8, 4, 9, 5, 0x3d9a6a);
    const head = this.add.circle(16, -12, 15, 0x5cdb7a);
    const snout = this.add.ellipse(28, -8, 16, 11, 0x7ee08a);
    const nostril = this.add.circle(33, -9, 1.6, 0x2e7d52);
    const eye = this.add.circle(20, -14, 5, 0xffffff);
    const pupil = this.add.circle(21.5, -14, 2.4, 0x243047);
    const legFront = this.add.ellipse(8, 16, 11, 14, 0x4caf86);
    const footFront = this.add.ellipse(10, 24, 12, 6, 0x2e7d52);

    dino.add([
      tail,
      spike1,
      spike2,
      legBack,
      footBack,
      body,
      belly,
      arm,
      head,
      snout,
      nostril,
      eye,
      pupil,
      legFront,
      footFront,
    ]);
    dino.setDepth(6);

    this.dinoLegFront = legFront;
    this.dinoLegBack = legBack;
    this.dinoFootFront = footFront;
    this.dinoFootBack = footBack;
    this.dinoPupil = pupil;
    return dino;
  }

  notifyState(state) {
    this.playState = state;
    const onStateChange = this.registry.get('onStateChange');
    if (typeof onStateChange === 'function') {
      onStateChange(state);
    }
  }

  startGame() {
    if (this.ended || this.playState !== 'waiting') {
      return;
    }

    this.hintText.setVisible(false);
    this.audio.unlock();
    this.audio.start();
    this.physics.resume();
    this.ignoreJumpUntil = this.time.now + 200;
    this.jumpHeld = false;
    this.airborne = false;

    this.notifyState('playing');
    this.restartSpawnTimer();
    this.spawnObstacle(GAME_WIDTH + 80);
  }

  applyLevelSettings() {
    const settings = LEVELS[this.level - 1] || LEVELS[0];
    this.runSpeed = settings.speed;
    this.spawnDelay = settings.spawn;
    this.flyChance = settings.flyChance;
  }

  restartSpawnTimer() {
    this.spawnEvent?.remove(false);
    this.spawnEvent = this.time.addEvent({
      delay: this.spawnDelay,
      callback: this.spawnObstacle,
      callbackScope: this,
      loop: true,
    });
  }

  showBanner(message) {
    this.tweens.killTweensOf(this.bannerText);
    this.bannerText.setText(message);
    this.bannerText.setVisible(true);
    this.bannerText.setAlpha(1);
    this.tweens.add({
      targets: this.bannerText,
      alpha: 0,
      duration: 360,
      delay: 1100,
      onComplete: () => {
        if (!this.ended) {
          this.bannerText.setVisible(false);
        }
      },
    });
  }

  advanceLevel() {
    this.level += 1;
    this.levelObstacles = 0;
    this.spawnedThisLevel = 0;
    this.applyLevelSettings();
    this.levelText.setText(`Level ${this.level}`);
    this.obstacles.getChildren().forEach((obstacle) => {
      if (obstacle.body) {
        obstacle.body.setVelocityX(-this.runSpeed);
      }
    });
    this.restartSpawnTimer();
    this.spawnObstacle();
    this.showBanner(`Level ${this.level}!`);
    this.audio.level();
  }

  pauseGame() {
    if (this.ended || this.playState !== 'playing') {
      return;
    }

    this.physics.pause();
    if (this.spawnEvent) {
      this.spawnEvent.paused = true;
    }
    this.notifyState('paused');
  }

  resumeGame() {
    if (this.ended || this.playState !== 'paused') {
      return;
    }

    if (this.spawnEvent) {
      this.spawnEvent.paused = false;
    }
    this.physics.resume();
    this.ignoreJumpUntil = this.time.now + 180;
    this.jumpHeld = false;
    this.notifyState('playing');
  }

  togglePause() {
    if (this.playState === 'playing') {
      this.pauseGame();
    } else if (this.playState === 'paused') {
      this.resumeGame();
    }
  }

  onSpace() {
    if (this.playState === 'waiting') {
      this.startGame();
      return;
    }

    if (this.playState === 'paused') {
      this.resumeGame();
      return;
    }

    this.jump();
  }

  onPointer() {
    if (this.playState === 'waiting') {
      this.startGame();
      return;
    }

    this.jump();
  }

  isGrounded() {
    return Boolean(this.hit.body?.blocked.down || this.hit.body?.touching.down);
  }

  jump() {
    if (this.ended || this.playState !== 'playing' || this.time.now < this.ignoreJumpUntil) {
      return;
    }
    if (!this.isGrounded() && this.time.now > this.coyoteUntil) {
      return;
    }

    this.airborne = true;
    this.jumpHeld = true;
    this.coyoteUntil = 0;
    this.ignoreJumpUntil = this.time.now + JUMP_LOCK_MS;
    this.hit.body.setGravityY(0);
    this.hit.body.setVelocityY(JUMP_VELOCITY);
    this.audio.flap();
  }

  endJumpHold() {
    this.jumpHeld = false;
    if (this.ended || this.playState !== 'playing' || !this.hit.body) {
      return;
    }
    if (this.hit.body.velocity.y < JUMP_CUT_VELOCITY) {
      this.hit.body.setVelocityY(JUMP_CUT_VELOCITY);
    }
  }

  addObstacle(x, y, width, height, art) {
    const body = this.add.rectangle(x, y, width, height, 0x000000, 0);
    this.physics.add.existing(body);
    this.obstacles.add(body);
    body.body.setAllowGravity(false);
    body.body.setImmovable(true);
    body.body.moves = true;
    body.body.setVelocityX(-this.runSpeed);
    body.scored = false;
    body.art = art;
    body.setDepth(5);
    return body;
  }

  spawnObstacle(x = GAME_WIDTH + 28) {
    if (this.ended || this.playState !== 'playing') {
      return;
    }
    if (this.spawnedThisLevel >= OBSTACLES_PER_LEVEL) {
      return;
    }

    const remaining = OBSTACLES_PER_LEVEL - this.spawnedThisLevel;
    const roll = Math.random();

    if (remaining >= 2 && this.level >= 2 && roll < this.flyChance * 0.4) {
      this.spawnJumpThenDuck(x);
      return;
    }
    if (remaining >= 2 && this.level >= 3 && roll < this.flyChance * 0.7) {
      this.spawnDoubleCactus(x);
      return;
    }
    if (roll < this.flyChance) {
      this.spawnPtero(x, Math.random() < 0.7);
      this.spawnedThisLevel += 1;
      return;
    }
    this.spawnCactus(x);
    this.spawnedThisLevel += 1;
  }

  spawnCactus(x, size) {
    const tall = size ? size === 'tall' : Math.random() < 0.4 + this.level * 0.06;
    const width = tall ? 32 : 24;
    const height = tall ? 68 : 46;
    const y = GAME_HEIGHT - GROUND_HEIGHT - height / 2;
    const art = this.add.container(x, y);
    const stem = this.add.rectangle(0, 2, width, height - 6, 0x3d9a4a);
    const cap = this.add.ellipse(0, -height / 2 + 6, width + 4, 14, 0x4caf50);
    art.add(stem);
    if (tall) {
      art.add(this.add.rectangle(-15, -6, 16, 9, 0x3d9a4a));
      art.add(this.add.ellipse(-22, -6, 10, 10, 0x4caf50));
      art.add(this.add.rectangle(15, 8, 16, 9, 0x3d9a4a));
      art.add(this.add.ellipse(22, 8, 10, 10, 0x4caf50));
    } else {
      art.add(this.add.rectangle(12, -2, 12, 8, 0x3d9a4a));
      art.add(this.add.ellipse(18, -2, 8, 8, 0x4caf50));
    }
    art.add(cap);
    art.setDepth(5);
    this.addObstacle(x, y, width - 2, height - 8, art);
  }

  spawnPtero(x, high = Math.random() < 0.6) {
    const y = high ? 248 : 300;
    const height = high ? 24 : 22;
    const art = this.buildPtero(x, y);
    const body = this.addObstacle(x, y, 42, height, art);
    body.kind = 'ptero';
  }

  spawnJumpThenDuck(x) {
    this.spawnCactus(x, 'short');
    this.spawnPtero(x + Phaser.Math.Between(118, 160), true);
    this.spawnedThisLevel += 2;
  }

  spawnDoubleCactus(x) {
    this.spawnCactus(x, 'short');
    this.spawnCactus(x + Phaser.Math.Between(52, 78), Math.random() < 0.5 ? 'tall' : 'short');
    this.spawnedThisLevel += 2;
  }

  buildPtero(x, y) {
    const art = this.add.container(x, y);
    const wingL = this.add.ellipse(-16, -2, 28, 10, 0xc77dff);
    const wingR = this.add.ellipse(16, -2, 26, 9, 0xb366f0);
    const body = this.add.ellipse(0, 2, 28, 14, 0xd9a5ff);
    const beak = this.add.triangle(18, 2, 0, -4, 16, 2, 0, 6, 0xffb347);
    const eye = this.add.circle(6, -2, 3, 0xffffff);
    const pupil = this.add.circle(7, -2, 1.6, 0x243047);
    art.add([wingL, wingR, body, beak, eye, pupil]);
    art.setDepth(5);
    art.wingL = wingL;
    art.wingR = wingR;
    return art;
  }

  wrapDecor(items, resetX, speed, dt, span) {
    items.forEach((item) => {
      item.x -= speed * dt;
      if (item.x < -resetX) {
        item.x += span || GAME_WIDTH + resetX * 2;
      }
    });
  }

  syncDino() {
    const grounded = this.hit.body.blocked.down || this.hit.body.touching.down;
    this.dino.x = this.hit.x;
    this.dino.y = this.hit.y;
    this.shadow.x = this.hit.x;
    this.shadow.setScale(grounded ? 1 : 0.7);
    this.shadow.setAlpha(grounded ? 0.22 : 0.1);

    const run = this.playState === 'playing' && grounded ? Math.sin(this.time.now / 70) : 0;
    this.dinoLegFront.y = 16 + run * 5;
    this.dinoFootFront.y = 24 + run * 5;
    this.dinoLegBack.y = 16 - run * 5;
    this.dinoFootBack.y = 24 - run * 5;
    this.dinoPupil.x = 21.5;
    this.dino.setRotation(
      grounded ? 0 : Phaser.Math.Clamp(this.hit.body.velocity.y / 900, -0.28, 0.42)
    );

    if (this.time.now < this.invulnUntil) {
      const pulse = 0.35 + 0.45 * Math.abs(Math.sin(this.time.now / 70));
      this.dino.setAlpha(pulse);
    } else {
      this.dino.setAlpha(1);
    }
  }

  update(_time, delta) {
    this.syncDino();

    if (this.ended || this.playState !== 'playing') {
      return;
    }

    const grounded = this.isGrounded();
    if (grounded) {
      this.airborne = false;
      this.coyoteUntil = this.time.now + COYOTE_MS;
      this.hit.body.setGravityY(0);
    } else {
      this.airborne = true;
      if (this.hit.body.velocity.y > 40) {
        this.hit.body.setGravityY(680);
      } else {
        this.hit.body.setGravityY(0);
      }
    }

    if (this.hit.y < 8) {
      this.hit.y = 8;
      this.hit.body.setVelocityY(Math.max(0, this.hit.body.velocity.y));
    }
    if (this.hit.y > GAME_HEIGHT) {
      this.loseLife();
      if (!this.ended) {
        this.hit.y = GAME_HEIGHT - GROUND_HEIGHT - 22;
        this.hit.body.setVelocityY(0);
      }
      return;
    }

    const dt = delta / 1000;
    this.wrapDecor(this.stars, 10, this.runSpeed * 0.12, dt);
    this.wrapDecor(this.planets, 40, this.runSpeed * 0.28, dt);
    this.wrapDecor(this.dashes, 40, this.runSpeed, dt, 14 * 64);
    this.stars.forEach((star) => {
      star.setAlpha(0.4 + Math.abs(Math.sin(this.time.now / 420 * star.twinkle)) * 0.55);
    });

    this.obstacles.getChildren().forEach((obstacle) => {
      if (!obstacle.active || this.ended) {
        return;
      }

      if (obstacle.body) {
        obstacle.body.moves = true;
        obstacle.body.setAllowGravity(false);
        obstacle.body.setImmovable(true);
        obstacle.body.setVelocityX(-this.runSpeed);
      }

      if (obstacle.art) {
        obstacle.art.x = obstacle.x;
        obstacle.art.y = obstacle.y;
        if (obstacle.kind === 'ptero' && obstacle.art.wingL) {
          const flap = Math.sin(this.time.now / 110);
          obstacle.art.wingL.setScale(1, 0.75 + flap * 0.28);
          obstacle.art.wingR?.setScale(1, 0.75 - flap * 0.22);
        }
      }

      if (!obstacle.scored && obstacle.x + 20 < this.hit.x) {
        obstacle.scored = true;
        this.score += 1;
        this.levelObstacles += 1;
        this.scoreText.setText(`Score: ${this.score}`);
        this.audio.score();

        if (this.levelObstacles >= OBSTACLES_PER_LEVEL) {
          if (this.level >= MAX_LEVEL) {
            this.winGame();
            return;
          }
          this.advanceLevel();
        }
      }

      if (obstacle.x < -70) {
        obstacle.art?.destroy();
        obstacle.destroy();
      }
    });
  }

  refreshLives() {
    this.livesIcons.forEach((icon, index) => {
      icon.setVisible(index < this.lives);
    });
  }

  onHitObstacle(_dino, obstacle) {
    if (this.ended || this.playState !== 'playing' || this.time.now < this.invulnUntil) {
      return;
    }

    if (obstacle?.active) {
      obstacle.art?.destroy();
      obstacle.destroy();
    }

    this.loseLife();
  }

  loseLife() {
    if (this.ended || this.playState !== 'playing' || this.time.now < this.invulnUntil) {
      return;
    }

    this.lives -= 1;
    this.invulnUntil = this.time.now + INVULN_MS;
    this.audio.hit();
    this.cameras.main.shake(110, 0.008);
    this.refreshLives();

    if (this.lives <= 0) {
      this.endGame();
      return;
    }

    this.showBanner(this.lives === 1 ? '1 life left!' : `${this.lives} lives left!`);
  }

  finishRun(won) {
    if (this.ended) {
      return;
    }

    this.ended = true;
    this.won = won;
    this.physics.pause();
    this.spawnEvent?.remove(false);
    this.tweens.killTweensOf(this.bannerText);
    this.notifyState('ended');

    const onGameOver = this.registry.get('onGameOver');
    if (typeof onGameOver === 'function') {
      onGameOver(this.score, this.level, won);
    }
  }

  winGame() {
    if (this.ended) {
      return;
    }

    this.audio.win();
    this.bannerText.setText('You win!');
    this.bannerText.setVisible(true);
    this.bannerText.setAlpha(1);
    this.finishRun(true);
  }

  endGame() {
    if (this.ended) {
      return;
    }

    this.finishRun(false);
  }
}

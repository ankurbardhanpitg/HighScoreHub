import Phaser from 'phaser';

export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 380;
export const STARTING_LIVES = 3;

function createChaseAudio() {
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
      beep({ type: 'sine', freq: 587, duration: 0.12, volume: 0.07, delay: 0.08 });
    },
    collect() {
      beep({ type: 'sine', freq: 880, duration: 0.07, volume: 0.08 });
      beep({ type: 'sine', freq: 1175, duration: 0.1, volume: 0.08, delay: 0.06 });
    },
    hit() {
      beep({ type: 'square', freq: 180, freqEnd: 70, duration: 0.28, volume: 0.09 });
      beep({ type: 'triangle', freq: 140, freqEnd: 50, duration: 0.4, volume: 0.08, delay: 0.04 });
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

const HUD_TOP = 42;
const PAD = 22;
const PLAYER_R = 16;
const CHASER_R = 17;
const STAR_R = 8;
const CATCH_DIST = 26;
const INVULN_MS = 1600;
const STAR_POINTS = 10;
const MAX_LEVEL = 10;
const LEVELS = [
  { playerSpeed: 230, chaserSpeed: 108, stars: 8 },
  { playerSpeed: 236, chaserSpeed: 114, stars: 8 },
  { playerSpeed: 242, chaserSpeed: 120, stars: 9 },
  { playerSpeed: 248, chaserSpeed: 126, stars: 9 },
  { playerSpeed: 254, chaserSpeed: 132, stars: 10 },
  { playerSpeed: 260, chaserSpeed: 138, stars: 10 },
  { playerSpeed: 266, chaserSpeed: 144, stars: 11 },
  { playerSpeed: 272, chaserSpeed: 150, stars: 11 },
  { playerSpeed: 278, chaserSpeed: 156, stars: 12 },
  { playerSpeed: 284, chaserSpeed: 162, stars: 12 },
];
const CHASER_SPAWNS = [
  { x: 48, y: HUD_TOP + 28 },
  { x: GAME_WIDTH / 2, y: HUD_TOP + 28 },
  { x: GAME_WIDTH - 48, y: HUD_TOP + 28 },
  { x: 48, y: GAME_HEIGHT / 2 },
  { x: GAME_WIDTH - 48, y: GAME_HEIGHT / 2 },
  { x: 48, y: GAME_HEIGHT - 36 },
  { x: GAME_WIDTH / 2, y: GAME_HEIGHT - 36 },
  { x: GAME_WIDTH - 48, y: GAME_HEIGHT - 36 },
  { x: GAME_WIDTH / 4, y: HUD_TOP + 28 },
  { x: (GAME_WIDTH * 3) / 4, y: GAME_HEIGHT - 36 },
];
const BUSHES = [
  { x: 210, y: 150, r: 28 },
  { x: 510, y: 150, r: 28 },
  { x: 360, y: 268, r: 32 },
  { x: 140, y: 290, r: 24 },
  { x: 580, y: 290, r: 24 },
];

export default class ChaseScene extends Phaser.Scene {
  constructor() {
    super('ChaseScene');
  }

  create() {
    this.ended = false;
    this.won = false;
    this.playState = 'waiting';
    this.score = 0;
    this.level = 1;
    this.lives = STARTING_LIVES;
    this.starsLeft = 0;
    this.invulnUntil = 0;
    this.ignoreMoveUntil = 0;
    this.usingPointer = false;
    this.pointerX = GAME_WIDTH / 2;
    this.pointerY = GAME_HEIGHT / 2;
    this.chasers = [];
    this.stars = [];
    this.audio = createChaseAudio();
    this.applyLevelSettings();

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x7ecf8a);
    this.add.rectangle(GAME_WIDTH / 2, HUD_TOP / 2, GAME_WIDTH, HUD_TOP, 0x5bb86c).setDepth(8);
    this.add.ellipse(120, 90, 180, 50, 0x8ed99a, 0.45);
    this.add.ellipse(560, 80, 200, 46, 0x8ed99a, 0.4);
    this.add.ellipse(360, 200, 260, 70, 0x6fc47e, 0.35);

    this.bushes = BUSHES.map((bush) => this.addBush(bush.x, bush.y, bush.r));

    this.player = this.buildPlayer(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20);

    this.scoreText = this.add.text(16, 10, 'Score: 0', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#ffffff',
      stroke: '#1d4d3a',
      strokeThickness: 6,
    }).setDepth(12);

    this.levelText = this.add.text(GAME_WIDTH / 2, 20, 'Level 1', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#ffe566',
      stroke: '#1d4d3a',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(12);

    this.needText = this.add.text(GAME_WIDTH / 2, 58, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      stroke: '#1d4d3a',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(12);

    this.livesIcons = [];
    for (let i = 0; i < STARTING_LIVES; i += 1) {
      const icon = this.add.circle(GAME_WIDTH - 70 + i * 22, 20, 8, 0xff6b9d);
      icon.setStrokeStyle(2, 0xffe1ea);
      icon.setDepth(12);
      this.livesIcons.push(icon);
    }

    this.bannerText = this.add.text(GAME_WIDTH / 2, 110, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '32px',
      color: '#ffe566',
      stroke: '#1d4d3a',
      strokeThickness: 8,
    }).setOrigin(0.5).setDepth(14).setVisible(false);

    this.hintText = this.add.text(GAME_WIDTH / 2, 86, 'Press Start when you are ready!', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#ffffff',
      stroke: '#1d4d3a',
      strokeThickness: 5,
      align: 'center',
      wordWrap: { width: 560 },
    }).setOrigin(0.5).setDepth(12);

    this.cursors = this.input.keyboard?.createCursorKeys();
    this.wasd = this.input.keyboard?.addKeys('W,A,S,D');
    this.input.keyboard?.addCapture(['LEFT', 'RIGHT', 'UP', 'DOWN', 'W', 'A', 'S', 'D', 'P', 'ESC', 'SPACE']);
    this.input.keyboard?.on('keydown-SPACE', this.onSpace, this);
    this.input.keyboard?.on('keydown-P', this.togglePause, this);
    this.input.keyboard?.on('keydown-ESC', this.togglePause, this);
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);

    this.registry.set('gameApi', {
      start: () => this.startGame(),
      pause: () => this.pauseGame(),
      resume: () => this.resumeGame(),
    });
    this.notifyState('waiting');
  }

  addBush(x, y, r) {
    const bush = this.add.container(x, y);
    bush.add(this.add.circle(0, 6, r * 0.7, 0x2e7d32, 0.35));
    bush.add(this.add.circle(-10, 0, r * 0.62, 0x43a047));
    bush.add(this.add.circle(10, 2, r * 0.58, 0x388e3c));
    bush.add(this.add.circle(0, -8, r * 0.55, 0x66bb6a));
    bush.setDepth(3);
    bush.radius = r;
    return bush;
  }

  buildPlayer(x, y) {
    const player = this.add.container(x, y);
    const body = this.add.circle(0, 2, PLAYER_R, 0xff6b9d);
    const belly = this.add.circle(0, 6, 8, 0xffe1ea);
    const earL = this.add.triangle(-10, -12, 0, 10, 8, 10, 4, -2, 0xff6b9d);
    const earR = this.add.triangle(10, -12, 0, 10, 8, 10, 4, -2, 0xff6b9d);
    const eyeL = this.add.circle(-5, -2, 3.2, 0xffffff);
    const eyeR = this.add.circle(5, -2, 3.2, 0xffffff);
    const pupilL = this.add.circle(-4.2, -2, 1.6, 0x243047);
    const pupilR = this.add.circle(5.8, -2, 1.6, 0x243047);
    player.add([earL, earR, body, belly, eyeL, eyeR, pupilL, pupilR]);
    player.setDepth(6);
    player.radius = PLAYER_R;
    return player;
  }

  buildChaser(x, y, tint) {
    const chaser = this.add.container(x, y);
    const body = this.add.ellipse(0, 0, 34, 32, tint);
    const eyeL = this.add.circle(-6, -4, 4, 0xffffff);
    const eyeR = this.add.circle(7, -4, 4, 0xffffff);
    const pupilL = this.add.circle(-5, -4, 2, 0x243047);
    const pupilR = this.add.circle(8, -4, 2, 0x243047);
    const frown = this.add.rectangle(0, 6, 12, 3, 0x243047, 0.55);
    chaser.add([body, eyeL, eyeR, pupilL, pupilR, frown]);
    chaser.setDepth(5);
    chaser.radius = CHASER_R;
    chaser.tint = tint;
    return chaser;
  }

  buildStar(x, y) {
    const star = this.add.star(x, y, 5, 5, 11, 0xffe566);
    star.setStrokeStyle(2, 0xfff7b0);
    star.setDepth(4);
    star.radius = STAR_R;
    return star;
  }

  applyLevelSettings() {
    const settings = LEVELS[this.level - 1] || LEVELS[0];
    this.playerSpeed = settings.playerSpeed;
    this.chaserCount = this.level;
    this.starCount = settings.stars;
    this.chaserSpeed = settings.chaserSpeed / (1 + 0.65 * (this.chaserCount - 1));
    if (this.level >= 8) {
      this.chaserSpeed = this.playerSpeed;
    } else if (this.level >= 7) {
      this.chaserSpeed *= 2;
    } else if (this.level >= 6) {
      this.chaserSpeed *= 1.5;
    }
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
    this.ignoreMoveUntil = this.time.now + 220;
    this.notifyState('playing');
    this.setupLevel(true);
  }

  setupLevel(resetPlayer) {
    this.clearActors(false);
    this.applyLevelSettings();
    this.levelText.setText(`Level ${this.level}`);
    this.starsLeft = this.starCount;
    this.refreshNeed();

    if (resetPlayer) {
      this.player.x = GAME_WIDTH / 2;
      this.player.y = GAME_HEIGHT / 2 + 16;
    }

    const tints = [0x9b6dff, 0x4da3ff, 0xff8a3d, 0xff6b9d, 0x2bbbad];
    for (let i = 0; i < this.chaserCount; i += 1) {
      const spawn = CHASER_SPAWNS[i % CHASER_SPAWNS.length];
      this.chasers.push(this.buildChaser(spawn.x, spawn.y, tints[i % tints.length]));
    }

    this.spawnStars();
  }

  spawnStars() {
    this.stars.forEach((star) => star.destroy());
    this.stars = [];

    let guard = 0;
    while (this.stars.length < this.starCount && guard < 200) {
      guard += 1;
      const x = Phaser.Math.Between(PAD + 16, GAME_WIDTH - PAD - 16);
      const y = Phaser.Math.Between(HUD_TOP + 28, GAME_HEIGHT - PAD - 16);
      if (this.blockedSpot(x, y, 26, true)) {
        continue;
      }
      this.stars.push(this.buildStar(x, y));
    }
    this.starsLeft = this.stars.length;
    this.refreshNeed();
  }

  blockedSpot(x, y, minDist, includePlayer) {
    if (includePlayer && Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 70) {
      return true;
    }
    if (this.bushes.some((bush) => Phaser.Math.Distance.Between(x, y, bush.x, bush.y) < bush.radius + minDist)) {
      return true;
    }
    if (this.stars.some((star) => Phaser.Math.Distance.Between(x, y, star.x, star.y) < 36)) {
      return true;
    }
    if (this.chasers.some((chaser) => Phaser.Math.Distance.Between(x, y, chaser.x, chaser.y) < 50)) {
      return true;
    }
    return false;
  }

  clearActors(includePlayer) {
    this.chasers.forEach((chaser) => chaser.destroy());
    this.chasers = [];
    this.stars.forEach((star) => star.destroy());
    this.stars = [];
    if (includePlayer) {
      this.player.destroy();
    }
  }

  refreshNeed() {
    this.needText.setText(`Stars left: ${this.starsLeft}`);
  }

  refreshLives() {
    this.livesIcons.forEach((icon, index) => {
      icon.setVisible(index < this.lives);
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

  pauseGame() {
    if (this.ended || this.playState !== 'playing') {
      return;
    }
    this.notifyState('paused');
  }

  resumeGame() {
    if (this.ended || this.playState !== 'paused') {
      return;
    }
    this.ignoreMoveUntil = this.time.now + 180;
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
    }
  }

  onPointerDown(pointer) {
    if (this.playState === 'waiting') {
      this.startGame();
      return;
    }
    if (this.playState !== 'playing') {
      return;
    }
    this.usingPointer = true;
    this.pointerX = pointer.x;
    this.pointerY = pointer.y;
  }

  onPointerMove(pointer) {
    if (this.playState !== 'playing') {
      return;
    }
    this.usingPointer = true;
    this.pointerX = pointer.x;
    this.pointerY = pointer.y;
  }

  clampActor(actor, radius) {
    actor.x = Phaser.Math.Clamp(actor.x, PAD + radius, GAME_WIDTH - PAD - radius);
    actor.y = Phaser.Math.Clamp(actor.y, HUD_TOP + radius, GAME_HEIGHT - PAD - radius);
  }

  resolveBushes(actor) {
    this.bushes.forEach((bush) => {
      const dx = actor.x - bush.x;
      const dy = actor.y - bush.y;
      const dist = Math.hypot(dx, dy) || 0.01;
      const min = bush.radius + actor.radius - 2;
      if (dist < min) {
        actor.x = bush.x + (dx / dist) * min;
        actor.y = bush.y + (dy / dist) * min;
      }
    });
  }

  movePlayer(dt) {
    if (this.time.now < this.ignoreMoveUntil) {
      return;
    }

    let vx = 0;
    let vy = 0;
    if (this.cursors?.left.isDown || this.wasd?.A.isDown) {
      vx -= 1;
    }
    if (this.cursors?.right.isDown || this.wasd?.D.isDown) {
      vx += 1;
    }
    if (this.cursors?.up.isDown || this.wasd?.W.isDown) {
      vy -= 1;
    }
    if (this.cursors?.down.isDown || this.wasd?.S.isDown) {
      vy += 1;
    }

    if (vx !== 0 || vy !== 0) {
      this.usingPointer = false;
      const len = Math.hypot(vx, vy) || 1;
      this.player.x += (vx / len) * this.playerSpeed * dt;
      this.player.y += (vy / len) * this.playerSpeed * dt;
    } else if (this.usingPointer) {
      const dx = this.pointerX - this.player.x;
      const dy = this.pointerY - this.player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 6) {
        const step = Math.min(this.playerSpeed * dt, dist);
        this.player.x += (dx / dist) * step;
        this.player.y += (dy / dist) * step;
      }
    }

    this.clampActor(this.player, PLAYER_R);
    this.resolveBushes(this.player);
  }

  moveChasers(dt) {
    this.chasers.forEach((chaser, index) => {
      const dx = this.player.x - chaser.x;
      const dy = this.player.y - chaser.y;
      const dist = Math.hypot(dx, dy) || 1;
      chaser.x += (dx / dist) * this.chaserSpeed * dt;
      chaser.y += (dy / dist) * this.chaserSpeed * dt;

      this.chasers.forEach((other, otherIndex) => {
        if (otherIndex <= index) {
          return;
        }
        const ox = chaser.x - other.x;
        const oy = chaser.y - other.y;
        const gap = Math.hypot(ox, oy) || 0.01;
        if (gap < 34) {
          const push = (34 - gap) / 2;
          chaser.x += (ox / gap) * push;
          chaser.y += (oy / gap) * push;
          other.x -= (ox / gap) * push;
          other.y -= (oy / gap) * push;
        }
      });

      this.clampActor(chaser, CHASER_R);
      this.resolveBushes(chaser);
    });
  }

  collectStars() {
    this.stars = this.stars.filter((star) => {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, star.x, star.y) > PLAYER_R + STAR_R) {
        return true;
      }
      star.destroy();
      this.score += STAR_POINTS;
      this.starsLeft = Math.max(0, this.starsLeft - 1);
      this.scoreText.setText(`Score: ${this.score}`);
      this.refreshNeed();
      this.audio.collect();
      return false;
    });

    if (this.stars.length === 0 && !this.ended) {
      this.completeLevel();
    }
  }

  completeLevel() {
    if (this.level >= MAX_LEVEL) {
      this.winGame();
      return;
    }

    this.level += 1;
    this.audio.level();
    this.showBanner(`Level ${this.level}!`);
    this.setupLevel(false);
    this.invulnUntil = this.time.now + 900;
  }

  checkCaught() {
    if (this.time.now < this.invulnUntil) {
      return;
    }

    const caught = this.chasers.some(
      (chaser) => Phaser.Math.Distance.Between(this.player.x, this.player.y, chaser.x, chaser.y) < CATCH_DIST
    );
    if (!caught) {
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
    this.chasers.forEach((chaser, index) => {
      const spawn = CHASER_SPAWNS[index % CHASER_SPAWNS.length];
      chaser.x = spawn.x;
      chaser.y = spawn.y;
    });
  }

  update(_time, delta) {
    if (this.ended || this.playState !== 'playing') {
      return;
    }

    const dt = Math.min(delta, 32) / 1000;
    this.movePlayer(dt);
    this.moveChasers(dt);
    this.collectStars();
    this.checkCaught();

    const pulse = this.time.now < this.invulnUntil ? 0.35 + 0.45 * Math.abs(Math.sin(this.time.now / 70)) : 1;
    this.player.setAlpha(pulse);
    this.stars.forEach((star) => {
      star.rotation += dt * 1.6;
      star.setScale(0.92 + Math.sin(this.time.now / 180) * 0.08);
    });
  }

  finishRun(won) {
    if (this.ended) {
      return;
    }

    this.ended = true;
    this.won = won;
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

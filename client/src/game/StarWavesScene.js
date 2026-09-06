import Phaser from 'phaser';

export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 380;
export const STARTING_LIVES = 3;

function createStarWavesAudio() {
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
    shoot() {
      beep({ type: 'square', freq: 680, freqEnd: 980, duration: 0.07, volume: 0.06 });
    },
    hit() {
      beep({ type: 'triangle', freq: 520, freqEnd: 820, duration: 0.09, volume: 0.08 });
    },
    alienShot() {
      beep({ type: 'sine', freq: 240, freqEnd: 160, duration: 0.1, volume: 0.05 });
    },
    playerHit() {
      beep({ type: 'triangle', freq: 220, freqEnd: 80, duration: 0.28, volume: 0.09 });
    },
    wave() {
      beep({ freq: 523, duration: 0.09, volume: 0.08 });
      beep({ freq: 659, duration: 0.09, volume: 0.08, delay: 0.09 });
      beep({ freq: 784, duration: 0.16, volume: 0.09, delay: 0.18 });
    },
    lose() {
      beep({ type: 'triangle', freq: 330, freqEnd: 110, duration: 0.42, volume: 0.09 });
    },
  };
}

const HUD_TOP = 34;
const SHIP_Y = GAME_HEIGHT - 30;
const SHIP_SPEED = 430;
const SHIP_HALF = 20;
const BULLET_SPEED = 460;
const BULLET_COOLDOWN = 260;
const MAX_PLAYER_BULLETS = 3;
const ALIEN_W = 30;
const ALIEN_H = 22;
const ALIEN_GAP_X = 16;
const ALIEN_GAP_Y = 12;
const COLS = 8;
const STEP_DOWN = 14;
const PLAYER_SHOT_R = 4;
const ALIEN_SHOT_R = 4;
const ALIEN_SHOT_SPEED = 145;
const CLEAR_PAUSE = 1100;
const INVULN_MS = 1600;
const MAX_LIVES = 5;
const ALIEN_COLORS = [0x9b6dff, 0x4da3ff, 0x7ed957, 0xffe566, 0xff8a3d];

export default class StarWavesScene extends Phaser.Scene {
  constructor() {
    super('StarWavesScene');
  }

  create() {
    this.ended = false;
    this.playState = 'waiting';
    this.phase = 'live';
    this.score = 0;
    this.lives = STARTING_LIVES;
    this.wave = 1;
    this.pointerX = GAME_WIDTH / 2;
    this.usingPointer = false;
    this.nextShotAt = 0;
    this.invulnUntil = 0;
    this.clearRemaining = 0;
    this.alienFireIn = 1400;
    this.swarmDir = 1;
    this.waveCount = 0;
    this.aliens = [];
    this.playerShots = [];
    this.alienShots = [];
    this.stars = [];
    this.audio = createStarWavesAudio();

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1a1448);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH - 16, GAME_HEIGHT - 16, 0x24185e);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 8, GAME_WIDTH, 16, 0x3d2a7a);

    for (let i = 0; i < 46; i += 1) {
      const star = this.add.circle(
        Phaser.Math.Between(18, GAME_WIDTH - 18),
        Phaser.Math.Between(HUD_TOP + 8, GAME_HEIGHT - 40),
        Phaser.Math.FloatBetween(1, 2.2),
        0xffffff,
        Phaser.Math.FloatBetween(0.25, 0.85)
      );
      star.setData('base', star.alpha);
      star.setData('phase', Phaser.Math.FloatBetween(0, Math.PI * 2));
      this.stars.push(star);
    }

    this.ship = this.createShip(GAME_WIDTH / 2, SHIP_Y);

    this.scoreText = this.add.text(108, 16, 'Score 0', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      stroke: '#1a1448',
      strokeThickness: 5,
    }).setOrigin(0, 0.5).setDepth(12);

    this.waveText = this.add.text(GAME_WIDTH / 2, 16, 'Wave 1', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#ffe566',
      stroke: '#1a1448',
      strokeThickness: 5,
    }).setOrigin(0.5, 0.5).setDepth(12);

    this.hintText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 56, 'Move, then tap or press Space to blast', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '15px',
      color: '#ffffff',
      stroke: '#1a1448',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(12);

    this.bannerText = this.add.text(GAME_WIDTH / 2, 200, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '28px',
      color: '#ffe566',
      stroke: '#1a1448',
      strokeThickness: 8,
    }).setOrigin(0.5).setDepth(13).setVisible(false);

    this.livesIcons = [];
    for (let i = 0; i < MAX_LIVES; i += 1) {
      const icon = this.add.triangle(24 + i * 18, 16, 0, 8, 6, -8, 12, 8, 0xffe566).setStrokeStyle(2, 0xfff7b0).setDepth(12);
      this.livesIcons.push(icon);
    }

    this.buildWave();
    this.refreshHud();

    this.cursors = this.input.keyboard?.createCursorKeys();
    this.wasd = this.input.keyboard?.addKeys('A,D');
    this.input.keyboard?.addCapture(['LEFT', 'RIGHT', 'A', 'D', 'P', 'ESC', 'SPACE']);
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

  createShip(x, y) {
    const body = this.add.rectangle(0, 6, 36, 14, 0xff6b9d);
    body.setStrokeStyle(2, 0xffd6e6);
    const nose = this.add.triangle(0, -8, -12, 10, 12, 10, 0, -12, 0xffe566);
    nose.setStrokeStyle(2, 0xfff7b0);
    const window = this.add.circle(0, 5, 4.5, 0x7ec8ff);
    const ship = this.add.container(x, y, [body, nose, window]);
    ship.setDepth(10);
    return ship;
  }

  createAlien(x, y, color, points) {
    const body = this.add.ellipse(0, 0, ALIEN_W, ALIEN_H, color);
    body.setStrokeStyle(2, 0xffffff, 0.75);
    const eyeL = this.add.circle(-6, -2, 3.6, 0xffffff);
    const eyeR = this.add.circle(6, -2, 3.6, 0xffffff);
    const pupilL = this.add.circle(-5, -1, 1.7, 0x243047);
    const pupilR = this.add.circle(7, -1, 1.7, 0x243047);
    const alien = this.add.container(x, y, [body, eyeL, eyeR, pupilL, pupilR]);
    alien.setDepth(6);
    alien.setData('points', points);
    alien.setData('color', color);
    return alien;
  }

  rowCountForWave() {
    return Math.min(5, 3 + Math.floor((this.wave - 1) / 2));
  }

  marchSpeedForWave() {
    return 26 + (this.wave - 1) * 7;
  }

  alienFireRange() {
    const min = Math.max(720, 1600 - (this.wave - 1) * 140);
    const max = Math.max(1100, 2400 - (this.wave - 1) * 160);
    return { min, max };
  }

  clearAliens() {
    this.aliens.forEach((alien) => alien.destroy());
    this.aliens = [];
  }

  clearShots() {
    this.playerShots.forEach((shot) => shot.gfx.destroy());
    this.alienShots.forEach((shot) => shot.gfx.destroy());
    this.playerShots = [];
    this.alienShots = [];
  }

  buildWave() {
    this.clearAliens();
    this.clearShots();
    this.swarmDir = 1;
    this.phase = 'live';
    const rows = this.rowCountForWave();
    const gridWidth = COLS * ALIEN_W + (COLS - 1) * ALIEN_GAP_X;
    const startX = (GAME_WIDTH - gridWidth) / 2 + ALIEN_W / 2;
    const startY = HUD_TOP + 30;

    for (let row = 0; row < rows; row += 1) {
      const color = ALIEN_COLORS[row % ALIEN_COLORS.length];
      const points = (rows - row) * 10;
      for (let col = 0; col < COLS; col += 1) {
        const x = startX + col * (ALIEN_W + ALIEN_GAP_X);
        const y = startY + row * (ALIEN_H + ALIEN_GAP_Y);
        this.aliens.push(this.createAlien(x, y, color, points));
      }
    }

    this.waveCount = this.aliens.length;
    this.alienFireIn = this.alienFireRange().max;
  }

  livingAliens() {
    return this.aliens.filter((alien) => alien.active);
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

    this.audio.unlock();
    this.hintText.setVisible(false);
    this.notifyState('playing');
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

    if (this.playState === 'playing') {
      this.tryShoot();
    }
  }

  isCanvasPointer(pointer) {
    const target = pointer.event?.target;
    return !target || target === this.game.canvas;
  }

  pointerToGameX(pointer) {
    const rect = this.game.canvas.getBoundingClientRect();
    if (pointer.event?.clientX != null && rect.width > 0) {
      return ((pointer.event.clientX - rect.left) / rect.width) * GAME_WIDTH;
    }
    return pointer.x;
  }

  onPointerDown(pointer) {
    if (this.playState === 'waiting') {
      this.startGame();
      return;
    }

    if (!this.isCanvasPointer(pointer) || this.playState !== 'playing') {
      return;
    }

    this.pointerX = this.pointerToGameX(pointer);
    this.usingPointer = true;
    this.tryShoot();
  }

  onPointerMove(pointer) {
    if (!this.isCanvasPointer(pointer) || this.playState !== 'playing') {
      return;
    }

    this.pointerX = this.pointerToGameX(pointer);
    this.usingPointer = true;
  }

  clampShipX(x) {
    return Phaser.Math.Clamp(x, 18 + SHIP_HALF, GAME_WIDTH - 18 - SHIP_HALF);
  }

  tryShoot() {
    if (this.ended || this.playState !== 'playing' || this.phase !== 'live') {
      return;
    }
    if (this.time.now < this.nextShotAt || this.playerShots.length >= MAX_PLAYER_BULLETS) {
      return;
    }

    const gfx = this.add.circle(this.ship.x, this.ship.y - 22, PLAYER_SHOT_R, 0xffe566);
    gfx.setStrokeStyle(2, 0xffffff);
    gfx.setDepth(8);
    this.playerShots.push({ gfx, x: this.ship.x, y: this.ship.y - 22 });
    this.nextShotAt = this.time.now + BULLET_COOLDOWN;
    this.audio.shoot();
  }

  refreshHud() {
    this.scoreText.setText(`Score ${this.score}`);
    this.waveText.setText(`Wave ${this.wave}`);
    this.livesIcons.forEach((icon, index) => {
      icon.setVisible(index < this.lives);
    });
  }

  popBits(x, y, color) {
    for (let i = 0; i < 6; i += 1) {
      const bit = this.add.rectangle(x, y, 5, 5, color).setDepth(11);
      this.tweens.add({
        targets: bit,
        x: x + Phaser.Math.Between(-26, 26),
        y: y + Phaser.Math.Between(-18, 16),
        alpha: 0,
        scale: 0.3,
        duration: 280,
        onComplete: () => bit.destroy(),
      });
    }
  }

  floatLabel(x, y, text, color = '#ffffff') {
    const label = this.add.text(x, y, text, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color,
      stroke: '#1a1448',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(14);
    this.tweens.add({
      targets: label,
      y: y - 22,
      alpha: 0,
      duration: 520,
      onComplete: () => label.destroy(),
    });
  }

  hits(ax, ay, ar, bx, by, br) {
    return Math.hypot(ax - bx, ay - by) <= ar + br;
  }

  rectHits(ax, ay, aw, ah, bx, by, br) {
    const dx = Math.abs(ax - bx);
    const dy = Math.abs(ay - by);
    return dx <= aw / 2 + br && dy <= ah / 2 + br;
  }

  destroyAlien(alien) {
    const points = alien.getData('points');
    this.score += points;
    this.popBits(alien.x, alien.y, alien.getData('color'));
    this.floatLabel(alien.x, alien.y - 8, `+${points}`);
    this.audio.hit();
    alien.destroy();
    this.aliens = this.aliens.filter((item) => item.active);
    this.refreshHud();

    if (this.livingAliens().length === 0) {
      this.beginWaveClear();
    }
  }

  beginWaveClear() {
    this.phase = 'clearing';
    this.clearRemaining = CLEAR_PAUSE;
    this.clearShots();
    this.score += this.wave * 100;
    this.bannerText.setText(`Wave ${this.wave} clear!`);
    this.bannerText.setVisible(true);
    this.audio.wave();
    this.refreshHud();
  }

  startNextWave() {
    this.wave += 1;
    if (this.wave % 3 === 1 && this.lives < MAX_LIVES) {
      this.lives += 1;
      this.floatLabel(GAME_WIDTH / 2, 86, 'Extra life!', '#ff6b9d');
    }
    this.bannerText.setVisible(false);
    this.buildWave();
    this.refreshHud();
  }

  fireAlienShot() {
    const living = this.livingAliens();
    if (!living.length) {
      return;
    }

    const lowestY = Math.max(...living.map((alien) => alien.y));
    const front = living.filter((alien) => alien.y >= lowestY - 8);
    const shooter = Phaser.Utils.Array.GetRandom(front);
    const gfx = this.add.circle(shooter.x, shooter.y + 14, ALIEN_SHOT_R, 0xff9ec4);
    gfx.setStrokeStyle(2, 0xffe1ea);
    gfx.setDepth(7);
    this.alienShots.push({ gfx, x: shooter.x, y: shooter.y + 14 });
    this.audio.alienShot();
  }

  playerIsInvulnerable() {
    return this.time.now < this.invulnUntil;
  }

  hitPlayer() {
    if (this.playerIsInvulnerable()) {
      return;
    }

    this.lives -= 1;
    this.invulnUntil = this.time.now + INVULN_MS;
    this.audio.playerHit();
    this.cameras.main.shake(90, 0.006);
    this.refreshHud();

    if (this.lives <= 0) {
      this.endGame();
    }
  }

  moveShip(delta) {
    let dir = 0;
    if (this.cursors?.left.isDown || this.wasd?.A.isDown) {
      dir -= 1;
    }
    if (this.cursors?.right.isDown || this.wasd?.D.isDown) {
      dir += 1;
    }

    if (dir !== 0) {
      this.usingPointer = false;
      this.ship.x = this.clampShipX(this.ship.x + dir * SHIP_SPEED * (delta / 1000));
    } else if (this.usingPointer) {
      this.ship.x = this.clampShipX(this.pointerX);
    }

    this.ship.y = SHIP_Y;
    this.ship.setAlpha(this.playerIsInvulnerable() ? 0.45 + 0.45 * Math.sin(this.time.now / 70) : 1);
  }

  moveSwarm(delta) {
    const living = this.livingAliens();
    if (!living.length) {
      return;
    }

    const speed = this.marchSpeedForWave() * (1 + 0.7 * (1 - living.length / Math.max(this.waveCount, 1)));
    const dx = this.swarmDir * speed * (delta / 1000);
    living.forEach((alien) => {
      alien.x += dx;
    });

    const minX = Math.min(...living.map((alien) => alien.x));
    const maxX = Math.max(...living.map((alien) => alien.x));
    if (minX - ALIEN_W / 2 < 18 || maxX + ALIEN_W / 2 > GAME_WIDTH - 18) {
      this.swarmDir *= -1;
      living.forEach((alien) => {
        alien.x -= dx;
        alien.y += STEP_DOWN;
      });
    }

    const lowest = Math.max(...living.map((alien) => alien.y));
    if (lowest + ALIEN_H / 2 >= SHIP_Y - 20) {
      this.endGame();
    }
  }

  moveShots(delta) {
    const dt = delta / 1000;

    this.playerShots = this.playerShots.filter((shot) => {
      shot.y -= BULLET_SPEED * dt;
      shot.gfx.setPosition(shot.x, shot.y);
      if (shot.y < HUD_TOP) {
        shot.gfx.destroy();
        return false;
      }
      return true;
    });

    this.alienShots = this.alienShots.filter((shot) => {
      shot.y += ALIEN_SHOT_SPEED * dt;
      shot.gfx.setPosition(shot.x, shot.y);
      if (shot.y > GAME_HEIGHT + 8) {
        shot.gfx.destroy();
        return false;
      }
      return true;
    });
  }

  resolveHits() {
    const leftoverShots = [];
    this.playerShots.forEach((shot) => {
      if (this.phase !== 'live') {
        return;
      }
      const hit = this.livingAliens().find((alien) => this.hits(shot.x, shot.y, PLAYER_SHOT_R, alien.x, alien.y, ALIEN_W / 2 - 2));
      if (hit) {
        shot.gfx.destroy();
        this.destroyAlien(hit);
        return;
      }
      leftoverShots.push(shot);
    });
    if (this.phase === 'live') {
      this.playerShots = leftoverShots;
    }

    if (this.phase !== 'live' || this.ended) {
      return;
    }

    this.alienShots = this.alienShots.filter((shot) => {
      if (this.rectHits(this.ship.x, this.ship.y, 36, 28, shot.x, shot.y, ALIEN_SHOT_R)) {
        shot.gfx.destroy();
        this.hitPlayer();
        return false;
      }
      return true;
    });
  }

  twinkleStars() {
    this.stars.forEach((star) => {
      const base = star.getData('base');
      const phase = star.getData('phase');
      star.setAlpha(base * (0.55 + 0.45 * Math.sin(this.time.now / 420 + phase)));
    });
  }

  update(_time, delta) {
    this.twinkleStars();

    if (this.ended || this.playState !== 'playing') {
      return;
    }

    this.moveShip(delta);

    if (this.phase === 'clearing') {
      this.clearRemaining -= delta;
      if (this.clearRemaining <= 0) {
        this.startNextWave();
      }
      return;
    }

    this.moveSwarm(delta);
    this.moveShots(delta);
    this.resolveHits();

    this.alienFireIn -= delta;
    if (this.alienFireIn <= 0) {
      this.fireAlienShot();
      const range = this.alienFireRange();
      this.alienFireIn = Phaser.Math.Between(range.min, range.max);
    }
  }

  endGame() {
    if (this.ended) {
      return;
    }

    this.ended = true;
    this.phase = 'ended';
    this.bannerText.setVisible(false);
    this.hintText.setVisible(false);
    this.audio.lose();
    this.notifyState('ended');

    const onGameOver = this.registry.get('onGameOver');
    if (typeof onGameOver === 'function') {
      onGameOver(this.score, this.wave);
    }
  }
}

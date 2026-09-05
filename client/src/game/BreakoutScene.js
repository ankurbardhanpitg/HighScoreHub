import Phaser from 'phaser';

export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 380;
export const STARTING_LIVES = 3;

function createBreakoutAudio() {
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
    launch() {
      beep({ type: 'sine', freq: 520, freqEnd: 880, duration: 0.12, volume: 0.07 });
    },
    paddle() {
      beep({ type: 'triangle', freq: 240, freqEnd: 420, duration: 0.08, volume: 0.08 });
    },
    wall() {
      beep({ type: 'triangle', freq: 300, duration: 0.05, volume: 0.06 });
    },
    brick(combo) {
      const freq = Math.min(1180, 420 + combo * 90);
      beep({ type: 'square', freq, freqEnd: freq + 160, duration: 0.07, volume: 0.08 });
    },
    crack() {
      beep({ type: 'triangle', freq: 360, freqEnd: 280, duration: 0.06, volume: 0.06 });
    },
    bank() {
      beep({ type: 'sine', freq: 784, duration: 0.08, volume: 0.07, delay: 0.04 });
    },
    miss() {
      beep({ type: 'triangle', freq: 220, freqEnd: 80, duration: 0.28, volume: 0.09 });
    },
    level() {
      beep({ freq: 523, duration: 0.09, volume: 0.08 });
      beep({ freq: 659, duration: 0.09, volume: 0.08, delay: 0.09 });
      beep({ freq: 784, duration: 0.16, volume: 0.09, delay: 0.18 });
    },
    lose() {
      beep({ type: 'triangle', freq: 330, freqEnd: 110, duration: 0.42, volume: 0.09 });
    },
  };
}

const WALL = 10;
const HUD_TOP = 36;
const BALL_RADIUS = 7;
const PADDLE_HEIGHT = 14;
const PADDLE_Y = GAME_HEIGHT - 22;
const PADDLE_KEY_SPEED = 560;
const BALL_SPEED_START = 250;
const BALL_SPEED_MAX = 390;
const BALL_SPEED_BRICK_BUMP = 5;
const MAX_BOUNCE_ANGLE = Phaser.Math.DegToRad(68);
const MAX_LAUNCH_ANGLE = Phaser.Math.DegToRad(58);
const BRICK_COLS = 10;
const BRICK_GAP = 5;
const BRICK_HEIGHT = 16;
const BRICK_COLORS = [0xff6b9d, 0xff8a3d, 0xffe566, 0x7ed957, 0x4da3ff, 0x9b6dff];
const ROW_POINTS = [60, 50, 40, 30, 20, 10];
const BANK_BONUS = 25;
const CLEAR_PAUSE = 900;
const MAX_LIVES = 5;

export default class BreakoutScene extends Phaser.Scene {
  constructor() {
    super('BreakoutScene');
  }

  create() {
    this.ended = false;
    this.playState = 'waiting';
    this.phase = 'serve';
    this.score = 0;
    this.lives = STARTING_LIVES;
    this.level = 1;
    this.combo = 0;
    this.ballSpeed = BALL_SPEED_START;
    this.pointerX = GAME_WIDTH / 2;
    this.usingPointer = false;
    this.lastPaddleX = GAME_WIDTH / 2;
    this.bouncedWall = false;
    this.nextWallSoundAt = 0;
    this.previewUntil = 0;
    this.clearRemaining = 0;
    this.bricks = [];
    this.trail = [];
    this.audio = createBreakoutAudio();

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x16324f);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH - 20, GAME_HEIGHT - 20, 0x1b4b6b);
    this.add.rectangle(GAME_WIDTH / 2, (HUD_TOP + GAME_HEIGHT) / 2, GAME_WIDTH - 44, GAME_HEIGHT - HUD_TOP - 24, 0x165a78);

    this.leftWall = this.add.rectangle(WALL / 2, GAME_HEIGHT / 2, WALL, GAME_HEIGHT, 0xffb347);
    this.rightWall = this.add.rectangle(GAME_WIDTH - WALL / 2, GAME_HEIGHT / 2, WALL, GAME_HEIGHT, 0xffb347);
    this.topWall = this.add.rectangle(GAME_WIDTH / 2, WALL / 2, GAME_WIDTH, WALL, 0x7ed8f2);
    this.physics.add.existing(this.leftWall, true);
    this.physics.add.existing(this.rightWall, true);
    this.physics.add.existing(this.topWall, true);

    this.trailGfx = this.add.graphics().setDepth(3);
    this.aimGfx = this.add.graphics().setDepth(8);
    this.paddleGfx = this.add.graphics().setDepth(6);

    this.paddle = this.add.rectangle(GAME_WIDTH / 2, PADDLE_Y, this.paddleWidthForLevel(), PADDLE_HEIGHT, 0xff6b9d);
    this.paddle.setStrokeStyle(3, 0xffd6e6);
    this.paddle.setDepth(7);

    this.ball = this.add.circle(GAME_WIDTH / 2, PADDLE_Y - PADDLE_HEIGHT / 2 - BALL_RADIUS, BALL_RADIUS, 0xfff4c2);
    this.ball.setStrokeStyle(3, 0xffffff);
    this.ball.setDepth(9);
    this.physics.add.existing(this.ball);
    this.ball.body.setCircle(BALL_RADIUS);
    this.ball.body.setBounce(1, 1);
    this.ball.body.setAllowGravity(false);
    this.ball.body.setCollideWorldBounds(false);
    this.ball.body.setFriction(0, 0);
    this.ball.body.setDrag(0, 0);
    this.ball.body.setMaxVelocity(BALL_SPEED_MAX + 50, BALL_SPEED_MAX + 50);
    this.ball.body.enable = false;

    this.physics.add.collider(this.ball, this.leftWall, this.hitWall, undefined, this);
    this.physics.add.collider(this.ball, this.rightWall, this.hitWall, undefined, this);
    this.physics.add.collider(this.ball, this.topWall, this.hitWall, undefined, this);

    this.scoreText = this.add.text(108, 16, 'Score 0', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      stroke: '#16324f',
      strokeThickness: 5,
    }).setOrigin(0, 0.5).setDepth(12);

    this.levelText = this.add.text(GAME_WIDTH / 2, 16, 'Level 1', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#ffe566',
      stroke: '#16324f',
      strokeThickness: 5,
    }).setOrigin(0.5, 0.5).setDepth(12);

    this.comboText = this.add.text(220, 16, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#ffe566',
      stroke: '#16324f',
      strokeThickness: 5,
    }).setOrigin(0, 0.5).setDepth(12);

    this.hintText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 48, 'Move to aim, then click or press Space', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '15px',
      color: '#ffffff',
      stroke: '#16324f',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(12);

    this.bannerText = this.add.text(GAME_WIDTH / 2, 200, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '28px',
      color: '#ffe566',
      stroke: '#16324f',
      strokeThickness: 8,
    }).setOrigin(0.5).setDepth(13).setVisible(false);

    this.livesIcons = [];
    for (let i = 0; i < MAX_LIVES; i += 1) {
      const icon = this.add.circle(24 + i * 16, 16, 6, 0xff6b9d).setStrokeStyle(2, 0xffd6e6).setDepth(12);
      this.livesIcons.push(icon);
    }

    this.buildBricks();
    this.refreshHud();
    this.parkBallOnPaddle();

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

  paddleWidthForLevel() {
    return Math.max(72, 112 - (this.level - 1) * 6);
  }

  serveSpeed() {
    return Math.min(BALL_SPEED_START + (this.level - 1) * 18, BALL_SPEED_MAX - 40);
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
    this.notifyState('playing');
    this.phase = 'serve';
    this.hintText.setText('Move to aim, then click or press Space');
    this.hintText.setVisible(true);
  }

  pauseGame() {
    if (this.ended || this.playState !== 'playing') {
      return;
    }

    this.physics.pause();
    this.notifyState('paused');
  }

  resumeGame() {
    if (this.ended || this.playState !== 'paused') {
      return;
    }

    this.physics.resume();
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

    if (this.playState === 'playing' && this.phase === 'serve') {
      this.launchBall();
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

    if (this.phase === 'serve') {
      this.launchBall();
    }
  }

  onPointerMove(pointer) {
    if (!this.isCanvasPointer(pointer) || this.playState !== 'playing') {
      return;
    }

    this.pointerX = this.pointerToGameX(pointer);
    this.usingPointer = true;
  }

  innerLeft() {
    return WALL + 8;
  }

  innerRight() {
    return GAME_WIDTH - WALL - 8;
  }

  clampPaddleX(x) {
    const half = this.paddle.width / 2;
    return Phaser.Math.Clamp(x, this.innerLeft() + half, this.innerRight() - half);
  }

  launchAngle() {
    const halfRange = (this.innerRight() - this.innerLeft()) / 2 - this.paddle.width / 2;
    const offset = Phaser.Math.Clamp((this.paddle.x - GAME_WIDTH / 2) / Math.max(1, halfRange), -1, 1);
    return offset * MAX_LAUNCH_ANGLE;
  }

  velocityFromAngle(angle, speed, goingUp = true) {
    return {
      vx: Math.sin(angle) * speed,
      vy: (goingUp ? -1 : 1) * Math.cos(angle) * speed,
    };
  }

  parkBallOnPaddle() {
    this.ball.body.enable = false;
    this.ball.body.stop();
    this.ball.setPosition(this.paddle.x, PADDLE_Y - PADDLE_HEIGHT / 2 - BALL_RADIUS - 1);
    this.trail = [];
    this.aimGfx.clear();
    this.trailGfx.clear();
  }

  launchBall() {
    if (this.ended || this.playState !== 'playing' || this.phase !== 'serve') {
      return;
    }

    this.phase = 'live';
    this.combo = 0;
    this.bouncedWall = false;
    this.hintText.setVisible(false);
    this.ballSpeed = this.serveSpeed();
    const { vx, vy } = this.velocityFromAngle(this.launchAngle(), this.ballSpeed, true);
    this.ball.setPosition(this.paddle.x, PADDLE_Y - PADDLE_HEIGHT / 2 - BALL_RADIUS - 1);
    this.ball.body.enable = true;
    this.ball.body.reset(this.ball.x, this.ball.y);
    this.ball.body.setVelocity(vx, vy);
    this.previewUntil = this.time.now + 700;
    this.audio.launch();
    this.refreshHud();
  }

  rowCountForLevel() {
    return Math.min(6, 5 + Math.floor((this.level - 1) / 2));
  }

  clearBricks() {
    this.bricks.forEach((brick) => brick.destroy());
    this.bricks = [];
  }

  buildBricks() {
    this.clearBricks();
    const rows = this.rowCountForLevel();
    const innerWidth = this.innerRight() - this.innerLeft();
    const brickWidth = (innerWidth - (BRICK_COLS - 1) * BRICK_GAP) / BRICK_COLS;
    const startX = this.innerLeft() + brickWidth / 2;
    const startY = HUD_TOP + 22;
    const toughRows = Math.min(rows - 1, Math.max(0, this.level - 1));

    for (let row = 0; row < rows; row += 1) {
      const color = BRICK_COLORS[row % BRICK_COLORS.length];
      const points = ROW_POINTS[row] || 10;
      const hits = row < toughRows ? 2 : 1;
      for (let col = 0; col < BRICK_COLS; col += 1) {
        const x = startX + col * (brickWidth + BRICK_GAP);
        const y = startY + row * (BRICK_HEIGHT + BRICK_GAP);
        const brick = this.add.rectangle(x, y, brickWidth, BRICK_HEIGHT, color);
        brick.setStrokeStyle(2, hits > 1 ? 0xffffff : 0xfff7d6, hits > 1 ? 0.95 : 0.55);
        brick.setDepth(5);
        brick.setData('hits', hits);
        brick.setData('points', points);
        brick.setData('color', color);
        this.bricks.push(brick);
      }
    }
  }

  remainingBricks() {
    return this.bricks.filter((brick) => brick.active).length;
  }

  refreshHud() {
    this.scoreText.setText(`Score ${this.score}`);
    this.levelText.setText(`Level ${this.level}`);
    this.comboText.setText(this.combo >= 2 ? `Combo x${this.combo}` : '');
    this.livesIcons.forEach((icon, index) => {
      icon.setVisible(index < this.lives);
    });
  }

  hitWall() {
    if (this.phase !== 'live' || this.ended) {
      return;
    }

    this.bouncedWall = true;
    this.keepBallSpeed();
    if (this.time.now >= this.nextWallSoundAt) {
      this.nextWallSoundAt = this.time.now + 80;
      this.audio.wall();
    }
  }

  keepBallSpeed() {
    const { x, y } = this.ball.body.velocity;
    const mag = Math.hypot(x, y);
    if (mag < 1) {
      return;
    }

    let vx = (x / mag) * this.ballSpeed;
    let vy = (y / mag) * this.ballSpeed;
    if (Math.abs(vy) < this.ballSpeed * 0.22) {
      vy = Math.sign(vy || -1) * this.ballSpeed * 0.28;
      const next = Math.hypot(vx, vy);
      vx = (vx / next) * this.ballSpeed;
      vy = (vy / next) * this.ballSpeed;
    }
    this.ball.body.setVelocity(vx, vy);
  }

  ballHitsRect(rect, extraX = 0, extraY = 0) {
    return (
      Math.abs(this.ball.x - rect.x) <= rect.width / 2 + BALL_RADIUS + extraX &&
      Math.abs(this.ball.y - rect.y) <= rect.height / 2 + BALL_RADIUS + extraY
    );
  }

  bounceOffPaddle() {
    const relative = (this.ball.x - this.paddle.x) / (this.paddle.width / 2);
    const paddleEnglish = Phaser.Math.Clamp((this.paddle.x - this.lastPaddleX) / 18, -0.35, 0.35);
    const angle = Phaser.Math.Clamp(relative + paddleEnglish, -1, 1) * MAX_BOUNCE_ANGLE;
    const nextY = PADDLE_Y - PADDLE_HEIGHT / 2 - BALL_RADIUS - 1;
    const { vx, vy } = this.velocityFromAngle(angle, this.ballSpeed, true);
    this.ball.setPosition(this.ball.x, nextY);
    this.ball.body.reset(this.ball.x, nextY);
    this.ball.body.setVelocity(vx, vy);
    this.combo = 0;
    this.bouncedWall = false;
    this.previewUntil = this.time.now + 720;
    this.audio.paddle();
    this.refreshHud();
  }

  popBits(x, y, color) {
    for (let i = 0; i < 5; i += 1) {
      const bit = this.add.rectangle(x, y, 5, 5, color).setDepth(11);
      this.tweens.add({
        targets: bit,
        x: x + Phaser.Math.Between(-28, 28),
        y: y + Phaser.Math.Between(-22, 18),
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
      stroke: '#16324f',
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

  resolveBrickHit(brick) {
    const overlapX = brick.width / 2 + BALL_RADIUS - Math.abs(this.ball.x - brick.x);
    const overlapY = brick.height / 2 + BALL_RADIUS - Math.abs(this.ball.y - brick.y);
    const vel = this.ball.body.velocity;

    if (overlapX < overlapY) {
      this.ball.x += Math.sign(this.ball.x - brick.x) * (overlapX + 0.5);
      vel.x *= -1;
    } else {
      this.ball.y += Math.sign(this.ball.y - brick.y) * (overlapY + 0.5);
      vel.y *= -1;
    }
    this.ball.body.updateFromGameObject();
    this.ball.body.setVelocity(vel.x, vel.y);
    this.keepBallSpeed();

    const hits = brick.getData('hits') - 1;
    brick.setData('hits', hits);

    if (hits > 0) {
      const cracked = Phaser.Display.Color.IntegerToColor(brick.getData('color'));
      brick.setFillStyle(
        Phaser.Display.Color.GetColor(
          Math.round(cracked.r * 0.72),
          Math.round(cracked.g * 0.72),
          Math.round(cracked.b * 0.72)
        )
      );
      brick.setStrokeStyle(2, 0xfff7d6, 0.45);
      this.audio.crack();
      this.cameras.main.shake(40, 0.002);
      return;
    }

    this.combo += 1;
    this.ballSpeed = Math.min(this.ballSpeed + BALL_SPEED_BRICK_BUMP, BALL_SPEED_MAX);
    const gained = brick.getData('points') * this.combo;
    this.score += gained;
    this.popBits(brick.x, brick.y, brick.getData('color'));
    this.floatLabel(brick.x, brick.y - 8, `+${gained}`);
    this.audio.brick(this.combo);

    if (this.bouncedWall) {
      this.score += BANK_BONUS;
      this.floatLabel(brick.x + 18, brick.y + 10, `Bank +${BANK_BONUS}`, '#7ed957');
      this.audio.bank();
      this.bouncedWall = false;
    }

    brick.destroy();
    this.bricks = this.bricks.filter((item) => item.active);
    this.cameras.main.shake(this.combo >= 4 ? 90 : 55, this.combo >= 4 ? 0.006 : 0.003);
    this.refreshHud();

    if (this.remainingBricks() === 0) {
      this.beginLevelClear();
    }
  }

  beginLevelClear() {
    this.phase = 'clearing';
    this.clearRemaining = CLEAR_PAUSE;
    this.ball.body.stop();
    this.ball.body.enable = false;
    this.score += this.level * 100;
    this.bannerText.setText(`Level ${this.level} clear!`);
    this.bannerText.setVisible(true);
    this.audio.level();
    this.refreshHud();
  }

  startNextLevel() {
    this.level += 1;
    if (this.level % 3 === 1 && this.lives < MAX_LIVES) {
      this.lives += 1;
      this.floatLabel(GAME_WIDTH / 2, 86, 'Extra life!', '#ff6b9d');
    }
    this.paddle.setSize(this.paddleWidthForLevel(), PADDLE_HEIGHT);
    this.buildBricks();
    this.phase = 'serve';
    this.combo = 0;
    this.bouncedWall = false;
    this.ballSpeed = this.serveSpeed();
    this.bannerText.setVisible(false);
    this.hintText.setText('New wall — aim your shot');
    this.hintText.setVisible(true);
    this.parkBallOnPaddle();
    this.refreshHud();
  }

  missBall() {
    this.lives -= 1;
    this.combo = 0;
    this.bouncedWall = false;
    this.ballSpeed = this.serveSpeed();
    this.audio.miss();
    this.refreshHud();

    if (this.lives <= 0) {
      this.endGame();
      return;
    }

    this.phase = 'serve';
    this.hintText.setText(`${this.lives} ${this.lives === 1 ? 'life' : 'lives'} left — aim and launch`);
    this.hintText.setVisible(true);
    this.parkBallOnPaddle();
  }

  predictPath(startX, startY, vx, vy, maxDist = 300) {
    const points = [];
    let x = startX;
    let y = startY;
    let dist = 0;
    const left = WALL + BALL_RADIUS;
    const right = GAME_WIDTH - WALL - BALL_RADIUS;
    const top = WALL + BALL_RADIUS;
    const step = 1 / 90;
    const activeBricks = this.bricks.filter((brick) => brick.active);

    for (let i = 0; i < 220 && dist < maxDist; i += 1) {
      x += vx * step;
      y += vy * step;
      dist += Math.hypot(vx, vy) * step;

      if (x <= left) {
        x = left;
        vx = Math.abs(vx);
      } else if (x >= right) {
        x = right;
        vx = -Math.abs(vx);
      }
      if (y <= top) {
        y = top;
        vy = Math.abs(vy);
      }
      if (y > PADDLE_Y) {
        points.push({ x, y });
        break;
      }

      let hitBrick = false;
      for (let b = 0; b < activeBricks.length; b += 1) {
        const brick = activeBricks[b];
        if (
          Math.abs(x - brick.x) <= brick.width / 2 + BALL_RADIUS &&
          Math.abs(y - brick.y) <= brick.height / 2 + BALL_RADIUS
        ) {
          points.push({ x, y });
          hitBrick = true;
          break;
        }
      }
      if (hitBrick) {
        break;
      }

      if (i % 3 === 0) {
        points.push({ x, y });
      }
    }

    return points;
  }

  drawAimPreview() {
    this.aimGfx.clear();
    const serving = this.phase === 'serve' && this.playState === 'playing';
    const bounceHint = this.phase === 'live' && this.time.now < this.previewUntil;
    if (!serving && !bounceHint) {
      return;
    }

    let points;
    if (serving) {
      const { vx, vy } = this.velocityFromAngle(this.launchAngle(), this.ballSpeed || BALL_SPEED_START, true);
      points = this.predictPath(this.ball.x, this.ball.y, vx, vy, 340);
    } else {
      points = this.predictPath(this.ball.x, this.ball.y, this.ball.body.velocity.x, this.ball.body.velocity.y, 260);
    }

    const fade = serving ? 1 : Math.max(0, (this.previewUntil - this.time.now) / 720);
    points.forEach((point, index) => {
      const alpha = (serving ? 0.55 : 0.28) * fade * (1 - index / Math.max(points.length, 1));
      this.aimGfx.fillStyle(0xfff4c2, alpha);
      this.aimGfx.fillCircle(point.x, point.y, serving ? 3 : 2.2);
    });
  }

  drawPaddleGuides() {
    this.paddleGfx.clear();
    const half = this.paddle.width / 2;
    const left = this.paddle.x - half;
    const y = this.paddle.y;
    this.paddleGfx.lineStyle(2, 0xffd6e6, 0.55);
    this.paddleGfx.lineBetween(left + this.paddle.width * 0.28, y - 5, left + this.paddle.width * 0.28, y + 5);
    this.paddleGfx.lineBetween(left + this.paddle.width * 0.72, y - 5, left + this.paddle.width * 0.72, y + 5);

    if (this.phase === 'serve' && this.playState === 'playing') {
      const angle = this.launchAngle();
      this.paddleGfx.lineStyle(3, 0xffe566, 0.9);
      this.paddleGfx.lineBetween(
        this.ball.x,
        this.ball.y,
        this.ball.x + Math.sin(angle) * 26,
        this.ball.y - Math.cos(angle) * 26
      );
    }
  }

  drawTrail() {
    this.trailGfx.clear();
    if (this.phase !== 'live') {
      this.trail = [];
      return;
    }

    this.trail.push({ x: this.ball.x, y: this.ball.y });
    if (this.trail.length > 7) {
      this.trail.shift();
    }
    this.trail.forEach((point, index) => {
      this.trailGfx.fillStyle(0xfff4c2, 0.08 + index * 0.05);
      this.trailGfx.fillCircle(point.x, point.y, 4);
    });
  }

  updatePlayerPaddle(delta) {
    let dir = 0;
    if (this.cursors?.left.isDown || this.wasd?.A.isDown) {
      dir -= 1;
    }
    if (this.cursors?.right.isDown || this.wasd?.D.isDown) {
      dir += 1;
    }

    this.lastPaddleX = this.paddle.x;

    if (dir !== 0) {
      this.usingPointer = false;
      this.paddle.x = this.clampPaddleX(this.paddle.x + dir * PADDLE_KEY_SPEED * (delta / 1000));
    } else if (this.usingPointer) {
      this.paddle.x = this.clampPaddleX(this.pointerX);
    }

    this.paddle.y = PADDLE_Y;
  }

  update(_time, delta) {
    if (this.ended || this.playState !== 'playing') {
      this.drawAimPreview();
      this.drawPaddleGuides();
      return;
    }

    this.updatePlayerPaddle(delta);

    if (this.phase === 'clearing') {
      this.clearRemaining -= delta;
      this.parkBallOnPaddle();
      this.drawPaddleGuides();
      this.drawAimPreview();
      if (this.clearRemaining <= 0) {
        this.startNextLevel();
      }
      return;
    }

    if (this.phase === 'serve') {
      this.parkBallOnPaddle();
      this.drawPaddleGuides();
      this.drawAimPreview();
      return;
    }

    this.drawTrail();
    this.drawPaddleGuides();
    this.drawAimPreview();
    this.keepBallSpeed();

    if (this.ball.body.velocity.y > 0 && this.ballHitsRect(this.paddle, 0, 1) && this.ball.y <= PADDLE_Y) {
      this.bounceOffPaddle();
    }

    for (let i = 0; i < this.bricks.length; i += 1) {
      const brick = this.bricks[i];
      if (brick.active && this.ballHitsRect(brick)) {
        this.resolveBrickHit(brick);
        break;
      }
    }

    if (this.ball.y > GAME_HEIGHT + BALL_RADIUS) {
      this.missBall();
    }
  }

  endGame() {
    if (this.ended) {
      return;
    }

    this.ended = true;
    this.phase = 'ended';
    this.ball.body.stop();
    this.ball.body.enable = false;
    this.aimGfx.clear();
    this.bannerText.setVisible(false);
    this.hintText.setVisible(false);
    this.audio.lose();
    this.notifyState('ended');

    const onGameOver = this.registry.get('onGameOver');
    if (typeof onGameOver === 'function') {
      onGameOver(this.score, this.level);
    }
  }
}

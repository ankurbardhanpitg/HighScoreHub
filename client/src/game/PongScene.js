import Phaser from 'phaser';

export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 380;
export const WIN_SCORE = 5;

function createPongAudio() {
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
    paddle(playerHit) {
      beep({ freq: playerHit ? 560 : 420, duration: 0.07, volume: 0.08 });
    },
    wall() {
      beep({ type: 'triangle', freq: 280, duration: 0.06, volume: 0.07 });
    },
    serve() {
      beep({ type: 'sine', freq: 640, freqEnd: 880, duration: 0.12, volume: 0.07 });
    },
    score() {
      beep({ freq: 523, duration: 0.09, volume: 0.09 });
      beep({ freq: 659, duration: 0.12, volume: 0.09, delay: 0.08 });
    },
    miss() {
      beep({ type: 'triangle', freq: 220, freqEnd: 90, duration: 0.22, volume: 0.09 });
    },
    win() {
      beep({ freq: 523, duration: 0.1, volume: 0.09 });
      beep({ freq: 659, duration: 0.1, volume: 0.09, delay: 0.1 });
      beep({ freq: 784, duration: 0.2, volume: 0.1, delay: 0.2 });
    },
    lose() {
      beep({ type: 'triangle', freq: 330, freqEnd: 110, duration: 0.38, volume: 0.09 });
    },
  };
}

const PADDLE_WIDTH = 16;
const PLAYER_PADDLE_HEIGHT = 104;
const AI_PADDLE_HEIGHT = 78;
const BALL_RADIUS = 11;
const PLAYER_KEY_SPEED = 420;
const AI_SPEED = 195;
const BALL_SPEED = 230;
const BALL_SPEED_MAX = 390;
const BALL_SPEED_BUMP = 16;
const WALL_THICKNESS = 10;
const SERVE_DELAY = 1100;
const PLAYER_X = 36;
const AI_X = GAME_WIDTH - 36;

export default class PongScene extends Phaser.Scene {
  constructor() {
    super('PongScene');
  }

  create() {
    this.ended = false;
    this.playState = 'waiting';
    this.serving = false;
    this.serveRemaining = 0;
    this.serveTowardPlayer = true;
    this.playerScore = 0;
    this.cpuScore = 0;
    this.ballSpeed = BALL_SPEED;
    this.aiError = 0;
    this.pointerY = GAME_HEIGHT / 2;
    this.usingPointer = false;
    this.nextWallSoundAt = 0;
    this.audio = createPongAudio();

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1f4e79);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH - 24, GAME_HEIGHT - 24, 0x2a6f97);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH - 48, GAME_HEIGHT - 48, 0x1d5f86);

    const dashHeight = 16;
    const dashGap = 12;
    for (let y = 28; y < GAME_HEIGHT - 20; y += dashHeight + dashGap) {
      this.add.rectangle(GAME_WIDTH / 2, y + dashHeight / 2, 6, dashHeight, 0xffffff, 0.35);
    }

    this.add.text(86, 22, 'YOU', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color: '#ffd6e6',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(8);

    this.add.text(GAME_WIDTH - 86, 22, 'CPU', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color: '#d6ebff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(8);

    this.playerPaddle = this.add.rectangle(PLAYER_X, GAME_HEIGHT / 2, PADDLE_WIDTH, PLAYER_PADDLE_HEIGHT, 0xff6b9d);
    this.playerPaddle.setStrokeStyle(3, 0xffd6e6);
    this.playerPaddle.setDepth(5);

    this.aiPaddle = this.add.rectangle(AI_X, GAME_HEIGHT / 2, PADDLE_WIDTH, AI_PADDLE_HEIGHT, 0x4da3ff);
    this.aiPaddle.setStrokeStyle(3, 0xd6ebff);
    this.aiPaddle.setDepth(5);

    this.ball = this.add.circle(GAME_WIDTH / 2, GAME_HEIGHT / 2, BALL_RADIUS, 0xfff4c2);
    this.ball.setStrokeStyle(3, 0xffffff);
    this.ball.setDepth(6);
    this.physics.add.existing(this.ball);
    this.ball.body.setCircle(BALL_RADIUS);
    this.ball.body.setBounce(1, 1);
    this.ball.body.setAllowGravity(false);
    this.ball.body.setMaxVelocity(BALL_SPEED_MAX + 40, BALL_SPEED_MAX + 40);
    this.ball.body.setCollideWorldBounds(false);
    this.ball.body.setFriction(0, 0);
    this.ball.body.setDrag(0, 0);
    this.ball.body.enable = false;

    const topWall = this.add.rectangle(GAME_WIDTH / 2, WALL_THICKNESS / 2, GAME_WIDTH, WALL_THICKNESS, 0x7ed8f2);
    const bottomWall = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT - WALL_THICKNESS / 2,
      GAME_WIDTH,
      WALL_THICKNESS,
      0x7ed957
    );
    this.physics.add.existing(topWall, true);
    this.physics.add.existing(bottomWall, true);
    this.physics.add.collider(this.ball, topWall, this.hitWall, undefined, this);
    this.physics.add.collider(this.ball, bottomWall, this.hitWall, undefined, this);

    this.scoreText = this.add.text(GAME_WIDTH / 2, 28, '0  :  0', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '36px',
      color: '#ffffff',
      stroke: '#1f4e79',
      strokeThickness: 8,
    });
    this.scoreText.setOrigin(0.5);
    this.scoreText.setDepth(10);

    this.hintText = this.add.text(GAME_WIDTH / 2, 92, 'Press Start when you are ready!', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#ffffff',
      stroke: '#1f4e79',
      strokeThickness: 5,
      align: 'center',
      wordWrap: { width: 560 },
    });
    this.hintText.setOrigin(0.5);
    this.hintText.setDepth(10);

    this.serveText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 42, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '22px',
      color: '#ffe566',
      stroke: '#1f4e79',
      strokeThickness: 6,
    });
    this.serveText.setOrigin(0.5);
    this.serveText.setDepth(10);
    this.serveText.setVisible(false);

    this.cursors = this.input.keyboard?.createCursorKeys();
    this.wasd = this.input.keyboard?.addKeys('W,S');

    this.input.keyboard?.addCapture(['UP', 'DOWN', 'W', 'S', 'P', 'ESC', 'SPACE']);
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
    this.notifyState('playing');
    this.serve(true);
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
    }
  }

  isCanvasPointer(pointer) {
    const target = pointer.event?.target;
    return !target || target === this.game.canvas;
  }

  pointerToGameY(pointer) {
    const rect = this.game.canvas.getBoundingClientRect();
    if (pointer.event?.clientY != null && rect.height > 0) {
      return ((pointer.event.clientY - rect.top) / rect.height) * GAME_HEIGHT;
    }
    return pointer.y;
  }

  onPointerDown(pointer) {
    if (this.playState === 'waiting') {
      this.startGame();
      return;
    }

    if (!this.isCanvasPointer(pointer) || this.playState !== 'playing') {
      return;
    }

    this.pointerY = this.pointerToGameY(pointer);
    this.usingPointer = true;
  }

  onPointerMove(pointer) {
    if (!this.isCanvasPointer(pointer) || this.playState !== 'playing') {
      return;
    }

    this.pointerY = this.pointerToGameY(pointer);
    this.usingPointer = true;
  }

  clampPaddleY(y, height) {
    const half = height / 2;
    return Phaser.Math.Clamp(y, half + WALL_THICKNESS + 2, GAME_HEIGHT - half - WALL_THICKNESS - 2);
  }

  resetBall(x = GAME_WIDTH / 2, y = GAME_HEIGHT / 2) {
    this.ball.body.enable = true;
    this.ball.body.reset(x, y);
    this.ball.body.stop();
    this.ball.body.enable = false;
    this.ball.setPosition(x, y);
  }

  serve(towardPlayer) {
    this.serving = true;
    this.serveTowardPlayer = towardPlayer;
    this.serveRemaining = SERVE_DELAY;
    this.ballSpeed = BALL_SPEED;
    this.resetBall();
    this.refreshAiError();
    this.serveText.setText('Get ready!');
    this.serveText.setVisible(true);
  }

  launchBall() {
    if (this.ended || this.playState !== 'playing' || !this.serving) {
      return;
    }

    this.serveText.setVisible(false);
    this.serving = false;
    this.serveRemaining = 0;
    this.ball.body.enable = true;
    this.ball.body.reset(GAME_WIDTH / 2, GAME_HEIGHT / 2);

    const dir = this.serveTowardPlayer ? -1 : 1;
    const angle = Phaser.Math.FloatBetween(-0.14, 0.14);
    this.ball.body.setVelocity(
      dir * Math.cos(angle) * this.ballSpeed,
      Math.sin(angle) * this.ballSpeed
    );
    this.audio.serve();
  }

  refreshAiError() {
    this.aiError = Phaser.Math.Between(-58, 58);
  }

  hitWall() {
    if (this.serving || this.ended || this.time.now < this.nextWallSoundAt) {
      return;
    }

    this.nextWallSoundAt = this.time.now + 90;
    this.audio.wall();
  }

  bounceOffPaddle(paddle, directionX, paddleHeight) {
    const relative = (this.ball.y - paddle.y) / (paddleHeight / 2);
    const clamped = Phaser.Math.Clamp(relative, -0.95, 0.95);
    const angle = clamped * Phaser.Math.DegToRad(52);
    this.ballSpeed = Math.min(this.ballSpeed + BALL_SPEED_BUMP, BALL_SPEED_MAX);
    const nextX = paddle.x + directionX * (PADDLE_WIDTH / 2 + BALL_RADIUS + 2);
    const nextY = Phaser.Math.Clamp(
      this.ball.y,
      WALL_THICKNESS + BALL_RADIUS + 2,
      GAME_HEIGHT - WALL_THICKNESS - BALL_RADIUS - 2
    );
    this.ball.body.reset(nextX, nextY);
    this.ball.body.setVelocity(
      directionX * Math.cos(angle) * this.ballSpeed,
      Math.sin(angle) * this.ballSpeed
    );
    this.audio.paddle(directionX > 0);
    this.refreshAiError();
  }

  ballHitsPaddle(paddle, paddleHeight) {
    return (
      Math.abs(this.ball.x - paddle.x) <= PADDLE_WIDTH / 2 + BALL_RADIUS &&
      Math.abs(this.ball.y - paddle.y) <= paddleHeight / 2 + BALL_RADIUS
    );
  }

  updateScoreboard() {
    this.scoreText.setText(`${this.playerScore}  :  ${this.cpuScore}`);
  }

  scorePoint(scoredByPlayer) {
    if (this.ended || this.serving) {
      return;
    }

    this.serving = true;
    this.resetBall();

    if (scoredByPlayer) {
      this.playerScore += 1;
    } else {
      this.cpuScore += 1;
    }

    this.updateScoreboard();

    if (this.playerScore >= WIN_SCORE || this.cpuScore >= WIN_SCORE) {
      this.endGame();
      return;
    }

    if (scoredByPlayer) {
      this.audio.score();
    } else {
      this.audio.miss();
    }

    this.serve(true);
  }

  update(_time, delta) {
    if (this.ended || this.playState !== 'playing') {
      return;
    }

    this.updatePlayerPaddle(delta);
    this.updateAiPaddle(delta);

    if (this.serving) {
      this.serveRemaining -= delta;
      if (this.serveRemaining <= 0) {
        this.launchBall();
      }
      return;
    }

    if (this.ball.body.velocity.x < 0 && this.ballHitsPaddle(this.playerPaddle, PLAYER_PADDLE_HEIGHT)) {
      this.bounceOffPaddle(this.playerPaddle, 1, PLAYER_PADDLE_HEIGHT);
    } else if (this.ball.body.velocity.x > 0 && this.ballHitsPaddle(this.aiPaddle, AI_PADDLE_HEIGHT)) {
      this.bounceOffPaddle(this.aiPaddle, -1, AI_PADDLE_HEIGHT);
    }

    if (this.ball.x < -BALL_RADIUS) {
      this.scorePoint(false);
      return;
    }

    if (this.ball.x > GAME_WIDTH + BALL_RADIUS) {
      this.scorePoint(true);
    }
  }

  updatePlayerPaddle(delta) {
    let dir = 0;
    if (this.cursors?.up.isDown || this.wasd?.W.isDown) {
      dir -= 1;
    }
    if (this.cursors?.down.isDown || this.wasd?.S.isDown) {
      dir += 1;
    }

    if (dir !== 0) {
      this.usingPointer = false;
      this.playerPaddle.y = this.clampPaddleY(
        this.playerPaddle.y + dir * PLAYER_KEY_SPEED * (delta / 1000),
        PLAYER_PADDLE_HEIGHT
      );
      return;
    }

    if (this.usingPointer) {
      this.playerPaddle.y = this.clampPaddleY(this.pointerY, PLAYER_PADDLE_HEIGHT);
    }
  }

  updateAiPaddle(delta) {
    const ballGoingRight = !this.serving && this.ball.body.velocity.x > 0;
    const targetY = ballGoingRight ? this.ball.y + this.aiError : GAME_HEIGHT / 2;
    const dy = targetY - this.aiPaddle.y;
    const maxMove = AI_SPEED * (delta / 1000);

    if (Math.abs(dy) > 10) {
      this.aiPaddle.y = this.clampPaddleY(
        this.aiPaddle.y + Phaser.Math.Clamp(dy, -maxMove, maxMove),
        AI_PADDLE_HEIGHT
      );
    }
  }

  endGame() {
    if (this.ended) {
      return;
    }

    this.ended = true;
    this.serving = false;
    this.serveRemaining = 0;
    this.ball.body.stop();
    this.ball.body.enable = false;
    this.serveText.setVisible(false);
    if (this.playerScore >= WIN_SCORE) {
      this.audio.win();
    } else {
      this.audio.lose();
    }
    this.notifyState('ended');

    const onGameOver = this.registry.get('onGameOver');
    if (typeof onGameOver === 'function') {
      onGameOver(this.playerScore, this.cpuScore);
    }
  }
}

import Phaser from 'phaser';

export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 380;

function createFlappyAudio() {
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
      beep({ type: 'sine', freq: 523, duration: 0.1, volume: 0.07 });
      beep({ type: 'sine', freq: 784, duration: 0.14, volume: 0.07, delay: 0.08 });
    },
    flap() {
      beep({ type: 'triangle', freq: 420, freqEnd: 720, duration: 0.09, volume: 0.06 });
    },
    score() {
      beep({ type: 'sine', freq: 880, duration: 0.08, volume: 0.08 });
      beep({ type: 'sine', freq: 1175, duration: 0.12, volume: 0.08, delay: 0.07 });
    },
    hit() {
      beep({ type: 'square', freq: 180, freqEnd: 70, duration: 0.28, volume: 0.09 });
      beep({ type: 'triangle', freq: 140, freqEnd: 50, duration: 0.4, volume: 0.08, delay: 0.04 });
    },
  };
}

const PIPE_WIDTH = 64;
const PIPE_GAP = 180;
const PIPE_SPEED = 120;
const SPAWN_INTERVAL = 2200;
const FLAP_VELOCITY = -150;
const BIRD_RADIUS = 14;
const GROUND_HEIGHT = 20;

export default class FlappyScene extends Phaser.Scene {
  constructor() {
    super('FlappyScene');
  }

  create() {
    this.ended = false;
    this.playState = 'waiting';
    this.score = 0;
    this.nextPipeId = 1;
    this.ignoreFlapUntil = 0;
    this.spawnEvent = null;
    this.audio = createFlappyAudio();

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x7ed8f2);

    this.addCloud(90, 70, 0.9);
    this.addCloud(280, 120, 0.7);
    this.addCloud(480, 60, 0.8);
    this.addCloud(640, 110, 0.65);

    this.bird = this.add.circle(90, GAME_HEIGHT / 2, BIRD_RADIUS, 0xffd93d);
    this.physics.add.existing(this.bird);
    this.bird.body.setCircle(BIRD_RADIUS);
    this.bird.body.setBounce(0);
    this.bird.body.setCollideWorldBounds(false);
    this.bird.body.setAllowGravity(false);
    this.bird.body.setMaxVelocity(300, 180);
    this.bird.setDepth(5);

    this.birdWing = this.add.ellipse(78, GAME_HEIGHT / 2 + 4, 16, 10, 0xffc107).setDepth(4);
    this.birdBelly = this.add.circle(86, GAME_HEIGHT / 2 + 5, 7, 0xfff4c2).setDepth(6);
    this.birdEye = this.add.circle(96, GAME_HEIGHT / 2 - 4, 5, 0xffffff).setDepth(6);
    this.birdPupil = this.add.circle(97, GAME_HEIGHT / 2 - 4, 2.5, 0x243047).setDepth(7);
    this.birdBeak = this.add.triangle(108, GAME_HEIGHT / 2 + 2, 0, -5, 12, 2, 0, 9, 0xff9f1c).setDepth(6);

    this.pipes = this.physics.add.group({
      allowGravity: false,
      immovable: true,
    });

    const ground = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT - GROUND_HEIGHT / 2,
      GAME_WIDTH,
      GROUND_HEIGHT,
      0x7ed957
    );
    this.physics.add.existing(ground, true);
    ground.setDepth(3);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 5, GAME_WIDTH, 10, 0xde9b4a).setDepth(3);

    const ceiling = this.add.rectangle(GAME_WIDTH / 2, -4, GAME_WIDTH, 8, 0x7ed8f2, 0);
    this.physics.add.existing(ceiling, true);

    this.physics.add.collider(this.bird, this.pipes, this.endGame, undefined, this);
    this.physics.add.collider(this.bird, ground, this.endGame, undefined, this);
    this.physics.add.collider(this.bird, ceiling, this.endGame, undefined, this);

    this.scoreText = this.add.text(16, 16, 'Score: 0', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '22px',
      color: '#ffffff',
      stroke: '#1f4e79',
      strokeThickness: 6,
    });
    this.scoreText.setDepth(10);

    this.hintText = this.add.text(GAME_WIDTH / 2, 80, 'Press Start when you are ready!', {
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

    this.physics.pause();

    this.input.keyboard?.addCapture(['SPACE', 'P', 'ESC']);
    this.input.keyboard?.on('keydown-SPACE', this.onSpace, this);
    this.input.keyboard?.on('keydown-P', this.togglePause, this);
    this.input.keyboard?.on('keydown-ESC', this.togglePause, this);
    this.input.on('pointerdown', this.onPointer, this);

    this.registry.set('gameApi', {
      start: () => this.startGame(),
      pause: () => this.pauseGame(),
      resume: () => this.resumeGame(),
    });
    this.notifyState('waiting');
  }

  addCloud(x, y, scale) {
    const cloud = this.add.container(x, y);
    cloud.add(this.add.circle(-20, 6, 16, 0xffffff));
    cloud.add(this.add.circle(0, -4, 22, 0xffffff));
    cloud.add(this.add.circle(22, 6, 15, 0xffffff));
    cloud.setScale(scale);
    cloud.setDepth(1);
    cloud.setAlpha(0.92);
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
    this.bird.body.setAllowGravity(true);
    this.physics.resume();
    this.bird.body.setVelocityY(FLAP_VELOCITY);
    this.ignoreFlapUntil = this.time.now + 180;

    this.spawnEvent = this.time.addEvent({
      delay: SPAWN_INTERVAL,
      callback: this.spawnPipes,
      callbackScope: this,
      loop: true,
    });
    this.spawnPipes();
    this.notifyState('playing');
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
    this.ignoreFlapUntil = this.time.now + 180;
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

    this.flap();
  }

  onPointer() {
    if (this.playState === 'waiting') {
      this.startGame();
      return;
    }

    this.flap();
  }

  flap() {
    if (this.ended || this.playState !== 'playing' || this.time.now < this.ignoreFlapUntil) {
      return;
    }

    this.bird.body.setVelocityY(FLAP_VELOCITY);
    this.audio.flap();
  }

  spawnPipes() {
    if (this.ended || this.playState !== 'playing') {
      return;
    }

    const minPipeHeight = 36;
    const minGapCenter = PIPE_GAP / 2 + minPipeHeight;
    const maxGapCenter = GAME_HEIGHT - GROUND_HEIGHT - PIPE_GAP / 2 - minPipeHeight;
    const gapCenter = Phaser.Math.Between(minGapCenter, maxGapCenter);
    const topHeight = gapCenter - PIPE_GAP / 2;
    const bottomTop = gapCenter + PIPE_GAP / 2;
    const bottomHeight = GAME_HEIGHT - GROUND_HEIGHT - bottomTop;
    const x = GAME_WIDTH + PIPE_WIDTH / 2;
    const pipeId = this.nextPipeId;
    this.nextPipeId += 1;

    const topPipe = this.add.rectangle(x, topHeight / 2, PIPE_WIDTH, topHeight, 0x5cdb5c);
    this.physics.add.existing(topPipe);
    topPipe.pipeId = pipeId;
    topPipe.scored = false;
    topPipe.setDepth(2);

    const topCap = this.add.rectangle(x, topHeight - 8, PIPE_WIDTH + 10, 18, 0x2ea043);
    topCap.setDepth(2);

    const bottomPipe = this.add.rectangle(
      x,
      bottomTop + bottomHeight / 2,
      PIPE_WIDTH,
      bottomHeight,
      0x43b35a
    );
    this.physics.add.existing(bottomPipe);
    bottomPipe.pipeId = pipeId;
    bottomPipe.scored = true;
    bottomPipe.setDepth(2);

    const bottomCap = this.add.rectangle(x, bottomTop + 8, PIPE_WIDTH + 10, 18, 0x2ea043);
    bottomCap.setDepth(2);

    this.pipes.add(topPipe);
    this.pipes.add(bottomPipe);

    [topPipe, bottomPipe].forEach((pipe) => {
      pipe.body.setAllowGravity(false);
      pipe.body.setImmovable(true);
      pipe.body.setVelocityX(-PIPE_SPEED);
    });

    topPipe.cap = topCap;
    bottomPipe.cap = bottomCap;
  }

  update() {
    if (this.ended || this.playState !== 'playing') {
      return;
    }

    if (this.bird.y < 0 || this.bird.y > GAME_HEIGHT) {
      this.endGame();
      return;
    }

    this.birdWing.x = this.bird.x - 12;
    this.birdWing.y = this.bird.y + 4;
    this.birdBelly.x = this.bird.x - 4;
    this.birdBelly.y = this.bird.y + 5;
    this.birdEye.x = this.bird.x + 6;
    this.birdEye.y = this.bird.y - 4;
    this.birdPupil.x = this.bird.x + 7;
    this.birdPupil.y = this.bird.y - 4;
    this.birdBeak.x = this.bird.x + 18;
    this.birdBeak.y = this.bird.y + 2;

    this.pipes.getChildren().forEach((pipe) => {
      if (!pipe.active) {
        return;
      }

      if (pipe.cap) {
        pipe.cap.x = pipe.x;
      }

      if (!pipe.scored && pipe.x + PIPE_WIDTH / 2 < this.bird.x) {
        pipe.scored = true;
        this.score += 1;
        this.scoreText.setText(`Score: ${this.score}`);
        this.audio.score();
      }

      if (pipe.x < -PIPE_WIDTH) {
        pipe.cap?.destroy();
        pipe.destroy();
      }
    });
  }

  endGame() {
    if (this.ended) {
      return;
    }

    this.ended = true;
    this.physics.pause();
    this.spawnEvent?.remove(false);
    this.audio.hit();
    this.notifyState('ended');

    const onGameOver = this.registry.get('onGameOver');
    if (typeof onGameOver === 'function') {
      onGameOver(this.score);
    }
  }
}

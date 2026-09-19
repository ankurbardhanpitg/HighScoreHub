import Phaser from 'phaser';

export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 380;

function createSnakeAudio() {
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
      beep({ type: 'sine', freq: 392, duration: 0.09, volume: 0.07 });
      beep({ type: 'sine', freq: 523, duration: 0.12, volume: 0.07, delay: 0.08 });
    },
    turn() {
      beep({ type: 'triangle', freq: 480, duration: 0.04, volume: 0.04 });
    },
    eat() {
      beep({ type: 'sine', freq: 660, duration: 0.07, volume: 0.08 });
      beep({ type: 'sine', freq: 880, duration: 0.1, volume: 0.07, delay: 0.06 });
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

const HUD_TOP = 34;
const PAD = 10;
const CELL = 20;
const COLS = 35;
const ROWS = 16;
const ORIGIN_X = Math.floor((GAME_WIDTH - COLS * CELL) / 2);
const ORIGIN_Y = HUD_TOP + Math.floor((GAME_HEIGHT - HUD_TOP - PAD - ROWS * CELL) / 2);
const START_STEP_MS = 280;
const MIN_STEP_MS = 140;
const FOOD_PER_LEVEL = 5;
const POINTS = 10;

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};

function sameDir(a, b) {
  return a.x === b.x && a.y === b.y;
}

function opposite(a, b) {
  return a.x === -b.x && a.y === -b.y;
}

export default class SnakeScene extends Phaser.Scene {
  constructor() {
    super('SnakeScene');
  }

  create() {
    this.ended = false;
    this.playState = 'waiting';
    this.score = 0;
    this.level = 1;
    this.eaten = 0;
    this.stepMs = START_STEP_MS;
    this.accum = 0;
    this.dir = { ...DIRS.right };
    this.nextDir = { ...DIRS.right };
    this.snake = [];
    this.food = null;
    this.pointerStart = null;
    this.audio = createSnakeAudio();

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1d4d3a);
    this.add.rectangle(GAME_WIDTH / 2, HUD_TOP / 2, GAME_WIDTH, HUD_TOP, 0x16382b);
    this.add.rectangle(
      ORIGIN_X + (COLS * CELL) / 2,
      ORIGIN_Y + (ROWS * CELL) / 2,
      COLS * CELL + 8,
      ROWS * CELL + 8,
      0x0f2f22,
    );

    this.boardGfx = this.add.graphics().setDepth(2);
    this.gameGfx = this.add.graphics().setDepth(4);

    this.scoreText = this.add.text(16, 16, 'Score 0', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      stroke: '#16382b',
      strokeThickness: 5,
    }).setOrigin(0, 0.5).setDepth(12);

    this.levelText = this.add.text(GAME_WIDTH / 2, 16, 'Level 1', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#ffe566',
      stroke: '#16382b',
      strokeThickness: 5,
    }).setOrigin(0.5, 0.5).setDepth(12);

    this.lengthText = this.add.text(168, 16, 'Len 4', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#d8f5d3',
      stroke: '#16382b',
      strokeThickness: 5,
    }).setOrigin(0, 0.5).setDepth(12);

    this.hintText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 14, 'Arrows, WASD, or swipe to turn', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '15px',
      color: '#ffffff',
      stroke: '#16382b',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(12);

    this.bannerText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '28px',
      color: '#ffe566',
      stroke: '#16382b',
      strokeThickness: 8,
    }).setOrigin(0.5).setDepth(13).setVisible(false);

    this.resetSnake();
    this.drawAll();
    this.refreshHud();

    this.cursors = this.input.keyboard?.createCursorKeys();
    this.wasd = this.input.keyboard?.addKeys('W,A,S,D');
    this.input.keyboard?.addCapture(['LEFT', 'RIGHT', 'UP', 'DOWN', 'W', 'A', 'S', 'D', 'P', 'ESC', 'SPACE']);
    this.input.keyboard?.on('keydown-SPACE', this.onSpace, this);
    this.input.keyboard?.on('keydown-P', this.togglePause, this);
    this.input.keyboard?.on('keydown-ESC', this.togglePause, this);
    this.input.keyboard?.on('keydown-LEFT', () => this.queueDir(DIRS.left), this);
    this.input.keyboard?.on('keydown-RIGHT', () => this.queueDir(DIRS.right), this);
    this.input.keyboard?.on('keydown-UP', () => this.queueDir(DIRS.up), this);
    this.input.keyboard?.on('keydown-DOWN', () => this.queueDir(DIRS.down), this);
    this.input.keyboard?.on('keydown-A', () => this.queueDir(DIRS.left), this);
    this.input.keyboard?.on('keydown-D', () => this.queueDir(DIRS.right), this);
    this.input.keyboard?.on('keydown-W', () => this.queueDir(DIRS.up), this);
    this.input.keyboard?.on('keydown-S', () => this.queueDir(DIRS.down), this);
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointerup', this.onPointerUp, this);

    this.registry.set('gameApi', {
      start: () => this.startGame(),
      pause: () => this.pauseGame(),
      resume: () => this.resumeGame(),
    });
    this.notifyState('waiting');
  }

  resetSnake() {
    const startX = 8;
    const startY = Math.floor(ROWS / 2);
    this.dir = { ...DIRS.right };
    this.nextDir = { ...DIRS.right };
    this.snake = [
      { x: startX + 3, y: startY },
      { x: startX + 2, y: startY },
      { x: startX + 1, y: startY },
      { x: startX, y: startY },
    ];
    this.placeFood();
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
    this.audio.start();
    this.accum = 0;
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

    this.accum = 0;
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

  onPointerDown(pointer) {
    if (this.playState === 'waiting') {
      this.startGame();
      return;
    }
    if (!this.isCanvasPointer(pointer) || this.playState !== 'playing') {
      return;
    }
    this.pointerStart = { x: pointer.x, y: pointer.y };
  }

  onPointerUp(pointer) {
    if (!this.pointerStart || this.playState !== 'playing') {
      this.pointerStart = null;
      return;
    }

    const dx = pointer.x - this.pointerStart.x;
    const dy = pointer.y - this.pointerStart.y;
    this.pointerStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) {
      return;
    }

    if (Math.abs(dx) > Math.abs(dy)) {
      this.queueDir(dx > 0 ? DIRS.right : DIRS.left);
    } else {
      this.queueDir(dy > 0 ? DIRS.down : DIRS.up);
    }
  }

  queueDir(dir) {
    if (this.playState !== 'playing' || this.ended) {
      return;
    }
    if (opposite(dir, this.dir)) {
      return;
    }
    if (!sameDir(dir, this.nextDir)) {
      this.audio.turn();
    }
    this.nextDir = { ...dir };
  }

  occupied(x, y, ignoreTail = false) {
    const last = this.snake.length - 1;
    return this.snake.some((seg, index) => {
      if (ignoreTail && index === last) {
        return false;
      }
      return seg.x === x && seg.y === y;
    });
  }

  placeFood() {
    const empty = [];
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        if (!this.occupied(x, y)) {
          empty.push({ x, y });
        }
      }
    }
    this.food = empty.length > 0 ? Phaser.Utils.Array.GetRandom(empty) : null;
  }

  cellRect(x, y, inset = 1.5) {
    return {
      x: ORIGIN_X + x * CELL + inset,
      y: ORIGIN_Y + y * CELL + inset,
      w: CELL - inset * 2,
      h: CELL - inset * 2,
    };
  }

  drawAll() {
    this.boardGfx.clear();
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        this.boardGfx.fillStyle((x + y) % 2 === 0 ? 0x2d6a4f : 0x40916c, 1);
        this.boardGfx.fillRect(ORIGIN_X + x * CELL, ORIGIN_Y + y * CELL, CELL, CELL);
      }
    }

    this.gameGfx.clear();
    this.snake.forEach((seg, index) => {
      const box = this.cellRect(seg.x, seg.y, index === 0 ? 1 : 2);
      this.gameGfx.fillStyle(index === 0 ? 0xffe566 : 0x7ed957, 1);
      this.gameGfx.fillRoundedRect(box.x, box.y, box.w, box.h, 5);
      if (index === 0) {
        const cx = ORIGIN_X + seg.x * CELL + CELL / 2;
        const cy = ORIGIN_Y + seg.y * CELL + CELL / 2;
        const ox = this.dir.x * 3;
        const oy = this.dir.y * 3;
        this.gameGfx.fillStyle(0x243047, 1);
        if (this.dir.x !== 0) {
          this.gameGfx.fillCircle(cx + ox, cy - 3.5, 1.8);
          this.gameGfx.fillCircle(cx + ox, cy + 3.5, 1.8);
        } else {
          this.gameGfx.fillCircle(cx - 3.5, cy + oy, 1.8);
          this.gameGfx.fillCircle(cx + 3.5, cy + oy, 1.8);
        }
      }
    });

    if (this.food) {
      const cx = ORIGIN_X + this.food.x * CELL + CELL / 2;
      const cy = ORIGIN_Y + this.food.y * CELL + CELL / 2;
      this.gameGfx.fillStyle(0xff6b9d, 1);
      this.gameGfx.fillCircle(cx, cy, 7);
      this.gameGfx.fillStyle(0xffffff, 0.45);
      this.gameGfx.fillCircle(cx - 2.2, cy - 2.4, 2.2);
      this.gameGfx.fillStyle(0x5fc241, 1);
      this.gameGfx.fillTriangle(cx + 1, cy - 7, cx + 6, cy - 10, cx + 5, cy - 5);
    }
  }

  refreshHud() {
    this.scoreText.setText(`Score ${this.score}`);
    this.levelText.setText(`Level ${this.level}`);
    this.lengthText.setText(`Len ${this.snake.length}`);
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
      delay: 900,
      onComplete: () => {
        if (!this.ended) {
          this.bannerText.setVisible(false);
        }
      },
    });
  }

  step() {
    this.dir = { ...this.nextDir };
    const head = this.snake[0];
    const nx = head.x + this.dir.x;
    const ny = head.y + this.dir.y;

    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) {
      this.endGame();
      return;
    }

    const eating = this.food && this.food.x === nx && this.food.y === ny;
    if (this.occupied(nx, ny, !eating)) {
      this.endGame();
      return;
    }

    this.snake.unshift({ x: nx, y: ny });
    if (eating) {
      this.score += POINTS;
      this.eaten += 1;
      this.audio.eat();
      if (this.eaten % FOOD_PER_LEVEL === 0) {
        this.level += 1;
        this.stepMs = Math.max(MIN_STEP_MS, START_STEP_MS - (this.level - 1) * 10);
        this.audio.level();
        this.showBanner(`Level ${this.level}!`);
      }
      this.placeFood();
      if (!this.food) {
        this.endGame();
        return;
      }
    } else {
      this.snake.pop();
    }

    this.drawAll();
    this.refreshHud();
  }

  update(_time, delta) {
    if (this.playState !== 'playing' || this.ended) {
      return;
    }

    this.accum += Math.min(delta, 48);
    while (this.accum >= this.stepMs) {
      this.accum -= this.stepMs;
      this.step();
      if (this.ended) {
        return;
      }
    }
  }

  endGame() {
    if (this.ended) {
      return;
    }

    this.ended = true;
    this.audio.lose();
    this.notifyState('ended');
    const onGameOver = this.registry.get('onGameOver');
    if (typeof onGameOver === 'function') {
      onGameOver(this.score, this.level, this.snake.length);
    }
  }
}

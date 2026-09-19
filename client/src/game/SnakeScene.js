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
const BOARD_W = COLS * CELL;
const BOARD_H = ROWS * CELL;
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

const COLOR_HEAD = 0xd6ff63;
const COLOR_MID = 0x3ecb62;
const COLOR_TAIL = 0x0f7a48;
const COLOR_OUTLINE = 0x0b3d24;
const COLOR_BELLY = 0xf4ffc2;
const COLOR_SCALE = 0x1a8f52;

function sameDir(a, b) {
  return a.x === b.x && a.y === b.y;
}

function opposite(a, b) {
  return a.x === -b.x && a.y === -b.y;
}

function lerpColor(a, b, t) {
  const clamped = Phaser.Math.Clamp(t, 0, 1);
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const r = Math.round(ar + (br - ar) * clamped);
  const g = Math.round(ag + (bg - ag) * clamped);
  const bch = Math.round(ab + (bb - ab) * clamped);
  return (r << 16) | (g << 8) | bch;
}

function cellCenter(gx, gy) {
  return {
    x: ORIGIN_X + gx * CELL + CELL / 2,
    y: ORIGIN_Y + gy * CELL + CELL / 2,
  };
}

function drawCapsule(gfx, x1, y1, x2, y2, radius, color, alpha = 1) {
  gfx.fillStyle(color, alpha);
  gfx.fillCircle(x1, y1, radius);
  gfx.fillCircle(x2, y2, radius);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 0.01) {
    return;
  }
  const nx = -dy / len;
  const ny = dx / len;
  const ox = nx * radius;
  const oy = ny * radius;
  gfx.fillTriangle(x1 + ox, y1 + oy, x1 - ox, y1 - oy, x2 + ox, y2 + oy);
  gfx.fillTriangle(x1 - ox, y1 - oy, x2 - ox, y2 - oy, x2 + ox, y2 + oy);
}

function hashTile(x, y) {
  return (x * 73 + y * 149 + x * y * 13) & 255;
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
    this.foodBorn = 0;
    this.sparkles = [];
    this.pointerStart = null;
    this.audio = createSnakeAudio();

    this.drawGardenBackdrop();

    this.boardGfx = this.add.graphics().setDepth(2);
    this.gameGfx = this.add.graphics().setDepth(4);

    const clip = this.make.graphics({ add: false });
    clip.fillRoundedRect(ORIGIN_X, ORIGIN_Y, BOARD_W, BOARD_H, 8);
    const boardMask = clip.createGeometryMask();
    this.boardGfx.setMask(boardMask);
    this.gameGfx.setMask(boardMask);

    this.drawBoard();
    this.drawGardenFrame();
    this.spawnFireflies();

    this.scoreText = this.add.text(16, 16, 'Score 0', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#f7ffe8',
      stroke: '#102416',
      strokeThickness: 5,
    }).setOrigin(0, 0.5).setDepth(12);

    this.levelText = this.add.text(GAME_WIDTH / 2, 16, 'Level 1', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#ffe566',
      stroke: '#102416',
      strokeThickness: 5,
    }).setOrigin(0.5, 0.5).setDepth(12);

    this.lengthText = this.add.text(168, 16, 'Len 4', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#d6ffb0',
      stroke: '#102416',
      strokeThickness: 5,
    }).setOrigin(0, 0.5).setDepth(12);

    this.hintText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 14, 'Arrows, WASD, or swipe to turn', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '15px',
      color: '#f4ffd8',
      stroke: '#102416',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(12);

    this.bannerText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '28px',
      color: '#ffe566',
      stroke: '#102416',
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

  drawGardenBackdrop() {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x10261c);
    this.add.ellipse(110, 300, 280, 160, 0x1d4a32, 0.45).setDepth(0);
    this.add.ellipse(620, 70, 260, 120, 0x245c3c, 0.28).setDepth(0);
    this.add.ellipse(400, 200, 420, 220, 0x163628, 0.35).setDepth(0);
    this.add.rectangle(GAME_WIDTH / 2, HUD_TOP / 2, GAME_WIDTH, HUD_TOP, 0x0c1f16).setDepth(1);
    this.add.rectangle(GAME_WIDTH / 2, HUD_TOP - 1, GAME_WIDTH, 2, 0xe0b94a, 0.85).setDepth(1);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 9, GAME_WIDTH, 18, 0x0c1f16).setDepth(1);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 18, GAME_WIDTH, 2, 0xe0b94a, 0.45).setDepth(1);

    const vines = this.add.graphics().setDepth(1);
    vines.fillStyle(0x3fa85a, 0.95);
    vines.fillCircle(GAME_WIDTH - 28, 16, 5);
    vines.fillCircle(GAME_WIDTH - 40, 11, 3.5);
    vines.fillCircle(GAME_WIDTH - 18, 10, 3);
    vines.fillStyle(0x7ed957, 0.9);
    vines.fillCircle(GAME_WIDTH - 34, 12, 2.4);
    vines.fillStyle(0xffe566, 0.95);
    vines.fillCircle(GAME_WIDTH / 2 - 58, 16, 2.1);
    vines.fillCircle(GAME_WIDTH / 2 + 58, 16, 2.1);
  }

  drawGardenFrame() {
    const under = this.add.graphics().setDepth(1);
    const x = ORIGIN_X - 6;
    const y = ORIGIN_Y - 6;
    const w = BOARD_W + 12;
    const h = BOARD_H + 12;

    under.fillStyle(0x07140e, 0.55);
    under.fillRoundedRect(x + 2, y + 4, w, h, 14);
    under.fillStyle(0x6a3e1c);
    under.fillRoundedRect(x, y, w, h, 14);
    under.fillStyle(0x8a5428);
    under.fillRoundedRect(x + 2, y + 2, w - 4, h - 4, 12);
    under.fillStyle(0x123526, 1);
    under.fillRoundedRect(ORIGIN_X - 1, ORIGIN_Y - 1, BOARD_W + 2, BOARD_H + 2, 9);

    const rim = this.add.graphics().setDepth(6);
    rim.lineStyle(2.4, 0xf0c94d, 1);
    rim.strokeRoundedRect(x + 4, y + 4, w - 8, h - 8, 10);
    rim.lineStyle(1.2, 0xfff0b0, 0.55);
    rim.strokeRoundedRect(x + 6.5, y + 6.5, w - 13, h - 13, 9);
  }

  spawnFireflies() {
    const spots = [
      [GAME_WIDTH - 86, 15], [GAME_WIDTH - 54, 20],
      [26, GAME_HEIGHT - 14], [88, GAME_HEIGHT - 10],
      [632, GAME_HEIGHT - 12], [688, GAME_HEIGHT - 16],
    ];
    spots.forEach(([x, y], index) => {
      const glow = this.add.circle(x, y, 5.5, 0xfff4a3, 0.16).setDepth(11);
      const core = this.add.circle(x, y, 1.8, 0xfffbe6, 0.9).setDepth(11);
      this.tweens.add({
        targets: [glow, core],
        y: y - 7 - (index % 3),
        alpha: { from: 0.25, to: 0.85 },
        duration: 1600 + index * 140,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: index * 90,
      });
    });
  }

  drawBoard() {
    this.boardGfx.clear();
    this.boardGfx.fillStyle(0x1a4a32, 1);
    this.boardGfx.fillRoundedRect(ORIGIN_X, ORIGIN_Y, BOARD_W, BOARD_H, 8);

    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const shade = hashTile(x, y);
        const light = (x + y) % 2 === 0;
        const base = light ? 0x4ea86a : 0x347a50;
        const shift = light ? 0x5cb87a : 0x2c6c46;
        const color = shade % 5 === 0 ? shift : base;
        const px = ORIGIN_X + x * CELL + 1.2;
        const py = ORIGIN_Y + y * CELL + 1.2;
        const size = CELL - 2.4;
        this.boardGfx.fillStyle(color, 1);
        this.boardGfx.fillRoundedRect(px, py, size, size, 4);
        this.boardGfx.fillStyle(0xe8ffd0, light ? 0.16 : 0.08);
        this.boardGfx.fillRoundedRect(px + 1, py + 0.8, size - 2, 4.2, 2);

        if (shade % 19 === 0) {
          this.boardGfx.fillStyle(0xd5ff9a, 0.28);
          this.boardGfx.fillCircle(px + 6 + (shade % 5), py + 8, 1.15);
        } else if (shade % 23 === 0) {
          this.boardGfx.fillStyle(0x1f5c38, 0.35);
          this.boardGfx.fillTriangle(
            px + size - 6,
            py + size - 3,
            px + size - 2,
            py + size - 7,
            px + size - 1,
            py + size - 2,
          );
        }
      }
    }

    this.boardGfx.fillStyle(0x07180f, 0.18);
    this.boardGfx.fillRect(ORIGIN_X, ORIGIN_Y, BOARD_W, 18);
    this.boardGfx.fillRect(ORIGIN_X, ORIGIN_Y + BOARD_H - 16, BOARD_W, 16);
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
    this.foodBorn = this.time.now;
  }

  moveT() {
    if (this.ended) {
      return 0.92;
    }
    return Phaser.Math.Clamp(this.accum / this.stepMs, 0, 0.999);
  }

  visualSnake(t) {
    return this.snake.map((seg, index) => {
      let gx = seg.x;
      let gy = seg.y;
      if (index === 0) {
        gx += this.dir.x * t;
        gy += this.dir.y * t;
      } else {
        const prev = this.snake[index - 1];
        gx += (prev.x - seg.x) * t;
        gy += (prev.y - seg.y) * t;
      }
      return cellCenter(gx, gy);
    });
  }

  radiusAt(index, length) {
    if (index === 0) {
      return 9.4;
    }
    const u = index / Math.max(1, length - 1);
    return 8.35 - u * 2.55;
  }

  bodyColor(index, length) {
    const u = index / Math.max(1, length - 1);
    if (this.ended) {
      return lerpColor(0x8aa45a, 0x4d6a3a, u);
    }
    if (u < 0.28) {
      return lerpColor(COLOR_HEAD, COLOR_MID, u / 0.28);
    }
    return lerpColor(COLOR_MID, COLOR_TAIL, (u - 0.28) / 0.72);
  }

  spawnSparkles(x, y) {
    for (let i = 0; i < 9; i += 1) {
      const ang = (Math.PI * 2 * i) / 9;
      this.sparkles.push({
        x,
        y,
        vx: Math.cos(ang) * (1.1 + (i % 3) * 0.25),
        vy: Math.sin(ang) * (1.1 + (i % 3) * 0.25),
        born: this.time.now,
        life: 420,
        color: i % 2 === 0 ? 0xffe566 : 0xff8fb8,
      });
    }
  }

  drawAll() {
    this.drawActors();
  }

  drawActors() {
    const g = this.gameGfx;
    g.clear();
    const now = this.time.now;
    const t = this.moveT();
    const points = this.visualSnake(t);
    const n = points.length;

    this.drawFood(g, now);

    if (n > 0) {
      for (let i = n - 1; i >= 1; i -= 1) {
        const r = Math.max(this.radiusAt(i, n), this.radiusAt(i - 1, n));
        drawCapsule(g, points[i].x, points[i].y + 2.2, points[i - 1].x, points[i - 1].y + 2.2, r + 0.6, 0x062016, 0.28);
      }

      for (let i = n - 1; i >= 1; i -= 1) {
        const r = Math.max(this.radiusAt(i, n), this.radiusAt(i - 1, n));
        drawCapsule(g, points[i].x, points[i].y, points[i - 1].x, points[i - 1].y, r + 1.15, COLOR_OUTLINE, 1);
      }

      for (let i = n - 1; i >= 1; i -= 1) {
        const r = Math.max(this.radiusAt(i, n), this.radiusAt(i - 1, n));
        const color = this.bodyColor(i, n);
        drawCapsule(g, points[i].x, points[i].y, points[i - 1].x, points[i - 1].y, r, color, 1);
      }

      for (let i = n - 1; i >= 1; i -= 1) {
        const r = Math.max(2.2, this.radiusAt(i, n) * 0.42);
        drawCapsule(
          g,
          points[i].x,
          points[i].y + 1.1,
          points[i - 1].x,
          points[i - 1].y + 1.1,
          r,
          this.ended ? 0xc5d89a : COLOR_BELLY,
          0.72,
        );
      }

      for (let i = 1; i < n; i += 1) {
        const toward = points[i - 1];
        const p = points[i];
        const dx = toward.x - p.x;
        const dy = toward.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        const px = -dy / len;
        const py = dx / len;
        g.fillStyle(this.ended ? 0x5d7340 : COLOR_SCALE, 0.55);
        g.fillCircle(p.x + px * 3.1, p.y + py * 3.1 - 0.6, 1.35);
        g.fillCircle(p.x - px * 3.1, p.y - py * 3.1 - 0.6, 1.35);
        g.fillStyle(0xffffff, 0.16);
        g.fillCircle(p.x - 1.8, p.y - 2.6, Math.max(1.4, this.radiusAt(i, n) * 0.28));
      }

      this.drawHead(g, points[0], now);
    }

    this.drawSparkles(g, now);
  }

  drawHead(g, point, now) {
    const { x, y } = point;
    const dx = this.dir.x;
    const dy = this.dir.y;
    const px = -dy;
    const py = dx;
    const ended = this.ended;
    const snoutX = x + dx * 6.4;
    const snoutY = y + dy * 6.4;

    g.fillStyle(0x062016, 0.28);
    g.fillCircle(x, y + 2.4, 10.2);
    g.fillStyle(COLOR_OUTLINE, 1);
    g.fillCircle(x, y, 10.3);
    g.fillCircle(snoutX, snoutY, 7.3);
    g.fillStyle(ended ? 0x8aa45a : COLOR_HEAD, 1);
    g.fillCircle(x, y, 9.1);
    g.fillStyle(ended ? 0x7a9850 : 0xc3f35a, 1);
    g.fillCircle(snoutX, snoutY, 6.1);
    g.fillStyle(ended ? 0x9bb56a : 0x9be85c, 0.92);
    g.fillCircle(x + px * 5.4 - dx * 1.4, y + py * 5.4 - dy * 1.4, 3.4);
    g.fillCircle(x - px * 5.4 - dx * 1.4, y - py * 5.4 - dy * 1.4, 3.4);

    g.fillStyle(ended ? 0xc5d89a : COLOR_BELLY, 0.8);
    g.fillCircle(x + dx * 1.2, y + dy * 1.2 + 1.2, 4.4);

    const blink = !ended && Math.floor(now / 2600) % 8 === 0 && (now % 2600) < 110;
    const eyeX = x + dx * 2.2;
    const eyeY = y + dy * 2.2;
    const spread = 4.15;
    if (blink) {
      g.lineStyle(1.6, 0x1a2e14, 1);
      g.beginPath();
      g.moveTo(eyeX + px * spread - py * 1.8, eyeY + py * spread + px * 1.8);
      g.lineTo(eyeX + px * spread + py * 1.8, eyeY + py * spread - px * 1.8);
      g.moveTo(eyeX - px * spread - py * 1.8, eyeY - py * spread + px * 1.8);
      g.lineTo(eyeX - px * spread + py * 1.8, eyeY - py * spread - px * 1.8);
      g.strokePath();
    } else {
      g.fillStyle(0xffffff, 1);
      g.fillCircle(eyeX + px * spread, eyeY + py * spread, 2.6);
      g.fillCircle(eyeX - px * spread, eyeY - py * spread, 2.6);
      g.fillStyle(0x1a2410, 1);
      g.fillCircle(eyeX + px * spread + dx * 0.85, eyeY + py * spread + dy * 0.85, 1.4);
      g.fillCircle(eyeX - px * spread + dx * 0.85, eyeY - py * spread + dy * 0.85, 1.4);
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(eyeX + px * spread - 0.7, eyeY + py * spread - 0.8, 0.7);
      g.fillCircle(eyeX - px * spread - 0.7, eyeY - py * spread - 0.8, 0.7);
    }

    g.fillStyle(0x3d5c28, 0.9);
    g.fillCircle(snoutX + px * 1.55 + dx * 1.4, snoutY + py * 1.55 + dy * 1.4, 0.7);
    g.fillCircle(snoutX - px * 1.55 + dx * 1.4, snoutY - py * 1.55 + dy * 1.4, 0.7);

    const flick = !ended && this.playState === 'playing' && Math.floor(now / 140) % 8 < 3;
    if (flick) {
      const tongueX = snoutX + dx * 5.4;
      const tongueY = snoutY + dy * 5.4;
      g.lineStyle(1.6, 0xff5a7a, 1);
      g.beginPath();
      g.moveTo(snoutX + dx * 2.4, snoutY + dy * 2.4);
      g.lineTo(tongueX, tongueY);
      g.lineTo(tongueX + dx * 2.2 + px * 2.3, tongueY + dy * 2.2 + py * 2.3);
      g.moveTo(tongueX, tongueY);
      g.lineTo(tongueX + dx * 2.2 - px * 2.3, tongueY + dy * 2.2 - py * 2.3);
      g.strokePath();
    }

    g.fillStyle(0xffffff, 0.28);
    g.fillCircle(x - 2.6, y - 3.4, 3.3);
  }

  drawFood(g, now) {
    if (!this.food) {
      return;
    }

    const pos = cellCenter(this.food.x, this.food.y);
    const age = Math.max(0, now - this.foodBorn);
    const pop = Phaser.Math.Clamp(age / 200, 0, 1);
    const bounce = pop < 1 ? Phaser.Math.Easing.Back.Out(pop) : 1;
    const pulse = 1 + Math.sin(now / 210) * 0.07;
    const s = bounce * pulse;
    const x = pos.x;
    const y = pos.y;

    g.fillStyle(0x062016, 0.28);
    g.fillCircle(x, y + 6.2, 5.6 * s);
    g.fillStyle(0xff5a8a, 0.16);
    g.fillCircle(x, y, 13.5 * s);
    g.fillStyle(0xffe566, 0.12);
    g.fillCircle(x, y, 10.5 * s);
    g.fillStyle(0xc4234a, 1);
    g.fillCircle(x, y + 0.6 * s, 7.1 * s);
    g.fillStyle(0xff5d86, 1);
    g.fillCircle(x, y, 6.5 * s);
    g.fillStyle(0xff8eab, 0.9);
    g.fillCircle(x - 1.4 * s, y - 1.6 * s, 3.8 * s);
    g.fillStyle(0xffffff, 0.55);
    g.fillCircle(x - 2.1 * s, y - 2.4 * s, 1.9 * s);
    g.fillStyle(0x6a2a1c, 1);
    g.fillRect(x - 0.7 * s, y - 8.6 * s, 1.4 * s, 3.2 * s);
    g.fillStyle(0x5fc241, 1);
    g.fillTriangle(
      x + 0.6 * s,
      y - 7.4 * s,
      x + 7.2 * s,
      y - 11.2 * s,
      x + 5.4 * s,
      y - 4.8 * s,
    );
    g.fillStyle(0x8ee85a, 0.85);
    g.fillTriangle(
      x + 1.4 * s,
      y - 7 * s,
      x + 6.2 * s,
      y - 10 * s,
      x + 5 * s,
      y - 5.6 * s,
    );
    g.fillStyle(0xfff4a3, 0.8);
    g.fillCircle(x + 4.8 * s, y - 1.2 * s, 0.9 * s);
  }

  drawSparkles(g, now) {
    this.sparkles = this.sparkles.filter((spark) => now - spark.born < spark.life);
    this.sparkles.forEach((spark) => {
      const age = now - spark.born;
      const u = age / spark.life;
      const x = spark.x + spark.vx * age * 0.055;
      const y = spark.y + spark.vy * age * 0.055;
      g.fillStyle(spark.color, 1 - u);
      g.fillCircle(x, y, 2.1 * (1 - u * 0.7));
    });
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
      const bite = cellCenter(this.food.x, this.food.y);
      this.spawnSparkles(bite.x, bite.y);
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

    this.refreshHud();
  }

  update(_time, delta) {
    if (this.playState === 'playing' && !this.ended) {
      this.accum += Math.min(delta, 48);
      while (this.accum >= this.stepMs) {
        this.accum -= this.stepMs;
        this.step();
        if (this.ended) {
          break;
        }
      }
    }

    this.drawActors();
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

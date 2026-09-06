import Phaser from 'phaser';

export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 560;

function createBubbleAudio() {
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
      beep({ type: 'sine', freq: 520, freqEnd: 880, duration: 0.1, volume: 0.07 });
    },
    bounce() {
      beep({ type: 'triangle', freq: 300, duration: 0.05, volume: 0.05 });
    },
    stick() {
      beep({ type: 'triangle', freq: 240, freqEnd: 360, duration: 0.07, volume: 0.06 });
    },
    pop(count) {
      const n = Math.min(6, count);
      for (let i = 0; i < n; i += 1) {
        beep({ type: 'sine', freq: 520 + i * 90, duration: 0.08, volume: 0.07, delay: i * 0.04 });
      }
    },
    drop() {
      beep({ type: 'triangle', freq: 400, freqEnd: 180, duration: 0.22, volume: 0.07 });
    },
    row() {
      beep({ type: 'square', freq: 180, freqEnd: 260, duration: 0.16, volume: 0.06 });
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

const HUD_TOP = 32;
const WALL = 10;
const R = 16;
const COLS = 16;
const SPACING = R * 2;
const ROW_H = R * Math.sqrt(3);
const ORIGIN_X = (GAME_WIDTH - (COLS - 1) * SPACING) / 2;
const ORIGIN_Y = HUD_TOP + R + 6;
const SHOOTER_X = GAME_WIDTH / 2;
const SHOOTER_Y = GAME_HEIGHT - 28;
const DANGER_Y = GAME_HEIGHT - 72;
const SHOT_SPEED = 420;
const SHOT_STEP = 6;
const HIT_RANGE = R * 2 + 3;
const CEILING_Y = ORIGIN_Y - R;
const MAX_AIM = Phaser.Math.DegToRad(78);
const AIM_TURN = 2.4;
const COLORS = [0xff6b9d, 0xff8a3d, 0xffe566, 0x7ed957, 0x4da3ff];
const MAX_ROWS = 22;
const CLEAR_BONUS = 100;
const MATCH_MIN = 2;
const POP_POINTS = 10;
const DROP_POINTS = 15;

function cellKey(row, col) {
  return `${row},${col}`;
}

export default class BubbleShooterScene extends Phaser.Scene {
  constructor() {
    super('BubbleShooterScene');
  }

  create() {
    this.ended = false;
    this.playState = 'waiting';
    this.phase = 'ready';
    this.score = 0;
    this.level = 1;
    this.stagger = 0;
    this.shotsUntilDrop = this.shotsForLevel();
    this.aimAngle = 0;
    this.usingPointer = false;
    this.pointerX = SHOOTER_X;
    this.pointerY = 80;
    this.nextWallSoundAt = 0;
    this.bubbles = new Map();
    this.shot = null;
    this.loaded = null;
    this.nextPreview = null;
    this.nextColor = 0;
    this.shotVx = 0;
    this.shotVy = 0;
    this.audio = createBubbleAudio();

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x3b2d6b);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH - 16, GAME_HEIGHT - 16, 0x4a3a82);
    this.add.rectangle(WALL / 2, GAME_HEIGHT / 2, WALL, GAME_HEIGHT, 0xff9ec4);
    this.add.rectangle(GAME_WIDTH - WALL / 2, GAME_HEIGHT / 2, WALL, GAME_HEIGHT, 0xff9ec4);
    this.add.rectangle(GAME_WIDTH / 2, HUD_TOP / 2, GAME_WIDTH, HUD_TOP, 0x2f2458);

    this.dangerLine = this.add.graphics().setDepth(4);
    this.dangerLine.lineStyle(2, 0xff6b9d, 0.55);
    this.dangerLine.beginPath();
    this.dangerLine.moveTo(WALL + 8, DANGER_Y);
    this.dangerLine.lineTo(GAME_WIDTH - WALL - 8, DANGER_Y);
    this.dangerLine.strokePath();

    this.aimGfx = this.add.graphics().setDepth(8);
    this.cannon = this.add.triangle(SHOOTER_X, SHOOTER_Y + 6, -10, 16, 10, 16, 0, -26, 0xffe566);
    this.cannon.setStrokeStyle(3, 0xfff7b0);
    this.cannon.setDepth(8);

    this.scoreText = this.add.text(16, 16, 'Score 0', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      stroke: '#2f2458',
      strokeThickness: 5,
    }).setOrigin(0, 0.5).setDepth(12);

    this.levelText = this.add.text(GAME_WIDTH / 2, 16, 'Level 1', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#ffe566',
      stroke: '#2f2458',
      strokeThickness: 5,
    }).setOrigin(0.5, 0.5).setDepth(12);

    this.dropText = this.add.text(168, 16, 'Drop 8', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#ffd6e6',
      stroke: '#2f2458',
      strokeThickness: 5,
    }).setOrigin(0, 0.5).setDepth(12);

    this.hintText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 58, 'Aim, then tap or press Space to shoot', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '15px',
      color: '#ffffff',
      stroke: '#2f2458',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(12);

    this.bannerText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '28px',
      color: '#ffe566',
      stroke: '#2f2458',
      strokeThickness: 8,
    }).setOrigin(0.5).setDepth(13).setVisible(false);

    this.nextLabel = this.add.text(54, SHOOTER_Y + 18, 'Next', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#ffffff',
      stroke: '#2f2458',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(12);

    this.buildBoard();
    this.nextColor = this.randomBoardColor();
    this.loadShooter();
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

  shotsForLevel() {
    return Math.max(5, 8 - Math.floor((this.level - 1) / 2));
  }

  colorCount() {
    return this.level >= 3 ? COLORS.length : 4;
  }

  startRows() {
    return Math.min(6, 4 + Math.floor((this.level - 1) / 2));
  }

  oddForRow(row) {
    return (row + this.stagger) % 2 === 1;
  }

  colsInRow(row) {
    return this.oddForRow(row) ? COLS - 1 : COLS;
  }

  isValidCell(row, col) {
    return row >= 0 && row < MAX_ROWS && col >= 0 && col < this.colsInRow(row);
  }

  cellCenter(row, col) {
    const odd = this.oddForRow(row);
    return {
      x: ORIGIN_X + col * SPACING + (odd ? SPACING / 2 : 0),
      y: ORIGIN_Y + row * ROW_H,
    };
  }

  neighbors(row, col) {
    const odd = this.oddForRow(row);
    const deltas = odd
      ? [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]]
      : [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]];
    return deltas
      .map(([dr, dc]) => [row + dr, col + dc])
      .filter(([nextRow, nextCol]) => this.isValidCell(nextRow, nextCol));
  }

  getBubble(row, col) {
    return this.bubbles.get(cellKey(row, col)) || null;
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
    this.time.paused = false;
    this.tweens.resumeAll();
    this.notifyState('playing');
    this.phase = 'ready';
    this.hintText.setVisible(true);
  }

  pauseGame() {
    if (this.ended || this.playState !== 'playing') {
      return;
    }

    this.time.paused = true;
    this.tweens.pauseAll();
    this.notifyState('paused');
  }

  resumeGame() {
    if (this.ended || this.playState !== 'paused') {
      return;
    }

    this.time.paused = false;
    this.tweens.resumeAll();
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
      this.shoot();
    }
  }

  isCanvasPointer(pointer) {
    const target = pointer.event?.target;
    return !target || target === this.game.canvas;
  }

  pointerToGame(pointer) {
    const rect = this.game.canvas.getBoundingClientRect();
    if (pointer.event?.clientX != null && rect.width > 0) {
      return {
        x: ((pointer.event.clientX - rect.left) / rect.width) * GAME_WIDTH,
        y: ((pointer.event.clientY - rect.top) / rect.height) * GAME_HEIGHT,
      };
    }
    return { x: pointer.x, y: pointer.y };
  }

  onPointerDown(pointer) {
    if (this.playState === 'waiting') {
      this.startGame();
      return;
    }

    if (!this.isCanvasPointer(pointer) || this.playState !== 'playing') {
      return;
    }

    const point = this.pointerToGame(pointer);
    this.pointerX = point.x;
    this.pointerY = point.y;
    this.usingPointer = true;
    this.aimFromPoint(point.x, point.y);
    this.shoot();
  }

  onPointerMove(pointer) {
    if (!this.isCanvasPointer(pointer) || this.playState !== 'playing') {
      return;
    }

    const point = this.pointerToGame(pointer);
    this.pointerX = point.x;
    this.pointerY = point.y;
    this.usingPointer = true;
    this.aimFromPoint(point.x, point.y);
  }

  aimFromPoint(x, y) {
    const angle = Math.atan2(x - SHOOTER_X, SHOOTER_Y - y);
    this.aimAngle = Phaser.Math.Clamp(angle, -MAX_AIM, MAX_AIM);
  }

  createBubbleVisual(x, y, colorIndex, radius = R) {
    const color = COLORS[colorIndex] ?? COLORS[0];
    const container = this.add.container(x, y);
    const body = this.add.circle(0, 0, radius, color);
    body.setStrokeStyle(3, 0xffffff, 0.62);
    const shine = this.add.circle(-radius * 0.28, -radius * 0.3, radius * 0.28, 0xffffff, 0.48);
    container.add([body, shine]);
    container.setDepth(6);
    container.setData('colorIndex', colorIndex);
    return container;
  }

  placeBubble(row, col, colorIndex) {
    const { x, y } = this.cellCenter(row, col);
    const visual = this.createBubbleVisual(x, y, colorIndex);
    const bubble = { row, col, colorIndex, visual };
    this.bubbles.set(cellKey(row, col), bubble);
    return bubble;
  }

  clearBoard() {
    this.bubbles.forEach((bubble) => bubble.visual.destroy());
    this.bubbles = new Map();
  }

  buildBoard() {
    this.clearBoard();
    this.stagger = 0;
    const rows = this.startRows();
    for (let row = 0; row < rows; row += 1) {
      this.spawnFilledRow(row, true);
    }
  }

  spawnFilledRow(row, avoidMatches = false) {
    const palette = this.colorCount();
    const count = this.colsInRow(row);
    for (let col = 0; col < count; col += 1) {
      let color = Phaser.Math.Between(0, palette - 1);
      if (avoidMatches) {
        for (let tries = 0; tries < 8; tries += 1) {
          const same = this.neighbors(row, col).filter(([nextRow, nextCol]) => {
            const neighbor = this.getBubble(nextRow, nextCol);
            return neighbor && neighbor.colorIndex === color;
          });
          if (same.length < 2) {
            break;
          }
          color = (color + 1) % palette;
        }
      }
      this.placeBubble(row, col, color);
    }
  }

  randomBoardColor() {
    const present = new Set();
    this.bubbles.forEach((bubble) => present.add(bubble.colorIndex));
    const list = present.size > 0 ? [...present] : [...Array(this.colorCount()).keys()];
    return Phaser.Utils.Array.GetRandom(list);
  }

  loadShooter() {
    if (this.loaded) {
      this.loaded.destroy();
    }
    const color = this.nextColor;
    this.nextColor = this.randomBoardColor();
    this.loaded = this.createBubbleVisual(SHOOTER_X, SHOOTER_Y, color);
    this.loaded.setDepth(9);
    this.refreshNextPreview();
  }

  refreshNextPreview() {
    if (this.nextPreview) {
      this.nextPreview.destroy();
    }
    this.nextPreview = this.createBubbleVisual(54, SHOOTER_Y - 4, this.nextColor, 11);
    this.nextPreview.setDepth(9);
  }

  refreshHud() {
    this.scoreText.setText(`Score ${this.score}`);
    this.levelText.setText(`Level ${this.level}`);
    this.dropText.setText(`Drop ${this.shotsUntilDrop}`);
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

  shoot() {
    if (this.ended || this.playState !== 'playing' || this.phase !== 'ready' || !this.loaded) {
      return;
    }

    this.phase = 'flying';
    this.hintText.setVisible(false);
    this.shot = this.loaded;
    this.loaded = null;
    this.shotVx = Math.sin(this.aimAngle) * SHOT_SPEED;
    this.shotVy = -Math.cos(this.aimAngle) * SHOT_SPEED;
    this.aimGfx.clear();
    this.audio.shoot();
  }

  clusterHitAt(x, y) {
    let best = null;
    let bestDistance = HIT_RANGE;
    for (const bubble of this.bubbles.values()) {
      const distance = Phaser.Math.Distance.Between(x, y, bubble.visual.x, bubble.visual.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = bubble;
      }
    }
    return best;
  }

  positionToCell(x, y) {
    const row = Phaser.Math.Clamp(Math.round((y - ORIGIN_Y) / ROW_H), 0, MAX_ROWS - 1);
    const odd = this.oddForRow(row);
    const col = Math.round((x - ORIGIN_X - (odd ? SPACING / 2 : 0)) / SPACING);
    return { row, col: Phaser.Math.Clamp(col, 0, Math.max(0, this.colsInRow(row) - 1)) };
  }

  considerSnapCell(candidates, seen, x, y, row, col) {
    const key = cellKey(row, col);
    if (seen.has(key) || !this.isValidCell(row, col) || this.getBubble(row, col)) {
      return;
    }
    seen.add(key);
    const point = this.cellCenter(row, col);
    candidates.push({
      row,
      col,
      y: point.y,
      d: Phaser.Math.Distance.Between(x, y, point.x, point.y),
    });
  }

  pickBestCandidate(candidates) {
    if (candidates.length === 0) {
      return null;
    }
    const safe = candidates.filter((cell) => cell.y + R < DANGER_Y);
    const pool = safe.length > 0 ? safe : candidates;
    pool.sort((a, b) => a.d - b.d);
    return pool[0];
  }

  pickSnapCell(x, y, hit) {
    const seen = new Set();
    const nearHit = [];
    if (hit) {
      this.neighbors(hit.row, hit.col).forEach(([row, col]) => {
        this.considerSnapCell(nearHit, seen, x, y, row, col);
      });
      const bestNear = this.pickBestCandidate(nearHit);
      if (bestNear) {
        return bestNear;
      }
    }

    const candidates = nearHit;
    this.bubbles.forEach((bubble) => {
      this.neighbors(bubble.row, bubble.col).forEach(([row, col]) => {
        this.considerSnapCell(candidates, seen, x, y, row, col);
      });
    });
    for (let col = 0; col < this.colsInRow(0); col += 1) {
      this.considerSnapCell(candidates, seen, x, y, 0, col);
    }

    const approx = this.positionToCell(x, y);
    this.considerSnapCell(candidates, seen, x, y, approx.row, approx.col);
    this.neighbors(approx.row, approx.col).forEach(([row, col]) => {
      this.considerSnapCell(candidates, seen, x, y, row, col);
    });

    return this.pickBestCandidate(candidates);
  }

  sameColorGroup(row, col) {
    const start = this.getBubble(row, col);
    if (!start) {
      return [];
    }

    const seen = new Set();
    const stack = [[row, col]];
    const group = [];

    while (stack.length > 0) {
      const [nextRow, nextCol] = stack.pop();
      const key = cellKey(nextRow, nextCol);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      const bubble = this.getBubble(nextRow, nextCol);
      if (!bubble || bubble.colorIndex !== start.colorIndex) {
        continue;
      }
      group.push(bubble);
      this.neighbors(nextRow, nextCol).forEach((cell) => stack.push(cell));
    }

    return group;
  }

  ceilingConnected() {
    const seen = new Set();
    const stack = [];
    for (let col = 0; col < this.colsInRow(0); col += 1) {
      if (this.getBubble(0, col)) {
        stack.push([0, col]);
      }
    }

    while (stack.length > 0) {
      const [row, col] = stack.pop();
      const key = cellKey(row, col);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      this.neighbors(row, col).forEach(([nextRow, nextCol]) => {
        if (this.getBubble(nextRow, nextCol)) {
          stack.push([nextRow, nextCol]);
        }
      });
    }

    return seen;
  }

  anyPastDanger() {
    for (const bubble of this.bubbles.values()) {
      if (bubble.visual.y + R >= DANGER_Y) {
        return true;
      }
    }
    return false;
  }

  popBits(x, y, color) {
    for (let i = 0; i < 5; i += 1) {
      const bit = this.add.circle(x, y, 3.5, color).setDepth(11);
      this.tweens.add({
        targets: bit,
        x: x + Phaser.Math.Between(-26, 26),
        y: y + Phaser.Math.Between(-20, 16),
        alpha: 0,
        scale: 0.2,
        duration: 260,
        onComplete: () => bit.destroy(),
      });
    }
  }

  floatLabel(x, y, text) {
    const label = this.add.text(x, y, text, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color: '#ffe566',
      stroke: '#2f2458',
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

  recycleShot(colorIndex) {
    if (this.shot) {
      this.shot.destroy();
      this.shot = null;
    }
    this.loaded = this.createBubbleVisual(SHOOTER_X, SHOOTER_Y, colorIndex);
    this.loaded.setDepth(9);
    this.phase = 'ready';
  }

  attachShot(hit) {
    if (!this.shot) {
      return;
    }

    const x = this.shot.x;
    const y = this.shot.y;
    const colorIndex = this.shot.getData('colorIndex');
    const mag = Math.hypot(this.shotVx, this.shotVy) || 1;
    const snapX = x - (this.shotVx / mag) * 12;
    const snapY = y - (this.shotVy / mag) * 12;
    this.shot.destroy();
    this.shot = null;
    this.phase = 'resolve';

    const cell = this.pickSnapCell(snapX, snapY, hit) || this.pickSnapCell(x, y, hit);
    if (!cell) {
      this.recycleShot(colorIndex);
      return;
    }

    const placed = this.placeBubble(cell.row, cell.col, colorIndex);
    this.audio.stick();

    const group = this.sameColorGroup(cell.row, cell.col);
    if (group.length >= MATCH_MIN) {
      this.popAndDrop(group);
      return;
    }

    if (placed.visual.y + R >= DANGER_Y) {
      this.endGame();
      return;
    }

    this.afterNoMatch();
  }

  popAndDrop(group) {
    const extra = Math.max(0, group.length - MATCH_MIN);
    this.score += group.length * POP_POINTS + extra * 5;
    this.audio.pop(group.length);
    this.floatLabel(group[0].visual.x, group[0].visual.y, `+${group.length * POP_POINTS}`);

    group.forEach((bubble, index) => {
      this.bubbles.delete(cellKey(bubble.row, bubble.col));
      this.popBits(bubble.visual.x, bubble.visual.y, COLORS[bubble.colorIndex]);
      this.tweens.add({
        targets: bubble.visual,
        scale: 0.12,
        alpha: 0,
        duration: 180,
        delay: index * 16,
        onComplete: () => bubble.visual.destroy(),
      });
    });

    this.refreshHud();
    this.time.delayedCall(220 + group.length * 16, () => {
      if (this.ended) {
        return;
      }
      const connected = this.ceilingConnected();
      const falling = [];
      this.bubbles.forEach((bubble, key) => {
        if (!connected.has(key)) {
          falling.push(bubble);
        }
      });
      falling.forEach((bubble) => this.bubbles.delete(cellKey(bubble.row, bubble.col)));

      if (falling.length > 0) {
        this.score += falling.length * DROP_POINTS;
        this.audio.drop();
        this.floatLabel(GAME_WIDTH / 2, 120, `Drop +${falling.length * DROP_POINTS}`);
        falling.forEach((bubble, index) => {
          this.tweens.add({
            targets: bubble.visual,
            y: bubble.visual.y + 88,
            alpha: 0,
            duration: 280,
            delay: index * 18,
            onComplete: () => bubble.visual.destroy(),
          });
        });
      }

      this.refreshHud();
      this.time.delayedCall(falling.length > 0 ? 340 : 60, () => this.afterClear());
    });
  }

  afterClear() {
    if (this.ended) {
      return;
    }

    if (this.bubbles.size === 0) {
      this.score += CLEAR_BONUS;
      this.level += 1;
      this.shotsUntilDrop = this.shotsForLevel();
      this.audio.level();
      this.showBanner(`Level ${this.level}!`);
      this.buildBoard();
      this.nextColor = this.randomBoardColor();
      this.loadShooter();
      this.phase = 'ready';
      this.refreshHud();
      return;
    }

    this.countdownDrop();
  }

  afterNoMatch() {
    this.countdownDrop();
  }

  countdownDrop() {
    this.shotsUntilDrop -= 1;
    this.refreshHud();
    if (this.shotsUntilDrop <= 0) {
      this.addIncomingRow();
    } else {
      this.finishTurn();
    }
  }

  addIncomingRow() {
    const shifted = new Map();
    this.bubbles.forEach((bubble) => {
      bubble.row += 1;
      shifted.set(cellKey(bubble.row, bubble.col), bubble);
    });
    this.bubbles = shifted;
    this.stagger = 1 - this.stagger;

    const moveCount = this.bubbles.size;
    let finished = false;
    const finish = () => {
      if (finished || this.ended) {
        return;
      }
      finished = true;
      this.spawnFilledRow(0, true);
      this.shotsUntilDrop = this.shotsForLevel();
      this.audio.row();
      this.showBanner('More bubbles!');
      this.finishTurn();
    };

    if (moveCount === 0) {
      finish();
      return;
    }

    this.bubbles.forEach((bubble) => {
      const point = this.cellCenter(bubble.row, bubble.col);
      this.tweens.add({
        targets: bubble.visual,
        x: point.x,
        y: point.y,
        duration: 180,
      });
    });
    this.time.delayedCall(200, finish);
  }

  finishTurn() {
    if (this.ended) {
      return;
    }

    if (this.anyPastDanger()) {
      this.endGame();
      return;
    }

    this.loadShooter();
    this.phase = 'ready';
    this.refreshHud();
  }

  drawAim() {
    this.aimGfx.clear();
    if (this.playState !== 'playing' || this.phase !== 'ready') {
      return;
    }

    let x = SHOOTER_X;
    let y = SHOOTER_Y - R - 4;
    let vx = Math.sin(this.aimAngle);
    let vy = -Math.cos(this.aimAngle);
    const minX = WALL + R;
    const maxX = GAME_WIDTH - WALL - R;

    for (let i = 0; i < 48; i += 1) {
      x += vx * 12;
      y += vy * 12;
      if (x <= minX) {
        x = minX;
        vx *= -1;
      } else if (x >= maxX) {
        x = maxX;
        vx *= -1;
      }
      if (y - R <= CEILING_Y) {
        break;
      }
      if (this.clusterHitAt(x, y)) {
        break;
      }
      if (i % 2 === 0) {
        this.aimGfx.fillStyle(0xffffff, 0.72);
        this.aimGfx.fillCircle(x, y, 2.3);
      }
    }
  }

  update(_time, delta) {
    if (this.playState !== 'playing' || this.ended) {
      return;
    }

    const dt = Math.min(delta, 32) / 1000;
    const left = this.cursors?.left.isDown || this.wasd?.A.isDown;
    const right = this.cursors?.right.isDown || this.wasd?.D.isDown;
    if (left || right) {
      this.usingPointer = false;
      this.aimAngle = Phaser.Math.Clamp(this.aimAngle + (right ? AIM_TURN : -AIM_TURN) * dt, -MAX_AIM, MAX_AIM);
    } else if (this.usingPointer) {
      this.aimFromPoint(this.pointerX, this.pointerY);
    }

    this.cannon.setRotation(this.aimAngle);
    this.drawAim();

    if (this.phase !== 'flying' || !this.shot) {
      return;
    }

    const dist = SHOT_SPEED * dt;
    const steps = Math.max(1, Math.ceil(dist / SHOT_STEP));
    const stepDt = dt / steps;
    for (let i = 0; i < steps; i += 1) {
      if (this.phase !== 'flying' || !this.shot) {
        return;
      }
      this.advanceShot(stepDt);
    }
  }

  bounceWallSound() {
    if (this.time.now >= this.nextWallSoundAt) {
      this.nextWallSoundAt = this.time.now + 80;
      this.audio.bounce();
    }
  }

  advanceShot(dt) {
    this.shot.x += this.shotVx * dt;
    this.shot.y += this.shotVy * dt;

    const minX = WALL + R;
    const maxX = GAME_WIDTH - WALL - R;
    if (this.shot.x < minX) {
      this.shot.x = minX;
      this.shotVx = Math.abs(this.shotVx);
      this.bounceWallSound();
    } else if (this.shot.x > maxX) {
      this.shot.x = maxX;
      this.shotVx = -Math.abs(this.shotVx);
      this.bounceWallSound();
    }

    if (this.shot.y - R <= CEILING_Y + 1) {
      this.shot.y = CEILING_Y + R + 1;
      this.attachShot(null);
      return;
    }

    if (this.shot.y > GAME_HEIGHT + R) {
      this.recycleShot(this.shot.getData('colorIndex'));
      return;
    }

    const hit = this.clusterHitAt(this.shot.x, this.shot.y);
    if (hit) {
      this.attachShot(hit);
    }
  }

  endGame() {
    if (this.ended) {
      return;
    }

    this.ended = true;
    this.phase = 'ended';
    this.aimGfx.clear();
    this.audio.lose();
    this.notifyState('ended');
    const onGameOver = this.registry.get('onGameOver');
    if (typeof onGameOver === 'function') {
      onGameOver(this.score, this.level);
    }
  }
}

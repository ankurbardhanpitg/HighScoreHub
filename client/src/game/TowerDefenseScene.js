import Phaser from 'phaser';

export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 380;
export const STARTING_LIVES = 8;
export const STARTING_GOLD = 110;
export const TOTAL_WAVES = 30;

const TILE = 28;
const MAP_COLS = 18;
const MAP_ROWS = 12;
const MAP_X = 8;
const MAP_Y = 36;
const SHOP_X = 524;
const SHOP_W = 188;
const HUD_Y = 16;

const PATH_CORNERS = [
  [0, 6],
  [3, 6],
  [3, 2],
  [8, 2],
  [8, 9],
  [13, 9],
  [13, 4],
  [17, 4],
];

const FLOWERS = [
  [1, 1],
  [2, 8],
  [5, 5],
  [6, 11],
  [10, 0],
  [11, 6],
  [14, 1],
  [15, 8],
  [16, 11],
  [4, 10],
  [9, 4],
];

const TOWER_TYPES = {
  dart: {
    id: 'dart',
    name: 'Dart',
    cost: 50,
    damage: 13,
    range: 88,
    cooldown: 520,
    projectileSpeed: 330,
    splash: 0,
    slow: 0,
    slowMs: 0,
    color: 0x4da3ff,
    accent: 0xffe566,
    shot: 0xffe566,
  },
  frost: {
    id: 'frost',
    name: 'Frost',
    cost: 85,
    damage: 6,
    range: 84,
    cooldown: 660,
    projectileSpeed: 300,
    splash: 0,
    slow: 0.5,
    slowMs: 1400,
    color: 0x7ec8ff,
    accent: 0xffffff,
    shot: 0xb8f0ff,
  },
  boom: {
    id: 'boom',
    name: 'Boom',
    cost: 125,
    damage: 19,
    range: 84,
    cooldown: 880,
    projectileSpeed: 260,
    splash: 40,
    slow: 0,
    slowMs: 0,
    color: 0xff8a3d,
    accent: 0xffe566,
    shot: 0xff8a3d,
  },
};

const TOWER_ORDER = ['dart', 'frost', 'boom'];

const ENEMY_TYPES = {
  slime: { id: 'slime', hp: 34, speed: 44, points: 10, gold: 6, leak: 1, color: 0x7ed957, r: 12 },
  bee: { id: 'bee', hp: 20, speed: 76, points: 13, gold: 7, leak: 1, color: 0xffe566, r: 10 },
  rock: { id: 'rock', hp: 90, speed: 30, points: 22, gold: 10, leak: 1, color: 0xc48a4a, r: 14 },
  boss: { id: 'boss', hp: 230, speed: 34, points: 85, gold: 32, leak: 2, color: 0x9b6dff, r: 18 },
};

function createTowerDefenseAudio() {
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
    place() {
      beep({ type: 'triangle', freq: 420, freqEnd: 720, duration: 0.12, volume: 0.07 });
    },
    deny() {
      beep({ type: 'square', freq: 180, freqEnd: 90, duration: 0.12, volume: 0.05 });
    },
    shoot() {
      beep({ type: 'square', freq: 640, freqEnd: 880, duration: 0.05, volume: 0.045 });
    },
    hit() {
      beep({ type: 'triangle', freq: 500, freqEnd: 760, duration: 0.07, volume: 0.07 });
    },
    boom() {
      beep({ type: 'sawtooth', freq: 220, freqEnd: 70, duration: 0.18, volume: 0.06 });
    },
    leak() {
      beep({ type: 'triangle', freq: 240, freqEnd: 90, duration: 0.28, volume: 0.08 });
    },
    wave() {
      beep({ freq: 523, duration: 0.08, volume: 0.07 });
      beep({ freq: 659, duration: 0.08, volume: 0.07, delay: 0.08 });
      beep({ freq: 784, duration: 0.14, volume: 0.08, delay: 0.16 });
    },
    win() {
      beep({ freq: 523, duration: 0.1, volume: 0.08 });
      beep({ freq: 659, duration: 0.1, volume: 0.08, delay: 0.1 });
      beep({ freq: 784, duration: 0.1, volume: 0.08, delay: 0.2 });
      beep({ freq: 1046, duration: 0.22, volume: 0.09, delay: 0.3 });
    },
    lose() {
      beep({ type: 'triangle', freq: 330, freqEnd: 110, duration: 0.42, volume: 0.09 });
    },
  };
}

function expandPath(corners) {
  const tiles = [];
  const push = (c, r) => {
    const last = tiles[tiles.length - 1];
    if (!last || last.c !== c || last.r !== r) {
      tiles.push({ c, r });
    }
  };

  push(corners[0][0], corners[0][1]);
  for (let i = 1; i < corners.length; i += 1) {
    let c = corners[i - 1][0];
    let r = corners[i - 1][1];
    const tc = corners[i][0];
    const tr = corners[i][1];
    const dc = Math.sign(tc - c);
    const dr = Math.sign(tr - r);
    while (c !== tc || r !== tr) {
      c += dc;
      r += dr;
      push(c, r);
    }
  }
  return tiles;
}

function tileCenter(c, r) {
  return {
    x: MAP_X + c * TILE + TILE / 2,
    y: MAP_Y + r * TILE + TILE / 2,
  };
}

function enemiesForWave(wave) {
  if (wave === 7) {
    return Array.from({ length: 16 }, () => 'bee');
  }
  if (wave === 14 || wave === 21 || wave === 28) {
    return Array.from({ length: 16 + (wave / 7 - 1) * 6 }, () => 'bee');
  }

  const counts = {
    slime: Math.min(24, 6 + wave),
    bee: wave >= 2 ? Math.min(20, 1 + wave) : 0,
    rock: wave >= 4 ? Math.min(16, wave - 1) : 0,
    boss: wave === 5 || wave === 8 ? 1 : 0,
  };

  if (wave === 10) {
    counts.boss = 2;
    counts.rock += 2;
  } else if (wave === 15) {
    counts.boss = 1;
    counts.rock += 2;
  } else if (wave === 20 || wave === 25) {
    counts.boss = 2;
    counts.rock += 2;
  } else if (wave === 30) {
    counts.boss = 3;
    counts.rock += 4;
    counts.slime += 4;
  }

  const list = [];
  let added = true;
  while (added) {
    added = false;
    ['slime', 'bee', 'rock', 'boss'].forEach((type) => {
      if (counts[type] > 0) {
        list.push(type);
        counts[type] -= 1;
        added = true;
      }
    });
  }
  return list;
}

export default class TowerDefenseScene extends Phaser.Scene {
  constructor() {
    super('TowerDefenseScene');
  }

  create() {
    this.ended = false;
    this.playState = 'waiting';
    this.phase = 'idle';
    this.score = 0;
    this.lives = STARTING_LIVES;
    this.gold = STARTING_GOLD;
    this.wave = 1;
    this.nextWave = 1;
    this.selected = 'dart';
    this.hoverTile = null;
    this.spawnQueue = [];
    this.spawnIn = 0;
    this.spawnPack = 0;
    this.betweenMs = 0;
    this.enemies = [];
    this.towers = [];
    this.shots = [];
    this.occupied = new Set();
    this.audio = createTowerDefenseAudio();

    this.pathTiles = expandPath(PATH_CORNERS);
    this.pathSet = new Set(this.pathTiles.map((tile) => `${tile.c},${tile.r}`));
    this.waypoints = this.pathTiles.map((tile) => tileCenter(tile.c, tile.r));

    this.drawWorld();
    this.drawShop();
    this.createHud();
    this.createGhost();
    this.refreshHud();
    this.refreshShop();

    this.input.keyboard?.addCapture(['ONE', 'TWO', 'THREE', 'P', 'ESC', 'SPACE']);
    this.input.keyboard?.on('keydown-SPACE', this.onSpace, this);
    this.input.keyboard?.on('keydown-P', this.togglePause, this);
    this.input.keyboard?.on('keydown-ESC', this.togglePause, this);
    this.input.keyboard?.on('keydown-ONE', () => this.selectTower('dart'), this);
    this.input.keyboard?.on('keydown-TWO', () => this.selectTower('frost'), this);
    this.input.keyboard?.on('keydown-THREE', () => this.selectTower('boom'), this);
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);

    this.registry.set('gameApi', {
      start: () => this.startGame(),
      pause: () => this.pauseGame(),
      resume: () => this.resumeGame(),
    });
    this.notifyState('waiting');
  }

  drawWorld() {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x4f9a3e);
    this.add.rectangle(GAME_WIDTH / 2, 18, GAME_WIDTH, 36, 0x3d7a30);

    for (let r = 0; r < MAP_ROWS; r += 1) {
      for (let c = 0; c < MAP_COLS; c += 1) {
        const { x, y } = tileCenter(c, r);
        const onPath = this.pathSet.has(`${c},${r}`);
        const dark = (c + r) % 2 === 0;
        const color = onPath ? (dark ? 0xe2c078 : 0xf0d090) : dark ? 0x6bc94a : 0x7ed957;
        this.add.rectangle(x, y, TILE - 1, TILE - 1, color).setDepth(1);
      }
    }

    this.pathTiles.forEach((tile, index) => {
      if (index === 0 || index === this.pathTiles.length - 1) {
        return;
      }
      const next = this.pathTiles[index + 1];
      if (!next) {
        return;
      }
      const a = tileCenter(tile.c, tile.r);
      const b = tileCenter(next.c, next.r);
      this.add.rectangle((a.x + b.x) / 2, (a.y + b.y) / 2, 8, 8, 0xd4a85a, 0.35).setDepth(2);
    });

    FLOWERS.forEach(([c, r]) => {
      if (this.pathSet.has(`${c},${r}`)) {
        return;
      }
      const { x, y } = tileCenter(c, r);
      this.add.circle(x, y + 2, 4, 0xffffff).setDepth(3);
      this.add.circle(x, y + 2, 1.6, 0xffe566).setDepth(3);
    });

    const start = this.waypoints[0];
    const portal = this.add.container(start.x - 6, start.y, [
      this.add.ellipse(0, 0, 22, 28, 0x9b6dff, 0.9).setStrokeStyle(2, 0xe8dcff),
      this.add.ellipse(0, 0, 10, 16, 0x24185e),
    ]);
    portal.setDepth(4);

    const end = this.waypoints[this.waypoints.length - 1];
    const castle = this.add.container(end.x + 8, end.y, [
      this.add.rectangle(0, 6, 26, 20, 0xffd6ea).setStrokeStyle(2, 0xffffff),
      this.add.rectangle(-10, -6, 8, 14, 0xffb3c9),
      this.add.rectangle(10, -6, 8, 14, 0xffb3c9),
      this.add.rectangle(0, -10, 16, 12, 0xff6b9d),
      this.add.rectangle(0, 10, 8, 10, 0xc45c7a),
      this.add.circle(0, -2, 3, 0xffe566),
    ]);
    castle.setDepth(4);
  }

  drawShop() {
    this.add.rectangle(SHOP_X + SHOP_W / 2, MAP_Y + (MAP_ROWS * TILE) / 2, SHOP_W, MAP_ROWS * TILE, 0xfffdf8)
      .setStrokeStyle(3, 0xffffff)
      .setDepth(5);
    this.add.text(SHOP_X + SHOP_W / 2, MAP_Y + 14, 'Towers', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#243047',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(6);

    this.goldText = this.add.text(SHOP_X + SHOP_W / 2, MAP_Y + 34, `Gold ${STARTING_GOLD}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '15px',
      color: '#c79212',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(6);

    this.shopButtons = [];
    TOWER_ORDER.forEach((id, index) => {
      const def = TOWER_TYPES[id];
      const x = SHOP_X + 10;
      const y = MAP_Y + 50 + index * 78;
      const card = this.add.rectangle(x + 84, y + 34, 168, 70, 0xffffff)
        .setStrokeStyle(3, def.color)
        .setDepth(6);
      const icon = this.makeTowerIcon(x + 28, y + 34, def);
      icon.setDepth(7);
      const name = this.add.text(x + 52, y + 16, `${index + 1}  ${def.name}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '15px',
        color: '#243047',
        fontStyle: 'bold',
      }).setDepth(7);
      const cost = this.add.text(x + 52, y + 38, `$${def.cost}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#c79212',
      }).setDepth(7);
      this.shopButtons.push({ id, x, y, w: 168, h: 70, card, cost });
    });

    this.shopHint = this.add.text(SHOP_X + SHOP_W / 2, MAP_Y + MAP_ROWS * TILE - 16, 'Tap a tower, then grass', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#5b6b82',
    }).setOrigin(0.5).setDepth(6);
  }

  makeTowerIcon(x, y, def) {
    if (def.id === 'dart') {
      return this.add.container(x, y, [
        this.add.circle(0, 4, 10, def.color).setStrokeStyle(2, 0xffffff),
        this.add.triangle(0, -6, -7, 6, 7, 6, 0, -10, def.accent).setStrokeStyle(2, 0xffffff),
      ]);
    }
    if (def.id === 'frost') {
      return this.add.container(x, y, [
        this.add.circle(0, 0, 11, def.color).setStrokeStyle(2, 0xffffff),
        this.add.rectangle(0, 0, 12, 3, 0xffffff),
        this.add.rectangle(0, 0, 3, 12, 0xffffff),
      ]);
    }
    return this.add.container(x, y, [
      this.add.circle(0, 4, 11, def.color).setStrokeStyle(2, 0xffffff),
      this.add.rectangle(0, -6, 8, 12, def.accent).setStrokeStyle(2, 0xffffff),
    ]);
  }

  createHud() {
    this.livesText = this.add.text(16, HUD_Y, `Lives ${STARTING_LIVES}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      stroke: '#2d5c24',
      strokeThickness: 5,
    }).setOrigin(0, 0.5).setDepth(12);

    this.waveText = this.add.text(GAME_WIDTH / 2 - 80, HUD_Y, `Wave 1 / ${TOTAL_WAVES}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#ffe566',
      stroke: '#2d5c24',
      strokeThickness: 5,
    }).setOrigin(0.5, 0.5).setDepth(12);

    this.scoreText = this.add.text(SHOP_X - 12, HUD_Y, 'Score 0', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      stroke: '#2d5c24',
      strokeThickness: 5,
    }).setOrigin(1, 0.5).setDepth(12);

    this.hintText = this.add.text(MAP_X + (MAP_COLS * TILE) / 2, GAME_HEIGHT - 18, 'Pick a tower, then tap grass to build', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color: '#ffffff',
      stroke: '#2d5c24',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(12);

    this.bannerText = this.add.text(MAP_X + (MAP_COLS * TILE) / 2, 118, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '26px',
      color: '#ffe566',
      stroke: '#2d5c24',
      strokeThickness: 8,
    }).setOrigin(0.5).setDepth(13).setVisible(false);
  }

  createGhost() {
    this.rangeGfx = this.add.graphics().setDepth(8);
    this.ghost = this.add.circle(0, 0, 10, 0x4da3ff, 0.45).setDepth(9).setVisible(false);
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
    this.nextWave = 1;
    this.phase = 'between';
    this.betweenMs = 4000;
    this.bannerText.setText('Place towers!');
    this.bannerText.setVisible(true);
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

  pointerToGame(pointer) {
    const rect = this.game.canvas.getBoundingClientRect();
    if (pointer.event?.clientX != null && rect.width > 0 && rect.height > 0) {
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

    const { x, y } = this.pointerToGame(pointer);
    if (x >= SHOP_X) {
      const button = this.shopButtons.find(
        (item) => x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h
      );
      if (button) {
        this.selectTower(button.id);
      }
      return;
    }

    this.tryPlace(x, y);
  }

  onPointerMove(pointer) {
    if (!this.isCanvasPointer(pointer) || this.playState !== 'playing') {
      this.hoverTile = null;
      this.drawRangePreview();
      return;
    }
    const { x, y } = this.pointerToGame(pointer);
    this.hoverTile = this.tileAt(x, y);
    this.drawRangePreview();
  }

  selectTower(id) {
    if (this.ended || (this.playState !== 'playing' && this.playState !== 'waiting' && this.playState !== 'paused')) {
      return;
    }
    this.selected = id;
    this.refreshShop();
    this.drawRangePreview();
  }

  tileAt(x, y) {
    const c = Math.floor((x - MAP_X) / TILE);
    const r = Math.floor((y - MAP_Y) / TILE);
    if (c < 0 || r < 0 || c >= MAP_COLS || r >= MAP_ROWS) {
      return null;
    }
    return { c, r };
  }

  canBuild(tile) {
    if (!tile) {
      return false;
    }
    const key = `${tile.c},${tile.r}`;
    return !this.pathSet.has(key) && !this.occupied.has(key);
  }

  tryPlace(x, y) {
    const tile = this.tileAt(x, y);
    const def = TOWER_TYPES[this.selected];
    if (!def || !this.canBuild(tile)) {
      return;
    }
    if (this.gold < def.cost) {
      this.audio.deny();
      this.flashGold();
      return;
    }

    this.gold -= def.cost;
    this.occupied.add(`${tile.c},${tile.r}`);
    const pos = tileCenter(tile.c, tile.r);
    const gfx = this.makeTowerIcon(pos.x, pos.y, def);
    gfx.setDepth(10);
    this.towers.push({
      def,
      col: tile.c,
      row: tile.r,
      x: pos.x,
      y: pos.y,
      gfx,
      turret: def.id === 'frost' ? null : gfx.list[1],
      nextFireAt: 0,
    });
    this.audio.place();
    this.popBits(pos.x, pos.y, def.color);
    this.refreshHud();
    this.refreshShop();
  }

  flashGold() {
    this.goldText.setColor('#ff4d6d');
    this.time.delayedCall(220, () => {
      if (this.goldText.active) {
        this.goldText.setColor('#c79212');
      }
    });
  }

  refreshHud() {
    this.livesText.setText(`Lives ${this.lives}`);
    this.waveText.setText(`Wave ${this.wave} / ${TOTAL_WAVES}`);
    this.scoreText.setText(`Score ${this.score}`);
    this.goldText.setText(`Gold ${this.gold}`);
  }

  refreshShop() {
    this.shopButtons.forEach((button) => {
      const def = TOWER_TYPES[button.id];
      const selected = this.selected === button.id;
      const affordable = this.gold >= def.cost;
      button.card.setFillStyle(selected ? 0xfff3c4 : 0xffffff);
      button.card.setStrokeStyle(3, selected ? 0xff6b9d : def.color);
      button.cost.setColor(affordable ? '#c79212' : '#9aa6b8');
    });
  }

  drawRangePreview() {
    this.rangeGfx.clear();
    const def = TOWER_TYPES[this.selected];
    if (this.playState !== 'playing' || !def || !this.hoverTile || !this.canBuild(this.hoverTile)) {
      this.ghost.setVisible(false);
      return;
    }

    const { x, y } = tileCenter(this.hoverTile.c, this.hoverTile.r);
    const ok = this.gold >= def.cost;
    this.rangeGfx.fillStyle(ok ? def.color : 0xff6b9d, 0.12);
    this.rangeGfx.lineStyle(2, ok ? 0xffffff : 0xff6b9d, 0.7);
    this.rangeGfx.fillCircle(x, y, def.range);
    this.rangeGfx.strokeCircle(x, y, def.range);
    this.ghost.setFillStyle(def.color, 0.45);
    this.ghost.setPosition(x, y).setVisible(true);
  }

  beginWave(wave) {
    this.wave = wave;
    this.phase = 'spawning';
    this.spawnQueue = enemiesForWave(wave);
    this.spawnIn = 280;
    this.spawnPack = 0;
    this.bannerText.setText(`Wave ${wave}!`);
    this.bannerText.setVisible(true);
    this.audio.wave();
    this.refreshHud();
    this.time.delayedCall(900, () => {
      if (this.bannerText.active && this.phase === 'spawning') {
        this.bannerText.setVisible(false);
      }
    });
  }

  spawnEnemy(kind) {
    const def = ENEMY_TYPES[kind];
    const lateWaves = Math.max(0, this.wave - 10);
    const hpScale = 1 + Math.min(this.wave - 1, 9) * 0.18 + lateWaves * 0.08;
    const speedScale = 1 + Math.min(this.wave - 1, 9) * 0.03 + lateWaves * 0.015;
    const hp = Math.round(def.hp * hpScale);
    const start = this.waypoints[0];
    const parts = this.makeEnemyParts(def);
    const hpBg = this.add.rectangle(0, -def.r - 8, 22, 4, 0x243047);
    const hpBar = this.add.rectangle(-11, -def.r - 8, 22, 4, 0xff6b9d).setOrigin(0, 0.5);
    parts.push(hpBg, hpBar);
    const gfx = this.add.container(start.x, start.y, parts);
    gfx.setDepth(11);
    this.enemies.push({
      def,
      gfx,
      hpBar,
      hp,
      maxHp: hp,
      speed: def.speed * speedScale,
      wp: 0,
      t: 0,
      x: start.x,
      y: start.y,
      slowUntil: 0,
      traveled: 0,
    });
  }

  makeEnemyParts(def) {
    if (def.id === 'bee') {
      return [
        this.add.ellipse(-8, -2, 8, 10, 0xffffff, 0.8),
        this.add.ellipse(8, -2, 8, 10, 0xffffff, 0.8),
        this.add.ellipse(0, 0, 18, 14, def.color).setStrokeStyle(2, 0xffffff),
        this.add.rectangle(0, 0, 16, 3, 0x243047),
        this.add.circle(-3, -2, 1.6, 0x243047),
        this.add.circle(3, -2, 1.6, 0x243047),
      ];
    }
    if (def.id === 'rock') {
      return [
        this.add.rectangle(0, 0, 22, 18, def.color).setStrokeStyle(2, 0xffe4c4),
        this.add.circle(-4, -2, 2, 0x243047),
        this.add.circle(4, -2, 2, 0x243047),
      ];
    }
    if (def.id === 'boss') {
      return [
        this.add.ellipse(0, 2, 30, 24, def.color).setStrokeStyle(2, 0xffffff),
        this.add.triangle(0, -16, -8, -6, 8, -6, 0, -20, 0xffe566),
        this.add.circle(-6, 0, 3.2, 0xffffff),
        this.add.circle(6, 0, 3.2, 0xffffff),
        this.add.circle(-5, 1, 1.5, 0x243047),
        this.add.circle(7, 1, 1.5, 0x243047),
      ];
    }
    return [
      this.add.ellipse(0, 0, 22, 18, def.color).setStrokeStyle(2, 0xffffff),
      this.add.circle(-4, -2, 2.4, 0xffffff),
      this.add.circle(4, -2, 2.4, 0xffffff),
      this.add.circle(-3, -1, 1.2, 0x243047),
      this.add.circle(5, -1, 1.2, 0x243047),
    ];
  }

  livingEnemies() {
    return this.enemies.filter((enemy) => enemy.gfx.active && enemy.hp > 0);
  }

  moveEnemies(delta) {
    const leftover = [];
    this.enemies.forEach((enemy) => {
      if (!enemy.gfx.active || enemy.hp <= 0) {
        return;
      }
      const slowed = this.time.now < enemy.slowUntil;
      const speed = enemy.speed * (slowed ? 0.5 : 1);
      enemy.gfx.setAlpha(slowed ? 0.75 : 1);
      let remaining = speed * (delta / 1000);

      while (remaining > 0 && enemy.wp < this.waypoints.length - 1) {
        const a = this.waypoints[enemy.wp];
        const b = this.waypoints[enemy.wp + 1];
        const segLen = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
        const distLeft = (1 - enemy.t) * segLen;
        if (remaining >= distLeft) {
          remaining -= distLeft;
          enemy.traveled += distLeft;
          enemy.wp += 1;
          enemy.t = 0;
        } else {
          enemy.t += remaining / segLen;
          enemy.traveled += remaining;
          remaining = 0;
        }
      }

      if (enemy.wp >= this.waypoints.length - 1) {
        this.leakEnemy(enemy);
        return;
      }

      const a = this.waypoints[enemy.wp];
      const b = this.waypoints[enemy.wp + 1];
      enemy.x = a.x + (b.x - a.x) * enemy.t;
      enemy.y = a.y + (b.y - a.y) * enemy.t;
      enemy.gfx.setPosition(enemy.x, enemy.y);
      leftover.push(enemy);
    });
    this.enemies = leftover;
  }

  leakEnemy(enemy) {
    this.lives = Math.max(0, this.lives - enemy.def.leak);
    this.audio.leak();
    this.cameras.main.shake(80, 0.005);
    this.floatLabel(enemy.x, enemy.y, `-${enemy.def.leak}`, '#ff6b9d');
    this.popBits(enemy.x, enemy.y, enemy.def.color);
    enemy.gfx.destroy();
    this.refreshHud();
    if (this.lives <= 0) {
      this.endGame(false);
    }
  }

  towerTarget(tower) {
    let best = null;
    this.livingEnemies().forEach((enemy) => {
      if (Math.hypot(enemy.x - tower.x, enemy.y - tower.y) <= tower.def.range) {
        if (!best || enemy.traveled > best.traveled) {
          best = enemy;
        }
      }
    });
    return best;
  }

  fireTowers() {
    this.towers.forEach((tower) => {
      const target = this.towerTarget(tower);
      if (target && tower.turret?.setRotation) {
        tower.turret.setRotation(Math.atan2(target.y - tower.y, target.x - tower.x) + Math.PI / 2);
      }
      if (!target || this.time.now < tower.nextFireAt) {
        return;
      }

      const angle = Math.atan2(target.y - tower.y, target.x - tower.x);
      const gfx = this.add.circle(tower.x, tower.y, tower.def.splash ? 5 : 3.4, tower.def.shot)
        .setStrokeStyle(1, 0xffffff)
        .setDepth(12);
      this.shots.push({
        gfx,
        x: tower.x,
        y: tower.y,
        vx: Math.cos(angle) * tower.def.projectileSpeed,
        vy: Math.sin(angle) * tower.def.projectileSpeed,
        def: tower.def,
        target,
      });
      tower.nextFireAt = this.time.now + tower.def.cooldown;
      this.audio.shoot();
    });
  }

  moveShots(delta) {
    const dt = delta / 1000;
    this.shots = this.shots.filter((shot) => {
      if (shot.target?.gfx?.active && shot.target.hp > 0) {
        const angle = Math.atan2(shot.target.y - shot.y, shot.target.x - shot.x);
        const speed = shot.def.projectileSpeed;
        shot.vx = Math.cos(angle) * speed;
        shot.vy = Math.sin(angle) * speed;
      }
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.gfx.setPosition(shot.x, shot.y);

      if (shot.x < 0 || shot.y < 0 || shot.x > GAME_WIDTH || shot.y > GAME_HEIGHT) {
        shot.gfx.destroy();
        return false;
      }

      const hit = this.livingEnemies().find(
        (enemy) => Math.hypot(enemy.x - shot.x, enemy.y - shot.y) <= enemy.def.r + 4
      );
      if (hit) {
        this.explodeShot(shot, hit);
        shot.gfx.destroy();
        return false;
      }
      return true;
    });
  }

  explodeShot(shot, hit) {
    const targets = shot.def.splash
      ? this.livingEnemies().filter((enemy) => Math.hypot(enemy.x - hit.x, enemy.y - hit.y) <= shot.def.splash)
      : [hit];
    if (shot.def.splash) {
      this.audio.boom();
      this.popBits(hit.x, hit.y, shot.def.color);
    } else {
      this.audio.hit();
    }
    targets.forEach((enemy) => this.hurtEnemy(enemy, shot.def));
  }

  hurtEnemy(enemy, towerDef) {
    if (!enemy.gfx.active || enemy.hp <= 0) {
      return;
    }
    enemy.hp -= towerDef.damage;
    if (towerDef.slow) {
      enemy.slowUntil = this.time.now + towerDef.slowMs;
    }
    const ratio = Math.max(0, enemy.hp / enemy.maxHp);
    enemy.hpBar.setScale(ratio, 1);
    if (enemy.hp <= 0) {
      this.score += enemy.def.points;
      this.gold += enemy.def.gold;
      this.floatLabel(enemy.x, enemy.y - 8, `+${enemy.def.points}`);
      this.popBits(enemy.x, enemy.y, enemy.def.color);
      enemy.gfx.destroy();
      this.refreshHud();
      this.refreshShop();
    }
  }

  popBits(x, y, color) {
    for (let i = 0; i < 6; i += 1) {
      const bit = this.add.rectangle(x, y, 5, 5, color).setDepth(14);
      this.tweens.add({
        targets: bit,
        x: x + Phaser.Math.Between(-24, 24),
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
      stroke: '#2d5c24',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(15);
    this.tweens.add({
      targets: label,
      y: y - 22,
      alpha: 0,
      duration: 520,
      onComplete: () => label.destroy(),
    });
  }

  checkWaveClear() {
    if (this.phase !== 'spawning' && this.phase !== 'live') {
      return;
    }
    if (this.spawnQueue.length > 0) {
      this.phase = 'spawning';
      return;
    }
    if (this.livingEnemies().length > 0) {
      this.phase = 'live';
      return;
    }

    this.score += this.wave * 50;
    this.gold += 14 + this.wave * 3;
    this.refreshHud();
    this.refreshShop();

    if (this.wave >= TOTAL_WAVES) {
      this.score += this.lives * 25 + this.gold;
      this.refreshHud();
      this.endGame(true);
      return;
    }

    this.nextWave = this.wave + 1;
    this.phase = 'between';
    this.betweenMs = 2200;
    this.bannerText.setText(`Wave ${this.wave} clear!`);
    this.bannerText.setVisible(true);
    this.audio.wave();
  }

  update(_time, delta) {
    if (this.ended || this.playState !== 'playing') {
      return;
    }

    if (this.phase === 'between') {
      this.betweenMs -= delta;
      const seconds = Math.max(1, Math.ceil(this.betweenMs / 1000));
      const firstBuild = this.nextWave === 1 && this.livingEnemies().length === 0;
      this.bannerText.setText(firstBuild ? `Place towers! ${seconds}` : `Wave ${this.nextWave} in ${seconds}`);
      this.bannerText.setVisible(true);
      if (this.betweenMs <= 0) {
        this.bannerText.setVisible(false);
        this.beginWave(this.nextWave);
      }
      this.fireTowers();
      this.moveShots(delta);
      return;
    }

    if (this.phase === 'spawning') {
      this.spawnIn -= delta;
      if (this.spawnIn <= 0 && this.spawnQueue.length) {
        this.spawnEnemy(this.spawnQueue.shift());
        this.spawnPack += 1;
        const packEvery = this.wave >= 22 ? 2 : this.wave >= 14 ? 3 : this.wave >= 8 ? 4 : 0;
        if (packEvery && this.spawnPack % packEvery === 0 && this.spawnQueue.length) {
          this.spawnEnemy(this.spawnQueue.shift());
        }
        this.spawnIn = Math.max(180, 700 - this.wave * 38);
      }
    }

    this.moveEnemies(delta);
    this.fireTowers();
    this.moveShots(delta);
    this.checkWaveClear();
  }

  endGame(won) {
    if (this.ended) {
      return;
    }

    this.ended = true;
    this.phase = 'ended';
    this.ghost.setVisible(false);
    this.rangeGfx.clear();
    this.bannerText.setVisible(false);
    this.hintText.setVisible(false);
    if (won) {
      this.audio.win();
    } else {
      this.audio.lose();
    }
    this.notifyState('ended');

    const onGameOver = this.registry.get('onGameOver');
    if (typeof onGameOver === 'function') {
      onGameOver(this.score, this.wave, won);
    }
  }
}

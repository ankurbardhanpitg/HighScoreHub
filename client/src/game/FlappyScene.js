import Phaser from 'phaser';

export const GAME_WIDTH = 400;
export const GAME_HEIGHT = 600;

const PIPE_WIDTH = 64;
const PIPE_GAP = 160;
const PIPE_SPEED = 180;
const SPAWN_INTERVAL = 1500;
const FLAP_VELOCITY = -380;
const BIRD_RADIUS = 14;
const GROUND_HEIGHT = 20;

export default class FlappyScene extends Phaser.Scene {
  constructor() {
    super('FlappyScene');
  }

  create() {
    this.ended = false;
    this.score = 0;
    this.nextPipeId = 1;

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x70c5ce);

    this.bird = this.add.circle(90, GAME_HEIGHT / 2, BIRD_RADIUS, 0xf4d03f);
    this.physics.add.existing(this.bird);
    this.bird.body.setCircle(BIRD_RADIUS);
    this.bird.body.setBounce(0);
    this.bird.body.setCollideWorldBounds(false);

    this.pipes = this.physics.add.group({
      allowGravity: false,
      immovable: true,
    });

    const ground = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT - GROUND_HEIGHT / 2,
      GAME_WIDTH,
      GROUND_HEIGHT,
      0xded895
    );
    this.physics.add.existing(ground, true);

    const ceiling = this.add.rectangle(GAME_WIDTH / 2, -4, GAME_WIDTH, 8, 0x70c5ce, 0);
    this.physics.add.existing(ceiling, true);

    this.physics.add.collider(this.bird, this.pipes, this.endGame, undefined, this);
    this.physics.add.collider(this.bird, ground, this.endGame, undefined, this);
    this.physics.add.collider(this.bird, ceiling, this.endGame, undefined, this);

    this.scoreText = this.add.text(16, 16, 'Score: 0', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '22px',
      color: '#ffffff',
    });
    this.scoreText.setDepth(10);

    this.hintText = this.add.text(GAME_WIDTH / 2, 80, 'Click or press Space to flap', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#ffffff',
    });
    this.hintText.setOrigin(0.5);

    this.input.keyboard?.addCapture('SPACE');
    this.input.keyboard?.on('keydown-SPACE', this.flap, this);
    this.input.on('pointerdown', this.flap, this);

    this.spawnEvent = this.time.addEvent({
      delay: SPAWN_INTERVAL,
      callback: this.spawnPipes,
      callbackScope: this,
      loop: true,
    });

    this.spawnPipes();
  }

  flap() {
    if (this.ended) {
      return;
    }

    this.hintText.setVisible(false);
    this.bird.body.setVelocityY(FLAP_VELOCITY);
  }

  spawnPipes() {
    if (this.ended) {
      return;
    }

    const minGapCenter = 120;
    const maxGapCenter = GAME_HEIGHT - GROUND_HEIGHT - 120;
    const gapCenter = Phaser.Math.Between(minGapCenter, maxGapCenter);
    const topHeight = gapCenter - PIPE_GAP / 2;
    const bottomTop = gapCenter + PIPE_GAP / 2;
    const bottomHeight = GAME_HEIGHT - GROUND_HEIGHT - bottomTop;
    const x = GAME_WIDTH + PIPE_WIDTH / 2;
    const pipeId = this.nextPipeId;
    this.nextPipeId += 1;

    const topPipe = this.add.rectangle(x, topHeight / 2, PIPE_WIDTH, topHeight, 0x2ecc71);
    this.physics.add.existing(topPipe);
    topPipe.pipeId = pipeId;
    topPipe.scored = false;

    const bottomPipe = this.add.rectangle(
      x,
      bottomTop + bottomHeight / 2,
      PIPE_WIDTH,
      bottomHeight,
      0x27ae60
    );
    this.physics.add.existing(bottomPipe);
    bottomPipe.pipeId = pipeId;
    bottomPipe.scored = true;

    this.pipes.add(topPipe);
    this.pipes.add(bottomPipe);

    [topPipe, bottomPipe].forEach((pipe) => {
      pipe.body.setAllowGravity(false);
      pipe.body.setImmovable(true);
      pipe.body.setVelocityX(-PIPE_SPEED);
    });
  }

  update() {
    if (this.ended) {
      return;
    }

    if (this.bird.y < 0 || this.bird.y > GAME_HEIGHT) {
      this.endGame();
      return;
    }

    this.pipes.getChildren().forEach((pipe) => {
      if (!pipe.active) {
        return;
      }

      if (!pipe.scored && pipe.x + PIPE_WIDTH / 2 < this.bird.x) {
        pipe.scored = true;
        this.score += 1;
        this.scoreText.setText(`Score: ${this.score}`);
      }

      if (pipe.x < -PIPE_WIDTH) {
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

    const onGameOver = this.registry.get('onGameOver');
    if (typeof onGameOver === 'function') {
      onGameOver(this.score);
    }
  }
}

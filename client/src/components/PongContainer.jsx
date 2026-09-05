import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import Phaser from 'phaser';
import PongScene, { GAME_HEIGHT, GAME_WIDTH } from '../game/PongScene.js';

const PongContainer = forwardRef(function PongContainer({ onGameOver, onStateChange }, ref) {
  const containerRef = useRef(null);
  const gameRef = useRef(null);
  const onGameOverRef = useRef(onGameOver);
  const onStateChangeRef = useRef(onStateChange);

  useEffect(() => {
    onGameOverRef.current = onGameOver;
  }, [onGameOver]);

  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  useImperativeHandle(ref, () => ({
    start() {
      gameRef.current?.registry.get('gameApi')?.start();
    },
    pause() {
      gameRef.current?.registry.get('gameApi')?.pause();
    },
    resume() {
      gameRef.current?.registry.get('gameApi')?.resume();
    },
  }));

  useEffect(() => {
    if (!containerRef.current || gameRef.current) {
      return undefined;
    }

    const config = {
      type: Phaser.AUTO,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      parent: containerRef.current,
      backgroundColor: '#1f4e79',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 0 },
          debug: false,
        },
      },
      scene: PongScene,
    };

    const game = new Phaser.Game(config);
    game.registry.set('onGameOver', (score, cpuScore) => {
      onGameOverRef.current?.(score, cpuScore);
    });
    game.registry.set('onStateChange', (state) => {
      onStateChangeRef.current?.(state);
    });
    gameRef.current = game;

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="game-canvas pong-canvas" />;
});

export default PongContainer;

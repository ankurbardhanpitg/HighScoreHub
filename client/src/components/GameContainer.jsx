import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import Phaser from 'phaser';
import FlappyScene, { GAME_HEIGHT, GAME_WIDTH } from '../game/FlappyScene.js';

const GameContainer = forwardRef(function GameContainer({ onGameOver, onStateChange }, ref) {
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
      backgroundColor: '#3d96b4',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 260 },
          debug: false,
        },
      },
      scene: FlappyScene,
    };

    const game = new Phaser.Game(config);
    game.registry.set('onGameOver', (score, level, won) => {
      onGameOverRef.current?.(score, level, won);
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

  return <div ref={containerRef} className="game-canvas" />;
});

export default GameContainer;

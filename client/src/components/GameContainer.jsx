import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import FlappyScene, { GAME_HEIGHT, GAME_WIDTH } from '../game/FlappyScene.js';

export default function GameContainer({ onGameOver }) {
  const containerRef = useRef(null);
  const gameRef = useRef(null);
  const onGameOverRef = useRef(onGameOver);

  useEffect(() => {
    onGameOverRef.current = onGameOver;
  }, [onGameOver]);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) {
      return undefined;
    }

    const config = {
      type: Phaser.AUTO,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      parent: containerRef.current,
      backgroundColor: '#70c5ce',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 800 },
          debug: false,
        },
      },
      scene: FlappyScene,
    };

    const game = new Phaser.Game(config);
    game.registry.set('onGameOver', (score) => {
      onGameOverRef.current?.(score);
    });
    gameRef.current = game;

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="game-canvas" />;
}

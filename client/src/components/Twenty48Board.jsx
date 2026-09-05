import { useRef } from 'react';
import { SIZE } from '../game/twenty48.js';

const SWIPE_THRESHOLD = 28;

const TILE_CLASS = {
  2: 'tile-2',
  4: 'tile-4',
  8: 'tile-8',
  16: 'tile-16',
  32: 'tile-32',
  64: 'tile-64',
  128: 'tile-128',
  256: 'tile-256',
  512: 'tile-512',
  1024: 'tile-1024',
  2048: 'tile-2048',
};

function tileClassName(tile) {
  const valueClass = TILE_CLASS[tile.value] || 'tile-super';
  const extras = [];
  if (tile.isNew) {
    extras.push('is-new');
  }
  if (tile.isMerged) {
    extras.push('is-merged');
  }
  if (tile.removing) {
    extras.push('is-removing');
  }
  return ['puzzle-tile', valueClass, ...extras].join(' ');
}

export default function Twenty48Board({ tiles, onMove, disabled }) {
  const touchRef = useRef(null);

  function directionFromSwipe(deltaX, deltaY) {
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < SWIPE_THRESHOLD) {
      return null;
    }
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      return deltaX > 0 ? 'right' : 'left';
    }
    return deltaY > 0 ? 'down' : 'up';
  }

  function handleTouchStart(event) {
    if (disabled) {
      return;
    }
    const touch = event.changedTouches[0];
    touchRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(event) {
    if (disabled || !touchRef.current) {
      return;
    }
    const touch = event.changedTouches[0];
    const direction = directionFromSwipe(touch.clientX - touchRef.current.x, touch.clientY - touchRef.current.y);
    touchRef.current = null;
    if (direction) {
      event.preventDefault();
      onMove(direction);
    }
  }

  const cells = Array.from({ length: SIZE * SIZE }, (_, index) => index);

  return (
    <div
      className="puzzle-board"
      role="application"
      aria-label="2048 board"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="puzzle-grid" aria-hidden="true">
        {cells.map((cell) => (
          <div key={cell} className="puzzle-cell" />
        ))}
      </div>
      <div className="puzzle-tiles">
        {tiles.map((tile) => (
          <div
            key={tile.id}
            className={tileClassName(tile)}
            style={{
              transform: `translate(calc(${tile.col} * (100% + var(--gap))), calc(${tile.row} * (100% + var(--gap))))`,
            }}
          >
            <span className="puzzle-tile-face">{tile.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

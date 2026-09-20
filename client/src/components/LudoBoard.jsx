import {
  BOARD,
  BOARD_SIZE,
  PLAYERS,
  cellLabel,
  tokensAtCell,
} from '../game/ludo.js';

const PIP_FACES = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

export function LudoDie({ value, rolling, disabled, onRoll }) {
  const face = Math.min(6, Math.max(1, value || 1));
  const pips = PIP_FACES[face];

  return (
    <button
      type="button"
      className={`ludo-die${rolling ? ' is-rolling' : ''}`}
      onClick={onRoll}
      disabled={disabled}
      aria-label={rolling ? 'Rolling the dice' : disabled ? `Dice shows ${face}` : `Roll the dice, currently ${face}`}
    >
      {Array.from({ length: 9 }, (_, index) => (
        <span key={index} className={`ludo-pip${pips.includes(index + 1) ? ' is-on' : ''}`} aria-hidden="true" />
      ))}
    </button>
  );
}

function tokenLabel(token, movable, playerColor) {
  const yours = token.playerId === playerColor;
  const name = yours ? 'your' : PLAYERS[token.playerId].cpuName;
  const place = token.steps < 0 ? 'in the yard' : token.steps >= 56 ? 'home' : `token ${token.index + 1}`;
  if (movable) {
    return `Move ${name} token ${token.index + 1}`;
  }
  return `${name} token ${token.index + 1}, ${place}`;
}

export default function LudoBoard({
  tokens,
  legalMoves,
  lastMove,
  onPlay,
  disabled,
  playerColor = 'red',
}) {
  const movable = new Set((legalMoves || []).map((move) => move.tokenIndex));
  const lastKey = lastMove ? `${lastMove.playerId}:${lastMove.tokenIndex}` : '';

  return (
    <div className="ludo-board" role="grid" aria-label="Ludo board">
      {Array.from({ length: BOARD_SIZE }, (_, row) =>
        Array.from({ length: BOARD_SIZE }, (_, col) => {
          const meta = BOARD[row][col];
          const here = tokensAtCell(tokens, row, col);
          const classes = ['ludo-cell', `is-${meta.kind}`];
          if (meta.color) {
            classes.push(`is-${meta.color}`);
          }
          if (meta.safe) {
            classes.push('is-safe');
          }
          if (meta.start) {
            classes.push('is-start');
          }
          if (meta.home) {
            classes.push('is-home');
          }
          if (meta.yardSlot) {
            classes.push('is-slot');
          }

          return (
            <div key={`${row}-${col}`} className={classes.join(' ')} role="gridcell" aria-label={cellLabel(row, col)}>
              {meta.safe && meta.kind === 'path' && !meta.start ? <span className="ludo-star" aria-hidden="true">✦</span> : null}
              {here.map((token) => {
                const key = `${token.playerId}:${token.index}`;
                const canMove = !disabled && token.playerId === playerColor && movable.has(token.index);
                const classesForToken = ['ludo-token', `is-${token.playerId}`];
                if (canMove) {
                  classesForToken.push('is-movable');
                }
                if (key === lastKey) {
                  classesForToken.push('is-last');
                }
                if (here.length > 1) {
                  classesForToken.push('is-stack');
                }

                return (
                  <button
                    key={key}
                    type="button"
                    className={classesForToken.join(' ')}
                    disabled={!canMove}
                    aria-label={tokenLabel(token, canMove, playerColor)}
                    onClick={() => onPlay(token.index)}
                  >
                    {token.index + 1}
                  </button>
                );
              })}
            </div>
          );
        }),
      )}
    </div>
  );
}

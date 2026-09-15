import { COLS, CPU, PLAYER, ROWS, lowestEmptyRow } from '../game/connectfour.js';

function discClass(mark) {
  if (mark === PLAYER) {
    return 'c4-disc is-player';
  }
  if (mark === CPU) {
    return 'c4-disc is-cpu';
  }
  return 'c4-disc';
}

function columnLabel(col, board, disabled) {
  const number = col + 1;
  if (lowestEmptyRow(board, col) == null) {
    return `Column ${number}, full`;
  }
  if (disabled) {
    return `Column ${number}`;
  }
  return `Drop in column ${number}`;
}

export default function ConnectFourBoard({
  board,
  winningLine,
  lastMove,
  onPlay,
  disabled,
}) {
  const winSet = new Set(winningLine || []);

  return (
    <div className="c4-board" role="grid" aria-label="Connect Four board">
      {Array.from({ length: COLS }, (_, col) => {
        const landRow = lowestEmptyRow(board, col);
        const full = landRow == null;

        return (
          <button
            key={col}
            type="button"
            className="c4-col"
            aria-label={columnLabel(col, board, disabled)}
            disabled={disabled || full}
            onClick={() => onPlay(col)}
          >
            {Array.from({ length: ROWS }, (_, row) => {
              const index = row * COLS + col;
              const mark = board[index];
              const classes = ['c4-slot'];
              if (winSet.has(index)) {
                classes.push('is-win');
              }
              if (lastMove === index) {
                classes.push('is-last');
              }
              if (row === landRow) {
                classes.push('is-land');
              }

              return (
                <span key={index} className={classes.join(' ')} role="gridcell">
                  <span className={discClass(mark)} aria-hidden="true" />
                </span>
              );
            })}
          </button>
        );
      })}
    </div>
  );
}

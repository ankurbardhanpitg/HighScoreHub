function cellLabel(index, mark) {
  const row = Math.floor(index / 3) + 1;
  const col = (index % 3) + 1;
  if (mark === 'X') {
    return `Row ${row}, column ${col}, X`;
  }
  if (mark === 'O') {
    return `Row ${row}, column ${col}, O`;
  }
  return `Row ${row}, column ${col}, empty`;
}

export default function TicTacToeBoard({
  board,
  winningLine,
  lastMove,
  onPlay,
  disabled,
}) {
  const winSet = new Set(winningLine || []);

  return (
    <div className="ttt-board" role="grid" aria-label="Tic Tac Toe board">
      {board.map((mark, index) => {
        const classes = ['ttt-cell'];
        if (mark === 'X') {
          classes.push('is-x');
        }
        if (mark === 'O') {
          classes.push('is-o');
        }
        if (winSet.has(index)) {
          classes.push('is-win');
        }
        if (lastMove === index) {
          classes.push('is-last');
        }

        return (
          <button
            key={index}
            type="button"
            role="gridcell"
            className={classes.join(' ')}
            aria-label={cellLabel(index, mark)}
            disabled={disabled || Boolean(mark)}
            onClick={() => onPlay(index)}
          >
            {mark ? (
              <span className="ttt-mark" aria-hidden="true">
                {mark}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

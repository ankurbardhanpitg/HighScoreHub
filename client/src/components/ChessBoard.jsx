import {
  BLACK,
  FILES,
  PLAYER,
  PROMO_TYPES,
  WHITE,
  colorOf,
  glyphOf,
  pieceLabel,
  square,
  squareName,
  typeOf,
} from '../game/chess.js';

function squareLabel(sq, piece, selected, canMove) {
  const name = squareName(sq);
  const occupant = pieceLabel(piece);
  if (selected) {
    return `${name}, ${occupant}, selected`;
  }
  if (canMove && piece) {
    return `Capture on ${name}, ${occupant}`;
  }
  if (canMove) {
    return `Move to ${name}`;
  }
  return `${name}, ${occupant}`;
}

export default function ChessBoard({
  board,
  selected,
  legalTargets,
  lastMove,
  checkSquare,
  pendingPromotion,
  onSquare,
  onPromote,
  onCancelPromote,
  disabled,
  playerColor = PLAYER,
}) {
  const targetSet = new Set(legalTargets || []);
  const lastFrom = lastMove?.from;
  const lastTo = lastMove?.to;
  const flipped = playerColor === BLACK;
  const rankOrder = flipped ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const fileOrder = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const rankLabels = flipped ? ['1', '2', '3', '4', '5', '6', '7', '8'] : ['8', '7', '6', '5', '4', '3', '2', '1'];
  const fileLabels = (flipped ? 'hgfedcba' : FILES).split('');

  return (
    <div className="chess-board-wrap">
      <div className="chess-ranks" aria-hidden="true">
        {rankLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="chess-board" role="grid" aria-label="Chess board">
        {rankOrder.map((rank) => (
          <div key={rank} className="chess-row" role="row">
            {fileOrder.map((file) => {
              const sq = square(file, rank);
              const piece = board[sq];
              const light = (file + rank) % 2 === 1;
              const canMove = targetSet.has(sq);
              const classes = ['chess-square', light ? 'is-light' : 'is-dark'];
              if (selected === sq) {
                classes.push('is-selected');
              }
              if (canMove) {
                classes.push(piece ? 'is-capture' : 'is-move');
              }
              if (sq === lastFrom || sq === lastTo) {
                classes.push('is-last');
              }
              if (sq === checkSquare) {
                classes.push('is-check');
              }
              if (piece && colorOf(piece) === playerColor) {
                classes.push('is-own');
              }

              return (
                <button
                  key={sq}
                  type="button"
                  role="gridcell"
                  className={classes.join(' ')}
                  aria-label={squareLabel(sq, piece, selected === sq, canMove)}
                  disabled={disabled || Boolean(pendingPromotion)}
                  onClick={() => onSquare(sq)}
                >
                  {piece ? (
                    <span
                      className={`chess-piece is-${colorOf(piece) === WHITE ? 'white' : 'black'} is-${typeOf(piece)}`}
                      aria-hidden="true"
                    >
                      {glyphOf(piece)}
                    </span>
                  ) : null}
                  {canMove && !piece ? <span className="chess-dot" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        ))}

        {pendingPromotion ? (
          <div className="chess-promo" role="dialog" aria-label="Choose a piece to promote to">
            <p>Pick a piece</p>
            <div className="chess-promo-row">
              {PROMO_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className="chess-promo-btn"
                  aria-label={`Promote to ${type === 'n' ? 'knight' : { q: 'queen', r: 'rook', b: 'bishop' }[type]}`}
                  onClick={() => onPromote(type)}
                >
                  <span aria-hidden="true">{glyphOf(type.toUpperCase())}</span>
                </button>
              ))}
            </div>
            <button className="chess-promo-cancel" type="button" onClick={onCancelPromote}>
              Cancel
            </button>
          </div>
        ) : null}
      </div>

      <div className="chess-files" aria-hidden="true">
        {fileLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}

import {
  FILES,
  PLAYER,
  PROMO_TYPES,
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
}) {
  const targetSet = new Set(legalTargets || []);
  const lastFrom = lastMove?.from;
  const lastTo = lastMove?.to;

  return (
    <div className="chess-board-wrap">
      <div className="chess-ranks" aria-hidden="true">
        {['8', '7', '6', '5', '4', '3', '2', '1'].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="chess-board" role="grid" aria-label="Chess board">
        {Array.from({ length: 8 }, (_, visualRank) => {
          const rank = 7 - visualRank;
          return (
            <div key={rank} className="chess-row" role="row">
              {Array.from({ length: 8 }, (_, file) => {
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
                if (piece && colorOf(piece) === PLAYER) {
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
                        className={`chess-piece is-${colorOf(piece) === PLAYER ? 'white' : 'black'} is-${typeOf(piece)}`}
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
          );
        })}

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
        {FILES.split('').map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}

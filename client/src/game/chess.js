export const WHITE = 'w';
export const BLACK = 'b';
export const PLAYER = WHITE;
export const CPU = BLACK;
export const WIN_SCORE = 3;

export const FILES = 'abcdefgh';
export const PIECE_ORDER = ['q', 'r', 'b', 'n', 'p'];
export const PROMO_TYPES = ['q', 'r', 'b', 'n'];

export const PIECE_NAMES = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

export const GLYPHS = {
  k: '♚\uFE0E',
  q: '♛\uFE0E',
  r: '♜\uFE0E',
  b: '♝\uFE0E',
  n: '♞\uFE0E',
  p: '♟\uFE0E',
};

const PIECE_VALUES = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

const KNIGHT_OFF = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
];

const KING_OFF = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

const BISHOP_DIR = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

const ROOK_DIR = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const PAWN_PST = [
  0, 0, 0, 0, 0, 0, 0, 0,
  6, 6, 6, -4, -4, 6, 6, 6,
  4, 4, 8, 12, 12, 8, 4, 4,
  2, 2, 8, 16, 16, 8, 2, 2,
  4, 4, 10, 18, 18, 10, 4, 4,
  10, 10, 16, 22, 22, 16, 10, 10,
  28, 28, 28, 32, 32, 28, 28, 28,
  0, 0, 0, 0, 0, 0, 0, 0,
];

const KNIGHT_PST = [
  -20, -8, -6, -6, -6, -6, -8, -20,
  -8, -2, 2, 4, 4, 2, -2, -8,
  -6, 2, 6, 8, 8, 6, 2, -6,
  -6, 4, 8, 10, 10, 8, 4, -6,
  -6, 4, 8, 10, 10, 8, 4, -6,
  -6, 2, 6, 8, 8, 6, 2, -6,
  -8, -2, 2, 4, 4, 2, -2, -8,
  -20, -8, -6, -6, -6, -6, -8, -20,
];

const BISHOP_PST = [
  -8, -4, -4, -4, -4, -4, -4, -8,
  -4, 4, 2, 2, 2, 2, 4, -4,
  -4, 2, 6, 6, 6, 6, 2, -4,
  -4, 2, 6, 8, 8, 6, 2, -4,
  -4, 2, 6, 8, 8, 6, 2, -4,
  -4, 2, 6, 6, 6, 6, 2, -4,
  -4, 2, 2, 2, 2, 2, 2, -4,
  -8, -4, -4, -4, -4, -4, -4, -8,
];

const ROOK_PST = [
  2, 2, 4, 6, 6, 4, 2, 2,
  0, 0, 0, 2, 2, 0, 0, 0,
  0, 0, 0, 2, 2, 0, 0, 0,
  0, 0, 0, 2, 2, 0, 0, 0,
  0, 0, 0, 2, 2, 0, 0, 0,
  0, 0, 0, 2, 2, 0, 0, 0,
  8, 10, 10, 10, 10, 10, 10, 8,
  4, 4, 4, 6, 6, 4, 4, 4,
];

const QUEEN_PST = [
  -8, -4, -4, -2, -2, -4, -4, -8,
  -4, 0, 0, 0, 0, 0, 0, -4,
  -4, 0, 4, 4, 4, 4, 0, -4,
  -2, 0, 4, 6, 6, 4, 0, -2,
  -2, 0, 4, 6, 6, 4, 0, -2,
  -4, 0, 4, 4, 4, 4, 0, -4,
  -4, 0, 0, 0, 0, 0, 0, -4,
  -8, -4, -4, -2, -2, -4, -4, -8,
];

const KING_MID_PST = [
  12, 16, 6, 0, 0, 6, 16, 12,
  8, 8, 0, -8, -8, 0, 8, 8,
  -12, -16, -20, -24, -24, -20, -16, -12,
  -20, -24, -28, -32, -32, -28, -24, -20,
  -24, -24, -28, -32, -32, -28, -24, -24,
  -20, -20, -24, -28, -28, -24, -20, -20,
  -16, -16, -20, -24, -24, -20, -16, -16,
  -20, -16, -20, -24, -24, -20, -16, -20,
];

const PST = {
  p: PAWN_PST,
  n: KNIGHT_PST,
  b: BISHOP_PST,
  r: ROOK_PST,
  q: QUEEN_PST,
  k: KING_MID_PST,
};

export function square(file, rank) {
  return rank * 8 + file;
}

export function fileOf(sq) {
  return sq % 8;
}

export function rankOf(sq) {
  return Math.floor(sq / 8);
}

export function squareName(sq) {
  return `${FILES[fileOf(sq)]}${rankOf(sq) + 1}`;
}

export function typeOf(piece) {
  return piece.toLowerCase();
}

export function colorOf(piece) {
  return piece === piece.toUpperCase() ? WHITE : BLACK;
}

export function glyphOf(piece) {
  return GLYPHS[typeOf(piece)];
}

function onBoard(file, rank) {
  return file >= 0 && file < 8 && rank >= 0 && rank < 8;
}

function other(color) {
  return color === WHITE ? BLACK : WHITE;
}

function cloneState(state) {
  return {
    board: state.board.slice(),
    turn: state.turn,
    castling: { ...state.castling },
    ep: state.ep,
  };
}

export function initialState() {
  const board = Array.from({ length: 64 }, () => null);
  const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  for (let file = 0; file < 8; file += 1) {
    board[square(file, 0)] = back[file].toUpperCase();
    board[square(file, 1)] = 'P';
    board[square(file, 6)] = 'p';
    board[square(file, 7)] = back[file];
  }
  return {
    board,
    turn: WHITE,
    castling: { K: true, Q: true, k: true, q: true },
    ep: null,
  };
}

export function kingSquare(board, color) {
  const king = color === WHITE ? 'K' : 'k';
  return board.indexOf(king);
}

function sliderAttacks(board, sq, dirs, attackers) {
  const f0 = fileOf(sq);
  const r0 = rankOf(sq);
  for (const [df, dr] of dirs) {
    let file = f0 + df;
    let rank = r0 + dr;
    while (onBoard(file, rank)) {
      const piece = board[square(file, rank)];
      if (piece) {
        if (attackers.includes(piece)) {
          return true;
        }
        break;
      }
      file += df;
      rank += dr;
    }
  }
  return false;
}

export function isSquareAttacked(board, sq, byColor) {
  const f0 = fileOf(sq);
  const r0 = rankOf(sq);
  const enemyKing = byColor === WHITE ? 'K' : 'k';
  const enemyKnight = byColor === WHITE ? 'N' : 'n';
  const enemyBishop = byColor === WHITE ? 'B' : 'b';
  const enemyRook = byColor === WHITE ? 'R' : 'r';
  const enemyQueen = byColor === WHITE ? 'Q' : 'q';
  const enemyPawn = byColor === WHITE ? 'P' : 'p';

  if (byColor === WHITE) {
    if (onBoard(f0 - 1, r0 - 1) && board[square(f0 - 1, r0 - 1)] === enemyPawn) {
      return true;
    }
    if (onBoard(f0 + 1, r0 - 1) && board[square(f0 + 1, r0 - 1)] === enemyPawn) {
      return true;
    }
  } else {
    if (onBoard(f0 - 1, r0 + 1) && board[square(f0 - 1, r0 + 1)] === enemyPawn) {
      return true;
    }
    if (onBoard(f0 + 1, r0 + 1) && board[square(f0 + 1, r0 + 1)] === enemyPawn) {
      return true;
    }
  }

  for (const [df, dr] of KNIGHT_OFF) {
    const file = f0 + df;
    const rank = r0 + dr;
    if (onBoard(file, rank) && board[square(file, rank)] === enemyKnight) {
      return true;
    }
  }

  for (const [df, dr] of KING_OFF) {
    const file = f0 + df;
    const rank = r0 + dr;
    if (onBoard(file, rank) && board[square(file, rank)] === enemyKing) {
      return true;
    }
  }

  if (sliderAttacks(board, sq, BISHOP_DIR, [enemyBishop, enemyQueen])) {
    return true;
  }
  if (sliderAttacks(board, sq, ROOK_DIR, [enemyRook, enemyQueen])) {
    return true;
  }

  return false;
}

export function inCheck(state, color = state.turn) {
  const ksq = kingSquare(state.board, color);
  if (ksq < 0) {
    return true;
  }
  return isSquareAttacked(state.board, ksq, other(color));
}

function pushMove(moves, from, to, extra = {}) {
  moves.push({ from, to, ...extra });
}

function addPawnMoves(state, from, color, moves) {
  const board = state.board;
  const file = fileOf(from);
  const rank = rankOf(from);
  const dir = color === WHITE ? 1 : -1;
  const startRank = color === WHITE ? 1 : 6;
  const lastRank = color === WHITE ? 7 : 0;
  const forward = square(file, rank + dir);

  function addPromoOrPush(to, extra) {
    if (rankOf(to) === lastRank) {
      for (const promo of PROMO_TYPES) {
        pushMove(moves, from, to, { ...extra, promo });
      }
    } else {
      pushMove(moves, from, to, extra);
    }
  }

  if (!board[forward]) {
    addPromoOrPush(forward);
    if (rank === startRank) {
      const doubleSq = square(file, rank + dir * 2);
      if (!board[doubleSq]) {
        pushMove(moves, from, doubleSq, { double: true });
      }
    }
  }

  for (const df of [-1, 1]) {
    const captureFile = file + df;
    if (!onBoard(captureFile, rank + dir)) {
      continue;
    }
    const to = square(captureFile, rank + dir);
    const target = board[to];
    if (target && colorOf(target) !== color) {
      addPromoOrPush(to);
    } else if (state.ep === to) {
      addPromoOrPush(to, { ep: true });
    }
  }
}

function addSliderMoves(board, from, color, dirs, moves) {
  const f0 = fileOf(from);
  const r0 = rankOf(from);
  for (const [df, dr] of dirs) {
    let file = f0 + df;
    let rank = r0 + dr;
    while (onBoard(file, rank)) {
      const to = square(file, rank);
      const target = board[to];
      if (!target) {
        pushMove(moves, from, to);
      } else {
        if (colorOf(target) !== color) {
          pushMove(moves, from, to);
        }
        break;
      }
      file += df;
      rank += dr;
    }
  }
}

function addStepMoves(board, from, color, offsets, moves) {
  const f0 = fileOf(from);
  const r0 = rankOf(from);
  for (const [df, dr] of offsets) {
    const file = f0 + df;
    const rank = r0 + dr;
    if (!onBoard(file, rank)) {
      continue;
    }
    const to = square(file, rank);
    const target = board[to];
    if (!target || colorOf(target) !== color) {
      pushMove(moves, from, to);
    }
  }
}

function addCastleMoves(state, from, color, moves) {
  const board = state.board;
  const enemy = other(color);
  const rank = color === WHITE ? 0 : 7;
  if (from !== square(4, rank) || isSquareAttacked(board, from, enemy)) {
    return;
  }

  const kingSide = color === WHITE ? state.castling.K : state.castling.k;
  const queenSide = color === WHITE ? state.castling.Q : state.castling.q;

  if (kingSide && !board[square(5, rank)] && !board[square(6, rank)]) {
    if (!isSquareAttacked(board, square(5, rank), enemy) && !isSquareAttacked(board, square(6, rank), enemy)) {
      pushMove(moves, from, square(6, rank), { castle: 'k' });
    }
  }

  if (queenSide && !board[square(1, rank)] && !board[square(2, rank)] && !board[square(3, rank)]) {
    if (!isSquareAttacked(board, square(3, rank), enemy) && !isSquareAttacked(board, square(2, rank), enemy)) {
      pushMove(moves, from, square(2, rank), { castle: 'q' });
    }
  }
}

function generatePseudoMoves(state) {
  const moves = [];
  const { board, turn } = state;
  for (let from = 0; from < 64; from += 1) {
    const piece = board[from];
    if (!piece || colorOf(piece) !== turn) {
      continue;
    }
    const type = typeOf(piece);
    if (type === 'p') {
      addPawnMoves(state, from, turn, moves);
    } else if (type === 'n') {
      addStepMoves(board, from, turn, KNIGHT_OFF, moves);
    } else if (type === 'b') {
      addSliderMoves(board, from, turn, BISHOP_DIR, moves);
    } else if (type === 'r') {
      addSliderMoves(board, from, turn, ROOK_DIR, moves);
    } else if (type === 'q') {
      addSliderMoves(board, from, turn, BISHOP_DIR, moves);
      addSliderMoves(board, from, turn, ROOK_DIR, moves);
    } else if (type === 'k') {
      addStepMoves(board, from, turn, KING_OFF, moves);
      addCastleMoves(state, from, turn, moves);
    }
  }
  return moves;
}

function updateCastling(next, from, to, piece) {
  const rights = next.castling;
  if (piece === 'K') {
    rights.K = false;
    rights.Q = false;
  } else if (piece === 'k') {
    rights.k = false;
    rights.q = false;
  } else if (piece === 'R') {
    if (from === 0) {
      rights.Q = false;
    }
    if (from === 7) {
      rights.K = false;
    }
  } else if (piece === 'r') {
    if (from === 56) {
      rights.q = false;
    }
    if (from === 63) {
      rights.k = false;
    }
  }

  if (to === 0) {
    rights.Q = false;
  }
  if (to === 7) {
    rights.K = false;
  }
  if (to === 56) {
    rights.q = false;
  }
  if (to === 63) {
    rights.k = false;
  }
}

export function applyMove(state, move) {
  const next = cloneState(state);
  const piece = next.board[move.from];
  const color = colorOf(piece);
  const type = typeOf(piece);
  const toRank = rankOf(move.to);

  next.board[move.from] = null;

  if (move.ep) {
    const capRank = color === WHITE ? toRank - 1 : toRank + 1;
    next.board[square(fileOf(move.to), capRank)] = null;
  }

  if (type === 'p' && (toRank === 7 || toRank === 0)) {
    const promo = move.promo || 'q';
    next.board[move.to] = color === WHITE ? promo.toUpperCase() : promo;
  } else {
    next.board[move.to] = piece;
  }

  if (move.castle === 'k') {
    const rank = rankOf(move.from);
    next.board[square(5, rank)] = next.board[square(7, rank)];
    next.board[square(7, rank)] = null;
  } else if (move.castle === 'q') {
    const rank = rankOf(move.from);
    next.board[square(3, rank)] = next.board[square(0, rank)];
    next.board[square(0, rank)] = null;
  }

  updateCastling(next, move.from, move.to, piece);

  if (move.double) {
    next.ep = square(fileOf(move.from), (rankOf(move.from) + rankOf(move.to)) / 2);
  } else {
    next.ep = null;
  }

  next.turn = other(color);
  return next;
}

export function legalMoves(state) {
  return generatePseudoMoves(state).filter((move) => !inCheck(applyMove(state, move), state.turn));
}

export function legalMovesFrom(state, from) {
  return legalMoves(state).filter((move) => move.from === from);
}

export function findMove(state, from, to, promo) {
  return (
    legalMoves(state).find((move) => {
      if (move.from !== from || move.to !== to) {
        return false;
      }
      if (promo) {
        return move.promo === promo;
      }
      return !move.promo || move.promo === 'q';
    }) || null
  );
}

export function isPromotionMove(state, from, to) {
  const piece = state.board[from];
  if (!piece || typeOf(piece) !== 'p') {
    return false;
  }
  const rank = rankOf(to);
  return rank === 0 || rank === 7;
}

function countPieces(board) {
  const counts = { w: 0, b: 0, wn: 0, wb: 0, bn: 0, bb: 0, others: 0 };
  for (const piece of board) {
    if (!piece) {
      continue;
    }
    const color = colorOf(piece);
    const type = typeOf(piece);
    if (color === WHITE) {
      counts.w += 1;
    } else {
      counts.b += 1;
    }
    if (type === 'n') {
      if (color === WHITE) {
        counts.wn += 1;
      } else {
        counts.bn += 1;
      }
    } else if (type === 'b') {
      if (color === WHITE) {
        counts.wb += 1;
      } else {
        counts.bb += 1;
      }
    } else if (type !== 'k') {
      counts.others += 1;
    }
  }
  return counts;
}

export function isInsufficientMaterial(board) {
  const counts = countPieces(board);
  if (counts.others > 0) {
    return false;
  }
  if (counts.w + counts.b === 2) {
    return true;
  }
  if (counts.w + counts.b === 3 && counts.wn + counts.wb + counts.bn + counts.bb === 1) {
    return true;
  }
  return false;
}

export function getStatus(state) {
  const moves = legalMoves(state);
  const check = inCheck(state);
  if (moves.length === 0) {
    if (check) {
      return {
        result: other(state.turn),
        reason: 'checkmate',
        inCheck: true,
        moves,
      };
    }
    return { result: 'draw', reason: 'stalemate', inCheck: false, moves };
  }
  if (isInsufficientMaterial(state.board)) {
    return { result: 'draw', reason: 'material', inCheck: check, moves };
  }
  return { result: null, reason: null, inCheck: check, moves };
}

export function capturedPieces(board) {
  const start = { P: 8, N: 2, B: 2, R: 2, Q: 1, p: 8, n: 2, b: 2, r: 2, q: 1 };
  const now = { P: 0, N: 0, B: 0, R: 0, Q: 0, p: 0, n: 0, b: 0, r: 0, q: 0 };
  for (const piece of board) {
    if (piece && start[piece] != null) {
      now[piece] += 1;
    }
  }

  const byWhite = [];
  const byBlack = [];
  for (const type of PIECE_ORDER) {
    const missingBlack = start[type] - now[type];
    const missingWhite = start[type.toUpperCase()] - now[type.toUpperCase()];
    for (let i = 0; i < missingBlack; i += 1) {
      byWhite.push(type);
    }
    for (let i = 0; i < missingWhite; i += 1) {
      byBlack.push(type.toUpperCase());
    }
  }
  return { byWhite, byBlack };
}

function pstValue(type, sq, color) {
  const table = PST[type];
  if (!table) {
    return 0;
  }
  const index = color === WHITE ? sq : square(fileOf(sq), 7 - rankOf(sq));
  return table[index] || 0;
}

function evaluate(state) {
  let score = 0;
  for (let sq = 0; sq < 64; sq += 1) {
    const piece = state.board[sq];
    if (!piece) {
      continue;
    }
    const type = typeOf(piece);
    const color = colorOf(piece);
    const sign = color === WHITE ? 1 : -1;
    score += sign * (PIECE_VALUES[type] + pstValue(type, sq, color));
  }
  if (inCheck(state)) {
    score += state.turn === WHITE ? -18 : 18;
  }
  return score;
}

function captureScore(state, move) {
  const target = state.board[move.to];
  let score = 0;
  if (target) {
    score += 10 * PIECE_VALUES[typeOf(target)] - PIECE_VALUES[typeOf(state.board[move.from])];
  }
  if (move.ep) {
    score += 90;
  }
  if (move.promo) {
    score += PIECE_VALUES[move.promo];
  }
  if (move.castle) {
    score += 40;
  }
  return score;
}

function orderMoves(state, moves) {
  return moves
    .map((move, index) => ({ move, index, score: captureScore(state, move) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.move);
}

function negamax(state, depth, alpha, beta) {
  if (depth === 0) {
    return evaluate(state) * (state.turn === WHITE ? 1 : -1);
  }

  const moves = orderMoves(state, legalMoves(state));
  if (moves.length === 0) {
    if (inCheck(state)) {
      return -100000 + (4 - depth);
    }
    return 0;
  }

  if (isInsufficientMaterial(state.board)) {
    return 0;
  }

  let best = -Infinity;
  for (const move of moves) {
    const value = -negamax(applyMove(state, move), depth - 1, -beta, -alpha);
    if (value > best) {
      best = value;
    }
    if (best > alpha) {
      alpha = best;
    }
    if (alpha >= beta) {
      break;
    }
  }
  return best;
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function cpuMove(state, { depth = 2, blunderChance = 0.12 } = {}) {
  const moves = legalMoves(state);
  if (moves.length === 0) {
    return null;
  }

  const searchDepth = moves.length <= 18 ? Math.max(depth, 3) : depth;
  const scored = [];
  let bestScore = -Infinity;

  for (const move of orderMoves(state, moves)) {
    const value = -negamax(applyMove(state, move), searchDepth - 1, -Infinity, Infinity);
    scored.push({ move, value });
    if (value > bestScore) {
      bestScore = value;
    }
  }

  const window = Math.random() < blunderChance ? 140 : 35;
  const candidates = scored.filter((entry) => entry.value >= bestScore - window);
  return pickRandom(candidates).move;
}

export function pieceLabel(piece) {
  if (!piece) {
    return 'empty';
  }
  return `${colorOf(piece) === WHITE ? 'white' : 'black'} ${PIECE_NAMES[typeOf(piece)]}`;
}

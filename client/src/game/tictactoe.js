export const PLAYER = 'X';
export const CPU = 'O';
export const EMPTY = null;
export const WIN_SCORE = 5;

export const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function emptyBoard() {
  return Array.from({ length: 9 }, () => EMPTY);
}

export function getWinningLine(board) {
  return (
    WIN_LINES.find(([a, b, c]) => board[a] && board[a] === board[b] && board[a] === board[c]) || null
  );
}

export function getWinner(board) {
  const line = getWinningLine(board);
  return line ? board[line[0]] : null;
}

export function emptyCells(board) {
  return board.reduce((cells, mark, index) => {
    if (!mark) {
      cells.push(index);
    }
    return cells;
  }, []);
}

export function isBoardFull(board) {
  return emptyCells(board).length === 0;
}

export function isDraw(board) {
  return !getWinner(board) && isBoardFull(board);
}

function winningMove(board, mark) {
  for (const index of emptyCells(board)) {
    const next = board.slice();
    next[index] = mark;
    if (getWinner(next) === mark) {
      return index;
    }
  }
  return null;
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function cpuMove(board) {
  const empties = emptyCells(board);
  if (empties.length === 0) {
    return null;
  }

  const win = winningMove(board, CPU);
  if (win != null) {
    return win;
  }

  const block = winningMove(board, PLAYER);
  if (block != null && Math.random() < 0.88) {
    return block;
  }

  if (board[4] == null && Math.random() < 0.7) {
    return 4;
  }

  const corners = [0, 2, 6, 8].filter((index) => board[index] == null);
  if (corners.length > 0 && Math.random() < 0.75) {
    return pickRandom(corners);
  }

  return pickRandom(empties);
}

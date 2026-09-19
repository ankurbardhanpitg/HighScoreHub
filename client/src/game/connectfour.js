export const PLAYER = 'P';
export const CPU = 'C';
export const EMPTY = null;
export const COLS = 7;
export const ROWS = 6;
export const WIN_SCORE = 5;
export const WIN_LEN = 4;

const DIRS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

function indexOf(row, col) {
  return row * COLS + col;
}

function buildWindows() {
  const windows = [];

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      for (const [deltaRow, deltaCol] of DIRS) {
        const cells = [];
        for (let step = 0; step < WIN_LEN; step += 1) {
          const nextRow = row + deltaRow * step;
          const nextCol = col + deltaCol * step;
          if (nextRow < 0 || nextRow >= ROWS || nextCol < 0 || nextCol >= COLS) {
            break;
          }
          cells.push(indexOf(nextRow, nextCol));
        }
        if (cells.length === WIN_LEN) {
          windows.push(cells);
        }
      }
    }
  }

  return windows;
}

const WINDOWS = buildWindows();

export function emptyBoard() {
  return Array.from({ length: ROWS * COLS }, () => EMPTY);
}

export function lowestEmptyRow(board, col) {
  if (col < 0 || col >= COLS) {
    return null;
  }

  for (let row = ROWS - 1; row >= 0; row -= 1) {
    if (!board[indexOf(row, col)]) {
      return row;
    }
  }

  return null;
}

export function isColumnFull(board, col) {
  return lowestEmptyRow(board, col) == null;
}

export function legalColumns(board) {
  return Array.from({ length: COLS }, (_, col) => col).filter((col) => !isColumnFull(board, col));
}

export function dropDisc(board, col, mark) {
  const row = lowestEmptyRow(board, col);
  if (row == null) {
    return null;
  }

  const next = board.slice();
  const index = indexOf(row, col);
  next[index] = mark;
  return { board: next, index, row, col };
}

export function getWinningLine(board) {
  return (
    WINDOWS.find((cells) => {
      const first = board[cells[0]];
      return Boolean(first) && cells.every((cell) => board[cell] === first);
    }) || null
  );
}

export function getWinner(board) {
  const line = getWinningLine(board);
  return line ? board[line[0]] : null;
}

export function isBoardFull(board) {
  return legalColumns(board).length === 0;
}

export function isDraw(board) {
  return !getWinner(board) && isBoardFull(board);
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function wouldWin(board, col, mark) {
  const placed = dropDisc(board, col, mark);
  return Boolean(placed && getWinner(placed.board) === mark);
}

function givesOpponentWin(board, col, mark, opponent) {
  const placed = dropDisc(board, col, mark);
  if (!placed) {
    return true;
  }

  return legalColumns(placed.board).some((nextCol) => wouldWin(placed.board, nextCol, opponent));
}

function scoreWindow(board, cells, mark) {
  const opponent = mark === PLAYER ? CPU : PLAYER;
  let mine = 0;
  let theirs = 0;

  for (const cell of cells) {
    if (board[cell] === mark) {
      mine += 1;
    } else if (board[cell] === opponent) {
      theirs += 1;
    }
  }

  if (mine > 0 && theirs > 0) {
    return 0;
  }
  if (mine === 4) {
    return 100000;
  }
  if (theirs === 4) {
    return -100000;
  }
  if (mine === 3) {
    return 120;
  }
  if (theirs === 3) {
    return -140;
  }
  if (mine === 2) {
    return 10;
  }
  if (theirs === 2) {
    return -12;
  }
  if (mine === 1) {
    return 1;
  }
  return 0;
}

function evaluate(board, mark) {
  let total = 0;
  for (const cells of WINDOWS) {
    total += scoreWindow(board, cells, mark);
  }
  return total;
}

export function cpuMove(board) {
  const cols = legalColumns(board);
  if (cols.length === 0) {
    return null;
  }

  const wins = cols.filter((col) => wouldWin(board, col, CPU));
  if (wins.length > 0) {
    return pickRandom(wins);
  }

  const blocks = cols.filter((col) => wouldWin(board, col, PLAYER));
  if (blocks.length > 0 && Math.random() < 0.94) {
    return pickRandom(blocks);
  }

  const safe = cols.filter((col) => !givesOpponentWin(board, col, CPU, PLAYER));
  const pool = safe.length > 0 ? safe : cols;

  const scored = pool.map((col) => {
    const placed = dropDisc(board, col, CPU);
    const centerBonus = (3 - Math.abs(col - 3)) * 8;
    return { col, score: evaluate(placed.board, CPU) + centerBonus };
  });

  const best = Math.max(...scored.map((entry) => entry.score));
  const slack = best >= 80 ? 12 : 28;
  const good = scored.filter((entry) => entry.score >= best - slack);
  return pickRandom(good).col;
}

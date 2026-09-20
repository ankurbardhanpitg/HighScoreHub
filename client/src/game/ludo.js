export const BOARD_SIZE = 15;
export const TRACK_LEN = 52;
export const TOKEN_COUNT = 4;
export const YARD = -1;
export const HOME_START = 51;
export const FINISH = 56;
export const PLAYER = 'red';
export const POINTS_HOME = 25;
export const POINTS_CAPTURE = 10;
export const POINTS_WIN = 100;

export const TURN_ORDER = ['red', 'green', 'yellow', 'blue'];

export const TRACK = [
  [6, 1],
  [6, 2],
  [6, 3],
  [6, 4],
  [6, 5],
  [5, 6],
  [4, 6],
  [3, 6],
  [2, 6],
  [1, 6],
  [0, 6],
  [0, 7],
  [0, 8],
  [1, 8],
  [2, 8],
  [3, 8],
  [4, 8],
  [5, 8],
  [6, 9],
  [6, 10],
  [6, 11],
  [6, 12],
  [6, 13],
  [6, 14],
  [7, 14],
  [8, 14],
  [8, 13],
  [8, 12],
  [8, 11],
  [8, 10],
  [8, 9],
  [9, 8],
  [10, 8],
  [11, 8],
  [12, 8],
  [13, 8],
  [14, 8],
  [14, 7],
  [14, 6],
  [13, 6],
  [12, 6],
  [11, 6],
  [10, 6],
  [9, 6],
  [8, 5],
  [8, 4],
  [8, 3],
  [8, 2],
  [8, 1],
  [8, 0],
  [7, 0],
  [6, 0],
];

const SAFE_INDEXES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

export const PLAYERS = {
  red: {
    id: 'red',
    name: 'You',
    cpuName: 'Red',
    startIndex: 39,
    home: [
      [13, 7],
      [12, 7],
      [11, 7],
      [10, 7],
      [9, 7],
    ],
    yard: [
      [11, 2],
      [11, 3],
      [12, 2],
      [12, 3],
    ],
    finishCell: [8, 7],
  },
  green: {
    id: 'green',
    name: 'Green',
    cpuName: 'Green',
    startIndex: 0,
    home: [
      [7, 1],
      [7, 2],
      [7, 3],
      [7, 4],
      [7, 5],
    ],
    yard: [
      [2, 2],
      [2, 3],
      [3, 2],
      [3, 3],
    ],
    finishCell: [7, 6],
  },
  yellow: {
    id: 'yellow',
    name: 'Yellow',
    cpuName: 'Yellow',
    startIndex: 13,
    home: [
      [1, 7],
      [2, 7],
      [3, 7],
      [4, 7],
      [5, 7],
    ],
    yard: [
      [2, 11],
      [2, 12],
      [3, 11],
      [3, 12],
    ],
    finishCell: [6, 7],
  },
  blue: {
    id: 'blue',
    name: 'Blue',
    cpuName: 'Blue',
    startIndex: 26,
    home: [
      [7, 13],
      [7, 12],
      [7, 11],
      [7, 10],
      [7, 9],
    ],
    yard: [
      [11, 11],
      [11, 12],
      [12, 11],
      [12, 12],
    ],
    finishCell: [7, 8],
  },
};

function buildBoard() {
  const cells = Array.from({ length: BOARD_SIZE }, (_, row) =>
    Array.from({ length: BOARD_SIZE }, (_, col) => {
      let kind = 'path';
      let color = null;

      if (row >= 6 && row <= 8 && col >= 6 && col <= 8) {
        kind = 'center';
        if (row === 6 && col === 7) {
          color = 'yellow';
        } else if (row === 7 && col === 6) {
          color = 'green';
        } else if (row === 7 && col === 8) {
          color = 'blue';
        } else if (row === 8 && col === 7) {
          color = 'red';
        } else if (row === 7 && col === 7) {
          color = 'hub';
        }
      } else if (row <= 5 && col <= 5) {
        kind = 'yard';
        color = 'green';
      } else if (row <= 5 && col >= 9) {
        kind = 'yard';
        color = 'yellow';
      } else if (row >= 9 && col >= 9) {
        kind = 'yard';
        color = 'blue';
      } else if (row >= 9 && col <= 5) {
        kind = 'yard';
        color = 'red';
      }

      return { kind, color, safe: false, start: false, home: false, yardSlot: false };
    }),
  );

  for (const index of SAFE_INDEXES) {
    const [row, col] = TRACK[index];
    cells[row][col].safe = true;
  }

  for (const player of Object.values(PLAYERS)) {
    const [startRow, startCol] = TRACK[player.startIndex];
    cells[startRow][startCol].start = true;
    cells[startRow][startCol].color = player.id;
    cells[startRow][startCol].safe = true;

    for (const [row, col] of player.home) {
      cells[row][col].home = true;
      cells[row][col].color = player.id;
    }

    for (const [row, col] of player.yard) {
      cells[row][col].yardSlot = true;
    }
  }

  return cells;
}

export const BOARD = buildBoard();

export function nextPlayer(playerId) {
  const index = TURN_ORDER.indexOf(playerId);
  return TURN_ORDER[(index + 1) % TURN_ORDER.length];
}

export function rollDice() {
  return 1 + Math.floor(Math.random() * 6);
}

export function initialState() {
  const tokens = [];
  for (const playerId of TURN_ORDER) {
    for (let index = 0; index < TOKEN_COUNT; index += 1) {
      tokens.push({ playerId, index, steps: YARD });
    }
  }

  return {
    tokens,
    turn: PLAYER,
    consecutiveSixes: 0,
    winner: null,
    captures: { red: 0, green: 0, yellow: 0, blue: 0 },
  };
}

export function cellOf(token) {
  const player = PLAYERS[token.playerId];
  if (token.steps === YARD) {
    return player.yard[token.index];
  }
  if (token.steps === FINISH) {
    return player.finishCell;
  }
  if (token.steps >= HOME_START) {
    return player.home[token.steps - HOME_START];
  }
  return TRACK[(player.startIndex + token.steps) % TRACK_LEN];
}

export function tokensAtCell(tokens, row, col) {
  return tokens.filter((token) => {
    const [tokenRow, tokenCol] = cellOf(token);
    return tokenRow === row && tokenCol === col;
  });
}

function globalIndex(playerId, steps) {
  if (steps < 0 || steps >= HOME_START) {
    return null;
  }
  return (PLAYERS[playerId].startIndex + steps) % TRACK_LEN;
}

function occupantOnTrack(tokens, trackIndex) {
  return tokens.find((token) => globalIndex(token.playerId, token.steps) === trackIndex) || null;
}

function ownTokenAtSteps(tokens, playerId, steps) {
  return tokens.some((token) => token.playerId === playerId && token.steps === steps);
}

export function legalMoves(state, playerId, dice) {
  if (state.winner || dice < 1 || dice > 6) {
    return [];
  }

  const moves = [];

  for (const token of state.tokens) {
    if (token.playerId !== playerId) {
      continue;
    }

    if (token.steps === YARD) {
      if (dice !== 6 || ownTokenAtSteps(state.tokens, playerId, 0)) {
        continue;
      }
      const startIndex = PLAYERS[playerId].startIndex;
      const occupant = occupantOnTrack(state.tokens, startIndex);
      if (occupant && occupant.playerId !== playerId && SAFE_INDEXES.has(startIndex)) {
        continue;
      }
      moves.push({ tokenIndex: token.index, from: YARD, to: 0 });
      continue;
    }

    if (token.steps === FINISH) {
      continue;
    }

    const dest = token.steps + dice;
    if (dest > FINISH) {
      continue;
    }
    if (dest < FINISH && ownTokenAtSteps(state.tokens, playerId, dest)) {
      continue;
    }

    if (dest < HOME_START) {
      const destIndex = globalIndex(playerId, dest);
      const occupant = occupantOnTrack(state.tokens, destIndex);
      if (occupant && occupant.playerId !== playerId && SAFE_INDEXES.has(destIndex)) {
        continue;
      }
    }

    moves.push({ tokenIndex: token.index, from: token.steps, to: dest });
  }

  return moves;
}

export function registerRoll(state, dice) {
  const consecutiveSixes = dice === 6 ? state.consecutiveSixes + 1 : 0;

  if (dice === 6 && consecutiveSixes >= 3) {
    return {
      state: {
        ...state,
        consecutiveSixes: 0,
        turn: nextPlayer(state.turn),
      },
      forfeited: true,
    };
  }

  return {
    state: {
      ...state,
      consecutiveSixes,
    },
    forfeited: false,
  };
}

export function passTurn(state) {
  return {
    ...state,
    consecutiveSixes: 0,
    turn: nextPlayer(state.turn),
  };
}

export function applyMove(state, playerId, tokenIndex, dice) {
  const move = legalMoves(state, playerId, dice).find((entry) => entry.tokenIndex === tokenIndex);
  if (!move) {
    return null;
  }

  const tokens = state.tokens.map((token) => ({ ...token }));
  const token = tokens.find((entry) => entry.playerId === playerId && entry.index === tokenIndex);
  token.steps = move.to;

  let captured = null;
  if (move.to >= 0 && move.to < HOME_START) {
    const destIndex = globalIndex(playerId, move.to);
    if (!SAFE_INDEXES.has(destIndex)) {
      const victim = occupantOnTrack(
        tokens.filter((entry) => !(entry.playerId === playerId && entry.index === tokenIndex)),
        destIndex,
      );
      if (victim) {
        victim.steps = YARD;
        captured = { playerId: victim.playerId, index: victim.index };
      }
    }
  }

  const finished = move.to === FINISH;
  const captures = { ...state.captures };
  if (captured) {
    captures[playerId] += 1;
  }

  const homeCount = tokens.filter((entry) => entry.playerId === playerId && entry.steps === FINISH).length;
  const winner = homeCount === TOKEN_COUNT ? playerId : null;
  const extraTurn = !winner && (dice === 6 || Boolean(captured) || finished);
  const consecutiveSixes = dice === 6 ? state.consecutiveSixes : 0;

  return {
    state: {
      tokens,
      turn: extraTurn ? state.turn : nextPlayer(playerId),
      consecutiveSixes: extraTurn ? consecutiveSixes : 0,
      winner,
      captures,
    },
    move,
    captured,
    finished,
    extraTurn,
    cell: cellOf(token),
  };
}

function isThreatened(state, playerId, steps) {
  const trackIndex = globalIndex(playerId, steps);
  if (trackIndex == null || SAFE_INDEXES.has(trackIndex)) {
    return false;
  }

  return state.tokens.some((token) => {
    if (token.playerId === playerId || token.steps < 0 || token.steps >= HOME_START) {
      return false;
    }
    const from = globalIndex(token.playerId, token.steps);
    const distance = (trackIndex - from + TRACK_LEN) % TRACK_LEN;
    return distance >= 1 && distance <= 6;
  });
}

function scoreCpuMove(state, playerId, move) {
  let score = move.to + 6;

  if (move.from === YARD) {
    score += 72;
  }
  if (move.to === FINISH) {
    score += 220;
  } else if (move.to >= HOME_START) {
    score += 55;
  }

  if (move.to >= 0 && move.to < HOME_START) {
    const destIndex = globalIndex(playerId, move.to);
    if (SAFE_INDEXES.has(destIndex)) {
      score += 16;
    } else {
      const occupant = occupantOnTrack(state.tokens, destIndex);
      if (occupant && occupant.playerId !== playerId) {
        score += occupant.playerId === PLAYER ? 150 : 110;
      }
    }
  }

  if (move.from >= 0 && move.from < HOME_START && isThreatened(state, playerId, move.from)) {
    score += 28;
  }

  return score;
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function cpuMove(state, playerId, dice) {
  const moves = legalMoves(state, playerId, dice);
  if (moves.length === 0) {
    return null;
  }

  const scored = moves.map((move) => ({ move, score: scoreCpuMove(state, playerId, move) }));
  const best = Math.max(...scored.map((entry) => entry.score));
  const slack = best >= 180 ? 12 : 22;
  const good = scored.filter((entry) => entry.score >= best - slack);
  return pickRandom(good).move;
}

export function finishedCount(state, playerId) {
  return state.tokens.filter((token) => token.playerId === playerId && token.steps === FINISH).length;
}

export function scoreOf(state, playerId) {
  return finishedCount(state, playerId) * POINTS_HOME + state.captures[playerId] * POINTS_CAPTURE + (state.winner === playerId ? POINTS_WIN : 0);
}

export function playerLabel(playerId, { short = false } = {}) {
  if (playerId === PLAYER) {
    return short ? 'You' : 'You';
  }
  return PLAYERS[playerId][short ? 'cpuName' : 'name'];
}

export function cellLabel(row, col) {
  const meta = BOARD[row][col];
  if (meta.yardSlot) {
    return `${meta.color} yard`;
  }
  if (meta.kind === 'yard') {
    return `${meta.color} base`;
  }
  if (meta.home) {
    return `${meta.color} home path`;
  }
  if (meta.start) {
    return `${meta.color} start`;
  }
  if (meta.kind === 'center' && meta.color && meta.color !== 'hub') {
    return `${meta.color} home`;
  }
  if (meta.safe) {
    return 'safe square';
  }
  if (meta.kind === 'center') {
    return 'home triangle';
  }
  return `row ${row + 1}, column ${col + 1}`;
}

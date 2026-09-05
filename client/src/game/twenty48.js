export const SIZE = 4;

const VECTORS = {
  left: { row: 0, col: -1 },
  right: { row: 0, col: 1 },
  up: { row: -1, col: 0 },
  down: { row: 1, col: 0 },
};

let nextTileId = 1;

function emptyGrid() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
}

function withinBounds(cell) {
  return cell.row >= 0 && cell.row < SIZE && cell.col >= 0 && cell.col < SIZE;
}

function occupiedKey(row, col) {
  return `${row},${col}`;
}

function emptyCells(tiles) {
  const taken = new Set(
    tiles.filter((tile) => !tile.removing).map((tile) => occupiedKey(tile.row, tile.col)),
  );
  const cells = [];

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (!taken.has(occupiedKey(row, col))) {
        cells.push({ row, col });
      }
    }
  }

  return cells;
}

export function makeTile(value, row, col, extra = {}) {
  nextTileId += 1;
  return {
    id: extra.id ?? nextTileId,
    value,
    row,
    col,
    isNew: false,
    isMerged: false,
    removing: false,
    ...extra,
  };
}

export function addRandomTile(tiles, random = Math.random) {
  const cells = emptyCells(tiles);
  if (cells.length === 0) {
    return tiles;
  }

  const spot = cells[Math.floor(random() * cells.length)];
  const value = random() < 0.9 ? 2 : 4;
  return [...tiles, makeTile(value, spot.row, spot.col, { isNew: true })];
}

export function createInitialTiles(random = Math.random) {
  return addRandomTile(addRandomTile([], random), random);
}

function buildTraversals(vector) {
  const rows = [0, 1, 2, 3];
  const cols = [0, 1, 2, 3];
  if (vector.row === 1) {
    rows.reverse();
  }
  if (vector.col === 1) {
    cols.reverse();
  }
  return { rows, cols };
}

function findFarthest(grid, start, vector) {
  let previous = start;
  let cell = { row: start.row + vector.row, col: start.col + vector.col };

  while (withinBounds(cell) && !grid[cell.row][cell.col]) {
    previous = cell;
    cell = { row: previous.row + vector.row, col: previous.col + vector.col };
  }

  return {
    farthest: previous,
    nextCell: withinBounds(cell) ? cell : null,
  };
}

export function moveTiles(tiles, direction) {
  const vector = VECTORS[direction];
  if (!vector) {
    return { tiles, moved: false, scoreGained: 0, reached2048: false };
  }

  const next = tiles
    .filter((tile) => !tile.removing)
    .map((tile) => ({
      ...tile,
      isNew: false,
      isMerged: false,
      removing: false,
    }));

  const grid = emptyGrid();
  for (const tile of next) {
    grid[tile.row][tile.col] = tile;
  }

  const traversals = buildTraversals(vector);
  let moved = false;
  let scoreGained = 0;
  let reached2048 = false;

  for (const row of traversals.rows) {
    for (const col of traversals.cols) {
      const tile = grid[row][col];
      if (!tile) {
        continue;
      }

      const { farthest, nextCell } = findFarthest(grid, { row, col }, vector);
      const nextTile = nextCell ? grid[nextCell.row][nextCell.col] : null;

      if (nextTile && nextTile.value === tile.value && !nextTile.isMerged) {
        const mergedValue = tile.value * 2;
        nextTile.value = mergedValue;
        nextTile.isMerged = true;
        scoreGained += mergedValue;
        if (mergedValue >= 2048) {
          reached2048 = true;
        }

        grid[tile.row][tile.col] = null;
        tile.row = nextTile.row;
        tile.col = nextTile.col;
        tile.removing = true;
        moved = true;
      } else if (farthest.row !== tile.row || farthest.col !== tile.col) {
        grid[tile.row][tile.col] = null;
        tile.row = farthest.row;
        tile.col = farthest.col;
        grid[tile.row][tile.col] = tile;
        moved = true;
      }
    }
  }

  return { tiles: next, moved, scoreGained, reached2048 };
}

export function canMove(tiles) {
  const grid = emptyGrid();
  const live = tiles.filter((tile) => !tile.removing);

  for (const tile of live) {
    grid[tile.row][tile.col] = tile;
  }

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const tile = grid[row][col];
      if (!tile) {
        return true;
      }

      const right = col + 1 < SIZE ? grid[row][col + 1] : null;
      const down = row + 1 < SIZE ? grid[row + 1][col] : null;
      if ((right && right.value === tile.value) || (down && down.value === tile.value)) {
        return true;
      }
    }
  }

  return false;
}

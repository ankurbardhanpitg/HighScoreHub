import { randomInt } from 'crypto';
import { WebSocketServer } from 'ws';
import {
  TURN_ORDER,
  applyMove,
  dropPlayer,
  initialState,
  legalMoves,
  passTurn,
  registerRoll,
  rollDice,
} from '../../client/src/game/ludo.js';

const rooms = new Map();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_TTL_MS = 45 * 60 * 1000;
const WAITING_TTL_MS = 20 * 60 * 1000;
const EMPTY_TTL_MS = 2 * 60 * 1000;
const MAX_PLAYERS = 4;

function isOpen(ws) {
  return Boolean(ws) && ws.readyState === 1;
}

function sanitizeName(name) {
  const cleaned = String(name || '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .slice(0, 16);
  return cleaned || 'Guest';
}

export function sanitizePlayerId(id) {
  return String(id || '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 80);
}

export function normalizeRoomId(id) {
  return String(id || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
}

function makeRoomId() {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += CODE_CHARS[randomInt(CODE_CHARS.length)];
  }
  return code;
}

function emptySeats() {
  return { red: null, green: null, yellow: null, blue: null };
}

function colorOfPlayer(room, playerId) {
  return TURN_ORDER.find((color) => room.seats[color]?.id === playerId) || null;
}

function seatFor(room, playerId) {
  const color = colorOfPlayer(room, playerId);
  return color ? room.seats[color] : null;
}

function firstOpenColor(room) {
  return TURN_ORDER.find((color) => !room.seats[color]) || null;
}

function occupiedColors(room) {
  return TURN_ORDER.filter((color) => room.seats[color]);
}

function publicRoom(room) {
  const seats = {};
  for (const color of TURN_ORDER) {
    const seat = room.seats[color];
    seats[color] = seat
      ? {
          name: seat.name,
          connected: isOpen(seat.ws),
        }
      : null;
  }

  return {
    id: room.id,
    status: room.status,
    seats,
    hostColor: colorOfPlayer(room, room.hostId),
    playerCount: occupiedColors(room).length,
    game: room.game,
    dice: room.dice,
    phase: room.phase,
    lastMove: room.lastMove,
    lastEvent: room.lastEvent,
    result: room.result,
    reason: room.reason,
  };
}

function send(ws, payload) {
  if (!isOpen(ws)) {
    return;
  }
  ws.send(JSON.stringify(payload));
}

function sendState(room, color) {
  const seat = room.seats[color];
  if (!seat) {
    return;
  }
  send(seat.ws, {
    type: 'state',
    color,
    room: publicRoom(room),
  });
}

function broadcast(room) {
  for (const color of TURN_ORDER) {
    sendState(room, color);
  }
}

function allDisconnected(room) {
  return occupiedColors(room).every((color) => !isOpen(room.seats[color]?.ws));
}

function destroyRoom(roomId) {
  rooms.delete(roomId);
}

function touch(room) {
  room.lastActive = Date.now();
}

function beginMatch(room) {
  const active = occupiedColors(room);
  if (active.length < 2) {
    return 'Need at least two players to start';
  }

  room.game = initialState(active);
  room.status = 'playing';
  room.phase = 'roll';
  room.dice = null;
  room.lastMove = null;
  room.result = null;
  room.reason = null;
  room.lastEvent = `${room.seats[room.game.turn]?.name || 'Pink'} rolls first`;
  touch(room);
  broadcast(room);
  return null;
}

export function peekRoom(roomId) {
  return rooms.get(normalizeRoomId(roomId)) || null;
}

export function createRoom(playerId, name) {
  const id = sanitizePlayerId(playerId);
  if (!id) {
    throw new Error('Missing player');
  }

  for (const room of rooms.values()) {
    if (room.hostId === id && room.status === 'waiting' && occupiedColors(room).length === 1) {
      const hostSeat = room.seats.red;
      if (hostSeat) {
        hostSeat.name = sanitizeName(name);
      }
      touch(room);
      return room;
    }
  }

  let roomId = makeRoomId();
  while (rooms.has(roomId)) {
    roomId = makeRoomId();
  }

  const room = {
    id: roomId,
    status: 'waiting',
    hostId: id,
    seats: emptySeats(),
    game: initialState(TURN_ORDER),
    dice: null,
    phase: 'roll',
    lastMove: null,
    lastEvent: '',
    result: null,
    reason: null,
    createdAt: Date.now(),
    lastActive: Date.now(),
  };
  room.seats.red = { id, name: sanitizeName(name), ws: null };
  rooms.set(roomId, room);
  return room;
}

function joinRoom(ws, payload) {
  const roomId = normalizeRoomId(payload.roomId);
  const playerId = sanitizePlayerId(payload.playerId);
  const name = sanitizeName(payload.name);
  const room = rooms.get(roomId);

  if (!playerId) {
    send(ws, { type: 'error', message: 'Could not join this room.', fatal: true });
    return;
  }

  if (!room) {
    send(ws, {
      type: 'error',
      message: 'Room not found. Ask your friend for a new link.',
      fatal: true,
    });
    return;
  }

  const existingColor = colorOfPlayer(room, playerId);
  if (existingColor) {
    const existing = room.seats[existingColor];
    if (isOpen(existing.ws) && existing.ws !== ws) {
      send(existing.ws, {
        type: 'error',
        message: 'You joined this room in another tab.',
        fatal: true,
      });
      existing.ws.close();
    }
    existing.ws = ws;
    existing.name = name || existing.name;
    ws.ludo = { roomId, playerId };
    touch(room);
    broadcast(room);
    return;
  }

  if (room.status !== 'waiting') {
    send(ws, {
      type: 'error',
      message: 'This game already started. Ask your friend for a new link.',
      fatal: true,
    });
    return;
  }

  const color = firstOpenColor(room);
  if (!color) {
    send(ws, {
      type: 'error',
      message: 'This room is full. Ask your friend for a new link.',
      fatal: true,
    });
    return;
  }

  room.seats[color] = { id: playerId, name, ws };
  ws.ludo = { roomId, playerId };
  touch(room);

  if (occupiedColors(room).length >= MAX_PLAYERS) {
    beginMatch(room);
    return;
  }

  broadcast(room);
}

function handleRoll(room, playerId) {
  if (room.status !== 'playing' || room.result) {
    return 'The game is not in play';
  }

  const color = colorOfPlayer(room, playerId);
  if (!color) {
    return 'You are not in this room';
  }
  if (room.game.turn !== color) {
    return 'Wait for your turn';
  }
  if (room.phase !== 'roll') {
    return 'Pick a token to move';
  }

  const value = rollDice();
  const rolled = registerRoll(room.game, value);
  room.game = rolled.state;
  room.dice = value;

  if (rolled.forfeited) {
    room.phase = 'roll';
    room.lastEvent = 'Three 6s in a row — turn skipped';
    touch(room);
    broadcast(room);
    return null;
  }

  const moves = legalMoves(room.game, color, value);
  if (moves.length === 0) {
    if (value === 6) {
      room.phase = 'roll';
      room.lastEvent = 'No move for that 6 — roll again';
    } else {
      room.game = passTurn(room.game);
      room.phase = 'roll';
      room.lastEvent = 'No moves — next player';
    }
    touch(room);
    broadcast(room);
    return null;
  }

  room.phase = 'move';
  room.lastEvent = `Rolled a ${value}`;
  touch(room);
  broadcast(room);
  return null;
}

function handleMove(room, playerId, payload) {
  if (room.status !== 'playing' || room.result) {
    return 'The game is not in play';
  }

  const color = colorOfPlayer(room, playerId);
  if (!color) {
    return 'You are not in this room';
  }
  if (room.game.turn !== color) {
    return 'Wait for your turn';
  }
  if (room.phase !== 'move' || room.dice == null) {
    return 'Roll the dice first';
  }

  const tokenIndex = Number(payload.tokenIndex);
  if (!Number.isInteger(tokenIndex)) {
    return 'That move is not allowed';
  }

  const result = applyMove(room.game, color, tokenIndex, room.dice);
  if (!result) {
    return 'That move is not allowed';
  }

  room.game = result.state;
  room.lastMove = { playerId: color, tokenIndex };

  if (result.captured) {
    room.lastEvent = `${room.seats[color]?.name || 'A player'} sent a token home`;
  } else if (result.finished) {
    room.lastEvent = `${room.seats[color]?.name || 'A player'} got a token home`;
  }

  if (result.state.winner) {
    room.result = result.state.winner;
    room.reason = 'home';
    room.status = 'ended';
    room.phase = 'roll';
    room.lastEvent = `${room.seats[result.state.winner]?.name || 'A player'} wins!`;
  } else {
    room.phase = 'roll';
    if (!result.extraTurn) {
      room.dice = null;
    }
  }

  touch(room);
  broadcast(room);
  return null;
}

function handleStart(room, playerId) {
  if (room.hostId !== playerId) {
    return 'Only the host can start the game';
  }
  if (room.status !== 'waiting') {
    return 'The game already started';
  }
  return beginMatch(room);
}

function handleResign(room, playerId) {
  if (room.status !== 'playing' || room.result) {
    return 'The game is not in play';
  }

  const color = colorOfPlayer(room, playerId);
  if (!color) {
    return 'You are not in this room';
  }

  room.game = dropPlayer(room.game, color);
  if (room.game.turn !== color) {
    room.phase = 'roll';
    room.dice = null;
  }
  room.lastEvent = `${room.seats[color]?.name || 'A player'} left the race`;

  if (room.game.winner) {
    room.result = room.game.winner;
    room.reason = 'resign';
    room.status = 'ended';
    room.lastEvent = `${room.seats[room.game.winner]?.name || 'A player'} wins!`;
  }

  touch(room);
  broadcast(room);
  return null;
}

function handleRematch(room, playerId) {
  if (!seatFor(room, playerId)) {
    return 'You are not in this room';
  }
  if (occupiedColors(room).length < 2) {
    return 'Wait for a friend to join first';
  }
  return beginMatch(room);
}

function handleMessage(ws, data) {
  let payload;
  try {
    payload = JSON.parse(data.toString());
  } catch {
    send(ws, { type: 'error', message: 'Bad message' });
    return;
  }

  const type = payload?.type;
  if (type === 'join') {
    joinRoom(ws, payload);
    return;
  }

  const meta = ws.ludo;
  if (!meta) {
    send(ws, { type: 'error', message: 'Join a room first' });
    return;
  }

  const room = rooms.get(meta.roomId);
  if (!room) {
    send(ws, { type: 'error', message: 'Room not found. Ask your friend for a new link.', fatal: true });
    return;
  }

  let error = null;
  if (type === 'roll') {
    error = handleRoll(room, meta.playerId);
  } else if (type === 'move') {
    error = handleMove(room, meta.playerId, payload);
  } else if (type === 'start') {
    error = handleStart(room, meta.playerId);
  } else if (type === 'resign') {
    error = handleResign(room, meta.playerId);
  } else if (type === 'rematch') {
    error = handleRematch(room, meta.playerId);
  } else {
    error = 'Unknown message';
  }

  if (error) {
    send(ws, { type: 'error', message: error });
  }
}

function handleClose(ws) {
  const meta = ws.ludo;
  if (!meta) {
    return;
  }

  const room = rooms.get(meta.roomId);
  if (!room) {
    return;
  }

  const seat = seatFor(room, meta.playerId);
  if (seat && seat.ws === ws) {
    seat.ws = null;
  }

  touch(room);
  broadcast(room);
}

function sweepRooms() {
  const now = Date.now();
  for (const [id, room] of rooms) {
    const idle = now - room.lastActive;
    if (allDisconnected(room) && idle > EMPTY_TTL_MS) {
      destroyRoom(id);
      continue;
    }
    if (room.status === 'waiting' && idle > WAITING_TTL_MS) {
      destroyRoom(id);
      continue;
    }
    if (idle > ROOM_TTL_MS) {
      destroyRoom(id);
    }
  }
}

export function attachLudoSockets(clientOrigin) {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws, req) => {
    const origin = req.headers.origin;
    if (clientOrigin && origin && origin !== clientOrigin) {
      ws.close();
      return;
    }

    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    ws.on('message', (data) => handleMessage(ws, data));
    ws.on('close', () => handleClose(ws));
  });

  const beat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
    sweepRooms();
  }, 30000);

  wss.on('close', () => {
    clearInterval(beat);
  });

  return wss;
}

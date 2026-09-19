import { randomInt } from 'crypto';
import { WebSocketServer } from 'ws';
import {
  applyMove,
  BLACK,
  findMove,
  getStatus,
  initialState,
  WHITE,
} from '../../client/src/game/chess.js';

const rooms = new Map();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_TTL_MS = 45 * 60 * 1000;
const WAITING_TTL_MS = 20 * 60 * 1000;
const EMPTY_TTL_MS = 2 * 60 * 1000;

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

function colorOfPlayer(room, playerId) {
  if (room.host?.id === playerId) {
    return WHITE;
  }
  if (room.guest?.id === playerId) {
    return BLACK;
  }
  return null;
}

function seatFor(room, playerId) {
  if (room.host?.id === playerId) {
    return room.host;
  }
  if (room.guest?.id === playerId) {
    return room.guest;
  }
  return null;
}

function publicRoom(room) {
  return {
    id: room.id,
    status: room.status,
    names: {
      w: room.host?.name || 'White',
      b: room.guest?.name || '',
    },
    connected: {
      w: isOpen(room.host?.ws),
      b: isOpen(room.guest?.ws),
    },
    game: room.game,
    lastMove: room.lastMove,
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

function sendState(room, seat) {
  if (!seat) {
    return;
  }
  send(seat.ws, {
    type: 'state',
    color: seat === room.host ? WHITE : BLACK,
    room: publicRoom(room),
  });
}

function broadcast(room) {
  sendState(room, room.host);
  sendState(room, room.guest);
}

function bothDisconnected(room) {
  return !isOpen(room.host?.ws) && !isOpen(room.guest?.ws);
}

function destroyRoom(roomId) {
  rooms.delete(roomId);
}

function touch(room) {
  room.lastActive = Date.now();
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
    if (room.host?.id === id && !room.guest && room.status === 'waiting') {
      room.host.name = sanitizeName(name);
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
    host: { id, name: sanitizeName(name), ws: null },
    guest: null,
    game: initialState(),
    lastMove: null,
    result: null,
    reason: null,
    createdAt: Date.now(),
    lastActive: Date.now(),
  };
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

  const existing = seatFor(room, playerId);
  if (existing) {
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
    ws.chess = { roomId, playerId };
    touch(room);
    broadcast(room);
    return;
  }

  if (!room.guest) {
    room.guest = { id: playerId, name, ws };
    room.status = room.result ? 'ended' : 'playing';
    ws.chess = { roomId, playerId };
    touch(room);
    broadcast(room);
    return;
  }

  send(ws, {
    type: 'error',
    message: 'This room already has two players. Ask your friend for a new link.',
    fatal: true,
  });
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

  const from = Number(payload.from);
  const to = Number(payload.to);
  const promo = payload.promo || undefined;
  if (!Number.isInteger(from) || !Number.isInteger(to)) {
    return 'That move is not allowed';
  }

  const move = findMove(room.game, from, to, promo);
  if (!move) {
    return 'That move is not allowed';
  }

  room.game = applyMove(room.game, move);
  room.lastMove = { from: move.from, to: move.to };

  const status = getStatus(room.game);
  if (status.result) {
    room.result = status.result;
    room.reason = status.reason;
    room.status = 'ended';
  }

  touch(room);
  broadcast(room);
  return null;
}

function handleResign(room, playerId) {
  if (room.status !== 'playing' || room.result) {
    return 'The game is not in play';
  }

  const color = colorOfPlayer(room, playerId);
  if (!color) {
    return 'You are not in this room';
  }

  room.result = color === WHITE ? BLACK : WHITE;
  room.reason = 'resign';
  room.status = 'ended';
  touch(room);
  broadcast(room);
  return null;
}

function handleRematch(room, playerId) {
  if (!seatFor(room, playerId)) {
    return 'You are not in this room';
  }
  if (!room.guest) {
    return 'Wait for your friend to join first';
  }

  room.game = initialState();
  room.lastMove = null;
  room.result = null;
  room.reason = null;
  room.status = 'playing';
  touch(room);
  broadcast(room);
  return null;
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

  const meta = ws.chess;
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
  if (type === 'move') {
    error = handleMove(room, meta.playerId, payload);
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
  const meta = ws.chess;
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
    if (bothDisconnected(room) && idle > EMPTY_TTL_MS) {
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

export function attachChessSockets(httpServer, clientOrigin) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/chess' });

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

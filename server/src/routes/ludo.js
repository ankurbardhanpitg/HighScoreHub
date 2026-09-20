import { Router } from 'express';
import { createRoom, peekRoom, sanitizePlayerId } from '../ludoRooms.js';

const router = Router();

router.post('/rooms', (req, res) => {
  const playerId = sanitizePlayerId(req.body?.playerId);
  const name = req.body?.name;

  if (!playerId) {
    return res.status(400).json({ error: 'Missing player' });
  }

  try {
    const room = createRoom(playerId, name);
    return res.json({ roomId: room.id });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Could not make a room' });
  }
});

router.get('/rooms/:roomId', (req, res) => {
  const room = peekRoom(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found. Ask your friend for a new link.' });
  }

  return res.json({
    roomId: room.id,
    status: room.status,
    waiting: room.status === 'waiting',
    playerCount: ['red', 'green', 'yellow', 'blue'].filter((color) => room.seats[color]).length,
  });
});

export default router;

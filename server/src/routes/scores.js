import { Router } from 'express';
import Score from '../models/Score.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const GAMES = ['flappy', '2048', 'whack', 'pong', 'breakout'];

function parseScore(value) {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return Number(value);
  }
  return NaN;
}

function parseGame(value) {
  if (value == null || value === '') {
    return 'flappy';
  }
  if (typeof value === 'string' && GAMES.includes(value)) {
    return value;
  }
  return null;
}

function gameFilter(game) {
  if (game === 'flappy') {
    return { $or: [{ game: 'flappy' }, { game: { $exists: false } }, { game: null }] };
  }
  return { game };
}

function validateScorePayload(req, res, next) {
  const numericScore = parseScore(req.body?.score);
  const game = parseGame(req.body?.game);

  if (!Number.isFinite(numericScore)) {
    return res.status(400).json({ error: 'score must be a number' });
  }

  if (numericScore < 0) {
    return res.status(400).json({ error: 'score cannot be negative' });
  }

  if (!game) {
    return res.status(400).json({ error: 'unknown game' });
  }

  req.body.score = numericScore;
  req.body.game = game;
  next();
}

router.post('/', requireAuth, validateScorePayload, async (req, res) => {
  try {
    const entry = await Score.create({
      playerName: req.user.username,
      userId: req.user._id,
      score: req.body.score,
      game: req.body.game,
    });
    return res.status(201).json(entry);
  } catch (error) {
    console.error('Failed to save score', error);
    return res.status(500).json({ error: 'Failed to save score' });
  }
});

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

router.get('/top', requireAuth, async (req, res) => {
  try {
    const game = parseGame(req.query.game);
    if (!game) {
      return res.status(400).json({ error: 'unknown game' });
    }

    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
    const filter = gameFilter(game);
    const total = await Score.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);
    const currentPage = totalPages > 0 ? Math.min(page, totalPages) : 1;
    const skip = (currentPage - 1) * limit;

    const scores = await Score.find(filter)
      .sort({ createdAt: -1, score: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.json({
      scores,
      game,
      page: currentPage,
      limit,
      total,
      totalPages,
    });
  } catch (error) {
    console.error('Failed to load leaderboard', error);
    return res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

export default router;

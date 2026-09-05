import { Router } from 'express';
import Score from '../models/Score.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function parseScore(value) {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return Number(value);
  }
  return NaN;
}

function validateScorePayload(req, res, next) {
  const numericScore = parseScore(req.body?.score);

  if (!Number.isFinite(numericScore)) {
    return res.status(400).json({ error: 'score must be a number' });
  }

  if (numericScore < 0) {
    return res.status(400).json({ error: 'score cannot be negative' });
  }

  req.body.score = numericScore;
  next();
}

router.post('/', requireAuth, validateScorePayload, async (req, res) => {
  try {
    const entry = await Score.create({
      playerName: req.user.username,
      userId: req.user._id,
      score: req.body.score,
    });
    return res.status(201).json(entry);
  } catch (error) {
    console.error('Failed to save score', error);
    return res.status(500).json({ error: 'Failed to save score' });
  }
});

router.get('/top', async (_req, res) => {
  try {
    const scores = await Score.find()
      .sort({ score: -1, createdAt: -1 })
      .limit(10)
      .lean();
    return res.json(scores);
  } catch (error) {
    console.error('Failed to load leaderboard', error);
    return res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

export default router;

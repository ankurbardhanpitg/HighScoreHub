import mongoose from 'mongoose';

const scoreSchema = new mongoose.Schema({
  playerName: {
    type: String,
    required: true,
    trim: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  score: {
    type: Number,
    required: true,
  },
  game: {
    type: String,
    enum: ['flappy', '2048', 'whack', 'pong', 'breakout'],
    default: 'flappy',
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index for leaderboard: newest first, then higher score
scoreSchema.index({ createdAt: -1, score: -1 });
scoreSchema.index({ game: 1, createdAt: -1, score: -1 });

const Score = mongoose.model('Score', scoreSchema);

export default Score;

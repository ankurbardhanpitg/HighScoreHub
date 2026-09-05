import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export function getJwtSecret() {
  return process.env.JWT_SECRET || 'dev-flappy-jwt-secret-change-me';
}

export function signAuthToken(user) {
  return jwt.sign(
    { userId: user._id.toString() },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
}

export function toPublicUser(user) {
  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
  };
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!token) {
    return res.status(401).json({ error: 'Sign in required' });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());
    const user = await User.findById(payload.userId).select('username email');

    if (!user) {
      return res.status(401).json({ error: 'Account no longer exists' });
    }

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

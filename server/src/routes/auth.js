import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { requireAuth, signAuthToken, toPublicUser } from '../middleware/auth.js';

const router = Router();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

function normalizeSignup(body) {
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  return { username, email, password };
}

function normalizeSignin(body) {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  return { email, password };
}

router.post('/signup', async (req, res) => {
  const { username, email, password } = normalizeSignup(req.body ?? {});

  if (!USERNAME_PATTERN.test(username)) {
    return res.status(400).json({
      error: 'username must be 3-20 characters and use only letters, numbers, or underscores',
    });
  }

  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ error: 'A valid email is required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, passwordHash });
    const token = signAuthToken(user);

    return res.status(201).json({
      token,
      user: toPublicUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'account';
      return res.status(409).json({ error: `${field} is already taken` });
    }

    console.error('Failed to sign up', error);
    return res.status(500).json({ error: 'Failed to create account' });
  }
});

router.post('/signin', async (req, res) => {
  const { email, password } = normalizeSignin(req.body ?? {});

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    return res.json({
      token: signAuthToken(user),
      user: toPublicUser(user),
    });
  } catch (error) {
    console.error('Failed to sign in', error);
    return res.status(500).json({ error: 'Failed to sign in' });
  }
});

router.get('/me', requireAuth, (req, res) => {
  return res.json({ user: toPublicUser(req.user) });
});

export default router;

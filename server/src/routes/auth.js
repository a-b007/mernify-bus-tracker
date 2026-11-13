import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDB } from '../config/db.js';
import env from '../config/env.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../models/schemas.js';
import { loginLimiter } from '../middleware/rateLimit.js';

const router = Router();

// POST /api/auth/register
router.post('/register', validate(registerSchema), async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = getDB();

    const existing = await db.collection('users').findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'User already exists with this email' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Default first user to admin or check role
    const count = await db.collection('users').countDocuments();
    const role = count === 0 ? 'admin' : 'viewer';

    const newUser = {
      email,
      passwordHash,
      role,
      createdAt: new Date(),
    };

    await db.collection('users').insertOne(newUser);

    const token = jwt.sign(
      { email, role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    return res.status(201).json({
      token,
      user: { email, role },
    });
  } catch (err) {
    console.error('[auth] Register error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = getDB();

    const user = await db.collection('users').findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { email: user.email, role: user.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    return res.json({
      token,
      user: { email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('[auth] Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

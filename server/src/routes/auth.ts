import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import { z } from 'zod';
import { config } from '../config.js';
import * as queries from '../db/queries.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function generateTokens(userId: string, role: string) {
  const accessToken = jwt.sign({ userId, role }, config.jwtSecret, {
    expiresIn: config.jwtAccessExpiry,
  });
  const refreshToken = jwt.sign({ userId, role, type: 'refresh' }, config.jwtSecret, {
    expiresIn: config.jwtRefreshExpiry,
  });
  return { accessToken, refreshToken };
}

// POST /auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password } = registerSchema.parse(req.body);

    const existing = queries.getUserByEmail(email);
    if (existing) {
      res.status(409).json({ success: false, error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = queries.createUser(email, passwordHash);

    const tokens = generateTokens(user.id, user.role);
    res.status(201).json({
      success: true,
      data: {
        ...tokens,
        user: queries.userToPublic(user),
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.errors[0]?.message || 'Validation error' });
      return;
    }
    throw err;
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = queries.getUserByEmail(email);
    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const tokens = generateTokens(user.id, user.role);
    res.json({
      success: true,
      data: {
        ...tokens,
        user: queries.userToPublic(user),
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.errors[0]?.message || 'Validation error' });
      return;
    }
    throw err;
  }
});

// POST /auth/refresh
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) {
    res.status(400).json({ success: false, error: 'Refresh token required' });
    return;
  }

  try {
    const decoded = jwt.verify(refreshToken, config.jwtSecret) as { userId: string; role: string; type?: string };
    if (decoded.type !== 'refresh') {
      res.status(401).json({ success: false, error: 'Invalid token type' });
      return;
    }

    const tokens = generateTokens(decoded.userId, decoded.role);
    res.json({ success: true, data: tokens });
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
  }
});

// POST /auth/2fa/setup
router.post('/2fa/setup', requireAuth, async (req: AuthRequest, res) => {
  const user = queries.getUser(req.userId!);
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }

  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(user.email, 'Helio', secret);

  try {
    const qrCodeUrl = await qrcode.toDataURL(otpauth);
    // Store secret temporarily (not enabled yet)
    queries.updateUserTotp(user.id, secret, false);
    res.json({ success: true, data: { secret, qrCodeUrl } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to generate QR code' });
  }
});

// POST /auth/2fa/verify
router.post('/2fa/verify', requireAuth, async (req: AuthRequest, res) => {
  const { token } = req.body as { token?: string };
  if (!token) {
    res.status(400).json({ success: false, error: 'Token required' });
    return;
  }

  const user = queries.getUser(req.userId!);
  if (!user || !user.totpSecret) {
    res.status(400).json({ success: false, error: '2FA not set up' });
    return;
  }

  const isValid = authenticator.verify({ token, secret: user.totpSecret });
  if (!isValid) {
    res.status(400).json({ success: false, error: 'Invalid token' });
    return;
  }

  queries.updateUserTotp(user.id, user.totpSecret, true);
  res.json({ success: true, data: { totpEnabled: true } });
});

// POST /auth/2fa/disable
router.post('/2fa/disable', requireAuth, (req: AuthRequest, res) => {
  queries.updateUserTotp(req.userId!, '', false);
  res.json({ success: true, data: { totpEnabled: false } });
});

// GET /auth/me
router.get('/me', requireAuth, (req: AuthRequest, res) => {
  const user = queries.getUser(req.userId!);
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }
  res.json({ success: true, data: queries.userToPublic(user) });
});

export default router;

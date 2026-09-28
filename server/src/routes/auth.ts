import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import { z } from 'zod';
import { config } from '../config.js';
import * as queries from '../db/queries.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();

// Used for unknown users so login timing does not reveal whether an account exists
const DUMMY_HASH = bcrypt.hashSync('helio-dummy-password', 12);

// Accept tokens from the previous/next 30s window (clock drift)
authenticator.options = { window: 1 };

const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').max(200);

const setupSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: passwordSchema,
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
  totpToken: z.string().trim().optional(),
});

function generateTokens(userId: string, role: string) {
  const accessToken = jwt.sign({ userId, role, type: 'access' }, config.jwtSecret, {
    expiresIn: config.jwtAccessExpiry as SignOptions['expiresIn'],
  });
  const refreshToken = jwt.sign({ userId, role, type: 'refresh' }, config.jwtSecret, {
    expiresIn: config.jwtRefreshExpiry as SignOptions['expiresIn'],
  });
  return { accessToken, refreshToken };
}

// GET /auth/setup — is the initial admin setup still required?
router.get('/setup', (_req, res) => {
  res.json({ success: true, data: { needsSetup: queries.countUsers() === 0 } });
});

/**
 * POST /auth/setup (alias: /auth/register)
 * Creates the first user as admin. Only possible while no user exists —
 * afterwards new users are created by an admin (POST /users).
 */
async function setupHandler(req: import('express').Request, res: import('express').Response) {
  try {
    if (queries.countUsers() > 0) {
      res.status(403).json({ success: false, error: 'Setup already completed. Ask an admin to create an account for you.' });
      return;
    }
    const { email, password } = setupSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(password, 12);

    // Re-check after the (slow) hash to avoid a race between two setup requests
    if (queries.countUsers() > 0) {
      res.status(403).json({ success: false, error: 'Setup already completed' });
      return;
    }
    const user = queries.createUser(email, passwordHash, 'admin');

    res.status(201).json({
      success: true,
      data: { ...generateTokens(user.id, user.role), user: queries.userToPublic(user) },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.errors[0]?.message || 'Validation error' });
      return;
    }
    throw err;
  }
}
router.post('/setup', setupHandler);
router.post('/register', setupHandler);

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password, totpToken } = loginSchema.parse(req.body);

    const user = queries.getUserByEmail(email);
    // Always run bcrypt to keep timing similar for unknown users
    const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    if (user.totpEnabled && user.totpSecret) {
      if (!totpToken) {
        res.status(401).json({ success: false, error: '2FA code required', data: { requires2fa: true } });
        return;
      }
      if (!authenticator.verify({ token: totpToken, secret: user.totpSecret })) {
        res.status(401).json({ success: false, error: 'Invalid 2FA code', data: { requires2fa: true } });
        return;
      }
    }

    res.json({
      success: true,
      data: { ...generateTokens(user.id, user.role), user: queries.userToPublic(user) },
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
    const decoded = jwt.verify(refreshToken, config.jwtSecret) as { userId: string; type?: string };
    if (decoded.type !== 'refresh') {
      res.status(401).json({ success: false, error: 'Invalid token type' });
      return;
    }
    const user = queries.getUser(decoded.userId);
    if (!user) {
      res.status(401).json({ success: false, error: 'User no longer exists' });
      return;
    }
    res.json({ success: true, data: generateTokens(user.id, user.role) });
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
  }
});

// POST /auth/password — change own password
router.post('/password', requireAuth, async (req: AuthRequest, res) => {
  const parsed = z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message || 'Validation error' });
    return;
  }
  const user = queries.getUser(req.userId!);
  if (!user || !(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
    res.status(400).json({ success: false, error: 'Current password is wrong' });
    return;
  }
  queries.updateUserPassword(user.id, await bcrypt.hash(parsed.data.newPassword, 12));
  res.json({ success: true, data: null });
});

// POST /auth/2fa/setup
router.post('/2fa/setup', requireAuth, async (req: AuthRequest, res) => {
  const user = queries.getUser(req.userId!);
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }
  if (user.totpEnabled) {
    res.status(400).json({ success: false, error: '2FA is already enabled' });
    return;
  }

  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(user.email, 'Helio', secret);

  try {
    const qrCodeUrl = await qrcode.toDataURL(otpauth);
    // Store secret (not enabled until verified)
    queries.updateUserTotp(user.id, secret, false);
    res.json({ success: true, data: { secret, qrCodeUrl } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to generate QR code' });
  }
});

// POST /auth/2fa/verify
router.post('/2fa/verify', requireAuth, (req: AuthRequest, res) => {
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

  if (!authenticator.verify({ token: token.trim(), secret: user.totpSecret })) {
    res.status(400).json({ success: false, error: 'Invalid token' });
    return;
  }

  queries.updateUserTotp(user.id, user.totpSecret, true);
  res.json({ success: true, data: { totpEnabled: true } });
});

// POST /auth/2fa/disable — requires a valid current code
router.post('/2fa/disable', requireAuth, (req: AuthRequest, res) => {
  const { token } = req.body as { token?: string };
  const user = queries.getUser(req.userId!);
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }
  if (user.totpEnabled && user.totpSecret) {
    if (!token || !authenticator.verify({ token: token.trim(), secret: user.totpSecret })) {
      res.status(400).json({ success: false, error: 'Invalid 2FA code' });
      return;
    }
  }
  queries.updateUserTotp(user.id, null, false);
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

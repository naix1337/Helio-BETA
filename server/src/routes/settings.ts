import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import * as queries from '../db/queries.js';

const router = Router();

// Settings are managed via env vars (config.ts) and user profile
// This route handles user-level settings

// GET /settings/profile
router.get('/profile', requireAuth, (req: AuthRequest, res) => {
  const user = queries.getUser(req.userId!);
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }
  res.json({ success: true, data: queries.userToPublic(user) });
});

export default router;

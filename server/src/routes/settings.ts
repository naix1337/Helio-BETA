import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import * as queries from '../db/queries.js';
import { config } from '../config.js';

const router = Router();

// Server-side settings are managed via environment variables (see .env.example)

// GET /settings/profile
router.get('/profile', requireAuth, (req: AuthRequest, res) => {
  const user = queries.getUser(req.userId!);
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }
  res.json({ success: true, data: queries.userToPublic(user) });
});

// GET /settings/server — read-only view of the effective server configuration
router.get('/server', requireAuth, (_req, res) => {
  res.json({
    success: true,
    data: {
      version: config.version,
      retentionRawDays: config.retention.rawHeartbeatsDays,
      backup: {
        enabled: config.backup.enabled,
        dir: config.backup.dir,
        retentionDays: config.backup.retentionDays,
      },
      allowPrivateNotificationTargets: config.allowPrivateNotificationTargets,
      ntfyDefaultServer: config.ntfyDefaultServer,
    },
  });
});

export default router;

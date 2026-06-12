import { Router } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { requireAuth, requireAdmin, type AuthRequest } from '../middleware/auth.js';
import * as queries from '../db/queries.js';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.enum(['read', 'write'])).default(['read']),
});

// GET /api-keys
router.get('/', requireAuth, (req: AuthRequest, res) => {
  const keys = queries.listApiKeys(req.userId!);
  res.json({ success: true, data: keys });
});

// POST /api-keys
router.post('/', requireAuth, (req: AuthRequest, res) => {
  try {
    const input = createSchema.parse(req.body);

    // Generate key: pk_ prefix + 48 chars of entropy
    const plainKey = 'pk_' + randomBytes(32).toString('hex');
    const keyHash = createHash('sha256').update(plainKey).digest('hex');
    const keyPrefix = plainKey.slice(0, 8) + '...';

    const key = queries.createApiKey(req.userId!, input.name, keyHash, keyPrefix, input.scopes);

    res.status(201).json({
      success: true,
      data: {
        ...key,
        plainKey, // Only returned once on creation
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: err.errors.map((e) => e.message).join(', ') });
      return;
    }
    throw err;
  }
});

// DELETE /api-keys/:id
router.delete('/:id', requireAuth, (req: AuthRequest, res) => {
  const key = queries.getApiKey(req.params['id']!);
  if (!key || key.userId !== req.userId) {
    res.status(404).json({ success: false, error: 'API key not found' });
    return;
  }
  queries.deleteApiKey(req.params['id']!);
  res.json({ success: true, data: null });
});

export default router;

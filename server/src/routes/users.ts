import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { requireAuth, requireAdmin, type AuthRequest } from '../middleware/auth.js';
import * as queries from '../db/queries.js';

/**
 * User management (admin only).
 * Roles: admin = full access, user = read-only dashboard access.
 */
const router = Router();

router.use(requireAuth, requireAdmin);

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  role: z.enum(['admin', 'user']).default('user'),
});

const updateSchema = z.object({
  role: z.enum(['admin', 'user']).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200).optional(),
});

router.get('/', (_req, res) => {
  res.json({ success: true, data: queries.listUsers().map(queries.userToPublic) });
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors.map((e) => e.message).join(', ') });
    return;
  }
  if (queries.getUserByEmail(parsed.data.email)) {
    res.status(409).json({ success: false, error: 'Email already registered' });
    return;
  }
  const user = queries.createUser(parsed.data.email, await bcrypt.hash(parsed.data.password, 12), parsed.data.role);
  res.status(201).json({ success: true, data: queries.userToPublic(user) });
});

router.patch('/:id', async (req: AuthRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors.map((e) => e.message).join(', ') });
    return;
  }
  const user = queries.getUser(req.params['id']!);
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }
  if (parsed.data.role && parsed.data.role !== user.role) {
    if (user.role === 'admin' && queries.countAdmins() <= 1) {
      res.status(400).json({ success: false, error: 'Cannot demote the last admin' });
      return;
    }
    queries.updateUserRole(user.id, parsed.data.role);
  }
  if (parsed.data.password) {
    queries.updateUserPassword(user.id, await bcrypt.hash(parsed.data.password, 12));
  }
  res.json({ success: true, data: queries.userToPublic(queries.getUser(user.id)!) });
});

router.delete('/:id', (req: AuthRequest, res) => {
  const user = queries.getUser(req.params['id']!);
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }
  if (user.id === req.userId) {
    res.status(400).json({ success: false, error: 'You cannot delete your own account' });
    return;
  }
  if (user.role === 'admin' && queries.countAdmins() <= 1) {
    res.status(400).json({ success: false, error: 'Cannot delete the last admin' });
    return;
  }
  queries.deleteUser(user.id);
  res.json({ success: true, data: null });
});

export default router;

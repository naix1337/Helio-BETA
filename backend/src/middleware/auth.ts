// helio-app/backend/src/middleware/auth.ts
import { randomBytes } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { UserRole } from '../types.js';

let JWT_SECRET: string;
if (process.env.JWT_SECRET) {
  JWT_SECRET = process.env.JWT_SECRET;
} else {
  JWT_SECRET = randomBytes(32).toString('hex');
  console.warn(
    '[auth] WARNING: JWT_SECRET env var is not set. ' +
    'A random secret has been generated — all tokens will be invalidated on restart. ' +
    'Set JWT_SECRET in your environment for production use.',
  );
}

export { JWT_SECRET };

// ---------------------------------------------------------------------------
// Module augmentation — extend Express Request so req.user is typed
// ---------------------------------------------------------------------------
export interface AuthUser {
  userId: number;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// ---------------------------------------------------------------------------
// Role hierarchy
// ---------------------------------------------------------------------------
const ROLE_RANK: Record<UserRole, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
};

// ---------------------------------------------------------------------------
// requireAuth — verifies the Bearer JWT and attaches req.user
// ---------------------------------------------------------------------------
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser;

    // Basic shape validation
    if (
      typeof payload.userId !== 'number' ||
      typeof payload.email !== 'string' ||
      !['admin', 'editor', 'viewer'].includes(payload.role)
    ) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    req.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// ---------------------------------------------------------------------------
// requireRole — factory that enforces a minimum role level.
// Must be placed AFTER requireAuth in the middleware chain.
// ---------------------------------------------------------------------------
export function requireRole(minimumRole: UserRole) {
  return function roleGuard(req: Request, res: Response, next: NextFunction): void {
    const user = req.user;

    if (!user) {
      // requireAuth was not applied — treat as unauthorised rather than forbidden
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (ROLE_RANK[user.role] < ROLE_RANK[minimumRole]) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    next();
  };
}

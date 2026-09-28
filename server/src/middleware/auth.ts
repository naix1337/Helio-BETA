import { createHash } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { getApiKeyByHash, getUser, touchApiKey } from '../db/queries.js';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  authMethod?: 'jwt' | 'api-key';
}

type Access = 'read' | 'write';

interface AccessTokenPayload {
  userId: string;
  role: string;
  type?: string;
}

/** Verify an access token (refresh tokens are rejected). Returns null if invalid. */
export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AccessTokenPayload;
    if (decoded.type && decoded.type !== 'access') return null;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Authenticate via `Authorization: Bearer <jwt>` or `X-API-Key: <key>`.
 *
 * - read:  any authenticated user / API key with "read" scope
 * - write: admin users only; API keys additionally need the "write" scope
 *
 * The user's role is always loaded from the DB so role changes and
 * deleted users take effect immediately.
 */
function authenticate(access: Access) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const decoded = verifyAccessToken(authHeader.slice(7));
      if (!decoded) {
        res.status(401).json({ success: false, error: 'Invalid or expired token' });
        return;
      }
      userId = decoded.userId;
      req.authMethod = 'jwt';
    } else {
      const apiKey = req.headers['x-api-key'];
      if (typeof apiKey === 'string' && apiKey) {
        const key = getApiKeyByHash(createHash('sha256').update(apiKey).digest('hex'));
        if (!key) {
          res.status(401).json({ success: false, error: 'Invalid API key' });
          return;
        }
        if (!key.scopes.includes(access)) {
          res.status(403).json({ success: false, error: `API key missing required scope: ${access}` });
          return;
        }
        touchApiKey(key.id);
        userId = key.userId;
        req.authMethod = 'api-key';
      }
    }

    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required (Bearer token or X-API-Key header)' });
      return;
    }

    const user = getUser(userId);
    if (!user) {
      res.status(401).json({ success: false, error: 'User no longer exists' });
      return;
    }

    req.userId = user.id;
    req.userRole = user.role;

    if (access === 'write' && user.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Admin access required' });
      return;
    }

    next();
  };
}

/** Any authenticated user (JWT or API key with read scope) */
export const requireAuth = authenticate('read');

/** Admin user (JWT) or admin-owned API key with write scope */
export const requireWrite = authenticate('write');

/** Backwards-compatible alias */
export function requireAuthOrApiKey(...scopes: Access[]) {
  return authenticate(scopes.includes('write') ? 'write' : 'read');
}

/** Use after requireAuth — admin role only */
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.userRole !== 'admin') {
    res.status(403).json({ success: false, error: 'Admin access required' });
    return;
  }
  next();
}

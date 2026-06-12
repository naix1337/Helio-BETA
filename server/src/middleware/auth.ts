import { createHash } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { getApiKeyByHash, touchApiKey } from '../db/queries.js';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

/**
 * JWT Bearer token auth — used by route handlers.
 * Sets req.userId and req.userRole on success.
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { userId: string; role: string };
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

/**
 * Combined auth middleware: tries JWT first, then X-API-Key header.
 * Use on routes that should accept both authentication methods.
 */
export function requireAuthOrApiKey(...scopes: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    // Try JWT first
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const decoded = jwt.verify(token, config.jwtSecret) as { userId: string; role: string };
        req.userId = decoded.userId;
        req.userRole = decoded.role;
        next();
        return;
      } catch {
        res.status(401).json({ success: false, error: 'Invalid or expired token' });
        return;
      }
    }

    // Fallback: X-API-Key
    const apiKey = req.headers['x-api-key'] as string;
    if (apiKey) {
      const hash = createHash('sha256').update(apiKey).digest('hex');
      const key = getApiKeyByHash(hash);
      if (!key) {
        res.status(401).json({ success: false, error: 'Invalid API key' });
        return;
      }
      if (scopes.length > 0) {
        const hasScope = scopes.some((s) => key.scopes.includes(s));
        if (!hasScope) {
          res.status(403).json({ success: false, error: `API key missing required scope: ${scopes.join(', ')}` });
          return;
        }
      }
      touchApiKey(key.id);
      req.userId = key.userId;
      next();
      return;
    }

    res.status(401).json({ success: false, error: 'Authentication required (Bearer token or X-API-Key header)' });
  };
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.userRole !== 'admin') {
    res.status(403).json({ success: false, error: 'Admin access required' });
    return;
  }
  next();
}

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export function errorHandler(err: Error & { status?: number; type?: string }, req: Request, res: Response, _next: NextFunction): void {
  // Malformed JSON bodies etc.
  if (err.type === 'entity.parse.failed') {
    res.status(400).json({ success: false, error: 'Invalid JSON body' });
    return;
  }
  if (err.type === 'entity.too.large') {
    res.status(413).json({ success: false, error: 'Request body too large' });
    return;
  }
  // SQLite UNIQUE constraint → conflict
  if ((err as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
    res.status(409).json({ success: false, error: 'Entry already exists' });
    return;
  }

  logger.error({ err, method: req.method, path: req.originalUrl }, 'Unhandled error');
  res.status(err.status && err.status >= 400 && err.status < 600 ? err.status : 500).json({
    success: false,
    error: process.env['NODE_ENV'] === 'production' ? 'Internal server error' : err.message,
  });
}

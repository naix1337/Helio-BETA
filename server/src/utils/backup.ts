/**
 * Automatic database backup module.
 *
 * Creates daily SQLite backups and prunes backups older than
 * the configured retention period. Backups are file-level copies
 * (safe because SQLite uses WAL mode).
 */

import { copyFileSync, mkdirSync, readdirSync, statSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config.js';
import { logger } from './logger.js';

const BACKUP_DIR = process.env['BACKUP_DIR'] || '/app/data/backups';
const RETENTION_DAYS = parseInt(process.env['BACKUP_RETENTION_DAYS'] || '30', 10);

export function backupDatabase(): void {
  if (process.env['BACKUP_ENABLED'] !== 'true') {
    logger.debug('Backups disabled via BACKUP_ENABLED');
    return;
  }

  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
    logger.info({ dir: BACKUP_DIR }, 'Created backup directory');
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(BACKUP_DIR, `helio-${timestamp}.db`);

  try {
    copyFileSync(config.dbPath, backupPath);
    logger.info({ backupPath }, 'Database backup created');

    // Prune old backups
    const files = readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('helio-') && f.endsWith('.db'))
      .map((f) => ({
        name: f,
        path: join(BACKUP_DIR, f),
        mtime: statSync(join(BACKUP_DIR, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime); // newest first

    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    let pruned = 0;

    for (const file of files) {
      if (file.mtime < cutoff) {
        unlinkSync(file.path);
        pruned++;
      }
    }

    if (pruned > 0) {
      logger.info({ count: pruned }, 'Pruned old backups');
    }
  } catch (err) {
    logger.error({ err }, 'Database backup failed');
  }
}

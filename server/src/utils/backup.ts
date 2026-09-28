/**
 * Automatic database backup module.
 *
 * Uses SQLite's online backup API (safe while the DB is in use, including
 * WAL contents) and prunes backups older than the configured retention.
 */

import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config.js';
import { getDb } from '../db/connection.js';
import { logger } from './logger.js';

export async function backupDatabase(): Promise<void> {
  if (!config.backup.enabled) return;

  const dir = config.backup.dir;
  try {
    mkdirSync(dir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = join(dir, `helio-${timestamp}.db`);

    await getDb().backup(backupPath);
    logger.info({ backupPath }, 'Database backup created');

    const cutoff = Date.now() - config.backup.retentionDays * 24 * 60 * 60 * 1000;
    let pruned = 0;
    for (const f of readdirSync(dir)) {
      if (!f.startsWith('helio-') || !f.endsWith('.db')) continue;
      const p = join(dir, f);
      if (statSync(p).mtimeMs < cutoff) {
        unlinkSync(p);
        pruned++;
      }
    }
    if (pruned > 0) logger.info({ count: pruned }, 'Pruned old backups');
  } catch (err) {
    logger.error({ err }, 'Database backup failed');
  }
}

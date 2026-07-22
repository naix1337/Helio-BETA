import type { IChecker, CheckResult } from './IChecker.js';
import type { PushConfig } from '@pulse/shared';
import { registerChecker } from './registry.js';
import { getDb } from '../db/connection.js';

/**
 * Push Checker
 *
 * Instead of actively checking, this expects external services to HTTP GET
 * a push URL generated from the monitor's token. The engine stores the last
 * push timestamp. If no push arrives within interval + grace period, the
 * monitor is marked DOWN.
 *
 * Push timestamps are persisted in SQLite to survive restarts (migration 012).
 */
export class PushChecker implements IChecker {
  readonly type = 'push';

  async check(config: unknown): Promise<CheckResult> {
    const cfg = config as PushConfig;

    if (!cfg.token) {
      return { status: 'DOWN', latencyMs: null, message: 'No push token configured', statusCode: null };
    }

    return { status: 'UP', latencyMs: 0, message: 'Push token valid', statusCode: null };
  }
}

registerChecker(new PushChecker());

/* ============================================================
   Push Tracker — persisted in SQLite
   ============================================================ */

/**
 * Record a push hit for the given token.
 * Persists the current timestamp in SQLite.
 */
export function recordPushHit(token: string): void {
  getDb().prepare(`
    INSERT INTO push_tracking (token, last_push_at, created_at)
    VALUES (?, datetime('now'), datetime('now'))
    ON CONFLICT(token) DO UPDATE SET last_push_at = datetime('now')
  `).run(token);
}

/**
 * Get the last push timestamp for a token, in milliseconds since epoch.
 * Returns undefined if the token has never been pushed to.
 */
export function getLastPushTime(token: string): number | undefined {
  const row = getDb().prepare(
    'SELECT last_push_at FROM push_tracking WHERE token = ?'
  ).get(token) as { last_push_at: string } | undefined;

  if (!row) return undefined;
  return new Date(row.last_push_at + 'Z').getTime();
}

/**
 * Check whether a push token's grace period has expired.
 * A token is considered expired if no push has been received within
 * (intervalSeconds + graceSeconds) of the current time.
 */
export function isPushExpired(
  token: string,
  intervalSeconds: number,
  graceSeconds: number,
): boolean {
  const last = getLastPushTime(token);
  if (last === undefined) return true;
  const elapsed = (Date.now() - last) / 1000;
  return elapsed > intervalSeconds + graceSeconds;
}

/**
 * Delete push tracking entries older than the given retention period.
 * Called during aggregation.
 */
export function prunePushTracking(retentionDays: number = 30): number {
  const result = getDb().prepare(
    "DELETE FROM push_tracking WHERE last_push_at < datetime('now', ? || ' days')"
  ).run(`-${retentionDays}`);
  return result.changes;
}

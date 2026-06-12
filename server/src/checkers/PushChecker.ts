import type { IChecker, CheckResult } from './IChecker.js';
import type { PushConfig, Heartbeat } from '@pulse/shared';
import { registerChecker } from './registry.js';

/**
 * Push Checker
 *
 * Instead of actively checking, this expects external services to HTTP GET
 * a push URL generated from the monitor's token. The engine stores the last
 * push timestamp. If no push arrives within interval + grace period, the
 * monitor is marked DOWN.
 */
export class PushChecker implements IChecker {
  readonly type = 'push';

  async check(config: unknown): Promise<CheckResult> {
    const cfg = config as PushConfig;

    // The real check logic is handled by the engine via recordPushHit() and checking recency.
    // Here we just validate the config and return a check based on last push time.

    if (!cfg.token) {
      return { status: 'DOWN', latencyMs: null, message: 'No push token configured', statusCode: null };
    }

    // This check is a NO-OP for the actual push logic;
    // the engine manages push state separately via PushTracker.
    return { status: 'UP', latencyMs: 0, message: 'Push token valid', statusCode: null };
  }
}

registerChecker(new PushChecker());

/* ---------- Push Tracker (used by the engine) ---------- */

const pushTimestamps = new Map<string, number>();

export function recordPushHit(token: string): void {
  pushTimestamps.set(token, Date.now());
}

export function getLastPushTime(token: string): number | undefined {
  return pushTimestamps.get(token);
}

export function isPushExpired(token: string, intervalSeconds: number, graceSeconds: number): boolean {
  const last = pushTimestamps.get(token);
  if (last === undefined) return true;
  const elapsed = (Date.now() - last) / 1000;
  return elapsed > intervalSeconds + graceSeconds;
}

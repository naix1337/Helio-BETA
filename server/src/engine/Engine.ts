import type { Monitor, MonitorStatus, NotificationPayload } from '@pulse/shared';
import type { StatusChangePayload, HeartbeatPayload } from '@pulse/shared';

// Import all checkers to register them in the registry (side effects)
import '../checkers/HttpChecker.js';
import '../checkers/TcpChecker.js';
import '../checkers/PingChecker.js';
import '../checkers/DnsChecker.js';
import '../checkers/SslChecker.js';
import '../checkers/PushChecker.js';

import type { CheckResult } from '../checkers/IChecker.js';
import { getChecker } from '../checkers/registry.js';
import { pruneContainerMetrics } from '../db/containerQueries.js';
import { startScheduler, stopScheduler, stopAllSchedulers } from './Scheduler.js';
import { recordPushHit, getLastPushTime, prunePushTracking } from '../checkers/PushChecker.js';
import * as queries from '../db/queries.js';
import { config } from '../config.js';
import { dispatchNotification } from '../notifications/index.js';
import { logger } from '../utils/logger.js';

type StatusChangeHandler = (payload: StatusChangePayload) => void;
type HeartbeatHandler = (payload: HeartbeatPayload) => void;

const statusChangeHandlers: StatusChangeHandler[] = [];
const heartbeatHandlers: HeartbeatHandler[] = [];

/** When the scheduler for a monitor was (re)started — reference point for push timeouts */
const scheduledAt = new Map<string, number>();

/** Timestamp of the last status change per monitor — used for "was down for X" in notifications */
const lastStatusChangeAt = new Map<string, number>();

export function onStatusChange(handler: StatusChangeHandler): void {
  statusChangeHandlers.push(handler);
}

export function onHeartbeat(handler: HeartbeatHandler): void {
  heartbeatHandlers.push(handler);
}

function emitStatusChange(payload: StatusChangePayload): void {
  for (const h of statusChangeHandlers) {
    try { h(payload); } catch (err) { logger.error({ err }, 'Status change handler failed'); }
  }
}

function emitHeartbeat(payload: HeartbeatPayload): void {
  for (const h of heartbeatHandlers) {
    try { h(payload); } catch (err) { logger.error({ err }, 'Heartbeat handler failed'); }
  }
}

/**
 * Whether a status transition should trigger notifications.
 * - any → DOWN / DEGRADED (if it actually changed)
 * - DOWN / DEGRADED → UP (recovery)
 * PENDING → UP (first successful check) does not notify.
 */
function shouldNotify(prev: MonitorStatus, next: MonitorStatus): boolean {
  if (prev === next) return false;
  if (next === 'DOWN' || next === 'DEGRADED') return true;
  if (next === 'UP') return prev === 'DOWN' || prev === 'DEGRADED';
  return false;
}

/**
 * Persist a check result: write heartbeat, update status on transitions,
 * emit WS events and dispatch notifications.
 */
function applyResult(monitorId: string, result: CheckResult): void {
  // Re-read state right before writing — the check may have taken a while
  // and the monitor could have been paused or deleted in the meantime.
  const monitor = queries.getMonitor(monitorId);
  if (!monitor || monitor.status === 'PAUSED') return;

  const prev = monitor.status;
  const next = result.status;

  const hb = queries.createHeartbeat(monitor.id, next, result.latencyMs, result.message, result.statusCode);

  if (prev !== next) {
    queries.updateMonitorStatus(monitor.id, next);
    const now = Date.now();
    const since = lastStatusChangeAt.get(monitor.id);
    lastStatusChangeAt.set(monitor.id, now);

    emitStatusChange({
      monitorId: monitor.id,
      monitorName: monitor.name,
      previousStatus: prev,
      newStatus: next,
      latencyMs: result.latencyMs ?? undefined,
      message: result.message ?? undefined,
    });

    if (shouldNotify(prev, next)) {
      void dispatchForMonitor(monitor, prev, next, hb, since ? now - since : undefined);
    }
  }

  emitHeartbeat({ monitorId: monitor.id, heartbeat: hb });
}

/**
 * Run a single check for a monitor, with optional retry logic.
 * The monitor is always loaded fresh from the DB so config/status changes
 * take effect without restarting the scheduler.
 */
async function runCheck(monitorId: string): Promise<void> {
  const monitor = queries.getMonitor(monitorId);
  if (!monitor || monitor.status === 'PAUSED') {
    stopMonitorEngine(monitorId);
    return;
  }

  // Skip checks while the monitor is in a maintenance window
  if (queries.isInMaintenance(monitor.id)) return;

  if (monitor.type === 'push') {
    checkPushTimeout(monitor);
    return;
  }

  const checker = getChecker(monitor.type);
  if (!checker) {
    logger.error({ monitorId: monitor.id, type: monitor.type }, 'No checker for monitor type');
    return;
  }

  const configData = (monitor.config as { data?: unknown }).data ?? monitor.config;

  let result: CheckResult | null = null;
  const maxRetries = monitor.retries ?? 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      result = await checker.check(configData);
    } catch (err) {
      result = { status: 'DOWN', latencyMs: null, message: err instanceof Error ? err.message : 'Check failed', statusCode: null };
    }

    if (result.status === 'UP') break;

    if (attempt < maxRetries) {
      logger.debug({ monitorId: monitor.id, attempt: attempt + 1, maxRetries }, 'Check failed, retrying...');
      await new Promise((resolve) => setTimeout(resolve, Math.min(5000 * (attempt + 1), 30000)));
    }
  }

  if (result) applyResult(monitor.id, result);
}

/**
 * Push monitors: mark DOWN when no push arrived within interval + grace.
 */
function checkPushTimeout(monitor: Monitor): void {
  const cfg = ((monitor.config as { data?: { token?: string; graceSeconds?: number } }).data ?? {});
  if (!cfg.token) {
    applyResult(monitor.id, { status: 'DOWN', latencyMs: null, message: 'No push token configured', statusCode: null });
    return;
  }

  const grace = cfg.graceSeconds ?? 60;
  const lastPush = getLastPushTime(cfg.token) ?? 0;
  const reference = Math.max(lastPush, scheduledAt.get(monitor.id) ?? 0);
  const elapsedSec = (Date.now() - reference) / 1000;

  if (elapsedSec > monitor.intervalSeconds + grace) {
    applyResult(monitor.id, {
      status: 'DOWN',
      latencyMs: null,
      message: lastPush
        ? `No push received for ${Math.round(elapsedSec)}s (interval ${monitor.intervalSeconds}s + grace ${grace}s)`
        : 'No push received yet',
      statusCode: null,
    });
  }
}

/**
 * Dispatch notifications for a status transition (fire and forget).
 */
async function dispatchForMonitor(
  monitor: Monitor,
  previousStatus: MonitorStatus,
  newStatus: MonitorStatus,
  hb: { latencyMs: number | null; message: string | null; timestamp: string },
  previousStatusDurationMs?: number,
): Promise<void> {
  const notifications = queries.getNotificationsForMonitor(monitor.id);
  if (notifications.length === 0) return;

  const payload: NotificationPayload = {
    monitorName: monitor.name,
    monitorId: monitor.id,
    status: newStatus,
    latencyMs: hb.latencyMs ?? undefined,
    errorMessage: hb.message ?? undefined,
    timestamp: hb.timestamp,
    previousStatus,
    previousStatusDurationMs,
  };

  await Promise.all(notifications.map(async (notif) => {
    try {
      const ok = await dispatchNotification(notif, payload);
      if (!ok) logger.warn({ notificationId: notif.id, provider: notif.provider }, 'Notification was not delivered');
    } catch (err) {
      logger.error({ notificationId: notif.id, err }, 'Failed to dispatch notification');
    }
  }));
}

/* ============================================================
   Engine lifecycle
   ============================================================ */

function schedule(monitor: Monitor): void {
  scheduledAt.set(monitor.id, Date.now());
  startScheduler(monitor.id, Math.max(20, monitor.intervalSeconds), () => runCheck(monitor.id));
}

export function startEngine(): void {
  const monitors = queries.listMonitors();
  let started = 0;

  for (const monitor of monitors) {
    if (monitor.status === 'PAUSED') continue;
    schedule(monitor);
    started++;
  }

  logger.info({ count: started }, 'Engine started');
}

/** (Re)start the scheduler for a monitor — call after create/update/resume. */
export function startMonitorEngine(monitor: Monitor): void {
  stopScheduler(monitor.id);
  if (monitor.status === 'PAUSED') return;
  schedule(monitor);
  logger.debug({ monitorId: monitor.id, name: monitor.name }, 'Monitor engine started');
}

export function stopMonitorEngine(monitorId: string): void {
  stopScheduler(monitorId);
  scheduledAt.delete(monitorId);
}

export function stopEngine(): void {
  stopAllSchedulers();
  scheduledAt.clear();
  logger.info('All monitors stopped');
}

/* ============================================================
   Push handling (external endpoint)
   ============================================================ */

export interface PushHitOptions {
  status?: 'up' | 'down';
  msg?: string;
  ping?: number;
}

/**
 * Handle an incoming push (GET/POST /api/push/:token).
 * Returns false if no push monitor with that token exists.
 */
export function handlePushHit(token: string, opts: PushHitOptions = {}): boolean {
  const monitor = queries.findPushMonitorByToken(token);
  if (!monitor) return false;
  if (monitor.status === 'PAUSED') return true;

  recordPushHit(token);

  const isDown = opts.status === 'down';
  applyResult(monitor.id, {
    status: isDown ? 'DOWN' : 'UP',
    latencyMs: opts.ping !== undefined && Number.isFinite(opts.ping) ? opts.ping : null,
    message: opts.msg ? opts.msg.slice(0, 500) : isDown ? 'Push reported DOWN' : 'Push received',
    statusCode: null,
  });
  return true;
}

/* ============================================================
   Heartbeat Aggregation
   ============================================================ */

export async function runAggregation(): Promise<void> {
  const monitors = queries.listMonitors();
  const hourMs = 60 * 60 * 1000;
  const currentHour = Math.floor(Date.now() / hourMs) * hourMs;

  // (Re-)aggregate the last 3 completed hours — idempotent via unique index
  for (const monitor of monitors) {
    for (let i = 1; i <= 3; i++) {
      const from = new Date(currentHour - i * hourMs).toISOString();
      const to = new Date(currentHour - (i - 1) * hourMs).toISOString();
      queries.aggregateHour(monitor.id, from, to);
    }
  }

  const pruned = queries.pruneRawHeartbeats(config.retention.rawHeartbeatsDays);
  const prunedPush = prunePushTracking(Math.max(30, config.retention.rawHeartbeatsDays));
  const prunedContainers = pruneContainerMetrics(config.retention.rawHeartbeatsDays);

  logger.debug(
    { prunedHeartbeats: pruned, prunedPush, prunedContainers },
    'Aggregation complete',
  );
}

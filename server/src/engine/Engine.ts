import type { Monitor, MonitorStatus } from '@pulse/shared';
import type { WsEvent, StatusChangePayload, HeartbeatPayload } from '@pulse/shared';

// Import all checkers to register them in the registry (side effects)
import '../checkers/HttpChecker.js';
import '../checkers/TcpChecker.js';
import '../checkers/PingChecker.js';
import '../checkers/DnsChecker.js';
import '../checkers/SslChecker.js';
import '../checkers/PushChecker.js';

import { getChecker } from '../checkers/registry.js';
import { startScheduler, stopScheduler, stopAllSchedulers, isMonitorScheduled } from './Scheduler.js';
import { recordPushHit, getLastPushTime, isPushExpired } from '../checkers/PushChecker.js';
import * as queries from '../db/queries.js';
import { config } from '../config.js';
import { dispatchNotification } from '../notifications/index.js';

type StatusChangeHandler = (payload: StatusChangePayload) => void;
type HeartbeatHandler = (payload: HeartbeatPayload) => void;

const statusChangeHandlers: StatusChangeHandler[] = [];
const heartbeatHandlers: HeartbeatHandler[] = [];

export function onStatusChange(handler: StatusChangeHandler): void {
  statusChangeHandlers.push(handler);
}

export function onHeartbeat(handler: HeartbeatHandler): void {
  heartbeatHandlers.push(handler);
}

function emitStatusChange(payload: StatusChangePayload): void {
  for (const h of statusChangeHandlers) h(payload);
}

function emitHeartbeat(payload: HeartbeatPayload): void {
  for (const h of heartbeatHandlers) h(payload);
}

/**
 * Run a single check for a monitor.
 */
async function runCheck(monitor: Monitor): Promise<void> {
  const checker = getChecker(monitor.type);
  if (!checker) {
    console.error(`[engine] No checker for monitor type: ${monitor.type} (${monitor.id})`);
    return;
  }

  // Check if monitor is in maintenance window
  const inMaintenance = queries.isInMaintenance(monitor.id);
  if (inMaintenance) return;

  // Get the checker's config data
  const configData = (monitor.config as { data: unknown }).data ?? monitor.config;

  // Run the check
  const result = await checker.check(configData);

  // Handle push monitoring specially
  if (monitor.type === 'push') {
    const pushConfig = configData as { token?: string; graceSeconds?: number };
    if (pushConfig.token) {
      const lastPush = getLastPushTime(pushConfig.token);
      const grace = pushConfig.graceSeconds ?? 60;
      const expired = isPushExpired(pushConfig.token, monitor.intervalSeconds, grace);

      if (expired && monitor.status === 'UP') {
        // Transition to DOWN
        const hb = queries.createHeartbeat(monitor.id, 'DOWN', null, 'No push received within interval + grace', null);
        queries.updateMonitorStatus(monitor.id, 'DOWN');
        emitStatusChange({
          monitorId: monitor.id,
          monitorName: monitor.name,
          previousStatus: monitor.status,
          newStatus: 'DOWN',
          message: 'Push timeout',
        });
        emitHeartbeat({ monitorId: monitor.id, heartbeat: hb });
        await dispatchForMonitor(monitor, monitor.status, 'DOWN', hb);
      } else if (!expired && monitor.status !== 'UP') {
        // Recovered
        const hb = queries.createHeartbeat(monitor.id, 'UP', 0, 'Push received', null);
        queries.updateMonitorStatus(monitor.id, 'UP');
        emitStatusChange({
          monitorId: monitor.id,
          monitorName: monitor.name,
          previousStatus: monitor.status,
          newStatus: 'UP',
          message: 'Push recovered',
        });
        emitHeartbeat({ monitorId: monitor.id, heartbeat: hb });
        await dispatchForMonitor(monitor, monitor.status, 'UP', hb);
      } else {
        // No transition, just record
        const status = expired ? 'DOWN' : 'UP';
        const hb = queries.createHeartbeat(monitor.id, status, 0, expired ? 'Push timeout' : 'Push OK', null);
        emitHeartbeat({ monitorId: monitor.id, heartbeat: hb });
      }
      return;
    }
  }

  if (result.status === 'UP' && (monitor.status === 'DOWN' || monitor.status === 'PENDING')) {
    // DOWN → UP transition
    const hb = queries.createHeartbeat(monitor.id, 'UP', result.latencyMs, result.message, result.statusCode);
    queries.updateMonitorStatus(monitor.id, 'UP');
    emitStatusChange({
      monitorId: monitor.id,
      monitorName: monitor.name,
      previousStatus: monitor.status,
      newStatus: 'UP',
      latencyMs: result.latencyMs ?? undefined,
      message: result.message ?? undefined,
    });
    emitHeartbeat({ monitorId: monitor.id, heartbeat: hb });
    await dispatchForMonitor(monitor, monitor.status, 'UP', hb);
  } else if ((result.status === 'DOWN' || result.status === 'DEGRADED') && monitor.status === 'UP') {
    // UP → DOWN/DEGRADED transition
    const hb = queries.createHeartbeat(monitor.id, result.status, result.latencyMs, result.message, result.statusCode);
    queries.updateMonitorStatus(monitor.id, result.status);
    emitStatusChange({
      monitorId: monitor.id,
      monitorName: monitor.name,
      previousStatus: monitor.status,
      newStatus: result.status,
      latencyMs: result.latencyMs ?? undefined,
      message: result.message ?? undefined,
    });
    emitHeartbeat({ monitorId: monitor.id, heartbeat: hb });
    await dispatchForMonitor(monitor, monitor.status, result.status, hb);
  } else if (result.status === 'DEGRADED' && monitor.status !== result.status) {
    // Any → DEGRADED
    const hb = queries.createHeartbeat(monitor.id, 'DEGRADED', result.latencyMs, result.message, result.statusCode);
    queries.updateMonitorStatus(monitor.id, 'DEGRADED');
    emitStatusChange({
      monitorId: monitor.id,
      monitorName: monitor.name,
      previousStatus: monitor.status,
      newStatus: 'DEGRADED',
      latencyMs: result.latencyMs ?? undefined,
      message: result.message ?? undefined,
    });
    emitHeartbeat({ monitorId: monitor.id, heartbeat: hb });
  } else {
    // No status transition, just record heartbeat
    const hb = queries.createHeartbeat(monitor.id, result.status, result.latencyMs, result.message, result.statusCode);
    emitHeartbeat({ monitorId: monitor.id, heartbeat: hb });
  }
}

/**
 * Dispatch notifications for a status transition.
 */
async function dispatchForMonitor(monitor: Monitor, previousStatus: MonitorStatus, newStatus: MonitorStatus, hb: { latencyMs: number | null; message: string | null; timestamp: string }): Promise<void> {
  const notifications = queries.getNotificationsForMonitor(monitor.id);
  const payload = {
    monitorName: monitor.name,
    monitorId: monitor.id,
    status: newStatus,
    latencyMs: hb.latencyMs ?? undefined,
    errorMessage: hb.message ?? undefined,
    timestamp: hb.timestamp,
    previousStatus,
  };

  for (const notif of notifications) {
    try {
      await dispatchNotification(notif, payload);
    } catch (err) {
      console.error(`[engine] Failed to dispatch notification ${notif.id}:`, err);
    }
  }
}

/* ============================================================
   Engine lifecycle
   ============================================================ */

export function startEngine(): void {
  const monitors = queries.listMonitors();
  let started = 0;

  for (const monitor of monitors) {
    if (monitor.status === 'PAUSED') continue;
    // Don't start push monitors via scheduler; they're push-based
    if (monitor.type === 'push') {
      // Still schedule a periodic check for push timeout
      startScheduler(monitor.id, Math.max(20, monitor.intervalSeconds), () => runCheck(monitor));
      started++;
      continue;
    }
    startScheduler(monitor.id, Math.max(20, monitor.intervalSeconds), () => runCheck(monitor));
    started++;
  }

  console.log(`[engine] Started monitoring ${started} monitors`);
}

export function startMonitorEngine(monitor: Monitor): void {
  if (monitor.status === 'PAUSED') return;
  if (isMonitorScheduled(monitor.id)) return;
  startScheduler(monitor.id, Math.max(20, monitor.intervalSeconds), () => runCheck(monitor));
  console.log(`[engine] Started monitoring: ${monitor.name} (${monitor.id})`);
}

export function stopMonitorEngine(monitorId: string): void {
  stopScheduler(monitorId);
}

export function stopEngine(): void {
  stopAllSchedulers();
  console.log('[engine] All monitors stopped');
}

/* ============================================================
   Push handling (external endpoint)
   ============================================================ */

export function handlePushHit(token: string): void {
  recordPushHit(token);

  // Find monitor with this push token and create an UP heartbeat
  const monitors = queries.listMonitors();
  const monitor = monitors.find((m) => {
    if (m.type !== 'push') return false;
    const cfg = m.config as { data: { token?: string } };
    return cfg.data?.token === token;
  });

  if (monitor) {
    const hb = queries.createHeartbeat(monitor.id, 'UP', 0, 'Push received', null);
    if (monitor.status === 'DOWN' || monitor.status === 'PENDING') {
      queries.updateMonitorStatus(monitor.id, 'UP');
      emitStatusChange({
        monitorId: monitor.id,
        monitorName: monitor.name,
        previousStatus: monitor.status,
        newStatus: 'UP',
        message: 'Push recovered',
      });
    }
    emitHeartbeat({ monitorId: monitor.id, heartbeat: hb });
  }
}

/* ============================================================
   Heartbeat Aggregation
   ============================================================ */

export async function runAggregation(): Promise<void> {
  const monitors = queries.listMonitors();

  for (const monitor of monitors) {
    // Hourly aggregation
    const now = new Date();
    const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0).toISOString();

    const stats = queries.count24hHeartbeats(monitor.id);
    const recentHeartbeats = queries.getRecentHeartbeatsForSparkline(monitor.id, 1000);
    const latencies = recentHeartbeats
      .filter((h) => h.latencyMs !== null)
      .map((h) => h.latencyMs as number);

    if (latencies.length > 0) {
      const avgLat = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const minLat = Math.min(...latencies);
      const maxLat = Math.max(...latencies);
      const uptimePct = stats.total > 0 ? ((stats.total - stats.failed) / stats.total) * 100 : 100;

      queries.createUptimeAggregation({
        monitorId: monitor.id,
        period: 'hourly',
        timestamp: hourStart,
        avgLatencyMs: Math.round(avgLat * 100) / 100,
        minLatencyMs: minLat,
        maxLatencyMs: maxLat,
        uptimePercent: Math.round(uptimePct * 100) / 100,
        totalChecks: stats.total,
        failedChecks: stats.failed,
      });
    }
  }

  // Prune old heartbeats
  const pruned = queries.pruneRawHeartbeats(config.retention.rawHeartbeatsDays);
  console.log(`[engine] Aggregation complete, pruned ${pruned} old heartbeats`);
}

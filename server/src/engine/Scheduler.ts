/**
 * Per-monitor interval scheduler with jitter.
 *
 * Each monitor gets its own interval timer that fires at its configured
 * interval. The first run is delayed by up to 10% random jitter to prevent
 * a thundering herd when many monitors start at the same time.
 *
 * Concurrent execution is prevented via the `running` flag — if a check
 * takes longer than its interval, the next tick is skipped.
 */

import { logger } from '../utils/logger.js';

interface ScheduledTask {
  monitorId: string;
  intervalSeconds: number;
  timer: ReturnType<typeof setInterval> | null;
  startTimer: ReturnType<typeof setTimeout> | null;
  running: boolean;
  lastCheckAt: number | null;
}

const tasks = new Map<string, ScheduledTask>();

export function startScheduler(
  monitorId: string,
  intervalSeconds: number,
  fn: () => Promise<void>,
): void {
  stopScheduler(monitorId);

  const task: ScheduledTask = {
    monitorId,
    intervalSeconds,
    timer: null,
    startTimer: null,
    running: false,
    lastCheckAt: null,
  };

  const run = async () => {
    if (task.running) {
      logger.warn({ monitorId }, 'Check skipped — previous still running');
      return;
    }
    task.running = true;
    try {
      await fn();
      task.lastCheckAt = Date.now();
    } catch (err) {
      logger.error({ monitorId, err }, 'Scheduler run failed');
    } finally {
      task.running = false;
    }
  };

  tasks.set(monitorId, task);

  // First check shortly after start (with jitter), then at the fixed interval
  const jitterMs = Math.min(Math.random() * intervalSeconds * 1000 * 0.1, 5000);
  task.startTimer = setTimeout(() => {
    task.startTimer = null;
    if (tasks.get(monitorId) !== task) return;
    void run();
    task.timer = setInterval(run, intervalSeconds * 1000);
  }, jitterMs);
}

export function stopScheduler(monitorId: string): void {
  const existing = tasks.get(monitorId);
  if (existing?.startTimer) clearTimeout(existing.startTimer);
  if (existing?.timer) clearInterval(existing.timer);
  tasks.delete(monitorId);
}

export function stopAllSchedulers(): void {
  for (const id of Array.from(tasks.keys())) {
    stopScheduler(id);
  }
}

export function getScheduledMonitorIds(): string[] {
  return Array.from(tasks.keys());
}

export function isMonitorScheduled(monitorId: string): boolean {
  return tasks.has(monitorId);
}

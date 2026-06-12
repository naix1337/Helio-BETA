/**
 * Per-monitor interval scheduler.
 * Each monitor gets its own interval timer that fires at its configured interval.
 */

interface ScheduledTask {
  monitorId: string;
  intervalSeconds: number;
  timer: ReturnType<typeof setInterval> | null;
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
    running: false,
    lastCheckAt: null,
  };

  const run = async () => {
    if (task.running) return;
    task.running = true;
    try {
      await fn();
      task.lastCheckAt = Date.now();
    } finally {
      task.running = false;
    }
  };

  // Schedule recurring execution
  task.timer = setInterval(run, intervalSeconds * 1000);
  tasks.set(monitorId, task);

  // Run first check immediately
  run();
}

export function stopScheduler(monitorId: string): void {
  const existing = tasks.get(monitorId);
  if (existing?.timer) {
    clearInterval(existing.timer);
  }
  tasks.delete(monitorId);
}

export function updateSchedulerInterval(monitorId: string, intervalSeconds: number): void {
  const task = tasks.get(monitorId);
  if (task && task.timer) {
    clearInterval(task.timer);
    task.intervalSeconds = intervalSeconds;
  }
}

export function stopAllSchedulers(): void {
  for (const [id] of tasks) {
    stopScheduler(id);
  }
}

export function getScheduledMonitorIds(): string[] {
  return Array.from(tasks.keys());
}

export function isMonitorScheduled(monitorId: string): boolean {
  return tasks.has(monitorId);
}

// helio-app/backend/src/alertEngine.ts
import type { SystemSnapshot, Alert, AlertFireEvent, AlertMetric, AlertOperator } from './types.js';
import { queries } from './db/index.js';

type BroadcastFn = (msg: { type: string; data: unknown }) => void;
let broadcast: BroadcastFn = () => {};

export function setAlertBroadcast(fn: BroadcastFn): void {
  broadcast = fn;
}

export function extractValue(snap: SystemSnapshot, metric: AlertMetric): number {
  switch (metric) {
    case 'cpu': return snap.cpu;
    case 'memory': return snap.mem.percent;
    case 'disk': return snap.disk[0]?.percent ?? 0;
    case 'net_rx': return (snap.net[0]?.rx_sec ?? 0) / 1_000_000;
    case 'net_tx': return (snap.net[0]?.tx_sec ?? 0) / 1_000_000;
    default: return 0;
  }
}

export function evaluateCondition(value: number, operator: AlertOperator, threshold: number): boolean {
  switch (operator) {
    case '>': return value > threshold;
    case '<': return value < threshold;
    case '>=': return value >= threshold;
    default: return false;
  }
}

export async function evaluateAlerts(snap: SystemSnapshot): Promise<void> {
  const rules = queries.getAlerts();

  for (const rule of rules) {
    const value = extractValue(snap, rule.metric as AlertMetric);
    const triggered = evaluateCondition(value, rule.operator as AlertOperator, rule.threshold);

    if (!triggered) continue;

    const lastEvent = queries.getLatestAlertEvent(rule.id);
    const nowSec = Math.floor(Date.now() / 1000);
    const cooldownPassed = !lastEvent ||
      (nowSec - lastEvent.triggered_at) > rule.cooldown * 60;

    if (!cooldownPassed) continue;

    queries.insertAlertEvent(rule.id, value);

    const fireEvent: AlertFireEvent = {
      alertId: rule.id,
      name: rule.name,
      metric: rule.metric as AlertMetric,
      value,
      triggeredAt: nowSec,
    };

    broadcast({ type: 'alert', data: fireEvent });

    if (rule.channel === 'webhook' || rule.channel === 'slack' || rule.channel === 'discord') {
      await dispatchWebhook(rule, value, nowSec).catch(err =>
        console.error(`[Alert] Webhook dispatch failed for "${rule.name}":`, err.message)
      );
    }
  }
}

async function dispatchWebhook(rule: Alert, value: number, ts: number): Promise<void> {
  const body = JSON.stringify({
    alert: rule.name,
    metric: rule.metric,
    value,
    threshold: rule.threshold,
    ts,
    host: process.env.HOSTNAME ?? 'helio-server',
  });

  const res = await fetch(rule.target, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${rule.target}`);
  }
}

// helio-app/backend/src/db/queries.ts
import type Database from 'better-sqlite3';
import type { SystemSnapshot, MetricRow, Alert, AlertEvent } from '../types.js';

export function buildQueries(db: Database.Database) {
  const stmtInsertMetric = db.prepare<{
    ts: number; cpu: number; mem_used: number; mem_total: number;
    disk_json: string; net_json: string;
  }>(`INSERT INTO metrics (ts, cpu, mem_used, mem_total, disk_json, net_json)
      VALUES (@ts, @cpu, @mem_used, @mem_total, @disk_json, @net_json)`);

  const stmtLatest = db.prepare<[], MetricRow>(
    'SELECT * FROM metrics ORDER BY ts DESC LIMIT 1'
  );

  const stmtRange = db.prepare<[number, number], MetricRow>(
    'SELECT * FROM metrics WHERE ts >= ? AND ts <= ? ORDER BY ts ASC'
  );

  const stmtGetAlerts = db.prepare<[], Alert>(
    'SELECT * FROM alerts WHERE enabled = 1'
  );

  const stmtGetAllAlerts = db.prepare<[], Alert>('SELECT * FROM alerts');

  const stmtInsertAlert = db.prepare<{
    name: string; metric: string; operator: string; threshold: number;
    channel: string; target: string; cooldown: number;
  }>(`INSERT INTO alerts (name, metric, operator, threshold, channel, target, cooldown)
      VALUES (@name, @metric, @operator, @threshold, @channel, @target, @cooldown)`);

  const stmtUpdateAlert = db.prepare<{ id: number; enabled: number }>(
    'UPDATE alerts SET enabled = @enabled WHERE id = @id'
  );

  const stmtDeleteAlert = db.prepare<[number]>('DELETE FROM alerts WHERE id = ?');

  const stmtInsertEvent = db.prepare<{
    alert_id: number; triggered_at: number; peak_value: number;
  }>(`INSERT INTO alert_events (alert_id, triggered_at, peak_value)
      VALUES (@alert_id, @triggered_at, @peak_value)`);

  const stmtLatestEvent = db.prepare<[number], AlertEvent>(
    'SELECT * FROM alert_events WHERE alert_id = ? ORDER BY triggered_at DESC LIMIT 1'
  );

  return {
    insertMetric(snap: SystemSnapshot): void {
      stmtInsertMetric.run({
        ts: snap.ts,
        cpu: snap.cpu,
        mem_used: snap.mem.used,
        mem_total: snap.mem.total,
        disk_json: JSON.stringify(snap.disk),
        net_json: JSON.stringify(snap.net),
      });
    },

    getLatestMetric(): MetricRow | undefined {
      return stmtLatest.get() as MetricRow | undefined;
    },

    getMetricsRange(from: number, to: number): MetricRow[] {
      return stmtRange.all(from, to) as MetricRow[];
    },

    getAlerts(): Alert[] {
      return stmtGetAlerts.all() as Alert[];
    },

    getAllAlerts(): Alert[] {
      return stmtGetAllAlerts.all() as Alert[];
    },

    insertAlert(a: Omit<Alert, 'id' | 'enabled' | 'created_at'>): number {
      const result = stmtInsertAlert.run(a as Parameters<typeof stmtInsertAlert.run>[0]);
      return Number(result.lastInsertRowid);
    },

    updateAlert(id: number, enabled: boolean): void {
      stmtUpdateAlert.run({ id, enabled: enabled ? 1 : 0 });
    },

    deleteAlert(id: number): void {
      stmtDeleteAlert.run(id);
    },

    insertAlertEvent(alertId: number, value: number): void {
      stmtInsertEvent.run({
        alert_id: alertId,
        triggered_at: Math.floor(Date.now() / 1000),
        peak_value: value,
      });
    },

    getLatestAlertEvent(alertId: number): AlertEvent | undefined {
      return stmtLatestEvent.get(alertId) as AlertEvent | undefined;
    },
  };
}

export type Queries = ReturnType<typeof buildQueries>;

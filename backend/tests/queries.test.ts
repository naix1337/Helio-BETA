// helio-app/backend/tests/queries.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { buildQueries } from '../src/db/queries.js';

// Inline the schema so tests are self-contained
function buildTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL, cpu REAL NOT NULL,
      mem_used INTEGER NOT NULL, mem_total INTEGER NOT NULL,
      disk_json TEXT NOT NULL, net_json TEXT NOT NULL
    );
    CREATE INDEX idx_metrics_ts ON metrics(ts);
    CREATE TABLE alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, metric TEXT NOT NULL, operator TEXT NOT NULL,
      threshold REAL NOT NULL, channel TEXT NOT NULL, target TEXT NOT NULL,
      cooldown INTEGER DEFAULT 15, enabled INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch())
    );
    CREATE TABLE alert_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_id INTEGER REFERENCES alerts(id) ON DELETE CASCADE,
      triggered_at INTEGER NOT NULL, resolved_at INTEGER,
      peak_value REAL NOT NULL
    );
  `);
  return db;
}

describe('insertMetric', () => {
  it('inserts a metric row and reads it back', () => {
    const db = buildTestDb();
    const { insertMetric, getLatestMetric } = buildQueries(db);
    insertMetric({
      ts: 1000, cpu: 42.5, mem: { used: 4e9, total: 16e9, percent: 25 },
      disk: [{ mount: '/', used: 10e9, size: 100e9, percent: 10 }],
      net: [{ iface: 'eth0', rx_sec: 1000, tx_sec: 500 }],
      uptime: 3600, loadAvg: [0.5, 0.4, 0.3],
    });
    const row = getLatestMetric();
    expect(row).toBeDefined();
    expect(row!.cpu).toBe(42.5);
    expect(row!.mem_used).toBe(4e9);
    db.close();
  });
});

describe('getMetricsRange', () => {
  it('returns rows within ts range', () => {
    const db = buildTestDb();
    const { insertMetric, getMetricsRange } = buildQueries(db);
    for (let i = 1; i <= 5; i++) {
      insertMetric({ ts: i * 1000, cpu: i, mem: { used: 0, total: 0, percent: 0 },
        disk: [], net: [], uptime: 0, loadAvg: [0, 0, 0] });
    }
    const rows = getMetricsRange(2000, 4000);
    expect(rows).toHaveLength(3);
    expect(rows[0].cpu).toBe(2);
    db.close();
  });
});

describe('alert queries', () => {
  it('inserts and retrieves alerts', () => {
    const db = buildTestDb();
    const { insertAlert, getAlerts } = buildQueries(db);
    insertAlert({ name: 'High CPU', metric: 'cpu', operator: '>', threshold: 90,
      channel: 'webhook', target: 'http://hook', cooldown: 10 });
    const alerts = getAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].name).toBe('High CPU');
    db.close();
  });

  it('inserts alert event and retrieves latest', () => {
    const db = buildTestDb();
    const { insertAlert, insertAlertEvent, getLatestAlertEvent } = buildQueries(db);
    insertAlert({ name: 'Test', metric: 'cpu', operator: '>', threshold: 80,
      channel: 'webhook', target: 'http://x', cooldown: 15 });
    const alerts = db.prepare('SELECT id FROM alerts').all() as { id: number }[];
    const alertId = alerts[0].id;
    insertAlertEvent(alertId, 95);
    const ev = getLatestAlertEvent(alertId);
    expect(ev).toBeDefined();
    expect(ev!.peak_value).toBe(95);
    db.close();
  });
});

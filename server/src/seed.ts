import { getDb, closeDb } from './db/connection.js';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';

async function seed(): Promise<void> {
  const db = getDb();

  console.log('[seed] Seeding database…');

  // 1. Create admin user
  const adminId = uuid();
  const passwordHash = await bcrypt.hash('admin123', 12);
  db.prepare(`
    INSERT OR IGNORE INTO users (id, email, password_hash, role, created_at)
    VALUES (?, 'admin@helio.local', ?, 'admin', datetime('now'))
  `).run(adminId, passwordHash);
  console.log('[seed] Admin user: admin@helio.local / admin123');

  // 2. Create demo monitors
  const monitors = [
    {
      id: uuid(), name: 'Helio API', type: 'http', status: 'UP', interval: 60,
      config: { type: 'http', data: { url: 'http://localhost:3001/api/v1/health', method: 'GET', statusCodeMin: 200, statusCodeMax: 299, timeoutMs: 10000 } },
    },
    {
      id: uuid(), name: 'Example Website', type: 'http', status: 'UP', interval: 120,
      config: { type: 'http', data: { url: 'https://example.com', method: 'GET', statusCodeMin: 200, statusCodeMax: 299, keyword: 'Example', timeoutMs: 15000 } },
    },
    {
      id: uuid(), name: 'Local Redis', type: 'tcp', status: 'UP', interval: 60,
      config: { type: 'tcp', data: { host: 'localhost', port: 6379, timeoutMs: 5000 } },
    },
    {
      id: uuid(), name: 'Google DNS', type: 'ping', status: 'PENDING', interval: 120,
      config: { type: 'ping', data: { host: '8.8.8.8', count: 2 } },
    },
    {
      id: uuid(), name: 'example.com SSL', type: 'ssl', status: 'UP', interval: 3600,
      config: { type: 'ssl', data: { host: 'example.com', port: 443, warningDays: 30 } },
    },
    {
      id: uuid(), name: 'Cronjob Backup', type: 'push', status: 'PENDING', interval: 86400,
      config: { type: 'push', data: { token: uuid(), graceSeconds: 300 } },
    },
  ];

  const insertMonitor = db.prepare(`
    INSERT OR REPLACE INTO monitors (id, name, type, config, interval_seconds, retries, status, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 2, ?, '[]', datetime('now'), datetime('now'))
  `);

  for (const m of monitors) {
    insertMonitor.run(m.id, m.name, m.type, JSON.stringify(m.config), m.intervalSeconds, m.status);
    console.log(`[seed] Monitor: ${m.name} (${m.type})`);
  }

  // 3. Create demo notifications
  const notifId = uuid();
  db.prepare(`
    INSERT OR REPLACE INTO notifications (id, name, provider, config, created_at)
    VALUES (?, 'Demo Webhook', 'webhook', ?, datetime('now'))
  `).run(notifId, JSON.stringify({ provider: 'webhook', data: { url: 'https://hooks.example.com/helio', headers: {} } }));

  // Link notification to first monitor
  db.prepare('INSERT OR IGNORE INTO monitor_notifications (monitor_id, notification_id) VALUES (?, ?)')
    .run(monitors[0]!.id, notifId);

  // 4. Create demo status page
  const pageId = uuid();
  db.prepare(`
    INSERT OR REPLACE INTO status_pages (id, title, slug, monitor_ids, created_at, updated_at)
    VALUES (?, 'Helio Status', 'helio-status', ?, datetime('now'), datetime('now'))
  `).run(pageId, JSON.stringify(monitors.slice(0, 3).map((m) => m.id)));

  // 5. Seed historical heartbeats
  const insertHeartbeat = db.prepare(`
    INSERT INTO heartbeats (id, monitor_id, timestamp, status, latency_ms, message, status_code)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const now = Date.now();
  for (const monitor of monitors.slice(0, 3)) {
    for (let i = 0; i < 200; i++) {
      const ts = new Date(now - i * 60000).toISOString();
      const isUp = Math.random() > 0.08; // ~92% uptime
      const lat = isUp ? Math.round(10 + Math.random() * 90) : null;
      const status = isUp ? 'UP' : 'DOWN';
      const msg = isUp ? 'OK' : 'Simulated failure';
      insertHeartbeat.run(uuid(), monitor.id, ts, status, lat, msg, isUp ? 200 : 503);
    }
  }
  console.log('[seed] Created 600 historical heartbeats');

  console.log('[seed] Done!');
  closeDb();
}

seed().catch((err) => {
  console.error('[seed] Error:', err);
  closeDb();
  process.exit(1);
});

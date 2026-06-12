import { v4 as uuid } from 'uuid';
import { getDb } from './connection.js';
import type {
  Monitor, MonitorStatus, Heartbeat, Notification, User, UserPublic,
  ApiKey, StatusPage, MaintenanceWindow, UptimeAggregation, UptimeSummary,
  CreateMonitorInput, UpdateMonitorInput, CreateNotificationInput,
} from '@pulse/shared';

/* ---------- Helpers ---------- */

function rowToMonitor(row: Record<string, unknown>): Monitor {
  return {
    id: row['id'] as string,
    name: row['name'] as string,
    type: row['type'] as Monitor['type'],
    config: JSON.parse(row['config'] as string) as Monitor['config'],
    intervalSeconds: row['interval_seconds'] as number,
    retries: row['retries'] as number,
    status: row['status'] as MonitorStatus,
    tags: JSON.parse(row['tags'] as string) as string[],
    createdAt: row['created_at'] as string,
    updatedAt: row['updated_at'] as string,
  };
}

function rowToHeartbeat(row: Record<string, unknown>): Heartbeat {
  return {
    id: row['id'] as string,
    monitorId: row['monitor_id'] as string,
    timestamp: row['timestamp'] as string,
    status: row['status'] as MonitorStatus,
    latencyMs: row['latency_ms'] as number | null,
    message: row['message'] as string | null,
    statusCode: row['status_code'] as number | null,
  };
}

function rowToNotification(row: Record<string, unknown>): Notification {
  return {
    id: row['id'] as string,
    name: row['name'] as string,
    provider: row['provider'] as Notification['provider'],
    config: JSON.parse(row['config'] as string) as Notification['config'],
    monitorIds: [],
    createdAt: row['created_at'] as string,
  };
}

function rowToUser(row: Record<string, unknown>): User {
  return {
    id: row['id'] as string,
    email: row['email'] as string,
    passwordHash: row['password_hash'] as string,
    totpSecret: row['totp_secret'] as string | null,
    totpEnabled: !!row['totp_enabled'],
    role: row['role'] as User['role'],
    createdAt: row['created_at'] as string,
  };
}

export function userToPublic(u: User): UserPublic {
  return {
    id: u.id,
    email: u.email,
    totpEnabled: u.totpEnabled,
    role: u.role,
    createdAt: u.createdAt,
  };
}

/* ============================================================
   MONITORS
   ============================================================ */

export function createMonitor(input: CreateMonitorInput): Monitor {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO monitors (id, name, type, config, interval_seconds, retries, status, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)
  `).run(id, input.name, input.type, JSON.stringify(input.config), input.intervalSeconds, input.retries, JSON.stringify(input.tags || []), now, now);
  return getMonitor(id)!;
}

export function getMonitor(id: string): Monitor | null {
  const row = getDb().prepare('SELECT * FROM monitors WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToMonitor(row) : null;
}

export function listMonitors(filter?: { status?: MonitorStatus; type?: string; tag?: string }): Monitor[] {
  let sql = 'SELECT * FROM monitors WHERE 1=1';
  const params: unknown[] = [];
  if (filter?.status) { sql += ' AND status = ?'; params.push(filter.status); }
  if (filter?.type) { sql += ' AND type = ?'; params.push(filter.type); }
  sql += ' ORDER BY created_at DESC';
  const rows = getDb().prepare(sql).all(...params) as Record<string, unknown>[];
  return rows.map(rowToMonitor);
}

export function updateMonitor(id: string, input: UpdateMonitorInput): Monitor | null {
  const existing = getMonitor(id);
  if (!existing) return null;

  const db = getDb();
  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?'];
  const params: unknown[] = [now];

  if (input.name !== undefined) { sets.push('name = ?'); params.push(input.name); }
  if (input.config !== undefined) { sets.push('config = ?'); params.push(JSON.stringify(input.config)); }
  if (input.intervalSeconds !== undefined) { sets.push('interval_seconds = ?'); params.push(input.intervalSeconds); }
  if (input.retries !== undefined) { sets.push('retries = ?'); params.push(input.retries); }
  if (input.status !== undefined) { sets.push('status = ?'); params.push(input.status); }
  if (input.tags !== undefined) { sets.push('tags = ?'); params.push(JSON.stringify(input.tags)); }

  params.push(id);
  db.prepare(`UPDATE monitors SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  return getMonitor(id);
}

export function deleteMonitor(id: string): boolean {
  const result = getDb().prepare('DELETE FROM monitors WHERE id = ?').run(id);
  return result.changes > 0;
}

export function updateMonitorStatus(id: string, status: MonitorStatus): void {
  getDb().prepare("UPDATE monitors SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
}

/* ============================================================
   HEARTBEATS
   ============================================================ */

export function createHeartbeat(monitorId: string, status: MonitorStatus, latencyMs: number | null, message: string | null, statusCode: number | null): Heartbeat {
  const db = getDb();
  const id = uuid();
  const timestamp = new Date().toISOString();
  db.prepare(`
    INSERT INTO heartbeats (id, monitor_id, timestamp, status, latency_ms, message, status_code)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, monitorId, timestamp, status, latencyMs, message, statusCode);
  return { id, monitorId, timestamp, status, latencyMs, message, statusCode };
}

export function getHeartbeats(monitorId: string, limit: number = 100, offset: number = 0): Heartbeat[] {
  const rows = getDb().prepare(
    'SELECT * FROM heartbeats WHERE monitor_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?',
  ).all(monitorId, limit, offset) as Record<string, unknown>[];
  return rows.map(rowToHeartbeat);
}

export function getHeartbeatsByRange(monitorId: string, range: string): Heartbeat[] {
  const hours = range === '30d' ? 720 : range === '7d' ? 168 : 24;
  const rows = getDb().prepare(`
    SELECT * FROM heartbeats WHERE monitor_id = ? AND timestamp >= datetime('now', ? || ' hours')
    ORDER BY timestamp DESC
  `).all(monitorId, `-${hours}`) as Record<string, unknown>[];
  return rows.map(rowToHeartbeat);
}

export function getLatestHeartbeat(monitorId: string): Heartbeat | null {
  const row = getDb().prepare(
    'SELECT * FROM heartbeats WHERE monitor_id = ? ORDER BY timestamp DESC LIMIT 1',
  ).get(monitorId) as Record<string, unknown> | undefined;
  return row ? rowToHeartbeat(row) : null;
}

export function getRecentHeartbeatsForSparkline(monitorId: string, count: number = 50): Heartbeat[] {
  const rows = getDb().prepare(`
    SELECT * FROM heartbeats WHERE monitor_id = ? AND status IN ('UP', 'DOWN')
    ORDER BY timestamp DESC LIMIT ?
  `).all(monitorId, count) as Record<string, unknown>[];
  return rows.reverse().map(rowToHeartbeat);
}

export function count24hHeartbeats(monitorId: string): { total: number; failed: number } {
  const row = getDb().prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status IN ('DOWN', 'DEGRADED') THEN 1 ELSE 0 END) as failed
    FROM heartbeats
    WHERE monitor_id = ? AND timestamp >= datetime('now', '-24 hours')
  `).get(monitorId) as { total: number; failed: number };
  return { total: row.total || 0, failed: row.failed || 0 };
}

/* ============================================================
   UPTIME AGGREGATION
   ============================================================ */

export function computeUptimeSummary(monitorId: string): UptimeSummary {
  const calc = (hours: number): number => {
    const row = getDb().prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'UP' THEN 1 ELSE 0 END) as up
      FROM heartbeats
      WHERE monitor_id = ? AND timestamp >= datetime('now', ? || ' hours')
    `).get(monitorId, `-${hours}`) as { total: number; up: number };
    if (!row.total) return 100;
    return Math.round((row.up / row.total) * 10000) / 100;
  };

  return {
    last24h: calc(24),
    last7d: calc(168),
    last30d: calc(720),
    last365d: calc(8760),
  };
}

export function createUptimeAggregation(agg: Omit<UptimeAggregation, 'id'>): void {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO uptime_aggregations (id, monitor_id, period, timestamp, avg_latency_ms, min_latency_ms, max_latency_ms, uptime_percent, total_checks, failed_checks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uuid(), agg.monitorId, agg.period, agg.timestamp, agg.avgLatencyMs, agg.minLatencyMs, agg.maxLatencyMs, agg.uptimePercent, agg.totalChecks, agg.failedChecks);
}

export function getUptimeAggregations(monitorId: string, period: 'hourly' | 'daily', limit: number = 168): UptimeAggregation[] {
  const rows = getDb().prepare(`
    SELECT * FROM uptime_aggregations
    WHERE monitor_id = ? AND period = ?
    ORDER BY timestamp DESC LIMIT ?
  `).all(monitorId, period, limit) as Record<string, unknown>[];
  return rows.reverse().map((r) => ({
    id: r['id'] as string,
    monitorId: r['monitor_id'] as string,
    period: r['period'] as 'hourly' | 'daily',
    timestamp: r['timestamp'] as string,
    avgLatencyMs: r['avg_latency_ms'] as number,
    minLatencyMs: r['min_latency_ms'] as number,
    maxLatencyMs: r['max_latency_ms'] as number,
    uptimePercent: r['uptime_percent'] as number,
    totalChecks: r['total_checks'] as number,
    failedChecks: r['failed_checks'] as number,
  }));
}

export function pruneRawHeartbeats(retentionDays: number): number {
  const result = getDb().prepare(
    "DELETE FROM heartbeats WHERE timestamp < datetime('now', ? || ' days')",
  ).run(`-${retentionDays}`);
  return result.changes;
}

/* ============================================================
   NOTIFICATIONS
   ============================================================ */

export function createNotification(input: CreateNotificationInput): Notification {
  const db = getDb();
  const id = uuid();
  db.prepare(`
    INSERT INTO notifications (id, name, provider, config, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(id, input.name, input.provider, JSON.stringify(input.config));

  // Link monitors
  const insert = db.prepare('INSERT OR IGNORE INTO monitor_notifications (monitor_id, notification_id) VALUES (?, ?)');
  for (const mid of input.monitorIds) {
    insert.run(mid, id);
  }

  return getNotification(id)!;
}

export function getNotification(id: string): Notification | null {
  const row = getDb().prepare('SELECT * FROM notifications WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  const n = rowToNotification(row);
  const mids = getDb().prepare('SELECT monitor_id FROM monitor_notifications WHERE notification_id = ?').all(id) as { monitor_id: string }[];
  n.monitorIds = mids.map((m) => m.monitor_id);
  return n;
}

export function listNotifications(): Notification[] {
  const rows = getDb().prepare('SELECT * FROM notifications ORDER BY created_at DESC').all() as Record<string, unknown>[];
  return rows.map(rowToNotification).map((n) => {
    const mids = getDb().prepare('SELECT monitor_id FROM monitor_notifications WHERE notification_id = ?').all(n.id) as { monitor_id: string }[];
    n.monitorIds = mids.map((m) => m.monitor_id);
    return n;
  });
}

export function updateNotification(id: string, input: Partial<CreateNotificationInput>): Notification | null {
  const existing = getNotification(id);
  if (!existing) return null;

  const db = getDb();
  if (input.name !== undefined) db.prepare('UPDATE notifications SET name = ? WHERE id = ?').run(input.name, id);
  if (input.provider !== undefined) db.prepare('UPDATE notifications SET provider = ? WHERE id = ?').run(input.provider, id);
  if (input.config !== undefined) db.prepare('UPDATE notifications SET config = ? WHERE id = ?').run(JSON.stringify(input.config), id);
  if (input.monitorIds !== undefined) {
    db.prepare('DELETE FROM monitor_notifications WHERE notification_id = ?').run(id);
    const insert = db.prepare('INSERT OR IGNORE INTO monitor_notifications (monitor_id, notification_id) VALUES (?, ?)');
    for (const mid of input.monitorIds) insert.run(mid, id);
  }
  return getNotification(id);
}

export function deleteNotification(id: string): boolean {
  const result = getDb().prepare('DELETE FROM notifications WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getMonitorsForNotification(notificationId: string): string[] {
  return (getDb().prepare('SELECT monitor_id FROM monitor_notifications WHERE notification_id = ?')
    .all(notificationId) as { monitor_id: string }[]).map((r) => r.monitor_id);
}

export function getNotificationsForMonitor(monitorId: string): Notification[] {
  const rows = getDb().prepare(`
    SELECT n.* FROM notifications n
    JOIN monitor_notifications mn ON mn.notification_id = n.id
    WHERE mn.monitor_id = ?
  `).all(monitorId) as Record<string, unknown>[];
  return rows.map(rowToNotification);
}

/* ============================================================
   USERS
   ============================================================ */

export function createUser(email: string, passwordHash: string, role: 'admin' | 'user' = 'user'): User {
  const id = uuid();
  getDb().prepare(`
    INSERT INTO users (id, email, password_hash, role, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(id, email, passwordHash, role);
  return getUser(id)!;
}

export function getUser(id: string): User | null {
  const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToUser(row) : null;
}

export function getUserByEmail(email: string): User | null {
  const row = getDb().prepare('SELECT * FROM users WHERE email = ?').get(email) as Record<string, unknown> | undefined;
  return row ? rowToUser(row) : null;
}

export function updateUserTotp(userId: string, secret: string, enabled: boolean): void {
  getDb().prepare('UPDATE users SET totp_secret = ?, totp_enabled = ? WHERE id = ?').run(secret, enabled ? 1 : 0, userId);
}

/* ============================================================
   API KEYS
   ============================================================ */

export function createApiKey(userId: string, name: string, keyHash: string, keyPrefix: string, scopes: string[]): ApiKeyWithSecret {
  const id = uuid();
  getDb().prepare(`
    INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, scopes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, userId, name, keyHash, keyPrefix, JSON.stringify(scopes));
  return { ...getApiKey(id)!, plainKey: '' };
}

export function getApiKey(id: string): ApiKey | null {
  const row = getDb().prepare('SELECT * FROM api_keys WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row['id'] as string,
    userId: row['user_id'] as string,
    name: row['name'] as string,
    keyPrefix: row['key_prefix'] as string,
    scopes: JSON.parse(row['scopes'] as string),
    lastUsedAt: row['last_used_at'] as string | null,
    createdAt: row['created_at'] as string,
  };
}

export function getApiKeyByHash(keyHash: string): ApiKey | null {
  const row = getDb().prepare('SELECT * FROM api_keys WHERE key_hash = ?').get(keyHash) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row['id'] as string,
    userId: row['user_id'] as string,
    name: row['name'] as string,
    keyPrefix: row['key_prefix'] as string,
    scopes: JSON.parse(row['scopes'] as string),
    lastUsedAt: row['last_used_at'] as string | null,
    createdAt: row['created_at'] as string,
  };
}

export function listApiKeys(userId: string): ApiKey[] {
  const rows = getDb().prepare('SELECT * FROM api_keys WHERE user_id = ? ORDER BY created_at DESC').all(userId) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r['id'] as string,
    userId: r['user_id'] as string,
    name: r['name'] as string,
    keyPrefix: r['key_prefix'] as string,
    scopes: JSON.parse(r['scopes'] as string),
    lastUsedAt: r['last_used_at'] as string | null,
    createdAt: r['created_at'] as string,
  }));
}

export function deleteApiKey(id: string): boolean {
  const result = getDb().prepare('DELETE FROM api_keys WHERE id = ?').run(id);
  return result.changes > 0;
}

export function touchApiKey(id: string): void {
  getDb().prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").run(id);
}

/* ============================================================
   STATUS PAGES
   ============================================================ */

export function createStatusPage(title: string, slug: string, monitorIds: string[] = []): StatusPage {
  const id = uuid();
  getDb().prepare(`
    INSERT INTO status_pages (id, title, slug, monitor_ids, created_at, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(id, title, slug, JSON.stringify(monitorIds));
  return getStatusPage(id)!;
}

export function getStatusPage(id: string): StatusPage | null {
  const row = getDb().prepare('SELECT * FROM status_pages WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row['id'] as string,
    title: row['title'] as string,
    slug: row['slug'] as string,
    logoUrl: row['logo_url'] as string | null,
    monitorIds: JSON.parse(row['monitor_ids'] as string),
    incidentBanner: row['incident_banner'] as string | null,
    createdAt: row['created_at'] as string,
    updatedAt: row['updated_at'] as string,
  };
}

export function getStatusPageBySlug(slug: string): StatusPage | null {
  const row = getDb().prepare('SELECT * FROM status_pages WHERE slug = ?').get(slug) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row['id'] as string,
    title: row['title'] as string,
    slug: row['slug'] as string,
    logoUrl: row['logo_url'] as string | null,
    monitorIds: JSON.parse(row['monitor_ids'] as string),
    incidentBanner: row['incident_banner'] as string | null,
    createdAt: row['created_at'] as string,
    updatedAt: row['updated_at'] as string,
  };
}

export function listStatusPages(): StatusPage[] {
  const rows = getDb().prepare('SELECT * FROM status_pages ORDER BY created_at DESC').all() as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r['id'] as string,
    title: r['title'] as string,
    slug: r['slug'] as string,
    logoUrl: r['logo_url'] as string | null,
    monitorIds: JSON.parse(r['monitor_ids'] as string),
    incidentBanner: r['incident_banner'] as string | null,
    createdAt: r['created_at'] as string,
    updatedAt: r['updated_at'] as string,
  }));
}

export function updateStatusPage(id: string, input: Partial<Omit<StatusPage, 'id' | 'createdAt'>>): StatusPage | null {
  const db = getDb();
  const sets: string[] = ["updated_at = datetime('now')"];
  const params: unknown[] = [];
  if (input.title !== undefined) { sets.push('title = ?'); params.push(input.title); }
  if (input.slug !== undefined) { sets.push('slug = ?'); params.push(input.slug); }
  if (input.logoUrl !== undefined) { sets.push('logo_url = ?'); params.push(input.logoUrl); }
  if (input.monitorIds !== undefined) { sets.push('monitor_ids = ?'); params.push(JSON.stringify(input.monitorIds)); }
  if (input.incidentBanner !== undefined) { sets.push('incident_banner = ?'); params.push(input.incidentBanner); }
  if (!sets.length) return getStatusPage(id);
  params.push(id);
  db.prepare(`UPDATE status_pages SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  return getStatusPage(id);
}

export function deleteStatusPage(id: string): boolean {
  const result = getDb().prepare('DELETE FROM status_pages WHERE id = ?').run(id);
  return result.changes > 0;
}

/* ============================================================
   MAINTENANCE WINDOWS
   ============================================================ */

export function createMaintenanceWindow(monitorIds: string[], startsAt: string, endsAt: string, description: string): MaintenanceWindow {
  const id = uuid();
  getDb().prepare(`
    INSERT INTO maintenance_windows (id, monitor_ids, starts_at, ends_at, description, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).run(id, JSON.stringify(monitorIds), startsAt, endsAt, description);
  return getMaintenanceWindow(id)!;
}

export function getMaintenanceWindow(id: string): MaintenanceWindow | null {
  const row = getDb().prepare('SELECT * FROM maintenance_windows WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row['id'] as string,
    monitorIds: JSON.parse(row['monitor_ids'] as string),
    startsAt: row['starts_at'] as string,
    endsAt: row['ends_at'] as string,
    description: row['description'] as string,
    createdAt: row['created_at'] as string,
  };
}

export function listMaintenanceWindows(): MaintenanceWindow[] {
  const rows = getDb().prepare('SELECT * FROM maintenance_windows ORDER BY starts_at DESC').all() as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r['id'] as string,
    monitorIds: JSON.parse(r['monitor_ids'] as string),
    startsAt: r['starts_at'] as string,
    endsAt: r['ends_at'] as string,
    description: r['description'] as string,
    createdAt: r['created_at'] as string,
  }));
}

export function getActiveMaintenanceWindows(): MaintenanceWindow[] {
  const rows = getDb().prepare(`
    SELECT * FROM maintenance_windows
    WHERE starts_at <= datetime('now') AND ends_at >= datetime('now')
    ORDER BY starts_at
  `).all() as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r['id'] as string,
    monitorIds: JSON.parse(r['monitor_ids'] as string),
    startsAt: r['starts_at'] as string,
    endsAt: r['ends_at'] as string,
    description: r['description'] as string,
    createdAt: r['created_at'] as string,
  }));
}

export function isInMaintenance(monitorId: string): boolean {
  const active = getActiveMaintenanceWindows();
  return active.some((mw) => mw.monitorIds.includes(monitorId));
}

export function deleteMaintenanceWindow(id: string): boolean {
  const result = getDb().prepare('DELETE FROM maintenance_windows WHERE id = ?').run(id);
  return result.changes > 0;
}

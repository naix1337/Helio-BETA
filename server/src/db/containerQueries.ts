import { randomUUID as uuid } from 'node:crypto';
import { getDb } from './connection.js';
import type { ProxmoxContainer } from '../collectors/proxmox.js';
import { encrypt, decrypt, isEncrypted } from '../utils/encryption.js';

/* ---------- Proxmox Config ---------- */

export interface ProxmoxConfig {
  id: string;
  host: string;
  user: string;
  password: string;
  intervalSeconds: number;
}

/**
 * Retrieve the Proxmox config with the password decrypted.
 * Returns null if no config exists.
 */
export function getProxmoxConfig(): ProxmoxConfig | null {
  const row = getDb().prepare('SELECT * FROM proxmox_config WHERE id = ?').get('default') as Record<string, unknown> | undefined;
  if (!row) return null;

  const encryptedPassword = row['password'] as string;
  let password: string;
  try {
    password = isEncrypted(encryptedPassword)
      ? decrypt(encryptedPassword)
      : encryptedPassword; // fallback for legacy unencrypted passwords
  } catch {
    password = encryptedPassword; // if decryption fails, use as-is
  }

  return {
    id: row['id'] as string,
    host: row['host'] as string,
    user: row['user'] as string,
    password,
    intervalSeconds: row['interval_seconds'] as number,
  };
}

/**
 * Save or update the Proxmox config.
 * The password is encrypted before storage using AES-256-GCM.
 */
export function setProxmoxConfig(cfg: { host: string; user: string; password: string; intervalSeconds?: number }): ProxmoxConfig {
  const existing = getProxmoxConfig();
  const encryptedPassword = encrypt(cfg.password);

  if (existing) {
    getDb().prepare(`
      UPDATE proxmox_config SET host = ?, user = ?, password = ?, interval_seconds = ?, updated_at = datetime('now')
      WHERE id = 'default'
    `).run(cfg.host, cfg.user, encryptedPassword, cfg.intervalSeconds ?? 60);
  } else {
    getDb().prepare(`
      INSERT INTO proxmox_config (id, host, user, password, interval_seconds, created_at, updated_at)
      VALUES ('default', ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(cfg.host, cfg.user, encryptedPassword, cfg.intervalSeconds ?? 60);
  }
  return getProxmoxConfig()!;
}

export function deleteProxmoxConfig(): void {
  getDb().prepare('DELETE FROM proxmox_config WHERE id = ?').run('default');
}

/* ---------- Container Metrics ---------- */

export interface ContainerMetricSnapshot {
  id: string;
  vmid: number;
  name: string;
  node: string;
  type: 'lxc' | 'qemu';
  status: string;
  cpu: number;
  mem: number;
  maxmem: number;
  disk: number;
  maxdisk: number;
  uptime: number | null;
  pingMs: number | null;
  netin: number | null;
  netout: number | null;
  timestamp: string;
}

export function saveContainerMetrics(containers: ProxmoxContainer[], pingResults?: Map<number, number>): void {
  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO container_metrics (id, vmid, name, node, type, status, cpu, mem, maxmem, disk, maxdisk, uptime, ping_ms, netin, netout, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    for (const c of containers) {
      const ping = pingResults?.get(c.vmid) ?? null;
      insert.run(
        uuid(), c.vmid, c.name, c.node, c.type, c.status,
        c.cpu, c.mem, c.maxmem, c.disk, c.maxdisk,
        c.uptime ?? null, ping, c.netin ?? null, c.netout ?? null, now,
      );
    }
  });
  tx();
}

/**
 * Get the most recent metric snapshot for each container.
 * Uses a subquery to find the latest row per vmid efficiently.
 */
export function getLatestContainerMetrics(): ContainerMetricSnapshot[] {
  const rows = getDb().prepare(`
    SELECT * FROM (
      SELECT cm.*, ROW_NUMBER() OVER (PARTITION BY vmid ORDER BY timestamp DESC) AS rn
      FROM container_metrics cm
    ) WHERE rn = 1
    ORDER BY name COLLATE NOCASE
  `).all() as Record<string, unknown>[];
  return rows.map(rowToMetric);
}

export function getContainerHistory(vmid: number, limit: number = 120): ContainerMetricSnapshot[] {
  const rows = getDb().prepare(`
    SELECT * FROM container_metrics WHERE vmid = ? ORDER BY timestamp DESC LIMIT ?
  `).all(vmid, limit) as Record<string, unknown>[];
  return rows.reverse().map(rowToMetric);
}

export function getContainerMetricByVmid(vmid: number): ContainerMetricSnapshot | null {
  const row = getDb().prepare(`
    SELECT * FROM container_metrics WHERE vmid = ? ORDER BY timestamp DESC LIMIT 1
  `).get(vmid) as Record<string, unknown> | undefined;
  return row ? rowToMetric(row) : null;
}

export function pruneContainerMetrics(retentionDays: number = 7): number {
  const result = getDb().prepare(
    'DELETE FROM container_metrics WHERE timestamp < ?',
  ).run(new Date(Date.now() - retentionDays * 86400000).toISOString());
  return result.changes;
}

/** Legacy rows use SQLite `YYYY-MM-DD HH:MM:SS` (UTC) */
function toIso(ts: string): string {
  return ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z';
}

function rowToMetric(row: Record<string, unknown>): ContainerMetricSnapshot {
  return {
    id: row['id'] as string,
    vmid: row['vmid'] as number,
    name: row['name'] as string,
    node: row['node'] as string,
    type: row['type'] as 'lxc' | 'qemu',
    status: row['status'] as string,
    cpu: row['cpu'] as number,
    mem: row['mem'] as number,
    maxmem: row['maxmem'] as number,
    disk: row['disk'] as number,
    maxdisk: row['maxdisk'] as number,
    uptime: row['uptime'] as number | null,
    pingMs: row['ping_ms'] as number | null,
    timestamp: toIso(row['timestamp'] as string),
    netin: row['netin'] as number | null,
    netout: row['netout'] as number | null,
  };
}

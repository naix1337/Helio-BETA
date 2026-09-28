import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const dbPath = resolve(process.env['DB_PATH'] || join(__dirname, '..', '..', 'helio.db'));

/**
 * Resolve the JWT / encryption secret.
 *
 * If JWT_SECRET is not set, a random secret is generated once and persisted
 * next to the database. Otherwise every restart would invalidate all sessions
 * and make the encrypted Proxmox password undecryptable.
 */
function resolveSecret(): string {
  const fromEnv = process.env['JWT_SECRET'];
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();

  const secretFile = join(dirname(dbPath), '.helio-secret');
  try {
    if (existsSync(secretFile)) {
      const stored = readFileSync(secretFile, 'utf-8').trim();
      if (stored) return stored;
    }
    mkdirSync(dirname(secretFile), { recursive: true });
    const generated = randomBytes(48).toString('hex');
    writeFileSync(secretFile, generated, { mode: 0o600 });
    return generated;
  } catch {
    // Read-only filesystem etc. — fall back to an ephemeral secret
    return randomBytes(48).toString('hex');
  }
}

function envBool(name: string, def: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === '') return def;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

function parseTrustProxy(v: string | undefined): boolean | number | string {
  if (v === undefined || v === '') return false;
  if (v === 'true') return true;
  if (v === 'false') return false;
  const n = Number(v);
  return Number.isInteger(n) ? n : v;
}

export const config = {
  version: '2.2.0',

  port: parseInt(process.env['PORT'] || '3001', 10),
  host: process.env['HOST'] || '0.0.0.0',

  jwtSecret: resolveSecret(),
  jwtAccessExpiry: process.env['JWT_ACCESS_EXPIRY'] || '15m',
  jwtRefreshExpiry: process.env['JWT_REFRESH_EXPIRY'] || '7d',

  dbPath,

  retention: {
    rawHeartbeatsDays: parseInt(process.env['RETENTION_RAW_DAYS'] || '7', 10),
  },

  aggregationIntervalMs: 60 * 60 * 1000, // 1 hour

  cors: {
    origin: process.env['CORS_ORIGIN'] || '*',
  },

  /** Express "trust proxy" setting — set when running behind nginx/traefik */
  trustProxy: parseTrustProxy(process.env['TRUST_PROXY']),

  /** Max API requests per minute per IP */
  apiRateLimit: parseInt(process.env['API_RATE_LIMIT'] || '600', 10),

  /**
   * Allow notification targets (webhook, ntfy, discord) in private networks.
   * Useful for homelabs with a self-hosted ntfy/gotify. Default: blocked (SSRF protection).
   */
  allowPrivateNotificationTargets: envBool('NOTIFICATION_ALLOW_PRIVATE', false),

  backup: {
    enabled: envBool('BACKUP_ENABLED', false),
    dir: process.env['BACKUP_DIR'] || join(dirname(dbPath), 'backups'),
    retentionDays: parseInt(process.env['BACKUP_RETENTION_DAYS'] || '30', 10),
  },

  // Notification defaults
  ntfyDefaultServer: process.env['NTFY_DEFAULT_SERVER'] || 'https://ntfy.sh',
};

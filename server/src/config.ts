import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const config = {
  port: parseInt(process.env['PORT'] || '3001', 10),
  host: process.env['HOST'] || '0.0.0.0',

  jwtSecret: process.env['JWT_SECRET'] || randomBytes(32).toString('hex'),
  jwtAccessExpiry: '15m',
  jwtRefreshExpiry: '7d',

  dbPath: process.env['DB_PATH'] || join(__dirname, '..', '..', 'helio.db'),

  retention: {
    rawHeartbeatsDays: parseInt(process.env['RETENTION_RAW_DAYS'] || '7', 10),
  },

  aggregationIntervalMs: 60 * 60 * 1000, // 1 hour

  cors: {
    origin: process.env['CORS_ORIGIN'] || '*',
  },

  // Notification defaults
  ntfyDefaultServer: process.env['NTFY_DEFAULT_SERVER'] || 'https://ntfy.sh',
};

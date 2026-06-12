import { connect } from 'node:tls';
import type { IChecker, CheckResult } from './IChecker.js';
import type { SslConfig } from '@pulse/shared';
import { registerChecker } from './registry.js';

export class SslChecker implements IChecker {
  readonly type = 'ssl';

  async check(config: unknown): Promise<CheckResult> {
    const cfg = config as SslConfig;
    const start = performance.now();
    const warningDays = cfg.warningDays ?? 30;

    return new Promise((resolve) => {
      const socket = connect({
        host: cfg.host,
        port: cfg.port ?? 443,
        servername: cfg.host,
        rejectUnauthorized: false,
      });

      socket.setTimeout(10000);

      socket.on('secureConnect', () => {
        const latencyMs = Math.round(performance.now() - start);
        const cert = socket.getPeerCertificate();

        if (!cert || !cert.valid_to) {
          socket.end();
          resolve({ status: 'DOWN', latencyMs, message: 'No certificate returned', statusCode: null });
          return;
        }

        const expiryDate = new Date(cert.valid_to);
        const now = new Date();
        const daysRemaining = Math.round((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        socket.end();

        if (daysRemaining <= 0) {
          resolve({
            status: 'DOWN',
            latencyMs,
            message: `Certificate expired ${Math.abs(daysRemaining)} days ago (${cert.valid_to})`,
            statusCode: null,
          });
        } else if (daysRemaining <= warningDays) {
          resolve({
            status: 'DEGRADED',
            latencyMs,
            message: `Certificate expires in ${daysRemaining} days (${cert.valid_to})`,
            statusCode: null,
          });
        } else {
          resolve({
            status: 'UP',
            latencyMs,
            message: `Certificate valid for ${daysRemaining} more days (until ${cert.valid_to}). Issuer: ${cert.issuer?.O || 'unknown'}`,
            statusCode: null,
          });
        }
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({ status: 'DOWN', latencyMs: null, message: 'SSL connection timeout', statusCode: null });
      });

      socket.on('error', (err) => {
        socket.destroy();
        resolve({ status: 'DOWN', latencyMs: null, message: err.message, statusCode: null });
      });
    });
  }
}

registerChecker(new SslChecker());

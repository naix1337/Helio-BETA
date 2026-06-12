import { connect } from 'node:net';
import type { IChecker, CheckResult } from './IChecker.js';
import type { TcpConfig } from '@pulse/shared';
import { registerChecker } from './registry.js';

export class TcpChecker implements IChecker {
  readonly type = 'tcp';

  async check(config: unknown): Promise<CheckResult> {
    const cfg = config as TcpConfig;
    const start = performance.now();
    const timeoutMs = cfg.timeoutMs ?? 10000;

    return new Promise((resolve) => {
      const socket = connect(cfg.port, cfg.host, () => {
        const latencyMs = Math.round(performance.now() - start);
        socket.destroy();
        resolve({ status: 'UP', latencyMs, message: `TCP ${cfg.host}:${cfg.port} connected`, statusCode: null });
      });

      socket.setTimeout(timeoutMs);
      socket.on('timeout', () => {
        socket.destroy();
        resolve({ status: 'DOWN', latencyMs: null, message: `TCP connection timeout after ${timeoutMs}ms`, statusCode: null });
      });

      socket.on('error', (err) => {
        socket.destroy();
        resolve({ status: 'DOWN', latencyMs: null, message: err.message, statusCode: null });
      });
    });
  }
}

registerChecker(new TcpChecker());

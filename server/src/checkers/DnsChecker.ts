import { promises as dnsPromises } from 'node:dns';
import type { IChecker, CheckResult } from './IChecker.js';
import type { DnsConfig } from '@pulse/shared';
import { registerChecker } from './registry.js';

export class DnsChecker implements IChecker {
  readonly type = 'dns';

  async check(config: unknown): Promise<CheckResult> {
    const cfg = config as DnsConfig;
    const start = performance.now();

    try {
      const resolver = cfg.resolver ? new (await import('node:dns')).promises.Resolver() : dnsPromises;
      if (cfg.resolver) {
        (resolver as import('node:dns').promises.Resolver).setServers([cfg.resolver]);
      }

      const recordType = cfg.recordType ?? 'A';
      let records: string[] = [];

      switch (recordType) {
        case 'A':
          records = (await resolver.resolve4(cfg.host)).map(String);
          break;
        case 'AAAA':
          records = (await resolver.resolve6(cfg.host)).map(String);
          break;
        case 'CNAME':
          records = [(await resolver.resolveCname(cfg.host)).join(', ')];
          break;
        case 'MX':
          records = (await resolver.resolveMx(cfg.host)).map((mx) => `${mx.exchange} priority ${mx.priority}`);
          break;
        case 'TXT':
          records = (await resolver.resolveTxt(cfg.host)).map((t) => t.join(' '));
          break;
        default:
          records = (await resolver.resolve(cfg.host, recordType)).map(String);
      }

      const latencyMs = Math.round(performance.now() - start);

      if (cfg.expectedValue && !records.some((r) => r.includes(cfg.expectedValue!))) {
        return {
          status: 'DOWN',
          latencyMs,
          message: `DNS ${recordType} record value mismatch: expected "${cfg.expectedValue}", got [${records.join(', ')}]`,
          statusCode: null,
        };
      }

      return {
        status: 'UP',
        latencyMs,
        message: `DNS ${recordType} resolved: ${records.join(', ')}`,
        statusCode: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'DNS resolution failed';
      return { status: 'DOWN', latencyMs: null, message, statusCode: null };
    }
  }
}

registerChecker(new DnsChecker());

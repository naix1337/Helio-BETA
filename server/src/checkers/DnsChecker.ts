import { promises as dnsPromises, Resolver } from 'node:dns';
import type { IChecker, CheckResult } from './IChecker.js';
import type { DnsConfig } from '@pulse/shared';
import { registerChecker } from './registry.js';

const { resolve4, resolve6, resolveCname, resolveMx, resolveTxt, resolve } = dnsPromises;

/**
 * DNS Checker
 *
 * Resolves DNS records for a given hostname and optional expected value.
 * Supports A, AAAA, CNAME, MX, TXT record types.
 * Optionally uses a custom DNS resolver.
 */
export class DnsChecker implements IChecker {
  readonly type = 'dns';

  async check(config: unknown): Promise<CheckResult> {
    const cfg = config as DnsConfig;
    const start = performance.now();

    try {
      const recordType = cfg.recordType ?? 'A';
      let records: string[] = [];

      // Use custom resolver if configured, otherwise system defaults
      if (cfg.resolver) {
        const customResolver = new Resolver();
        customResolver.setServers([cfg.resolver]);
        records = await this.resolveWith(customResolver, cfg.host, recordType);
      } else {
        records = await this.resolveWith(dnsPromises, cfg.host, recordType);
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

  private async resolveWith(
    resolver: typeof dnsPromises | Resolver,
    host: string,
    recordType: string,
  ): Promise<string[]> {
    switch (recordType) {
      case 'A':
        return (await resolver.resolve4(host)).map(String);
      case 'AAAA':
        return (await resolver.resolve6(host)).map(String);
      case 'CNAME':
        return [(await resolver.resolveCname(host)).join(', ')];
      case 'MX':
        return (await resolver.resolveMx(host)).map((mx) => `${mx.exchange} priority ${mx.priority}`);
      case 'TXT':
        return (await resolver.resolveTxt(host)).map((t) => t.join(' '));
      default:
        return (await resolver.resolve(host, recordType)).map(String);
    }
  }
}

registerChecker(new DnsChecker());

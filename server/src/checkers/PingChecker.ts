import { execFile } from 'node:child_process';
import { connect } from 'node:net';
import { promisify } from 'node:util';
import type { IChecker, CheckResult } from './IChecker.js';
import type { PingConfig } from '@pulse/shared';
import { registerChecker } from './registry.js';

const execFileAsync = promisify(execFile);

/* ---------- Host validation (injection prevention) ---------- */

const HOSTNAME_RE = /^[a-zA-Z0-9_]([a-zA-Z0-9_-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9_]([a-zA-Z0-9_-]{0,61}[a-zA-Z0-9])?)*\.?$/;
const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6_RE = /^[0-9a-fA-F:]+$/;

function validateHost(host: string): string | null {
  host = (host ?? '').trim();
  if (!host || host.startsWith('-')) return null;

  const m = host.match(IPV4_RE);
  if (m) {
    for (let i = 1; i <= 4; i++) {
      if (parseInt(m[i]!, 10) > 255) return null;
    }
    return host;
  }

  if (host.includes(':')) return IPV6_RE.test(host) ? host : null;
  if (HOSTNAME_RE.test(host)) return host;

  return null;
}

/**
 * Ping Checker
 *
 * Uses the system `ping` binary via execFile (no shell). In Docker the
 * container needs CAP_NET_RAW (set in docker-compose). Falls back to a TCP
 * connect on port 80/443 if ICMP is unavailable.
 */
export class PingChecker implements IChecker {
  readonly type = 'ping';

  async check(config: unknown): Promise<CheckResult> {
    const cfg = config as PingConfig;
    const count = Math.min(Math.max(cfg.count ?? 3, 1), 10);

    const host = validateHost(cfg.host);
    if (!host) {
      return {
        status: 'DOWN',
        latencyMs: null,
        message: `Invalid host: ${cfg.host} (hostnames, IPv4, and IPv6 only)`,
        statusCode: null,
      };
    }

    const isWin = process.platform === 'win32';
    const args = isWin
      ? ['-n', String(count), '-w', '3000', host]
      : ['-c', String(count), '-W', '3', host];

    try {
      const { stdout } = await execFileAsync('ping', args, { timeout: 5000 + count * 3000 });

      let avgMs: number | null = null;
      if (isWin) {
        const match = stdout.match(/(?:Average|Mittelwert|Durchschnitt)\s*=\s*(\d+)/i);
        if (match) avgMs = parseInt(match[1]!, 10);
      } else {
        // "rtt min/avg/max/mdev = 0.045/0.058/0.071/0.013 ms" (iputils) or
        // "round-trip min/avg/max = 0.045/0.058/0.071 ms" (busybox)
        const match = stdout.match(/=\s*[\d.]+\/([\d.]+)\//);
        if (match) avgMs = Math.round(parseFloat(match[1]!) * 100) / 100;
      }

      if (/\b100(\.0)?% (packet )?loss/i.test(stdout) || stdout.includes('100% Verlust')) {
        return { status: 'DOWN', latencyMs: null, message: '100% packet loss', statusCode: null };
      }

      return { status: 'UP', latencyMs: avgMs, message: 'Host reachable', statusCode: null };
    } catch (err) {
      const e = err as NodeJS.ErrnoException & { stdout?: string; code?: string | number };
      // ping binary missing or not permitted → TCP fallback
      if (e.code === 'ENOENT' || e.code === 'EPERM' || e.code === 'EACCES') {
        return this.tcpFallback(host);
      }
      const loss = e.stdout?.match(/(\d+(?:\.\d+)?)% (?:packet )?loss/i);
      const message = loss ? `${loss[1]}% packet loss` : 'Host unreachable';
      return { status: 'DOWN', latencyMs: null, message, statusCode: null };
    }
  }

  private async tcpFallback(host: string): Promise<CheckResult> {
    for (const port of [443, 80, 22]) {
      const start = performance.now();
      try {
        await new Promise<void>((resolve, reject) => {
          const s = connect(port, host, () => { s.destroy(); resolve(); });
          s.setTimeout(4000, () => { s.destroy(); reject(new Error('timeout')); });
          s.on('error', (err) => { s.destroy(); reject(err); });
        });
        return { status: 'UP', latencyMs: Math.round(performance.now() - start), message: `ICMP unavailable, TCP :${port} OK`, statusCode: null };
      } catch (err) {
        // ECONNREFUSED still proves the host is reachable
        if ((err as NodeJS.ErrnoException).code === 'ECONNREFUSED') {
          return { status: 'UP', latencyMs: Math.round(performance.now() - start), message: 'ICMP unavailable, host answered TCP', statusCode: null };
        }
      }
    }
    return { status: 'DOWN', latencyMs: null, message: 'ICMP unavailable and TCP fallback failed', statusCode: null };
  }
}

registerChecker(new PingChecker());

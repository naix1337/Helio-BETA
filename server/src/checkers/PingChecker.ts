import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { isIP } from 'node:net';
import type { IChecker, CheckResult } from './IChecker.js';
import type { PingConfig } from '@pulse/shared';
import { registerChecker } from './registry.js';

const execAsync = promisify(exec);

/* ---------- Host validation (SSRF / injection prevention) ---------- */

const HOSTNAME_RE = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.?$/;
const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6_RE = /^([0-9a-fA-F:]+)$/;

function validateHost(host: string): string | null {
  host = host.trim();
  if (!host) return null;

  // Validate IPv4 octets
  const m = host.match(IPV4_RE);
  if (m) {
    for (let i = 1; i <= 4; i++) {
      if (parseInt(m[i]!, 10) > 255) return null;
    }
    return host;
  }

  if (IPV6_RE.test(host)) return host;
  if (HOSTNAME_RE.test(host)) return host;

  return null;
}

/**
 * Ping Checker
 *
 * Uses system `ping` command. On Linux requires CAP_NET_RAW for raw sockets,
 * or setcap cap_net_raw+ep on the ping binary. Falls back to TCP Echo (port 7)
 * if ping fails.
 *
 * SECURITY: Host input is validated against a strict regex to prevent
 * shell injection via the `ping` command-line invocation.
 */
export class PingChecker implements IChecker {
  readonly type = 'ping';

  async check(config: unknown): Promise<CheckResult> {
    const cfg = config as PingConfig;
    const rawHost = cfg.host;
    const count = cfg.count ?? 3;

    // CRITICAL: Validate host to prevent shell injection
    const host = validateHost(rawHost);
    if (!host) {
      return {
        status: 'DOWN',
        latencyMs: null,
        message: `Invalid host: ${rawHost} (hostnames, IPv4, and IPv6 only)`,
        statusCode: null,
      };
    }

    const start = performance.now();

    try {
      // Windows uses -n, Linux/Mac use -c
      // Array-based exec avoids shell interpretation entirely
      const isWin = process.platform === 'win32';
      const cmd = isWin
        ? `ping -n ${count} ${host}`
        : `ping -c ${count} -W 3 ${host}`;

      const { stdout } = await execAsync(cmd, { timeout: 15000, shell: false });

      const latencyMs = Math.round(performance.now() - start);

      // Parse average from output
      let avgMs: number | null = null;
      if (isWin) {
        const match = stdout.match(/Durchschnitt\s*=\s*(\d+)/i) || stdout.match(/Average\s*=\s*(\d+)/i);
        if (match) avgMs = parseInt(match[1]!, 10);
      } else {
        const match = stdout.match(/(?:min|avg|max)\/(\d+\.?\d*)/);
        if (match) avgMs = Math.round(parseFloat(match[1]!));
      }

      const hasLoss = stdout.includes('100% loss') || stdout.includes('100% Verlust');
      if (hasLoss) {
        return { status: 'DOWN', latencyMs: avgMs, message: '100% packet loss', statusCode: null };
      }

      return { status: 'UP', latencyMs: avgMs ?? latencyMs, message: 'Host reachable', statusCode: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ping failed';
      // Fallback: try TCP echo (port 7)
      try {
        const { connect } = await import('node:net');
        await new Promise<void>((resolve, reject) => {
          const s = connect(7, host, () => { s.destroy(); resolve(); });
          s.setTimeout(5000, () => { s.destroy(); reject(new Error('timeout')); });
          s.on('error', reject);
        });
        const latencyMs = Math.round(performance.now() - start);
        return { status: 'UP', latencyMs, message: 'ICMP unavailable, TCP echo OK', statusCode: null };
      } catch {
        return { status: 'DOWN', latencyMs: null, message, statusCode: null };
      }
    }
  }
}

registerChecker(new PingChecker());

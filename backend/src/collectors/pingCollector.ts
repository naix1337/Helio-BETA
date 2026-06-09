// helio-app/backend/src/collectors/pingCollector.ts
import net from 'net';
import ping from 'ping';
import type { Queries } from '../db/queries.js';

export interface ProbeResult {
  success: boolean;
  latency_ms: number | null;
  status_code?: number | null;
  error?: string | null;
  icmp_fallback?: boolean;
}

export type PingTargetRow = {
  id: number;
  name: string;
  host: string;
  type: string;
  port: number | null;
  interval_ms: number;
  timeout_ms: number;
  enabled: number;
  created_at: number;
  tags: string;
};

export function computePingStatus(
  lastResults: { success: boolean }[],
): 'up' | 'degraded' | 'down' {
  if (lastResults.length === 0) return 'down';
  const last1 = lastResults.slice(0, 1);
  const last3 = lastResults.slice(0, 3);
  const last5 = lastResults.slice(0, 5);
  if (last1[0]?.success === false) return 'down';
  if (last3.every(r => r.success)) return 'up';
  // fewer than 3 of last 5 successful = degraded
  const successCount = last5.filter(r => r.success).length;
  if (successCount < 3) return 'degraded';
  return 'up';
}

function tcpProbe(
  port: number,
  host: string,
  timeoutMs: number,
): Promise<{ success: boolean; latency_ms: number | null; error?: string }> {
  return new Promise(resolve => {
    const start = Date.now();
    const socket = net.connect(port, host);
    socket.setTimeout(timeoutMs);

    socket.once('connect', () => {
      const latency_ms = Date.now() - start;
      socket.destroy();
      resolve({ success: true, latency_ms });
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve({ success: false, latency_ms: null, error: 'TCP connection timed out' });
    });

    socket.once('error', (err: Error) => {
      resolve({ success: false, latency_ms: null, error: err.message });
    });
  });
}

export class PingCollector {
  private intervals = new Map<number, NodeJS.Timeout>();
  private broadcast: (msg: object) => void;
  private queries: Queries;

  constructor(db: Queries, broadcast: (msg: object) => void) {
    this.queries = db;
    this.broadcast = broadcast;
  }

  start(): void {
    const targets = this.queries.listPingTargets() as PingTargetRow[];
    for (const target of targets) {
      if (target.enabled === 1) {
        this.addTarget(target);
      }
    }
  }

  stop(): void {
    for (const handle of this.intervals.values()) {
      clearInterval(handle);
    }
    this.intervals.clear();
  }

  addTarget(target: PingTargetRow): void {
    // Clear any existing interval for this target first
    const existing = this.intervals.get(target.id);
    if (existing !== undefined) {
      clearInterval(existing);
    }
    const handle = setInterval(() => this.runCycle(target), target.interval_ms);
    this.intervals.set(target.id, handle);
  }

  removeTarget(id: number): void {
    const handle = this.intervals.get(id);
    if (handle !== undefined) {
      clearInterval(handle);
      this.intervals.delete(id);
    }
  }

  async probe(target: {
    host: string;
    type: string;
    port?: number | null;
    timeout_ms: number;
  }): Promise<ProbeResult> {
    const { host, type, port, timeout_ms } = target;

    if (type === 'icmp') {
      try {
        const res = await ping.promise.probe(host, {
          timeout: Math.ceil(timeout_ms / 1000),
        });
        if (res.alive) {
          return {
            success: true,
            latency_ms: typeof res.time === 'number' ? res.time : null,
          };
        }
      } catch {
        // fall through to TCP fallback
      }

      // TCP fallback on port 80
      const fallback = await tcpProbe(80, host, timeout_ms);
      if (fallback.success) {
        return {
          success: true,
          latency_ms: fallback.latency_ms,
          icmp_fallback: true,
        };
      }
      return {
        success: false,
        latency_ms: null,
        error: fallback.error ?? 'ICMP and TCP fallback failed',
      };
    }

    if (type === 'http') {
      const url =
        port != null
          ? `http://${host}:${port}`
          : `http://${host}`;
      const start = Date.now();
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(timeout_ms),
        });
        const latency_ms = Date.now() - start;
        const statusCode = response.status;
        return {
          success: response.ok || statusCode < 500,
          latency_ms,
          status_code: statusCode,
        };
      } catch (err) {
        return {
          success: false,
          latency_ms: null,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    if (type === 'tcp') {
      const result = await tcpProbe(port ?? 80, host, timeout_ms);
      return {
        success: result.success,
        latency_ms: result.latency_ms,
        error: result.error ?? null,
      };
    }

    return { success: false, latency_ms: null, error: `Unknown probe type: ${type}` };
  }

  private async runCycle(target: PingTargetRow): Promise<void> {
    const ts = Math.floor(Date.now() / 1000);
    const result = await this.probe(target);
    this.queries.insertPingResult(
      target.id,
      ts,
      result.success,
      result.latency_ms ?? null,
      result.status_code ?? null,
      result.error ?? null,
      result.icmp_fallback ?? false,
    );
    this.broadcast({
      type: 'ping_update',
      targetId: target.id,
      result: { ts, ...result },
    });
  }
}

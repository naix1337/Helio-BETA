import { Agent, fetch as undiciFetch } from 'undici';
import type { IChecker, CheckResult } from './IChecker.js';
import type { HttpConfig } from '@pulse/shared';
import { registerChecker } from './registry.js';

/** Shared dispatchers — one strict, one that accepts self-signed / expired certs */
const strictAgent = new Agent({ connect: { timeout: 30000 } });
const insecureAgent = new Agent({ connect: { timeout: 30000, rejectUnauthorized: false } });

const MAX_BODY_BYTES = 2 * 1024 * 1024;

/** Resolve a simple JSONPath like `$.data.items[0].status` */
function resolveJsonPath(json: unknown, path: string): unknown {
  const parts = path
    .replace(/^\$\.?/, '')
    .replace(/\[(\d+)\]/g, '.$1')
    .split(/[./]/)
    .filter(Boolean);
  let value: unknown = json;
  for (const key of parts) {
    if (value && typeof value === 'object') {
      value = (value as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return value;
}

export class HttpChecker implements IChecker {
  readonly type = 'http';

  async check(config: unknown): Promise<CheckResult> {
    const cfg = config as HttpConfig & { jsonPathExpected?: string; invertKeyword?: boolean };
    const start = performance.now();
    const controller = new AbortController();
    const timeoutMs = cfg.timeoutMs ?? 30000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const method = cfg.method ?? 'GET';
      const headers: Record<string, string> = {
        'User-Agent': 'Helio-Monitor/2 (+https://github.com/naix1337/Helio-BETA)',
        Accept: '*/*',
        ...(cfg.headers ?? {}),
      };
      if (cfg.basicAuthUser) {
        headers['Authorization'] = 'Basic ' + Buffer.from(`${cfg.basicAuthUser}:${cfg.basicAuthPass ?? ''}`).toString('base64');
      }
      const hasBody = cfg.body && !['GET', 'HEAD'].includes(method);
      if (hasBody && !Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')) {
        headers['Content-Type'] = 'application/json';
      }

      const response = await undiciFetch(cfg.url, {
        method,
        headers,
        body: hasBody ? cfg.body : undefined,
        signal: controller.signal,
        redirect: cfg.followRedirects === false ? 'manual' : 'follow',
        dispatcher: cfg.ignoreTls ? insecureAgent : strictAgent,
      });

      const latencyMs = Math.round(performance.now() - start);
      const needsBody = Boolean(cfg.keyword || cfg.jsonPath);
      let body = '';
      if (needsBody) {
        const buf = await response.arrayBuffer();
        body = Buffer.from(buf.byteLength > MAX_BODY_BYTES ? buf.slice(0, MAX_BODY_BYTES) : buf).toString('utf-8');
      } else {
        // Release the connection without downloading the body
        await response.body?.cancel().catch(() => undefined);
      }

      // Status code range check
      const min = cfg.statusCodeMin ?? 200;
      const max = cfg.statusCodeMax ?? 299;
      if (response.status < min || response.status > max) {
        return {
          status: 'DOWN',
          latencyMs,
          message: `HTTP ${response.status} ${response.statusText} (expected ${min}-${max})`.trim(),
          statusCode: response.status,
        };
      }

      // Keyword check
      if (cfg.keyword) {
        const found = body.includes(cfg.keyword);
        if (found === Boolean(cfg.invertKeyword)) {
          return {
            status: 'DOWN',
            latencyMs,
            message: cfg.invertKeyword ? `Keyword "${cfg.keyword}" found in body` : `Keyword "${cfg.keyword}" not found in body`,
            statusCode: response.status,
          };
        }
      }

      // JSONPath check
      if (cfg.jsonPath) {
        let json: unknown;
        try {
          json = JSON.parse(body);
        } catch {
          return { status: 'DOWN', latencyMs, message: 'Invalid JSON response for JSONPath check', statusCode: response.status };
        }
        const value = resolveJsonPath(json, cfg.jsonPath);
        if (value === undefined || value === null) {
          return { status: 'DOWN', latencyMs, message: `JSONPath "${cfg.jsonPath}" returned null/undefined`, statusCode: response.status };
        }
        if (cfg.jsonPathExpected !== undefined && cfg.jsonPathExpected !== '' && String(value) !== cfg.jsonPathExpected) {
          return {
            status: 'DOWN',
            latencyMs,
            message: `JSONPath "${cfg.jsonPath}" = "${String(value)}" (expected "${cfg.jsonPathExpected}")`,
            statusCode: response.status,
          };
        }
      }

      return { status: 'UP', latencyMs, message: `HTTP ${response.status} ${response.statusText}`.trim(), statusCode: response.status };
    } catch (err) {
      let message = err instanceof Error ? err.message : 'Unknown error';
      if (controller.signal.aborted) message = `Timeout after ${timeoutMs}ms`;
      const cause = (err as { cause?: { code?: string; message?: string } }).cause;
      if (cause?.message && !controller.signal.aborted) message = `${message}: ${cause.code ?? ''} ${cause.message}`.trim();
      return { status: 'DOWN', latencyMs: null, message, statusCode: null };
    } finally {
      clearTimeout(timeout);
    }
  }
}

registerChecker(new HttpChecker());

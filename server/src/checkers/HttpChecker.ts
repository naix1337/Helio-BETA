import type { IChecker, CheckResult } from './IChecker.js';
import type { HttpConfig } from '@pulse/shared';
import { registerChecker } from './registry.js';

export class HttpChecker implements IChecker {
  readonly type = 'http';

  async check(config: unknown): Promise<CheckResult> {
    const cfg = config as HttpConfig;
    const start = performance.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs ?? 30000);

      const response = await fetch(cfg.url, {
        method: cfg.method ?? 'GET',
        headers: {
          ...(cfg.headers ?? {}),
          ...(cfg.basicAuthUser && cfg.basicAuthPass
            ? { Authorization: 'Basic ' + Buffer.from(`${cfg.basicAuthUser}:${cfg.basicAuthPass}`).toString('base64') }
            : {}),
        },
        signal: controller.signal,
        redirect: cfg.followRedirects !== false ? 'follow' : 'manual',
        ...(cfg.ignoreTls ? {} : {}),
      } as RequestInit);

      clearTimeout(timeout);
      const latencyMs = Math.round(performance.now() - start);
      const body = cfg.keyword || cfg.jsonPath ? await response.text() : '';

      // Status code range check
      const min = cfg.statusCodeMin ?? 200;
      const max = cfg.statusCodeMax ?? 299;
      if (response.status < min || response.status > max) {
        return {
          status: 'DOWN',
          latencyMs,
          message: `HTTP ${response.status} (expected ${min}-${max})`,
          statusCode: response.status,
        };
      }

      // Keyword check
      if (cfg.keyword && !body.includes(cfg.keyword)) {
        return {
          status: 'DOWN',
          latencyMs,
          message: `Keyword "${cfg.keyword}" not found in body`,
          statusCode: response.status,
        };
      }

      // JSONPath check (simple implementation)
      if (cfg.jsonPath) {
        try {
          const json = JSON.parse(body);
          const path = cfg.jsonPath.replace(/^[$/]/, '').split(/[./]/);
          let value: unknown = json;
          for (const key of path) {
            if (value && typeof value === 'object') {
              value = (value as Record<string, unknown>)[key];
            } else {
              value = undefined;
              break;
            }
          }
          if (value === undefined || value === null) {
            return {
              status: 'DOWN',
              latencyMs,
              message: `JSONPath "${cfg.jsonPath}" returned null/undefined`,
              statusCode: response.status,
            };
          }
        } catch {
          return { status: 'DOWN', latencyMs, message: 'Invalid JSON response for JSONPath check', statusCode: response.status };
        }
      }

      return { status: 'UP', latencyMs, message: `HTTP ${response.status}`, statusCode: response.status };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { status: 'DOWN', latencyMs: null, message, statusCode: null };
    }
  }
}

registerChecker(new HttpChecker());

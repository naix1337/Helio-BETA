import { isSafeUrl } from '../utils/urlSafety.js';

export interface HttpResult {
  ok: boolean;
  status: number;
  message: string;
}

/**
 * POST helper for notification providers: SSRF check + timeout + readable errors.
 */
export async function postNotification(
  url: string,
  body: string,
  headers: Record<string, string> = {},
  opts: { checkSsrf?: boolean; timeoutMs?: number } = {},
): Promise<HttpResult> {
  if (opts.checkSsrf !== false) {
    const check = await isSafeUrl(url);
    if (!check.safe) return { ok: false, status: 0, message: `Blocked: ${check.reason}` };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 15000),
    });
    let text = '';
    try { text = (await res.text()).slice(0, 300); } catch { /* ignore */ }
    return { ok: res.ok, status: res.status, message: res.ok ? `HTTP ${res.status}` : `HTTP ${res.status} ${text}`.trim() };
  } catch (err) {
    const e = err as Error & { cause?: { message?: string } };
    return { ok: false, status: 0, message: e.cause?.message ?? e.message ?? 'Request failed' };
  }
}

export function formatDuration(ms?: number): string | undefined {
  if (ms === undefined || ms < 0) return undefined;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

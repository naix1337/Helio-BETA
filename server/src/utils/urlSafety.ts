import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
import { config } from '../config.js';

const BLOCKED_V4 = [
  /^127\./,                     // loopback
  /^10\./,                      // RFC1918 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\./, // RFC1918 172.16.0.0/12
  /^192\.168\./,                // RFC1918 192.168.0.0/16
  /^169\.254\./,                // link-local / cloud metadata
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT 100.64.0.0/10
  /^0\./,                       // current network
];

function isBlockedIp(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return isBlockedIp(v.slice(7));
  if (isIP(v) === 4) return BLOCKED_V4.some((r) => r.test(v));
  if (isIP(v) === 6) {
    return v === '::1' || v === '::' || /^f[cd]/.test(v) || /^fe[89ab]/.test(v);
  }
  return false;
}

/**
 * Check if a URL points to a safe (non-private) network destination.
 * Used to prevent SSRF attacks in notification providers.
 * Can be disabled for homelab setups via NOTIFICATION_ALLOW_PRIVATE=true.
 */
export async function isSafeUrl(urlStr: string): Promise<{ safe: boolean; reason?: string }> {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return { safe: false, reason: 'Invalid URL' };
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return { safe: false, reason: `Unsupported protocol: ${url.protocol}` };
  }

  if (config.allowPrivateNotificationTargets) return { safe: true };

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return { safe: false, reason: 'Blocked host: localhost (set NOTIFICATION_ALLOW_PRIVATE=true to allow)' };
  }

  if (isIP(hostname)) {
    return isBlockedIp(hostname)
      ? { safe: false, reason: `Blocked private IP ${hostname} (set NOTIFICATION_ALLOW_PRIVATE=true to allow)` }
      : { safe: true };
  }

  try {
    const addrs = await lookup(hostname, { all: true });
    const blocked = addrs.find((a) => isBlockedIp(a.address));
    if (blocked) {
      return { safe: false, reason: `Host resolves to private IP ${blocked.address} (set NOTIFICATION_ALLOW_PRIVATE=true to allow)` };
    }
  } catch {
    // DNS failure — the request itself will fail with a clearer error
  }

  return { safe: true };
}

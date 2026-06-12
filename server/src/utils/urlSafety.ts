import { isIP } from 'node:net';
import { resolve4, resolve6 } from 'node:dns/promises';

const BLOCKED_RANGES = [
  /^127\./,         // loopback
  /^10\./,          // RFC1918 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\./, // RFC1918 172.16.0.0/12
  /^192\.168\./,    // RFC1918 192.168.0.0/16
  /^169\.254\./,    // link-local
  /^0\./,           // current network
];

/**
 * Check if a URL points to a safe (non-private) network destination.
 * Used to prevent SSRF attacks in notification providers.
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

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');

  // IP-based check
  if (isIP(hostname)) {
    if (BLOCKED_RANGES.some((r) => r.test(hostname))) {
      return { safe: false, reason: `Blocked IP range: ${hostname}` };
    }
    return { safe: true };
  }

  // DNS resolution check
  try {
    const ips = [
      ...await resolve4(hostname).catch(() => [] as string[]),
      ...await resolve6(hostname).catch(() => [] as string[]),
    ];

    const blocked = ips.find((ip) => BLOCKED_RANGES.some((r) => r.test(ip)));
    if (blocked) {
      return { safe: false, reason: `Host resolves to blocked IP: ${blocked}` };
    }
  } catch {
    // DNS resolution failed but that's OK for the actual fetch
    // The fetch will fail later with a clearer error
  }

  return { safe: true };
}

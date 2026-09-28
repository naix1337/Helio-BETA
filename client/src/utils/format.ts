export const TYPE_LABELS: Record<string, string> = {
  http: 'HTTP', tcp: 'TCP', ping: 'Ping', dns: 'DNS', ssl: 'SSL', push: 'Push',
};

export function formatInterval(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 6) / 10} min`.replace('.0 ', ' ');
  return `${Math.round(sec / 360) / 10} h`.replace('.0 ', ' ');
}

export function uptimeColor(v: number | undefined): string {
  if (v === undefined) return 'var(--color-text-dim)';
  if (v >= 99.9) return 'var(--color-ok)';
  if (v >= 95) return 'var(--color-warn)';
  return 'var(--color-down)';
}

export function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `vor ${Math.max(0, Math.round(diff))}s`;
  if (diff < 3600) return `vor ${Math.round(diff / 60)} min`;
  if (diff < 86400) return `vor ${Math.round(diff / 3600)} h`;
  return `vor ${Math.round(diff / 86400)} d`;
}

/** Short description of the monitor target (URL / host:port / ...) */
export function monitorTarget(type: string, cfg: Record<string, unknown>): string {
  switch (type) {
    case 'http': return String(cfg['url'] ?? '');
    case 'tcp': return `${cfg['host'] ?? ''}:${cfg['port'] ?? ''}`;
    case 'ssl': return `${cfg['host'] ?? ''}:${cfg['port'] ?? 443}`;
    case 'dns': return `${cfg['host'] ?? ''} (${cfg['recordType'] ?? 'A'})`;
    case 'ping': return String(cfg['host'] ?? '');
    case 'push': return 'Push-Endpunkt';
    default: return '';
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case 'UP': return 'var(--color-ok)';
    case 'DOWN': return 'var(--color-down)';
    case 'DEGRADED':
    case 'PENDING': return 'var(--color-warn)';
    default: return 'var(--color-text-dim)';
  }
}

export function pushUrl(origin: string, token: string): string {
  return `${origin}/api/push/${token}?status=up&msg=OK&ping=`;
}

export function publicStatusUrl(slug: string): string {
  return `${window.location.origin}/status/${slug}`;
}

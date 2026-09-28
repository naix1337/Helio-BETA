import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import BeatBar from './BeatBar';
import { uptimeColor } from '../utils/format';

interface PublicMonitor {
  id: string;
  name: string;
  type: string;
  status: 'UP' | 'DOWN' | 'PENDING' | 'PAUSED' | 'DEGRADED';
  inMaintenance: boolean;
  uptime: { last24h: number; last7d: number; last30d: number };
  beats: { status: 'UP' | 'DOWN' | 'PENDING' | 'PAUSED' | 'DEGRADED'; latencyMs: number | null; timestamp: string }[];
}

interface PublicData {
  page: { title: string; slug: string; logoUrl: string | null; incidentBanner: string | null };
  monitors: PublicMonitor[];
  maintenance: { description: string; startsAt: string; endsAt: string }[];
}

const STATUS_TEXT: Record<string, [string, string]> = {
  UP: ['Betriebsbereit', 'var(--color-ok)'],
  DEGRADED: ['Eingeschränkt', 'var(--color-warn)'],
  DOWN: ['Ausfall', 'var(--color-down)'],
  PENDING: ['Ausstehend', 'var(--color-text-dim)'],
  PAUSED: ['Pausiert', 'var(--color-text-dim)'],
};

/** Public, unauthenticated status page at /status/<slug> */
export default function PublicStatusPage({ slug }: { slug: string }) {
  const [data, setData] = useState<PublicData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let theme = 'dark';
    try { theme = localStorage.getItem('helio-theme') || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'); } catch { /* ignore */ }
    document.documentElement.setAttribute('data-theme', theme);

    const load = async () => {
      const res = await apiRequest<PublicData>('GET', `/status-pages/public/${slug}`, undefined, { noAuth: true });
      if (res.success && res.data) {
        setData(res.data);
        setError(null);
        setUpdated(new Date());
        document.title = `${res.data.page.title} — Status`;
      } else {
        setError(res.status === 404 ? 'Status-Seite nicht gefunden' : res.error || 'Fehler beim Laden');
      }
    };
    void load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [slug]);

  if (error && !data) {
    return <div className="min-h-screen grid place-items-center p-4" style={{ color: 'var(--color-text-muted)' }}>{error}</div>;
  }
  if (!data) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const visible = data.monitors.filter((m) => m.status !== 'PAUSED');
  const anyDown = visible.some((m) => m.status === 'DOWN' && !m.inMaintenance);
  const anyDegraded = visible.some((m) => m.status === 'DEGRADED');
  const overall = anyDown
    ? { text: 'Teilweiser Ausfall', color: 'var(--color-down)', bg: 'var(--color-down-soft)' }
    : anyDegraded
      ? { text: 'Eingeschränkter Betrieb', color: 'var(--color-warn)', bg: 'var(--color-warn-soft)' }
      : { text: 'Alle Systeme betriebsbereit', color: 'var(--color-ok)', bg: 'var(--color-ok-soft)' };

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-[860px] mx-auto px-4 py-10">
        <header className="flex items-center gap-4 mb-8">
          {data.page.logoUrl && <img src={data.page.logoUrl} alt="" className="w-[48px] h-[48px] rounded-[10px] object-contain" />}
          <h1 className="text-[1.6rem] font-semibold m-0 tracking-tight" style={{ color: 'var(--color-text)' }}>{data.page.title}</h1>
        </header>

        <div className="rounded-[var(--radius-lg)] px-5 py-4 mb-6 font-semibold text-[1.05rem]" style={{ color: overall.color, background: overall.bg }}>
          {overall.text}
        </div>

        {data.page.incidentBanner && <div className="alert alert-warn mb-6" style={{ whiteSpace: 'pre-wrap' }}>{data.page.incidentBanner}</div>}

        {data.maintenance.map((mw, i) => (
          <div key={i} className="alert mb-4" style={{ color: 'var(--color-violet)', background: 'var(--color-violet-soft)' }}>
            🔧 Wartung: {mw.description} ({new Date(mw.startsAt).toLocaleString()} – {new Date(mw.endsAt).toLocaleString()})
          </div>
        ))}

        <div className="card overflow-hidden">
          {visible.length === 0 && <div className="p-8 text-center" style={{ color: 'var(--color-text-dim)' }}>Keine Dienste konfiguriert.</div>}
          {visible.map((m) => {
            const [label, color] = m.inMaintenance ? ['Wartung', 'var(--color-violet)'] : STATUS_TEXT[m.status] ?? ['?', 'var(--color-text-dim)'];
            return (
              <div key={m.id} className="px-5 py-4 border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="font-medium" style={{ color: 'var(--color-text)' }}>{m.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[0.8rem]" style={{ color: uptimeColor(m.uptime.last24h) }}>{m.uptime.last24h}%</span>
                    <span className="text-[0.85rem] font-medium" style={{ color }}>{label}</span>
                  </div>
                </div>
                <BeatBar beats={m.beats} slots={60} className="w-full overflow-hidden" />
              </div>
            );
          })}
        </div>

        <footer className="mt-6 flex justify-between text-[0.75rem] font-mono" style={{ color: 'var(--color-text-dim)' }}>
          <span>{updated ? `Aktualisiert ${updated.toLocaleTimeString()}` : ''}</span>
          <span>Powered by Helio</span>
        </footer>
      </div>
    </div>
  );
}

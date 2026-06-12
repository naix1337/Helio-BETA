import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { getHeartbeats } from '../api/monitors';
import { prepCanvas, getCSSVar, hexA } from '../utils/chart';

const RANGE_MAP: Record<string, string> = {
  '1': '24h', '6': '24h', '24': '24h', '7d': '7d',
};

export default function MainChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRange = useStore((s) => s.timeRange);
  const monitors = useStore((s) => s.monitors);
  const monitorsLoading = useStore((s) => s.monitorsLoading);
  const [latencies, setLatencies] = useState<number[]>([]);
  const [stats, setStats] = useState({ up: 0, total: 0, avgMs: 0, sources: '' });

  // Fetch real heartbeat data periodically
  useEffect(() => {
    if (monitors.length === 0) return;

    let cancelled = false;
    const fetch = async () => {
      const allLat: number[] = [];
      let up = 0, total = 0;
      const sources: string[] = [];

      const activeMonitors = monitors.filter((m2) => m2.status !== 'PAUSED' && m2.status !== 'PENDING').slice(0, 10);
      const apiRange = RANGE_MAP[timeRange] || '24h';

      const results = await Promise.allSettled(
        activeMonitors.map((m) => getHeartbeats(m.id, apiRange))
      );

      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status !== 'fulfilled') continue;
        const hbs = r.value;
        if (hbs.length > 0) sources.push(activeMonitors[i]!.name);
        for (const hb of hbs) {
          if (hb.latencyMs !== null) allLat.push(hb.latencyMs);
          if (hb.status === 'UP') up++;
          total++;
        }
      }

      if (!cancelled) {
        setLatencies(allLat.slice(-200));
        setStats({
          up, total,
          avgMs: allLat.length > 0 ? Math.round(allLat.reduce((a, b) => a + b, 0) / allLat.length) : 0,
          sources: sources.length > 0 ? sources.slice(0, 3).join(', ') + (sources.length > 3 ? ' …' : '') : '—',
        });
      }
    };

    fetch();
    const interval = setInterval(fetch, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [monitors.length, timeRange]);

  // Draw chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const prep = prepCanvas(canvas);
    if (!prep) return;
    const { ctx, w, h } = prep;
    ctx.clearRect(0, 0, w, h);

    const primary = getCSSVar('--color-primary');
    const grid = getCSSVar('--color-grid-line');
    const pad = 8;

    // Gridlines
    ctx.strokeStyle = grid; ctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) {
      const y = pad + (g / 4) * (h - pad * 2);
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke();
    }

    if (latencies.length < 2) {
      ctx.fillStyle = getCSSVar('--color-text-dim');
      ctx.font = '13px Inter, sans-serif';
      ctx.textAlign = 'center';
      const msg = monitorsLoading ? '💤 Lade Monitore…' : stats.total > 0 ? '⏳ Sammle Latenzdaten…' : '💤 Warte auf erste Heartbeat-Daten…';
      ctx.fillText(msg, w / 2, h / 2);
      return;
    }

    // Bar chart of latencies, newest on right
    const maxLat = Math.max(...latencies, 10);
    const barW = Math.max(2, (w - pad * 2) / latencies.length - 1);

    latencies.forEach((lat, i) => {
      const x = w - pad - (latencies.length - 1 - i) * (barW + 1);
      const barH = (lat / maxLat) * (h - pad * 2);
      const y = h - pad - barH;
      const hue = 160 - (lat / maxLat) * 80; // green → yellow → orange based on latency
      ctx.fillStyle = `hsla(${Math.max(hue, 30)}, 75%, 50%, 0.5)`;
      ctx.fillRect(x, y, Math.max(barW, 2), barH);
    });

    // Average line
    const avg = stats.avgMs;
    const avgY = h - pad - (avg / maxLat) * (h - pad * 2);
    ctx.strokeStyle = hexA(primary, 0.5);
    ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(pad, avgY); ctx.lineTo(w - pad, avgY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = hexA(primary, 0.7);
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Ø ${avg} ms`, pad + 4, avgY - 4);
  }, [latencies, monitorsLoading, stats]);

  return (
    <div className="border rounded-[var(--radius-lg)] overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
      <div className="flex items-center justify-between gap-3 px-[18px] py-[16px] border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div>
          <h3 className="text-[0.96rem] font-semibold m-0" style={{ color: 'var(--color-text)' }}>Latenz-Verlauf</h3>
          <div className="font-mono text-[0.76rem] mt-[2px]" style={{ color: 'var(--color-text-dim)' }}>
            {stats.sources !== '—' ? `Quelle: ${stats.sources}` : 'Warte auf Monitor-Checks…'}
          </div>
        </div>
        {latencies.length > 0 && (
          <span className="font-mono text-[0.72rem] px-[8px] py-[3px] rounded-full border" style={{ borderColor: 'var(--color-primary-soft)', background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
            {latencies.length} Datenpunkte
          </span>
        )}
      </div>

      <div className="p-[18px]">
        <div className="relative w-full h-[240px]">
          <canvas ref={canvasRef} className="w-full h-full block" />
        </div>

        <div className="grid grid-cols-3 max-[600px]:grid-cols-1 gap-px mt-4 border rounded-[var(--radius-box)] overflow-hidden" style={{ background: 'var(--color-border)' }}>
          {[
            { label: 'Ausgewertete Monitore', value: stats.sources !== '—' ? stats.sources.split(',').length + ' Monitore' : '—' },
            { label: 'Durchschn. Latenz', value: latencies.length > 0 ? `${stats.avgMs} ms` : '—' },
            { label: 'Uptime (Ø)', value: stats.total > 0 ? `${Math.round((stats.up / stats.total) * 100)} %` : '—', ok: true },
          ].map((s) => (
            <div key={s.label} className="px-[14px] py-[12px]" style={{ background: 'var(--color-surface)' }}>
              <div className="text-[0.72rem]" style={{ color: 'var(--color-text-dim)' }}>{s.label}</div>
              <div className={`font-mono text-[1.05rem] font-semibold mt-[3px] ${s.ok ? 'text-[var(--color-ok)]' : ''}`}
                style={{ color: s.ok ? undefined : 'var(--color-text)' }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

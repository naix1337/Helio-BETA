import { useEffect, useState } from 'react';
import { useStore, type UptimeSummary } from '../store/useStore';
import { getUptime } from '../api/monitors';
import { Activity, TrendingUp, BarChart3, Zap } from 'lucide-react';
import { statusColor } from '../utils/format';
import { formatInterval, uptimeColor } from '../utils/format';

export default function MetricsView() {
  const monitors = useStore((s) => s.monitors);
  const setDetailMonitor = useStore((s) => s.setDetailMonitor);
  const [uptimes, setUptimes] = useState<Record<string, UptimeSummary>>({});
  const idKey = monitors.map((m) => m.id).join(',');

  useEffect(() => {
    let cancelled = false;
    const ids = idKey ? idKey.split(',') : [];
    Promise.all(ids.map(async (id) => [id, await getUptime(id).catch(() => null)] as const)).then((entries) => {
      if (cancelled) return;
      const out: Record<string, UptimeSummary> = {};
      for (const [id, u] of entries) if (u) out[id] = u;
      setUptimes(out);
    });
    return () => { cancelled = true; };
  }, [idKey]);

  const values = Object.values(uptimes);
  const avg = (k: keyof UptimeSummary) => values.length ? Math.round((values.reduce((s, u) => s + u[k], 0) / values.length) * 100) / 100 : undefined;
  const avgInterval = monitors.length ? Math.round(monitors.reduce((s, m) => s + m.intervalSeconds, 0) / monitors.length) : 0;

  const kpis = [
    { icon: <Activity className="w-[16px] h-[16px]" />, label: 'Monitore', value: String(monitors.length) },
    { icon: <Zap className="w-[16px] h-[16px]" />, label: 'Ø Uptime 24h', value: avg('last24h') !== undefined ? `${avg('last24h')}%` : '—', color: uptimeColor(avg('last24h')) },
    { icon: <BarChart3 className="w-[16px] h-[16px]" />, label: 'Ø Uptime 30 Tage', value: avg('last30d') !== undefined ? `${avg('last30d')}%` : '—', color: uptimeColor(avg('last30d')) },
    { icon: <TrendingUp className="w-[16px] h-[16px]" />, label: 'Ø Prüfintervall', value: monitors.length ? formatInterval(avgInterval) : '—' },
  ];

  const cell = (v: number | undefined) => (
    <td className="font-mono tabular-nums" style={{ textAlign: 'right', color: uptimeColor(v) }}>{v !== undefined ? `${v}%` : '—'}</td>
  );

  return (
    <div className="animate-[view-fade_0.35s_cubic-bezier(0.22,1,0.36,1)]">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        {kpis.map((k) => (
          <div key={k.label} className="card p-[16px]">
            <div className="flex items-center gap-[8px] text-[0.8rem]" style={{ color: 'var(--color-text-muted)' }}>
              <span className="w-[26px] h-[26px] rounded-[7px] grid place-items-center" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>{k.icon}</span>
              {k.label}
            </div>
            <div className="font-mono text-[1.5rem] font-[650] tracking-tight mt-[10px] leading-none" style={{ color: k.color ?? 'var(--color-text)' }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <div className="card-header font-medium text-[0.95rem]" style={{ color: 'var(--color-text)' }}>Uptime-Übersicht</div>
        <table className="table">
          <thead>
            <tr>
              <th>Monitor</th>
              <th style={{ textAlign: 'right' }}>24h</th>
              <th style={{ textAlign: 'right' }}>7 Tage</th>
              <th style={{ textAlign: 'right' }}>30 Tage</th>
              <th style={{ textAlign: 'right' }} className="max-md:hidden">1 Jahr</th>
            </tr>
          </thead>
          <tbody>
            {monitors.map((m) => {
              const u = uptimes[m.id];
              return (
                <tr key={m.id} className="cursor-pointer hover:bg-[var(--color-surface-2)]" onClick={() => setDetailMonitor(m.id)}>
                  <td style={{ color: 'var(--color-text)' }}>
                    <span className="flex items-center gap-[8px]">
                      <span className="w-[8px] h-[8px] rounded-full" style={{ background: statusColor(m.status) }} />
                      {m.name}
                    </span>
                  </td>
                  {cell(u?.last24h)}
                  {cell(u?.last7d)}
                  {cell(u?.last30d)}
                  <td className="font-mono tabular-nums max-md:hidden" style={{ textAlign: 'right', color: uptimeColor(u?.last365d) }}>{u ? `${u.last365d}%` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

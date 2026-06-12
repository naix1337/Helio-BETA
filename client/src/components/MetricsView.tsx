import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { getUptime } from '../api/monitors';
import { Activity, TrendingUp, BarChart3, Zap } from 'lucide-react';

export default function MetricsView() {
  const monitors = useStore((s) => s.monitors);
  const fetchMonitors = useStore((s) => s.fetchMonitors);
  const [uptimes, setUptimes] = useState<Record<string, { last24h: number; last7d: number; last30d: number }>>({});

  useEffect(() => {
    fetchMonitors();
  }, []);

  useEffect(() => {
    const load = async () => {
      const results: Record<string, any> = {};
      for (const m of monitors) {
        try {
          const u = await getUptime(m.id);
          if (u) results[m.id] = u;
        } catch {}
      }
      setUptimes(results);
    };
    if (monitors.length > 0) load();
  }, [monitors.length]);

  const totalChecks = monitors.length * 100; // Approx
  const avgUptime = monitors.length > 0
    ? Math.round(monitors.reduce((sum, m) => {
        const u = uptimes[m.id];
        return sum + (u?.last24h ?? 0);
      }, 0) / monitors.length * 100) / 100
    : 0;

  return (
    <div className="animate-[view-fade_0.35s_cubic-bezier(0.22,1,0.36,1)]">
      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        {[
          { icon: <Activity className="w-[16px] h-[16px]" />, label: 'Monitore', value: monitors.length },
          { icon: <Zap className="w-[16px] h-[16px]" />, label: 'Ø Uptime (24h)', value: avgUptime >= 99 ? `${avgUptime}%` : `${avgUptime}%`, color: avgUptime >= 99 ? 'var(--color-ok)' : 'var(--color-warn)' },
          { icon: <BarChart3 className="w-[16px] h-[16px]" />, label: 'Datenpunkte', value: `${totalChecks}+` },
          { icon: <TrendingUp className="w-[16px] h-[16px]" />, label: 'Prüfintervalle', value: '~60s' },
        ].map((k, i) => (
          <div key={i} className="border rounded-[var(--radius-lg)] p-[16px]" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <div className="flex items-center gap-[8px] text-[0.8rem]" style={{ color: 'var(--color-text-muted)' }}>
              <span className="w-[26px] h-[26px] rounded-[7px] grid place-items-center" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
                {k.icon}
              </span>
              {k.label}
            </div>
            <div className="font-mono text-[1.5rem] font-[650] tracking-tight mt-[10px] leading-none" style={{ color: 'var(--color-text)' }}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* Monitor uptime table */}
      <div className="border rounded-[var(--radius-lg)] overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="px-[18px] py-[14px] border-b font-medium text-[0.95rem]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
          Uptime-Übersicht
        </div>
        <table className="w-full text-[0.84rem] border-collapse">
          <thead>
            <tr style={{ background: 'var(--color-surface-2)' }}>
              <th className="font-mono text-[0.68rem] uppercase tracking-wider font-medium text-left px-4 py-[10px] border-b" style={{ color: 'var(--color-text-dim)', borderColor: 'var(--color-border)' }}>Monitor</th>
              <th className="font-mono text-[0.68rem] uppercase tracking-wider font-medium text-right px-4 py-[10px] border-b" style={{ color: 'var(--color-text-dim)', borderColor: 'var(--color-border)' }}>24h</th>
              <th className="font-mono text-[0.68rem] uppercase tracking-wider font-medium text-right px-4 py-[10px] border-b" style={{ color: 'var(--color-text-dim)', borderColor: 'var(--color-border)' }}>7 Tage</th>
              <th className="font-mono text-[0.68rem] uppercase tracking-wider font-medium text-right px-4 py-[10px] border-b" style={{ color: 'var(--color-text-dim)', borderColor: 'var(--color-border)' }}>30 Tage</th>
            </tr>
          </thead>
          <tbody>
            {monitors.map((m) => {
              const u = uptimes[m.id];
              return (
                <tr key={m.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-[11px] font-medium" style={{ color: 'var(--color-text)' }}>
                    <span className="flex items-center gap-[8px]">
                      <span className={`w-[8px] h-[8px] rounded-full ${
                        m.status === 'UP' ? 'bg-[var(--color-ok)]' : m.status === 'DOWN' ? 'bg-[var(--color-down)]' : 'bg-[var(--color-warn)]'
                      }`} />
                      {m.name}
                    </span>
                  </td>
                  <td className="px-4 py-[11px] text-right font-mono tabular-nums" style={{
                    color: u && u.last24h >= 99.9 ? 'var(--color-ok)' : u && u.last24h >= 95 ? 'var(--color-warn)' : 'var(--color-down)',
                  }}>{u ? `${u.last24h}%` : '—'}</td>
                  <td className="px-4 py-[11px] text-right font-mono tabular-nums" style={{
                    color: u && u.last7d >= 99.9 ? 'var(--color-ok)' : u && u.last7d >= 95 ? 'var(--color-warn)' : 'var(--color-down)',
                  }}>{u ? `${u.last7d}%` : '—'}</td>
                  <td className="px-4 py-[11px] text-right font-mono tabular-nums" style={{
                    color: u && u.last30d >= 99.9 ? 'var(--color-ok)' : u && u.last30d >= 95 ? 'var(--color-warn)' : 'var(--color-down)',
                  }}>{u ? `${u.last30d}%` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

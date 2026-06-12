import { useEffect } from 'react';
import { useStore } from '../store/useStore';

export default function AlertsView() {
  const monitors = useStore((s) => s.monitors);
  const fetchMonitors = useStore((s) => s.fetchMonitors);

  useEffect(() => {
    fetchMonitors();
  }, [fetchMonitors]);

  const alerts = monitors.filter((m) => m.status === 'DOWN' || m.status === 'DEGRADED');
  const recovered = monitors.filter((m) => m.status === 'UP');

  return (
    <div className="animate-[view-fade_0.35s_cubic-bezier(0.22,1,0.36,1)]">
      {alerts.length === 0 && recovered.length === 0 ? (
        <div className="border rounded-[var(--radius-lg)] p-10 text-center mt-4 flex flex-col items-center gap-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <span className="text-[2rem]">✅</span>
          <p className="m-0 text-[0.95rem] font-medium" style={{ color: 'var(--color-text)' }}>Alle Systeme online</p>
          <p className="m-0 text-[0.85rem]" style={{ color: 'var(--color-text-muted)' }}>Es liegen keine aktiven Alerts vor.</p>
        </div>
      ) : (
        <div className="border rounded-[var(--radius-lg)] overflow-hidden mt-4" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          {/* Active alerts */}
          {alerts.map((m) => {
            const isDown = m.status === 'DOWN';
            const badgeCls = isDown ? 'down' : 'warn';
            const label = isDown ? 'kritisch' : 'warnung';
            return (
              <div key={m.id} className="grid grid-cols-[38px_1fr_auto] gap-[14px] items-center px-[18px] py-[15px] border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
                <span className="w-[36px] h-[36px] rounded-[9px] grid place-items-center text-[1.1rem]" style={{
                  background: isDown ? 'var(--color-down-soft)' : 'var(--color-warn-soft)',
                }}>
                  {isDown ? '🔴' : '⚠️'}
                </span>
                <div>
                  <div className="font-medium text-[0.92rem]" style={{ color: 'var(--color-text)' }}>{m.name}</div>
                  <div className="font-mono text-[0.78rem] mt-[3px]" style={{ color: 'var(--color-text-dim)' }}>
                    Typ: {m.type} · Intervall: {m.intervalSeconds}s
                  </div>
                </div>
                <span className="inline-flex items-center font-mono text-[0.74rem] font-medium px-[10px] py-[4px] rounded-full border" style={{
                  color: `var(--color-${badgeCls})`,
                  borderColor: `var(--color-${badgeCls}-soft)`,
                  background: `var(--color-${badgeCls}-soft)`,
                }}>
                  {label}
                </span>
              </div>
            );
          })}

          {/* Recovered (last 5) */}
          {recovered.length > 0 && (
            <>
              <div className="px-[18px] py-[10px] text-[0.75rem] font-mono uppercase tracking-wider" style={{ color: 'var(--color-text-dim)', background: 'var(--color-surface-2)' }}>
                Online
              </div>
              {recovered.slice(0, 5).map((m) => (
                <div key={m.id} className="grid grid-cols-[38px_1fr_auto] gap-[14px] items-center px-[18px] py-[12px] border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
                  <span className="w-[36px] h-[36px] rounded-[9px] grid place-items-center text-[1.1rem]" style={{ background: 'var(--color-ok-soft)' }}>
                    ✅
                  </span>
                  <div>
                    <div className="font-medium text-[0.88rem]" style={{ color: 'var(--color-text)' }}>{m.name}</div>
                    <div className="font-mono text-[0.76rem]" style={{ color: 'var(--color-text-dim)' }}>{m.type}</div>
                  </div>
                  <span className="inline-flex items-center font-mono text-[0.74rem] font-medium px-[10px] py-[4px] rounded-full border" style={{
                    color: 'var(--color-ok)',
                    borderColor: 'var(--color-ok-soft)',
                    background: 'var(--color-ok-soft)',
                  }}>
                    online
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

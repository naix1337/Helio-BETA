import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { ArrowRight } from 'lucide-react';

export default function AlertFeed() {
  const monitors = useStore((s) => s.monitors);
  const fetchMonitors = useStore((s) => s.fetchMonitors);
  const setView = useStore((s) => s.setView);

  useEffect(() => {
    if (monitors.length === 0) fetchMonitors();
  }, [monitors.length, fetchMonitors]);

  const downMonitors = monitors.filter((m) => m.status === 'DOWN' || m.status === 'DEGRADED');
  const criticalCount = monitors.filter((m) => m.status === 'DOWN').length;

  return (
    <div className="border rounded-[var(--radius-lg)] overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-[18px] py-[16px] border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div>
          <h3 className="text-[0.96rem] font-semibold m-0" style={{ color: 'var(--color-text)' }}>Aktuelle Alerts</h3>
          <div className="font-mono text-[0.76rem] mt-[2px]" style={{ color: 'var(--color-text-dim)' }}>
            {downMonitors.length} aktiv · {criticalCount} kritisch
          </div>
        </div>
        <span className="inline-flex items-center gap-[7px] font-mono text-[0.74rem] px-[10px] py-[4px] rounded-full border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
          <span className="w-[7px] h-[7px] rounded-full" style={{ background: criticalCount > 0 ? 'var(--color-down)' : 'var(--color-ok)', boxShadow: criticalCount > 0 ? '0 0 0 3px var(--color-down-soft)' : '0 0 0 3px var(--color-ok-soft)' }} />
          live
        </span>
      </div>

      {/* Feed items */}
      <div className="flex flex-col">
        {downMonitors.length === 0 ? (
          <div className="px-[16px] py-[24px] text-center">
            <span className="text-[0.85rem]" style={{ color: 'var(--color-ok)' }}>✅ Alle Systeme online</span>
          </div>
        ) : (
          downMonitors.slice(0, 5).map((m) => {
            const isDown = m.status === 'DOWN';
            return (
              <div key={m.id} className="flex gap-3 px-[16px] py-[13px] border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
                <span className="w-[30px] h-[30px] rounded-[8px] flex-none grid place-items-center" style={{
                  background: isDown ? 'var(--color-down-soft)' : 'var(--color-warn-soft)',
                  color: isDown ? 'var(--color-down)' : 'var(--color-warn)',
                }}>
                  {isDown ? '🔴' : '⚠️'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[0.86rem] font-medium" style={{ color: 'var(--color-text)' }}>{m.name}</div>
                  <div className="font-mono text-[0.77rem] mt-[2px]" style={{ color: 'var(--color-text-dim)' }}>
                    {m.type} · {isDown ? 'Nicht erreichbar' : 'Gedrosselt'}
                  </div>
                </div>
                <span className="font-mono text-[0.72rem]" style={{ color: 'var(--color-text-dim)' }}>{m.status}</span>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-[16px] py-[12px] border-t text-center" style={{ borderColor: 'var(--color-border)' }}>
        <button
          onClick={() => setView('alerts')}
          className="text-[0.82rem] font-medium inline-flex items-center gap-[6px] bg-none border-none cursor-pointer"
          style={{ color: 'var(--color-primary)' }}
        >
          Alle Alerts ansehen
          <ArrowRight className="w-[14px] h-[14px]" />
        </button>
      </div>
    </div>
  );
}

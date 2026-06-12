import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Box } from 'lucide-react';

export default function ContainersView() {
  const monitors = useStore((s) => s.monitors);
  const fetchMonitors = useStore((s) => s.fetchMonitors);

  useEffect(() => {
    fetchMonitors();
  }, [fetchMonitors]);

  return (
    <div className="animate-[view-fade_0.35s_cubic-bezier(0.22,1,0.36,1)]">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 mt-4">
        {monitors.length === 0 ? (
          <div className="col-span-full border rounded-[var(--radius-lg)] p-8 text-center" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <p className="m-0 text-[0.9rem]" style={{ color: 'var(--color-text-muted)' }}>
              Keine Monitore vorhanden.
            </p>
          </div>
        ) : (
          monitors.map((m) => {
            const st = m.status === 'UP' ? 'ok' : m.status === 'DOWN' ? 'down' : 'warn';
            return (
              <div key={m.id} className="border rounded-[var(--radius-lg)] p-4 transition-colors hover:border-[var(--color-border-strong)]" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                <div className="flex items-center justify-between gap-[10px]">
                  <span className="flex items-center gap-[9px] font-medium min-w-0" style={{ color: 'var(--color-text)' }}>
                    <Box className="w-[16px] h-[16px]" style={{ color: 'var(--color-primary)' }} />
                    <span className="font-mono text-[0.84rem] truncate">{m.name}</span>
                  </span>
                  <span className={`inline-flex items-center gap-[7px] font-mono text-[0.74rem] font-medium px-[10px] py-[4px] rounded-full border`} style={{
                    color: `var(--color-${st})`,
                    borderColor: `var(--color-${st}-soft)`,
                    background: `var(--color-${st}-soft)`,
                  }}>
                    {m.status}
                  </span>
                </div>
                <div className="font-mono text-[0.74rem] mt-[10px]" style={{ color: 'var(--color-text-dim)' }}>
                  {m.type} · {m.intervalSeconds}s Intervall
                </div>
                <div className="grid grid-cols-2 gap-[10px] mt-[14px]">
                  <div className="border rounded-[8px] p-[9px_11px]" style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}>
                    <div className="text-[0.68rem]" style={{ color: 'var(--color-text-dim)' }}>Typ</div>
                    <div className="font-mono text-[1rem] font-semibold mt-[2px]" style={{ color: 'var(--color-text)' }}>{m.type}</div>
                  </div>
                  <div className="border rounded-[8px] p-[9px_11px]" style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}>
                    <div className="text-[0.68rem]" style={{ color: 'var(--color-text-dim)' }}>Status</div>
                    <div className="font-mono text-[1rem] font-semibold mt-[2px]" style={{ color: m.status === 'UP' ? 'var(--color-ok)' : 'var(--color-down)' }}>{m.status}</div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

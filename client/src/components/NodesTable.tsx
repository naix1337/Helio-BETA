import { useEffect, useRef, useState } from 'react';
import { useStore, type Monitor } from '../store/useStore';
import { drawRowSpark } from '../utils/chart';
import * as monitorsApi from '../api/monitors';
import { Trash2 } from 'lucide-react';

interface NodesTableProps {
  title?: string;
  subtitle?: string;
  full?: boolean;
}

function statusBadge(st: string) {
  const map: Record<string, [string, string]> = {
    UP: ['ok', 'online'],
    DOWN: ['down', 'offline'],
    DEGRADED: ['warn', 'gedrosselt'],
    PENDING: ['warn', 'ausstehend'],
    PAUSED: ['warn', 'pausiert'],
  };
  const [cls, label] = map[st] || ['ok', 'online'];
  return `<span class="inline-flex items-center gap-[7px] font-mono text-[0.74rem] font-medium px-[10px] py-[4px] rounded-full border" style="color:var(--color-${cls});border-color:var(--color-${cls}-soft);background:var(--color-${cls}-soft)">${label}</span>`;
}

export default function NodesTable({ title, subtitle, full }: NodesTableProps) {
  const monitors = useStore((s) => s.monitors);
  const fetchMonitors = useStore((s) => s.fetchMonitors);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Monitor "${name}" wirklich löschen?`)) return;
    await monitorsApi.deleteMonitor(id);
    fetchMonitors();
  };

  return (
    <div>
      {(title || subtitle) && (
        <div className="flex items-center justify-between gap-[14px] mb-4">
          {title && <h2 className="text-[1.05rem] font-semibold tracking-tight m-0" style={{ color: 'var(--color-text)' }}>{title}</h2>}
          {subtitle && <span className="font-mono text-[0.8rem]" style={{ color: 'var(--color-text-dim)' }}>{subtitle}</span>}
        </div>
      )}

      {monitors.length === 0 ? (
        <div className="border rounded-[var(--radius-lg)] p-8 text-center" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <p className="m-0 text-[0.9rem]" style={{ color: 'var(--color-text-muted)' }}>Keine Monitore vorhanden.</p>
        </div>
      ) : (
        <div className="border rounded-[var(--radius-lg)] overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <table className="w-full border-collapse text-[0.86rem]">
            <thead>
              <tr style={{ background: 'var(--color-surface-2)' }}>
                <th className="font-mono text-[0.7rem] uppercase tracking-wider font-medium text-left px-4 py-3 border-b whitespace-nowrap" style={{ color: 'var(--color-text-dim)', borderColor: 'var(--color-border)' }}>Monitor</th>
                <th className="font-mono text-[0.7rem] uppercase tracking-wider font-medium text-left px-4 py-3 border-b whitespace-nowrap max-md:hidden" style={{ color: 'var(--color-text-dim)', borderColor: 'var(--color-border)' }}>Typ</th>
                {full && <th className="font-mono text-[0.7rem] uppercase tracking-wider font-medium text-left px-4 py-3 border-b whitespace-nowrap max-md:hidden" style={{ color: 'var(--color-text-dim)', borderColor: 'var(--color-border)' }}>Intervall</th>}
                <th className="font-mono text-[0.7rem] uppercase tracking-wider font-medium text-left px-4 py-3 border-b whitespace-nowrap max-md:hidden" style={{ color: 'var(--color-text-dim)', borderColor: 'var(--color-border)' }}>Tags</th>
                <th className="font-mono text-[0.7rem] uppercase tracking-wider font-medium text-left px-4 py-3 border-b whitespace-nowrap text-right" style={{ color: 'var(--color-text-dim)', borderColor: 'var(--color-border)' }}>Status</th>
                <th className="font-mono text-[0.7rem] uppercase tracking-wider font-medium text-center px-2 py-3 border-b whitespace-nowrap w-[50px]" style={{ color: 'var(--color-text-dim)', borderColor: 'var(--color-border)' }}></th>
              </tr>
            </thead>
            <tbody>
              {monitors.map((m, i) => (
                <Row key={m.id} monitor={m} index={i} full={full} onDelete={handleDelete} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({ monitor, index, full, onDelete }: { monitor: Monitor; index: number; full?: boolean; onDelete: (id: string, name: string) => void }) {
  const sparkRef = useRef<HTMLCanvasElement>(null);
  const setDetailMonitor = useStore((s) => s.setDetailMonitor);

  useEffect(() => {
    const canvas = sparkRef.current;
    if (!canvas) return;
    const st = monitor.status === 'UP' ? 'ok' : monitor.status === 'DOWN' ? 'down' : 'warn';
    drawRowSpark(canvas, index + 2, st as 'ok' | 'warn' | 'down');
  }, [monitor.status, index]);

  const intervalMins = Math.round(monitor.intervalSeconds / 60);
  const typ = { http: 'HTTP', tcp: 'TCP', ping: 'Ping', dns: 'DNS', ssl: 'SSL', push: 'Push' }[monitor.type] || monitor.type;

  return (
    <tr className="transition-colors duration-100 cursor-pointer hover:bg-[var(--color-surface-2)]" onClick={() => setDetailMonitor(monitor.id)}>
      <td className="px-4 py-[13px] border-b" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
        <span className="flex items-center gap-[10px]" style={{ color: 'var(--color-text)' }}>
          <span className={`w-[9px] h-[9px] rounded-full flex-none inline-block ${
            monitor.status === 'UP' ? 'bg-[var(--color-ok)]' :
            monitor.status === 'DOWN' ? 'bg-[var(--color-down)]' :
            monitor.status === 'DEGRADED' ? 'bg-[var(--color-warn)]' :
            'bg-[var(--color-text-dim)]'
          }`} />
          <span className="font-mono text-[0.84rem] font-medium">{monitor.name}</span>
        </span>
      </td>
      <td className="px-4 py-[13px] border-b max-md:hidden font-mono text-[0.8rem]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>{typ}</td>
      {full && (
        <td className="px-4 py-[13px] border-b max-md:hidden font-mono text-[0.8rem]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
          {intervalMins > 0 ? `${intervalMins} min` : `${monitor.intervalSeconds} s`}
        </td>
      )}
      <td className="px-4 py-[13px] border-b max-md:hidden" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
        <div className="flex gap-1 flex-wrap">
          {monitor.tags.length > 0 ? monitor.tags.map((t) => (
            <span key={t} className="font-mono text-[0.7rem] px-[6px] py-[2px] rounded-[4px]" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-dim)' }}>{t}</span>
          )) : (
            <span className="text-[0.75rem]" style={{ color: 'var(--color-text-dim)' }}>—</span>
          )}
        </div>
      </td>
      <td className="px-4 py-[13px] border-b text-right" style={{ borderColor: 'var(--color-border)' }} dangerouslySetInnerHTML={{ __html: statusBadge(monitor.status) }} />
      <td className="px-2 py-[13px] border-b text-center" style={{ borderColor: 'var(--color-border)' }}>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(monitor.id, monitor.name); }}
          className="w-[30px] h-[30px] rounded-[6px] grid place-items-center border cursor-pointer hover:bg-[var(--color-down-soft)]"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-dim)', background: 'transparent' }}
          title="Löschen"
        >
          <Trash2 className="w-[13px] h-[13px]" />
        </button>
      </td>
    </tr>
  );
}

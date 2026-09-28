import { useMemo } from 'react';
import { Trash2, Edit3, Pause, Play } from 'lucide-react';
import { useStore, useIsAdmin, type Monitor, type Beat } from '../store/useStore';
import * as monitorsApi from '../api/monitors';
import BeatBar from './BeatBar';
import StatusPill from './StatusPill';
import { statusColor } from '../utils/format';
import { TYPE_LABELS, formatInterval, monitorTarget, uptimeColor } from '../utils/format';

interface NodesTableProps {
  title?: string;
  subtitle?: string;
  full?: boolean;
}

export default function NodesTable({ title, subtitle, full }: NodesTableProps) {
  const monitors = useStore((s) => s.monitors);
  const beats = useStore((s) => s.beats);
  const search = useStore((s) => s.search);
  const isAdmin = useIsAdmin();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return monitors;
    return monitors.filter((m) =>
      m.name.toLowerCase().includes(q) ||
      m.type.includes(q) ||
      m.tags.some((t) => t.toLowerCase().includes(q)) ||
      monitorTarget(m.type, monitorsApi.monitorConfig(m)).toLowerCase().includes(q));
  }, [monitors, search]);

  const handleDelete = async (m: Monitor) => {
    if (!confirm(`Monitor "${m.name}" wirklich löschen? Alle Heartbeats werden entfernt.`)) return;
    try {
      await monitorsApi.deleteMonitor(m.id);
      useStore.getState().removeMonitor(m.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Löschen fehlgeschlagen');
    }
  };

  const handleToggle = async (m: Monitor) => {
    try {
      const updated = m.status === 'PAUSED' ? await monitorsApi.resumeMonitor(m.id) : await monitorsApi.pauseMonitor(m.id);
      useStore.getState().upsertMonitor(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Aktion fehlgeschlagen');
    }
  };

  return (
    <div>
      {(title || subtitle) && (
        <div className="flex items-center justify-between gap-[14px] mb-4 flex-wrap">
          {title && <h2 className="text-[1.05rem] font-semibold tracking-tight m-0" style={{ color: 'var(--color-text)' }}>{title}</h2>}
          {subtitle && <span className="font-mono text-[0.8rem]" style={{ color: 'var(--color-text-dim)' }}>{subtitle}</span>}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="m-0 text-[0.9rem]" style={{ color: 'var(--color-text-muted)' }}>
            {monitors.length === 0
              ? isAdmin ? 'Noch keine Monitore. Lege oben rechts mit „+ Monitor“ den ersten an.' : 'Keine Monitore vorhanden.'
              : `Keine Monitore für „${search}“ gefunden.`}
          </p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Monitor</th>
                <th className="max-lg:hidden">Verlauf</th>
                {full && <th className="max-md:hidden">Intervall</th>}
                <th className="max-md:hidden text-right" style={{ textAlign: 'right' }}>Uptime</th>
                <th style={{ textAlign: 'right' }}>Status</th>
                {isAdmin && <th className="w-[1%]"></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <Row key={m.id} monitor={m} beats={beats[m.id] ?? []} full={full} isAdmin={isAdmin} onDelete={handleDelete} onToggle={handleToggle} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({ monitor, beats, full, isAdmin, onDelete, onToggle }: {
  monitor: Monitor; beats: Beat[]; full?: boolean; isAdmin: boolean;
  onDelete: (m: Monitor) => void; onToggle: (m: Monitor) => void;
}) {
  const setDetailMonitor = useStore((s) => s.setDetailMonitor);
  const setEditMonitor = useStore((s) => s.setEditMonitor);

  const counted = beats.filter((b) => b.status !== 'PENDING');
  const uptime = counted.length ? Math.round((counted.filter((b) => b.status !== 'DOWN').length / counted.length) * 1000) / 10 : undefined;
  const last = beats[beats.length - 1];
  const target = monitorTarget(monitor.type, monitorsApi.monitorConfig(monitor));

  return (
    <tr className="transition-colors duration-100 cursor-pointer hover:bg-[var(--color-surface-2)]" onClick={() => setDetailMonitor(monitor.id)}>
      <td>
        <div className="flex items-center gap-[10px] min-w-0">
          <span className="w-[9px] h-[9px] rounded-full flex-none inline-block" style={{ background: statusColor(monitor.status) }} />
          <div className="min-w-0">
            <div className="font-medium truncate max-w-[280px]" style={{ color: 'var(--color-text)' }}>{monitor.name}</div>
            <div className="font-mono text-[0.72rem] truncate max-w-[280px]" style={{ color: 'var(--color-text-dim)' }}>
              {TYPE_LABELS[monitor.type] ?? monitor.type}{target ? ` · ${target}` : ''}
              {last?.latencyMs != null ? ` · ${last.latencyMs} ms` : ''}
            </div>
            {monitor.tags.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-1">
                {monitor.tags.map((t) => (
                  <span key={t} className="font-mono text-[0.66rem] px-[6px] py-[1px] rounded-[4px]" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-dim)' }}>{t}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="max-lg:hidden">
        <BeatBar beats={beats} slots={30} />
      </td>
      {full && <td className="max-md:hidden font-mono text-[0.8rem]">{formatInterval(monitor.intervalSeconds)}</td>}
      <td className="max-md:hidden font-mono text-[0.8rem] tabular-nums" style={{ textAlign: 'right', color: uptimeColor(uptime) }}>
        {uptime !== undefined ? `${uptime}%` : '—'}
      </td>
      <td style={{ textAlign: 'right' }}><StatusPill status={monitor.status} /></td>
      {isAdmin && (
        <td>
          <div className="flex gap-1 justify-end">
            <button onClick={(e) => { e.stopPropagation(); onToggle(monitor); }} className="btn btn-icon" style={{ width: 30, height: 30 }} title={monitor.status === 'PAUSED' ? 'Fortsetzen' : 'Pausieren'}>
              {monitor.status === 'PAUSED' ? <Play className="w-[13px] h-[13px]" /> : <Pause className="w-[13px] h-[13px]" />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); setEditMonitor(monitor.id); }} className="btn btn-icon" style={{ width: 30, height: 30 }} title="Bearbeiten">
              <Edit3 className="w-[13px] h-[13px]" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(monitor); }} className="btn btn-icon btn-danger" style={{ width: 30, height: 30 }} title="Löschen">
              <Trash2 className="w-[13px] h-[13px]" />
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}

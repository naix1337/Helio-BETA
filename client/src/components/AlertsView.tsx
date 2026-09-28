import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { apiRequest } from '../api/client';
import { onWsEvent } from '../hooks/useWebSocket';
import StatusPill from './StatusPill';
import { statusColor } from '../utils/format';
import { relativeTime } from '../utils/format';

interface StatusEvent {
  id: string;
  monitorId: string;
  monitorName: string;
  timestamp: string;
  status: 'UP' | 'DOWN' | 'PENDING' | 'PAUSED' | 'DEGRADED';
  previousStatus: string | null;
  message: string | null;
  latencyMs: number | null;
}

export default function AlertsView() {
  const monitors = useStore((s) => s.monitors);
  const beats = useStore((s) => s.beats);
  const setDetailMonitor = useStore((s) => s.setDetailMonitor);
  const [events, setEvents] = useState<StatusEvent[]>([]);

  useEffect(() => {
    const load = () => apiRequest<StatusEvent[]>('GET', '/monitors/events?limit=100').then((r) => r.data && setEvents(r.data));
    void load();
    return onWsEvent('monitor:status-change', () => void load());
  }, []);

  const alerts = monitors.filter((m) => m.status === 'DOWN' || m.status === 'DEGRADED');

  return (
    <div className="animate-[view-fade_0.35s_cubic-bezier(0.22,1,0.36,1)] flex flex-col gap-5">
      <div className="card overflow-hidden">
        <div className="card-header">
          <h3 className="text-[0.96rem] font-semibold m-0" style={{ color: 'var(--color-text)' }}>Aktive Probleme</h3>
          <span className={`pill ${alerts.length ? 'pill-down' : 'pill-ok'}`}>{alerts.length ? `${alerts.length} aktiv` : 'alles ok'}</span>
        </div>
        {alerts.length === 0 ? (
          <div className="p-8 text-center text-[0.9rem]" style={{ color: 'var(--color-ok)' }}>✅ Alle Systeme online</div>
        ) : alerts.map((m) => {
          const last = beats[m.id]?.[beats[m.id]!.length - 1];
          return (
            <div key={m.id} onClick={() => setDetailMonitor(m.id)} className="grid grid-cols-[1fr_auto] gap-[14px] items-center px-[18px] py-[14px] border-b last:border-b-0 cursor-pointer hover:bg-[var(--color-surface-2)]" style={{ borderColor: 'var(--color-border)' }}>
              <div className="min-w-0">
                <div className="font-medium text-[0.92rem]" style={{ color: 'var(--color-text)' }}>{m.name}</div>
                <div className="font-mono text-[0.78rem] mt-[3px] truncate" style={{ color: 'var(--color-text-dim)' }}>
                  {last?.message || m.type}{last ? ` · ${relativeTime(last.timestamp)}` : ''}
                </div>
              </div>
              <StatusPill status={m.status} />
            </div>
          );
        })}
      </div>

      <div className="card overflow-hidden">
        <div className="card-header">
          <h3 className="text-[0.96rem] font-semibold m-0" style={{ color: 'var(--color-text)' }}>Ereignisse</h3>
          <span className="font-mono text-[0.76rem]" style={{ color: 'var(--color-text-dim)' }}>Statuswechsel</span>
        </div>
        {events.length === 0 ? (
          <div className="p-8 text-center text-[0.88rem]" style={{ color: 'var(--color-text-dim)' }}>Noch keine Ereignisse.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Zeit</th><th>Monitor</th><th>Status</th><th className="max-md:hidden">Meldung</th></tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="cursor-pointer hover:bg-[var(--color-surface-2)]" onClick={() => setDetailMonitor(e.monitorId)}>
                    <td className="font-mono text-[0.76rem] whitespace-nowrap">{new Date(e.timestamp).toLocaleString()}</td>
                    <td style={{ color: 'var(--color-text)' }}>{e.monitorName}</td>
                    <td className="whitespace-nowrap">
                      {e.previousStatus && <span className="font-mono text-[0.72rem] mr-2" style={{ color: statusColor(e.previousStatus) }}>{e.previousStatus} →</span>}
                      <StatusPill status={e.status} />
                    </td>
                    <td className="max-md:hidden text-[0.8rem] max-w-[380px] truncate">{e.message || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

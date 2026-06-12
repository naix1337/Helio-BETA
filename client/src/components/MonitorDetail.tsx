import { useEffect, useState, useRef } from 'react';
import { useStore, type Monitor, type Heartbeat, type UptimeSummary } from '../store/useStore';
import * as monitorsApi from '../api/monitors';
import { ArrowLeft, Pause, Play, Trash2 } from 'lucide-react';
import { prepCanvas, calcPoints, smoothPath, getCSSVar, hexA } from '../utils/chart';

interface MonitorDetailProps {
  monitorId: string;
  onBack: () => void;
}

export default function MonitorDetail({ monitorId, onBack }: MonitorDetailProps) {
  const [monitor, setMonitor] = useState<Monitor | null>(null);
  const [heartbeats, setHeartbeats] = useState<Heartbeat[]>([]);
  const [uptime, setUptime] = useState<UptimeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('24h');
  const fetchMonitors = useStore((s) => s.fetchMonitors);
  const chartRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadData();
  }, [monitorId, range]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [m, hb, ut] = await Promise.all([
        monitorsApi.getMonitor(monitorId),
        monitorsApi.getHeartbeats(monitorId, range),
        monitorsApi.getUptime(monitorId),
      ]);
      setMonitor(m);
      setHeartbeats(hb ?? []);
      setUptime(ut);
    } catch {} finally {
      setLoading(false);
    }
  };

  // Draw latency chart
  useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas || heartbeats.length === 0) return;
    const prep = prepCanvas(canvas);
    if (!prep) return;
    const { ctx, w, h } = prep;
    ctx.clearRect(0, 0, w, h);

    const primary = getCSSVar('--color-primary');
    const violet = getCSSVar('--color-violet');
    const down = getCSSVar('--color-down');
    const grid = getCSSVar('--color-grid-line');
    const pad = 8;

    // Grid
    ctx.strokeStyle = grid; ctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) {
      const y = pad + (g / 4) * (h - pad * 2);
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke();
    }

    const validLatencies = heartbeats
      .map((h) => h.latencyMs)
      .filter((l): l is number => l !== null);

    if (validLatencies.length === 0) {
      ctx.fillStyle = getCSSVar('--color-text-dim');
      ctx.font = '13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Keine Latenzdaten', w / 2, h / 2);
      return;
    }

    // Plot latencies as a bar-like chart
    const maxLat = Math.max(...validLatencies, 10);
    const bottomPad = 24; // extra space for time labels
    const plotH = h - pad - bottomPad;
    const barW = Math.max(2, (w - pad * 2) / heartbeats.length - 1);

    heartbeats.forEach((hb, i) => {
      if (hb.latencyMs === null) return;
      const x = pad + (i / (heartbeats.length - 1)) * (w - pad * 2);
      const barH = (hb.latencyMs / maxLat) * plotH;
      const y = h - pad - bottomPad - barH;
      ctx.fillStyle = hb.status === 'UP' ? hexA(primary, 0.5) : hexA(down, 0.6);
      ctx.fillRect(x - barW / 2, y, Math.max(barW, 2), barH);
    });

    // Draw time labels along the bottom
    const textColor = getCSSVar('--color-text-dim');
    ctx.fillStyle = textColor;
    ctx.font = '10px ' + getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Show 4 evenly-spaced time labels
    const labelPositions = [0, Math.floor(heartbeats.length / 3), Math.floor(heartbeats.length * 2 / 3), heartbeats.length - 1];
    const seen = new Set<number>();
    for (const idx of labelPositions) {
      if (seen.has(idx) || idx >= heartbeats.length) continue;
      seen.add(idx);
      const hb = heartbeats[idx]!;
      const x = pad + (idx / (heartbeats.length - 1)) * (w - pad * 2);
      const time = new Date(hb.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      ctx.fillText(time, x, h - bottomPad + 6);
    }
  }, [heartbeats]);

  const handlePause = async () => {
    await monitorsApi.pauseMonitor(monitorId);
    loadData();
    fetchMonitors();
  };

  const handleResume = async () => {
    await monitorsApi.resumeMonitor(monitorId);
    loadData();
    fetchMonitors();
  };

  const handleDelete = async () => {
    if (!confirm('Monitor wirklich löschen?')) return;
    await monitorsApi.deleteMonitor(monitorId);
    fetchMonitors();
    onBack();
  };

  if (loading || !monitor) {
    return (
      <div className="flex items-center justify-center min-h-[300px]" style={{ color: 'var(--color-text-muted)' }}>
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const now = new Date();
  const created = new Date(monitor.createdAt);
  const uptime24h = uptime?.last24h ?? 0;
  const uptime30d = uptime?.last30d ?? 0;
  const uptime1y = uptime?.last365d ?? 0;
  const upCount = heartbeats.filter((h) => h.status === 'UP').length;
  const totalCount = heartbeats.length;
  const realUptime = totalCount > 0 ? Math.round((upCount / totalCount) * 10000) / 100 : null;

  return (
    <div className="animate-[view-fade_0.35s_cubic-bezier(0.22,1,0.36,1)]">
      {/* Back button + title */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="w-[36px] h-[36px] rounded-[9px] grid place-items-center border cursor-pointer" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)', background: 'transparent' }}>
          <ArrowLeft className="w-[17px] h-[17px]" />
        </button>
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-[1.2rem] font-semibold m-0" style={{ color: 'var(--color-text)' }}>{monitor.name}</h2>
            <span className={`inline-flex items-center font-mono text-[0.75rem] font-medium px-[10px] py-[3px] rounded-full border ${
              monitor.status === 'UP' ? 'text-[var(--color-ok)] border-[var(--color-ok-soft)] bg-[var(--color-ok-soft)]' :
              monitor.status === 'DOWN' ? 'text-[var(--color-down)] border-[var(--color-down-soft)] bg-[var(--color-down-soft)]' :
              'text-[var(--color-warn)] border-[var(--color-warn-soft)] bg-[var(--color-warn-soft)]'
            }`}>{monitor.status}</span>
          </div>
          <span className="font-mono text-[0.75rem]" style={{ color: 'var(--color-text-dim)' }}>
            {monitor.type} · {Math.round(monitor.intervalSeconds / 60)}min Intervall · erstellt {created.toLocaleDateString()}
          </span>
        </div>
        <div className="flex-1" />
        <div className="flex gap-2">
          {monitor.status === 'PAUSED' ? (
            <button onClick={handleResume} className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-box)] text-[0.85rem] border-0 cursor-pointer" style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}>
              <Play className="w-[15px] h-[15px]" /> Fortsetzen
            </button>
          ) : (
            <button onClick={handlePause} className="px-4 py-2 rounded-[var(--radius-box)] text-[0.85rem] border cursor-pointer inline-flex items-center gap-2" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)', background: 'transparent' }}>
              <Pause className="w-[15px] h-[15px]" /> Pausieren
            </button>
          )}
          <button onClick={handleDelete} className="px-4 py-2 rounded-[var(--radius-box)] text-[0.85rem] border cursor-pointer inline-flex items-center gap-2" style={{ borderColor: 'var(--color-down-soft)', color: 'var(--color-down)', background: 'transparent' }}>
            <Trash2 className="w-[15px] h-[15px]" /> Löschen
          </button>
        </div>
      </div>

      {/* Uptime cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Uptime (24h)', value: uptime24h, real: realUptime },
          { label: 'Uptime (30d)', value: uptime30d },
          { label: 'Uptime (365d)', value: uptime1y },
          { label: 'Heartbeats', value: totalCount, suffix: 'total' },
        ].map((c) => (
          <div key={c.label} className="border rounded-[var(--radius-lg)] p-[16px]" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <div className="text-[0.78rem] font-medium" style={{ color: 'var(--color-text-dim)' }}>{c.label}</div>
            <div className="font-mono text-[1.6rem] font-[650] tracking-tight mt-[6px] leading-none" style={{
              color: c.value !== undefined && c.value >= 99.9 ? 'var(--color-ok)' :
                    c.value !== undefined && c.value >= 95 ? 'var(--color-warn)' :
                    'var(--color-text)'
            }}>
              {c.value !== undefined ? `${c.value}%` : '—'}
              {c.suffix && <small className="text-[0.8rem] font-normal ml-1" style={{ color: 'var(--color-text-dim)' }}>{c.suffix}</small>}
            </div>
          </div>
        ))}
      </div>

      {/* Latency chart */}
      <div className="border rounded-[var(--radius-lg)] overflow-hidden mb-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="flex items-center justify-between px-[18px] py-[14px] border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h3 className="text-[0.96rem] font-semibold m-0" style={{ color: 'var(--color-text)' }}>Latenz-Verlauf</h3>
          <div className="flex gap-1" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '9px', overflow: 'hidden' }}>
            {['24h', '7d', '30d'].map((r) => (
              <button key={r} onClick={() => setRange(r)}
                className="px-3 py-[5px] text-[0.78rem] font-mono border-none cursor-pointer transition-colors"
                style={{
                  background: range === r ? 'var(--color-primary-soft)' : 'transparent',
                  color: range === r ? 'var(--color-primary)' : 'var(--color-text-muted)',
                }}
              >{r}</button>
            ))}
          </div>
        </div>
        <div className="p-[16px]">
          <div className="relative w-full h-[200px]">
            <canvas ref={chartRef} className="w-full h-full block" />
          </div>
        </div>
      </div>

      {/* Heartbeat table */}
      <div className="border rounded-[var(--radius-lg)] overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="px-[18px] py-[14px] border-b font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
          Heartbeat-Verlauf ({heartbeats.length} Einträge)
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          <table className="w-full text-[0.82rem] border-collapse">
            <thead>
              <tr style={{ background: 'var(--color-surface-2)' }}>
                <th className="font-mono text-[0.68rem] uppercase tracking-wider font-medium text-left px-4 py-[8px] border-b" style={{ color: 'var(--color-text-dim)', borderColor: 'var(--color-border)' }}>Zeitpunkt</th>
                <th className="font-mono text-[0.68rem] uppercase tracking-wider font-medium text-left px-4 py-[8px] border-b" style={{ color: 'var(--color-text-dim)', borderColor: 'var(--color-border)' }}>Status</th>
                <th className="font-mono text-[0.68rem] uppercase tracking-wider font-medium text-right px-4 py-[8px] border-b" style={{ color: 'var(--color-text-dim)', borderColor: 'var(--color-border)' }}>Latenz</th>
                <th className="font-mono text-[0.68rem] uppercase tracking-wider font-medium text-left px-4 py-[8px] border-b max-md:hidden" style={{ color: 'var(--color-text-dim)', borderColor: 'var(--color-border)' }}>Meldung</th>
              </tr>
            </thead>
            <tbody>
              {heartbeats.slice(0, 100).map((hb) => (
                <tr key={hb.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-[9px] font-mono text-[0.75rem]" style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(hb.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-[9px]">
                    <span className={`font-mono text-[0.75rem] font-medium px-[6px] py-[1px] rounded-[4px] ${
                      hb.status === 'UP' ? 'text-[var(--color-ok)] bg-[var(--color-ok-soft)]' :
                      hb.status === 'DOWN' ? 'text-[var(--color-down)] bg-[var(--color-down-soft)]' :
                      'text-[var(--color-warn)] bg-[var(--color-warn-soft)]'
                    }`}>{hb.status}</span>
                  </td>
                  <td className="px-4 py-[9px] text-right font-mono tabular-nums" style={{ color: hb.latencyMs !== null ? 'var(--color-text)' : 'var(--color-text-dim)' }}>
                    {hb.latencyMs !== null ? `${hb.latencyMs} ms` : '—'}
                  </td>
                  <td className="px-4 py-[9px] text-[0.75rem] max-md:hidden" style={{ color: 'var(--color-text-dim)' }}>
                    {hb.message || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const style = document.createElement('style');
style.textContent = `
  .btn-primary { display:inline-flex;align-items:center;justify-content:center;font-weight:540;border-radius:var(--radius-box);transition:background-color .17s;background:var(--color-primary);color:var(--color-primary-fg); }
  .btn-primary:hover { background:var(--color-primary-hover); }
`;
document.head.appendChild(style);

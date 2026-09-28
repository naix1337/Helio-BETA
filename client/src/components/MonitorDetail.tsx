import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Pause, Play, Trash2, Edit3 } from 'lucide-react';
import { useStore, useIsAdmin, type Heartbeat, type UptimeSummary } from '../store/useStore';
import * as monitorsApi from '../api/monitors';
import { onWsEvent } from '../hooks/useWebSocket';
import { prepCanvas, getCSSVar, hexA } from '../utils/chart';
import { TYPE_LABELS, formatInterval, monitorTarget, uptimeColor } from '../utils/format';
import BeatBar from './BeatBar';
import StatusPill from './StatusPill';
import CopyField from './CopyField';
import { serverOrigin } from '../api/client';
import { pushUrl } from '../utils/format';

interface MonitorDetailProps {
  monitorId: string;
  onBack: () => void;
}

const RANGES = ['1h', '24h', '7d', '30d'] as const;

export default function MonitorDetail({ monitorId, onBack }: MonitorDetailProps) {
  const monitor = useStore((s) => s.monitors.find((m) => m.id === monitorId) ?? null);
  const monitorsLoaded = useStore((s) => s.monitorsLoaded);
  const beats = useStore((s) => s.beats[monitorId] ?? []);
  const setEditMonitor = useStore((s) => s.setEditMonitor);
  const isAdmin = useIsAdmin();

  const [heartbeats, setHeartbeats] = useState<Heartbeat[]>([]);
  const [uptime, setUptime] = useState<UptimeSummary | null>(null);
  const [range, setRange] = useState<(typeof RANGES)[number]>('24h');
  const [loading, setLoading] = useState(true);
  const chartRef = useRef<HTMLCanvasElement>(null);

  const loadData = useCallback(async () => {
    const [hb, ut] = await Promise.all([
      monitorsApi.getHeartbeats(monitorId, range),
      monitorsApi.getUptime(monitorId),
    ]);
    setHeartbeats(hb);
    setUptime(ut);
    setLoading(false);
  }, [monitorId, range]);

  useEffect(() => { void loadData(); }, [loadData]);

  // Live: prepend new heartbeats of this monitor
  useEffect(() => onWsEvent('heartbeat:new', (msg) => {
    const p = msg.payload as { monitorId: string; heartbeat: Heartbeat };
    if (p.monitorId === monitorId) setHeartbeats((prev) => [p.heartbeat, ...prev].slice(0, 5000));
  }), [monitorId]);

  // Refresh uptime numbers periodically
  useEffect(() => {
    const t = setInterval(() => void monitorsApi.getUptime(monitorId).then(setUptime), 60000);
    return () => clearInterval(t);
  }, [monitorId]);

  // Draw latency chart (oldest left → newest right)
  useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas) return;
    const draw = () => {
      const prep = prepCanvas(canvas);
      if (!prep) return;
      const { ctx, w, h } = prep;
      ctx.clearRect(0, 0, w, h);

      const primary = getCSSVar('--color-primary');
      const down = getCSSVar('--color-down');
      const warn = getCSSVar('--color-warn');
      const grid = getCSSVar('--color-grid-line') || getCSSVar('--color-border');
      const textColor = getCSSVar('--color-text-dim');
      const pad = 8;
      const bottomPad = 22;
      const leftPad = 44;
      const plotH = h - pad - bottomPad;

      const data = [...heartbeats].reverse();
      const valid = data.map((d) => d.latencyMs).filter((l): l is number => l !== null);

      ctx.font = '10px ' + (getCSSVar('--font-mono') || 'monospace');
      ctx.strokeStyle = grid;
      ctx.lineWidth = 1;
      const maxLat = Math.max(...valid, 10) * 1.1;
      for (let g = 0; g <= 4; g++) {
        const y = pad + (g / 4) * plotH;
        ctx.beginPath(); ctx.moveTo(leftPad, y); ctx.lineTo(w - pad, y); ctx.stroke();
        ctx.fillStyle = textColor; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.round(maxLat * (1 - g / 4))}`, leftPad - 6, y);
      }

      if (data.length === 0) {
        ctx.fillStyle = textColor; ctx.font = '13px Inter, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('Noch keine Daten in diesem Zeitraum', w / 2, h / 2);
        return;
      }

      const t0 = new Date(data[0]!.timestamp).getTime();
      const t1 = new Date(data[data.length - 1]!.timestamp).getTime();
      const span = Math.max(1, t1 - t0);
      const xOf = (ts: string) => leftPad + ((new Date(ts).getTime() - t0) / span) * (w - pad - leftPad);
      const yOf = (v: number) => pad + plotH - (v / maxLat) * plotH;

      // Down periods as red background bands
      data.forEach((d, i) => {
        if (d.status !== 'DOWN' && d.status !== 'DEGRADED') return;
        const x = xOf(d.timestamp);
        const next = data[i + 1];
        const x2 = next ? xOf(next.timestamp) : x + 2;
        ctx.fillStyle = hexA(d.status === 'DOWN' ? down : warn, 0.18);
        ctx.fillRect(x, pad, Math.max(2, x2 - x), plotH);
      });

      // Latency line + area
      const pts = data.filter((d) => d.latencyMs !== null).map((d) => ({ x: xOf(d.timestamp), y: yOf(d.latencyMs!) }));
      if (pts.length >= 2) {
        const grad = ctx.createLinearGradient(0, pad, 0, pad + plotH);
        grad.addColorStop(0, hexA(primary, 0.28));
        grad.addColorStop(1, hexA(primary, 0));
        ctx.beginPath();
        ctx.moveTo(pts[0]!.x, pad + plotH);
        pts.forEach((p) => ctx.lineTo(p.x, p.y));
        ctx.lineTo(pts[pts.length - 1]!.x, pad + plotH);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.beginPath();
        pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.strokeStyle = primary; ctx.lineWidth = 1.8; ctx.lineJoin = 'round';
        ctx.stroke();
      } else if (pts.length === 1) {
        ctx.beginPath(); ctx.arc(pts[0]!.x, pts[0]!.y, 3, 0, Math.PI * 2); ctx.fillStyle = primary; ctx.fill();
      }

      // Time labels
      ctx.fillStyle = textColor; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const multiDay = span > 36 * 3600 * 1000;
      for (let i = 0; i <= 4; i++) {
        const t = new Date(t0 + (span * i) / 4);
        const label = multiDay
          ? t.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + ' ' + t.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
          : t.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        const x = leftPad + (i / 4) * (w - pad - leftPad);
        ctx.textAlign = i === 0 ? 'left' : i === 4 ? 'right' : 'center';
        ctx.fillText(label, x, h - bottomPad + 6);
      }
    };
    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [heartbeats]);

  if (!monitor) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-4" style={{ color: 'var(--color-text-muted)' }}>
        {monitorsLoaded ? (
          <>
            <span>Monitor nicht gefunden.</span>
            <button className="btn" onClick={onBack}><ArrowLeft className="w-4 h-4" /> Zurück</button>
          </>
        ) : (
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
        )}
      </div>
    );
  }

  const cfg = monitorsApi.monitorConfig(monitor);
  const target = monitorTarget(monitor.type, cfg);
  const valid = heartbeats.map((h) => h.latencyMs).filter((l): l is number => l !== null);
  const avgLatency = valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
  const lastBeat = heartbeats[0];

  const handleToggle = async () => {
    try {
      const updated = monitor.status === 'PAUSED' ? await monitorsApi.resumeMonitor(monitorId) : await monitorsApi.pauseMonitor(monitorId);
      useStore.getState().upsertMonitor(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Aktion fehlgeschlagen');
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Monitor "${monitor.name}" wirklich löschen?`)) return;
    try {
      await monitorsApi.deleteMonitor(monitorId);
      useStore.getState().removeMonitor(monitorId);
      onBack();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Löschen fehlgeschlagen');
    }
  };

  const cards = [
    { label: 'Antwortzeit (aktuell)', value: lastBeat?.latencyMs != null ? `${lastBeat.latencyMs} ms` : '—' },
    { label: `Ø Antwortzeit (${range})`, value: avgLatency !== null ? `${avgLatency} ms` : '—' },
    { label: 'Uptime 24h', value: uptime ? `${uptime.last24h}%` : '—', color: uptimeColor(uptime?.last24h) },
    { label: 'Uptime 30 Tage', value: uptime ? `${uptime.last30d}%` : '—', color: uptimeColor(uptime?.last30d) },
  ];

  return (
    <div className="animate-[view-fade_0.35s_cubic-bezier(0.22,1,0.36,1)]">
      <div className="flex items-start gap-3 mb-5 flex-wrap">
        <button onClick={onBack} className="btn btn-icon" aria-label="Zurück"><ArrowLeft className="w-[17px] h-[17px]" /></button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-[1.2rem] font-semibold m-0 break-all" style={{ color: 'var(--color-text)' }}>{monitor.name}</h2>
            <StatusPill status={monitor.status} />
          </div>
          <div className="font-mono text-[0.76rem] mt-1 break-all" style={{ color: 'var(--color-text-dim)' }}>
            {TYPE_LABELS[monitor.type]} · {target} · alle {formatInterval(monitor.intervalSeconds)}
            {monitor.retries > 0 ? ` · ${monitor.retries} Wiederholungen` : ''}
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleToggle} className={`btn ${monitor.status === 'PAUSED' ? 'btn-primary' : ''}`}>
              {monitor.status === 'PAUSED' ? <><Play className="w-[15px] h-[15px]" /> Fortsetzen</> : <><Pause className="w-[15px] h-[15px]" /> Pausieren</>}
            </button>
            <button onClick={() => setEditMonitor(monitorId)} className="btn"><Edit3 className="w-[15px] h-[15px]" /> Bearbeiten</button>
            <button onClick={handleDelete} className="btn btn-danger"><Trash2 className="w-[15px] h-[15px]" /> Löschen</button>
          </div>
        )}
      </div>

      <div className="card p-4 mb-5">
        <BeatBar beats={beats} slots={60} />
        {lastBeat && (
          <div className="font-mono text-[0.76rem] mt-2" style={{ color: 'var(--color-text-dim)' }}>
            Letzter Check: {new Date(lastBeat.timestamp).toLocaleString()} · {lastBeat.message || lastBeat.status}
          </div>
        )}
      </div>

      {monitor.type === 'push' && isAdmin && typeof cfg['token'] === 'string' && (
        <div className="card p-4 mb-5">
          <label className="label">Push-URL</label>
          <CopyField value={pushUrl(serverOrigin(), cfg['token'] as string)} />
          <p className="hint m-0 mt-2">Per Cronjob aufrufen, z.B. <code>curl -fsS -m 10 '&lt;URL&gt;'</code>. Mit <code>status=down</code> kann ein Fehler gemeldet werden.</p>
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        {cards.map((c) => (
          <div key={c.label} className="card p-[16px]">
            <div className="text-[0.78rem] font-medium" style={{ color: 'var(--color-text-dim)' }}>{c.label}</div>
            <div className="font-mono text-[1.5rem] font-[650] tracking-tight mt-[6px] leading-none" style={{ color: c.color ?? 'var(--color-text)' }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden mb-5">
        <div className="card-header">
          <h3 className="text-[0.96rem] font-semibold m-0" style={{ color: 'var(--color-text)' }}>Antwortzeit (ms)</h3>
          <div className="inline-flex border rounded-[9px] overflow-hidden" style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}>
            {RANGES.map((r) => (
              <button key={r} onClick={() => setRange(r)}
                className="px-3 py-[5px] text-[0.78rem] font-mono border-none cursor-pointer transition-colors"
                style={{ background: range === r ? 'var(--color-primary-soft)' : 'transparent', color: range === r ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
              >{r}</button>
            ))}
          </div>
        </div>
        <div className="p-[16px]">
          <div className="relative w-full h-[220px]">
            {loading ? (
              <div className="w-full h-full grid place-items-center"><div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div>
            ) : <canvas ref={chartRef} className="w-full h-full block" />}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="card-header">
          <h3 className="text-[0.96rem] font-semibold m-0" style={{ color: 'var(--color-text)' }}>Heartbeats</h3>
          <span className="font-mono text-[0.76rem]" style={{ color: 'var(--color-text-dim)' }}>{heartbeats.length} im Zeitraum</span>
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          <table className="table">
            <thead>
              <tr><th>Zeitpunkt</th><th>Status</th><th style={{ textAlign: 'right' }}>Latenz</th><th className="max-md:hidden">Meldung</th></tr>
            </thead>
            <tbody>
              {heartbeats.slice(0, 200).map((hb) => (
                <tr key={hb.id}>
                  <td className="font-mono text-[0.75rem] whitespace-nowrap">{new Date(hb.timestamp).toLocaleString()}</td>
                  <td><StatusPill status={hb.status} /></td>
                  <td className="font-mono tabular-nums" style={{ textAlign: 'right' }}>{hb.latencyMs !== null ? `${hb.latencyMs} ms` : '—'}</td>
                  <td className="max-md:hidden text-[0.78rem] break-all">{hb.message || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

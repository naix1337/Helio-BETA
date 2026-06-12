import { useEffect, useState, useRef } from 'react';
import { apiRequest } from '../api/client';
import { prepCanvas, getCSSVar, hexA } from '../utils/chart';
import { Server, Cpu, MemoryStick, HardDrive, Settings, Activity } from 'lucide-react';

interface Container {
  vmid: number; name: string; node: string; type: string; status: string;
  cpu: number; mem: number; maxmem: number; disk: number; maxdisk: number;
  uptime: number | null; pingMs: number | null;
  netin: number | null; netout: number | null;
  timestamp: string;
}

const METRICS = [
  { key: 'cpu', label: 'CPU', color: '--color-primary', unit: '%' },
  { key: 'ram', label: 'RAM', color: '--color-violet', unit: '%' },
  { key: 'disk', label: 'Disk', color: '--color-warn', unit: '%' },
  { key: 'network', label: 'Netzwerk', color: '--color-ok', unit: 'B' },
] as const;

function MiniBar({ pct, color, label }: { pct: number; color: string; label: string }) {
  const colorMap: Record<string, string> = { primary: 'var(--color-primary)', ok: 'var(--color-ok)', warn: 'var(--color-warn)', down: 'var(--color-down)' };
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[0.82rem] tabular-nums w-[55px]" style={{ color: 'var(--color-text)' }}>{label}</span>
      <div className="w-[70px] h-[6px] rounded-full overflow-hidden" style={{ background: 'var(--color-surface-3)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: colorMap[color] || color }} />
      </div>
    </div>
  );
}

export default function ContainerDashboard() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [config, setConfig] = useState<{ host: string; user: string; intervalSeconds: number; connected: boolean } | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [cfgHost, setCfgHost] = useState(''); const [cfgUser, setCfgUser] = useState('');
  const [cfgPass, setCfgPass] = useState(''); const [cfgInterval, setCfgInterval] = useState(60);
  const [testResult, setTestResult] = useState('');
  const [selected, setSelected] = useState<Container | null>(null);
  const [history, setHistory] = useState<Container[]>([]);
  const [metricTab, setMetricTab] = useState('cpu');
  const chartRef = useRef<HTMLCanvasElement>(null);

  const load = async () => {
    const [cRes, cfgRes] = await Promise.all([
      apiRequest<Container[]>('GET', '/containers'),
      apiRequest<any>('GET', '/containers/config'),
    ]);
    if (cRes.data) setContainers(cRes.data);
    if (cfgRes.data) { setConfig(cfgRes.data); if (!cfgRes.data.connected) setShowConfig(true); }
    else setShowConfig(true);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { const i = setInterval(load, 10000); return () => clearInterval(i); }, []);

  // Load history on selection
  useEffect(() => {
    if (!selected) return;
    setMetricTab('cpu');
    apiRequest<Container[]>('GET', `/containers/${selected.vmid}/history`).then((r) => { if (r.data) setHistory(r.data); });
  }, [selected?.vmid]);

  // Draw chart based on selected metric tab
  useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas || history.length < 2) return;
    const prep = prepCanvas(canvas);
    if (!prep) return;
    const { ctx, w, h } = prep;
    ctx.clearRect(0, 0, w, h);
    const grid = getCSSVar('--color-grid-line'); const pad = 8; const pH = h - pad * 2;

    // Grid
    ctx.strokeStyle = grid; ctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) { const y = pad + (g / 4) * pH; ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke(); }

    let data: number[] = [];
    let color = '';
    let maxVal = 100;

    if (metricTab === 'cpu') {
      data = history.map((h) => parseFloat((h.cpu * 100).toFixed(2)));
      color = getCSSVar('--color-primary');
    } else if (metricTab === 'ram') {
      data = history.map((h) => h.maxmem > 0 ? Math.round((h.mem / h.maxmem) * 100) : 0);
      color = getCSSVar('--color-violet');
    } else if (metricTab === 'disk') {
      data = history.map((h) => h.maxdisk > 0 ? Math.round((h.disk / h.maxdisk) * 100) : 0);
      color = getCSSVar('--color-warn');
    } else if (metricTab === 'network') {
      data = history.map((h) => {
        const net = (h.netout || 0) + (h.netin || 0);
        return Math.round(net / 1024 / 1024 * 100) / 100; // in MB
      });
      color = getCSSVar('--color-ok');
      maxVal = Math.max(...data, 1) * 1.2;
    }

    if (data.length < 2) {
      ctx.fillStyle = getCSSVar('--color-text-dim');
      ctx.font = '13px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Warte auf Daten…', w / 2, h / 2);
      return;
    }

    // Draw area
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, hexA(color, 0.25)); grad.addColorStop(1, hexA(color, 0));
    ctx.beginPath();
    data.forEach((v, i) => { const x = pad + (i / (data.length - 1)) * (w - pad * 2); const y = h - pad - (v / maxVal) * pH; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
    ctx.lineTo(w - pad, h - pad); ctx.lineTo(pad, h - pad); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    // Draw line
    ctx.beginPath();
    data.forEach((v, i) => { const x = pad + (i / (data.length - 1)) * (w - pad * 2); const y = h - pad - (v / maxVal) * pH; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();

    // Last point dot
    const lastX = w - pad; const lastY = h - pad - (data[data.length - 1]! / maxVal) * pH;
    ctx.beginPath(); ctx.arc(lastX, lastY, 3.5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  }, [history, metricTab, selected?.vmid]);

  const saveConfig = async () => {
    const res = await apiRequest('POST', '/containers/config', { host: cfgHost, user: cfgUser, password: cfgPass, intervalSeconds: cfgInterval });
    if (res.success) { setShowConfig(false); load(); }
  };
  const testConnection = async () => {
    const res = await apiRequest<any>('POST', '/containers/test', { host: cfgHost, user: cfgUser, password: cfgPass });
    setTestResult(res.data?.message || 'Test fehlgeschlagen');
  };

  const running = containers.filter((c) => c.status === 'running');
  const totalCpu = containers.reduce((s, c) => s + c.cpu, 0);
  const totalMem = containers.reduce((s, c) => s + c.mem, 0);
  const totalMaxMem = containers.reduce((s, c) => s + c.maxmem, 1);
  const totalDisk = containers.reduce((s, c) => s + c.disk, 0);
  const totalMaxDisk = containers.reduce((s, c) => s + c.maxdisk, 1);

  return (
    <div className="animate-[view-fade_0.35s_cubic-bezier(0.22,1,0.36,1)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[1.05rem] font-semibold m-0" style={{ color: 'var(--color-text)' }}>Container</h2>
          <span className="font-mono text-[0.78rem]" style={{ color: 'var(--color-text-dim)' }}>
            {config?.connected ? `${containers.length} Container/VM · ${running.length} running · ${config.host}` : 'Nicht verbunden'}
          </span>
        </div>
        <button onClick={() => setShowConfig(!showConfig)} className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-box)] border cursor-pointer text-[0.85rem]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)', background: 'transparent' }}>
          <Settings className="w-[16px] h-[16px]" /> Konfiguration
        </button>
      </div>

      {/* Config */}
      {showConfig && (
        <div className="mb-4 p-4 border rounded-[var(--radius-lg)]" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <h3 className="text-[0.95rem] font-semibold m-0 mb-3" style={{ color: 'var(--color-text)' }}>Proxmox-Verbindung</h3>
          <div className="flex flex-col gap-3">
            <input value={cfgHost} onChange={(e) => setCfgHost(e.target.value)} className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] font-mono outline-none" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} placeholder="https://proxmox.local:8006" />
            <div className="grid grid-cols-2 gap-3">
              <input value={cfgUser} onChange={(e) => setCfgUser(e.target.value)} className="h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] font-mono outline-none" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} placeholder="root@pam" />
              <input type="password" value={cfgPass} onChange={(e) => setCfgPass(e.target.value)} className="h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] font-mono outline-none" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} placeholder="Passwort" />
            </div>
            <div className="flex items-center gap-3">
              <input type="number" value={cfgInterval} onChange={(e) => setCfgInterval(Number(e.target.value))} min={10} className="w-[100px] h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] font-mono outline-none" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
              <span className="text-[0.82rem]" style={{ color: 'var(--color-text-dim)' }}>Sekunden Poll-Intervall</span>
            </div>
            {testResult && <div className="text-[0.85rem]" style={{ color: testResult.includes('Verbunden') ? 'var(--color-ok)' : 'var(--color-text-muted)' }}>{testResult}</div>}
            <div className="flex gap-3">
              <button onClick={testConnection} className="px-4 py-[8px] rounded-[var(--radius-box)] border cursor-pointer text-[0.85rem]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)', background: 'transparent' }}>Verbindung testen</button>
              <button onClick={saveConfig} className="px-4 py-[8px] rounded-[var(--radius-box)] border-0 cursor-pointer text-[0.85rem]" style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}>Speichern &amp; verbinden</button>
            </div>
          </div>
        </div>
      )}

      {/* KPI cards */}
      {config?.connected && containers.length > 0 && (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
            {[
              { icon: <Server className="w-[16px] h-[16px]" />, label: 'Container/VM', value: `${containers.length}`, sub: `${running.length} running` },
              { icon: <Cpu className="w-[16px] h-[16px]" />, label: 'CPU gesamt', value: `${(totalCpu * 100).toFixed(1)}%`, sub: `${containers.length} Cores` },
              { icon: <MemoryStick className="w-[16px] h-[16px]" />, label: 'RAM gesamt', value: `${(totalMem / 1024 / 1024 / 1024).toFixed(1)} GB`, sub: `von ${(totalMaxMem / 1024 / 1024 / 1024).toFixed(1)} GB` },
              { icon: <HardDrive className="w-[16px] h-[16px]" />, label: 'Disk gesamt', value: `${(totalDisk / 1024 / 1024 / 1024).toFixed(1)} GB`, sub: `von ${(totalMaxDisk / 1024 / 1024 / 1024).toFixed(1)} GB` },
            ].map((k, i) => (
              <div key={i} className="border rounded-[var(--radius-lg)] p-[16px]" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                <div className="flex items-center gap-[8px] text-[0.8rem]" style={{ color: 'var(--color-text-muted)' }}>
                  <span className="w-[26px] h-[26px] rounded-[7px] grid place-items-center" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>{k.icon}</span>
                  {k.label}
                </div>
                <div className="font-mono text-[1.5rem] font-[650] tracking-tight mt-[8px] leading-none" style={{ color: 'var(--color-text)' }}>{k.value}</div>
                <div className="font-mono text-[0.72rem] mt-[4px]" style={{ color: 'var(--color-text-dim)' }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Detail panel with metric tabs */}
          {selected && (
            <div className="mb-4 border rounded-[var(--radius-lg)] overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
              <div className="flex items-center justify-between px-[18px] py-[14px] border-b" style={{ borderColor: 'var(--color-border)' }}>
                <div>
                  <span className="font-semibold text-[0.95rem]" style={{ color: 'var(--color-text)' }}>{selected.name}</span>
                  <span className="ml-3 font-mono text-[0.78rem]" style={{ color: 'var(--color-text-dim)' }}>
                    CT {selected.vmid} · {selected.node} · {selected.type.toUpperCase()}
                  </span>
                </div>
                <button onClick={() => { setSelected(null); setHistory([]); }} className="text-[0.8rem] bg-none border-none cursor-pointer" style={{ color: 'var(--color-text-dim)' }}>✕</button>
              </div>

              {/* Metric tabs */}
              <div className="flex gap-1 px-[18px] pt-[14px]">
                {METRICS.map((m) => (
                  <button key={m.key} onClick={() => setMetricTab(m.key)}
                    className={`px-4 py-[6px] rounded-t-[8px] text-[0.82rem] font-medium font-mono border border-b-0 cursor-pointer transition-colors`}
                    style={{
                      color: metricTab === m.key ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      background: metricTab === m.key ? 'var(--color-surface)' : 'var(--color-surface-2)',
                      borderColor: 'var(--color-border)',
                      marginBottom: metricTab === m.key ? '-1px' : '0',
                    }}
                  >{m.label}</button>
                ))}
              </div>

              <div className="p-[16px]">
                <div className="h-[180px]"><canvas ref={chartRef} className="w-full h-full block" /></div>
                <div className="flex gap-4 mt-3 text-[0.78rem] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                  {METRICS.filter((m) => m.key === metricTab).map((m) => (
                    <span key={m.key} className="flex items-center gap-2">
                      <span className="w-[10px] h-[10px] rounded-[3px]" style={{ background: `var(${m.color})` }} />
                      {m.label} {m.unit}
                    </span>
                  ))}
                </div>
                <div className="mt-1 flex gap-4 text-[0.72rem] font-mono" style={{ color: 'var(--color-text-dim)' }}>
                  <span>{history.length} Messungen</span>
                  {selected.pingMs !== null && <span>Ping: {selected.pingMs < 0 ? '✗' : `${selected.pingMs}ms`}</span>}
                  {selected.status !== 'running' && <span>Gestoppt</span>}
                </div>
              </div>
            </div>
          )}

          {/* Container table */}
          <div className="border rounded-[var(--radius-lg)] overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <table className="w-full text-[0.84rem] border-collapse">
              <thead>
                <tr style={{ background: 'var(--color-surface-2)' }}>
                  <th className="font-mono text-[0.68rem] uppercase tracking-wider font-medium text-left px-3 py-[10px] border-b" style={{ color: 'var(--color-text-dim)', borderColor: 'var(--color-border)' }}>Name</th>
                  <th className="font-mono text-[0.68rem] uppercase tracking-wider font-medium text-left px-3 py-[10px] border-b max-md:hidden" style={{ color: 'var(--color-text-dim)', borderColor: 'var(--color-border)' }}>VMID</th>
                  <th className="font-mono text-[0.68rem] uppercase tracking-wider font-medium text-left px-3 py-[10px] border-b max-md:hidden" style={{ color: 'var(--color-text-dim)', borderColor: 'var(--color-border)' }}>Node</th>
                  <th className="font-mono text-[0.68rem] uppercase tracking-wider font-medium text-left px-3 py-[10px] border-b" style={{ color: 'var(--color-text-dim)', borderColor: 'var(--color-border)' }}>CPU</th>
                  <th className="font-mono text-[0.68rem] uppercase tracking-wider font-medium text-left px-3 py-[10px] border-b" style={{ color: 'var(--color-text-dim)', borderColor: 'var(--color-border)' }}>RAM</th>
                  <th className="font-mono text-[0.68rem] uppercase tracking-wider font-medium text-left px-3 py-[10px] border-b max-md:hidden" style={{ color: 'var(--color-text-dim)', borderColor: 'var(--color-border)' }}>Disk</th>
                  <th className="font-mono text-[0.68rem] uppercase tracking-wider font-medium text-left px-3 py-[10px] border-b" style={{ color: 'var(--color-text-dim)', borderColor: 'var(--color-border)' }}>Ping</th>
                  <th className="font-mono text-[0.68rem] uppercase tracking-wider font-medium text-left px-3 py-[10px] border-b" style={{ color: 'var(--color-text-dim)', borderColor: 'var(--color-border)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {containers.map((c) => {
                  const cpuPct = parseFloat((c.cpu * 100).toFixed(1));
                  const memPct = c.maxmem > 0 ? Math.round((c.mem / c.maxmem) * 100) : 0;
                  const diskPct = c.maxdisk > 0 ? Math.round((c.disk / c.maxdisk) * 100) : 0;
                  const isRunning = c.status === 'running';
                  return (
                    <tr key={c.vmid} onClick={() => setSelected(c)}
                      className="transition-colors cursor-pointer hover:bg-[var(--color-surface-2)]" style={{ opacity: isRunning ? 1 : 0.5 }}>
                      <td className="px-3 py-[11px] border-b font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                        <span className="flex items-center gap-[8px]">
                          <span className={`w-[8px] h-[8px] rounded-full ${isRunning ? 'bg-[var(--color-ok)]' : 'bg-[var(--color-text-dim)]'}`} />
                          {c.name}
                        </span>
                      </td>
                      <td className="px-3 py-[11px] border-b font-mono max-md:hidden" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>{c.vmid}</td>
                      <td className="px-3 py-[11px] border-b font-mono max-md:hidden" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>{c.node}</td>
                      <td className="px-3 py-[11px] border-b" style={{ borderColor: 'var(--color-border)' }}><MiniBar pct={cpuPct} color={cpuPct > 80 ? 'warn' : 'primary'} label={`${cpuPct.toFixed(1)}%`} /></td>
                      <td className="px-3 py-[11px] border-b" style={{ borderColor: 'var(--color-border)' }}><MiniBar pct={memPct} color={memPct > 80 ? 'warn' : 'primary'} label={`${memPct}%`} /></td>
                      <td className="px-3 py-[11px] border-b max-md:hidden" style={{ borderColor: 'var(--color-border)' }}><MiniBar pct={diskPct} color={diskPct > 80 ? 'down' : diskPct > 50 ? 'warn' : 'primary'} label={`${diskPct}%`} /></td>
                      <td className="px-3 py-[11px] border-b font-mono" style={{ borderColor: 'var(--color-border)', color: c.pingMs !== null ? (c.pingMs < 0 ? 'var(--color-down)' : 'var(--color-text)') : 'var(--color-text-dim)' }}>
                        {c.pingMs !== null ? (c.pingMs < 0 ? '✗' : `${c.pingMs}ms`) : '—'}
                      </td>
                      <td className="px-3 py-[11px] border-b" style={{ borderColor: 'var(--color-border)' }}>
                        <span className={`font-mono text-[0.72rem] font-medium px-[6px] py-[2px] rounded-[4px] ${isRunning ? 'text-[var(--color-ok)] bg-[var(--color-ok-soft)]' : 'text-[var(--color-text-dim)] bg-[var(--color-surface-2)]'}`}>{c.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!config?.connected && !showConfig && (
        <div className="border rounded-[var(--radius-lg)] p-10 text-center" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <Server className="w-[36px] h-[36px] mx-auto mb-3" style={{ color: 'var(--color-primary)' }} />
          <p className="m-0 text-[0.95rem] mb-2" style={{ color: 'var(--color-text)' }}>Proxmox Container-Monitoring</p>
          <p className="m-0 text-[0.85rem]" style={{ color: 'var(--color-text-muted)' }}>
            Klicke auf "Konfiguration" um dich zu verbinden.
          </p>
        </div>
      )}
    </div>
  );
}

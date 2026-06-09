// helio-app/frontend/src/pages/AgentDetail.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Check } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { useAgentsStore } from '../store/agentsStore.ts';
import type { Agent, AgentMetricSnapshot } from '../types.ts';

type Tab = 'overview' | 'metrics' | 'settings';
type Range = '1h' | '6h' | '24h';

function relativeTime(ts: number): string {
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return 'gerade eben';
  if (diff < 3600) return `vor ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)}h`;
  return `vor ${Math.floor(diff / 86400)}d`;
}

function authHeader(): Record<string, string> {
  const token = localStorage.getItem('helio-jwt') ?? '';
  return { Authorization: `Bearer ${token}` };
}

function StatusDot({ online }: { online: boolean }) {
  return (
    <span style={{
      width: '9px', height: '9px', borderRadius: '50%', display: 'inline-block',
      background: online ? 'var(--ok)' : 'var(--text-dim)',
      flexShrink: 0,
    }} />
  );
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 16px', borderRadius: '8px',
        border: '1px solid',
        borderColor: active ? 'var(--primary)' : 'var(--border)',
        background: active ? 'var(--primary-soft)' : 'transparent',
        color: active ? 'var(--primary)' : 'var(--text-muted)',
        fontFamily: 'var(--font-mono)', fontSize: '0.8rem',
        cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );
}

function MiniStatCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 'var(--radius)',
      padding: '14px 16px', background: 'var(--bg-soft)', flex: 1, minWidth: '120px',
    }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
        {value}
        <small style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 400 }}> {unit}</small>
      </div>
    </div>
  );
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = value;
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    });
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '10px 12px', background: 'var(--bg-soft)',
      border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    }}>
      <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--primary)', flex: 1, wordBreak: 'break-all' }}>
        {value}
      </code>
      <button onClick={copy} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: copied ? 'var(--ok)' : 'var(--text-dim)' }}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-soft)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', padding: '8px 12px',
  color: 'var(--text)', fontSize: '0.9rem', width: '100%', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.8rem', color: 'var(--text-dim)', display: 'block', marginBottom: '6px',
};

export function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const agents = useAgentsStore((s) => s.agents);
  const agentMetrics = useAgentsStore((s) => s.agentMetrics);
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);

  const [agent, setAgent] = useState<Agent | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [range, setRange] = useState<Range>('24h');
  const [historyData, setHistoryData] = useState<{ ts: number; cpu: number; ram: number }[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Settings tab state
  const [name, setName] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load agent from store or fetch
  useEffect(() => {
    if (!id) return;
    const found = agents.find(a => a.id === id) ?? null;
    if (found) {
      setAgent(found);
      setName(found.name);
      setTagsInput(found.tags.join(', '));
    } else {
      fetchAgents().then(() => {
        const a = useAgentsStore.getState().agents.find(x => x.id === id) ?? null;
        setAgent(a);
        if (a) { setName(a.name); setTagsInput(a.tags.join(', ')); }
      });
    }
  }, [id, agents, fetchAgents]);

  // Fetch history when tab = metrics or range changes
  useEffect(() => {
    if (tab !== 'metrics' || !id) return;
    setHistoryLoading(true);
    fetch(`/api/agents/${id}/metrics/history?range=${range}`, { headers: authHeader() })
      .then(r => r.ok ? r.json() : [])
      .then((rows: AgentMetricSnapshot[]) => {
        const mapped = rows.map(r => ({
          ts: r.ts,
          cpu: r.cpu_usage ?? 0,
          ram: (r.mem_used != null && r.mem_total != null && r.mem_total > 0)
            ? Math.round((r.mem_used / r.mem_total) * 1000) / 10
            : 0,
        }));
        setHistoryData(mapped);
      })
      .catch(() => setHistoryData([]))
      .finally(() => setHistoryLoading(false));
  }, [tab, id, range]);

  const handleSaveSettings = async () => {
    if (!id || !agent) return;
    setSaving(true);
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    try {
      await fetch(`/api/agents/${id}`, {
        method: 'PUT',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, tags }),
      });
      setAgent(a => a ? { ...a, name, tags } : a);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!id) return;
    await fetch(`/api/agents/${id}`, { method: 'DELETE', headers: authHeader() });
    navigate('/dashboard/agents');
  };

  if (!agent) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
        Lade Agent…
      </div>
    );
  }

  // Live metrics from store ring buffer
  const liveSnaps: AgentMetricSnapshot[] = agentMetrics[agent.id] ?? [];
  const lastSnap = liveSnaps.length > 0 ? liveSnaps[liveSnaps.length - 1] : null;

  const cpu = agent.latestMetrics?.cpuUsage ?? lastSnap?.cpu_usage ?? null;
  const ram = agent.latestMetrics?.memUsedPercent ?? (
    lastSnap?.mem_used != null && lastSnap?.mem_total != null && lastSnap.mem_total > 0
      ? Math.round((lastSnap.mem_used / lastSnap.mem_total) * 1000) / 10
      : null
  );

  // Disk: first disk
  let diskPct: number | null = null;
  if (lastSnap?.disk_json) {
    try {
      const disks = JSON.parse(lastSnap.disk_json) as Array<{ percent: number }>;
      if (disks.length > 0) diskPct = disks[0].percent;
    } catch { /* ignore */ }
  }

  // Network: first iface rx
  let netRx: number | null = null;
  if (lastSnap?.net_json) {
    try {
      const nets = JSON.parse(lastSnap.net_json) as Array<{ rx_sec: number }>;
      if (nets.length > 0) netRx = nets[0].rx_sec;
    } catch { /* ignore */ }
  }

  const osStr = agent.osInfo ? `${agent.osInfo.distro} ${agent.osInfo.release}` : null;

  const formatBytes = (b: number) => {
    if (b < 1024) return `${b} B/s`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB/s`;
    return `${(b / 1024 / 1024).toFixed(1)} MB/s`;
  };

  const formatTs = (ts: number) =>
    new Date(ts * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  return (
    <>
      {/* Back + Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '20px' }}>
        <button
          onClick={() => navigate('/dashboard/agents')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: '4px', marginTop: '4px' }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <StatusDot online={agent.status === 'online'} />
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 640, letterSpacing: '-0.02em' }}>{agent.name}</h1>
            {agent.version && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.72rem', padding: '2px 8px',
                borderRadius: '4px', background: 'var(--bg-soft)', border: '1px solid var(--border)',
                color: 'var(--text-dim)',
              }}>
                v{agent.version}
              </span>
            )}
            {agent.tags.map(tag => (
              <span key={tag} style={{
                background: 'var(--primary-soft)', color: 'var(--primary)',
                fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px',
              }}>
                {tag}
              </span>
            ))}
          </div>
          {osStr && (
            <div style={{ marginTop: '4px', fontSize: '0.8rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              {osStr}
            </div>
          )}
          <div style={{ marginTop: '3px', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
            Zuletzt gesehen: {relativeTime(agent.lastSeen)}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '22px', flexWrap: 'wrap' }}>
        {(['overview', 'metrics', 'settings'] as Tab[]).map(t => (
          <TabBtn
            key={t}
            label={t === 'overview' ? 'Übersicht' : t === 'metrics' ? 'Metriken' : 'Einstellungen'}
            active={tab === t}
            onClick={() => setTab(t)}
          />
        ))}
      </div>

      {/* Tab: Overview */}
      {tab === 'overview' && (
        <>
          {agent.status === 'offline' && (
            <div style={{
              padding: '12px 16px', marginBottom: '16px',
              background: 'color-mix(in srgb, var(--text-dim) 10%, transparent)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              color: 'var(--text-muted)', fontSize: '0.85rem',
            }}>
              Agent ist offline
            </div>
          )}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <MiniStatCard label="CPU-Auslastung" value={cpu != null ? cpu.toFixed(1) : '—'} unit="%" />
            <MiniStatCard label="RAM" value={ram != null ? ram.toFixed(1) : '—'} unit="%" />
            <MiniStatCard label="Disk" value={diskPct != null ? diskPct.toFixed(1) : '—'} unit="%" />
            <MiniStatCard label="Network RX" value={netRx != null ? formatBytes(netRx) : '—'} unit="" />
          </div>
        </>
      )}

      {/* Tab: Metrics */}
      {tab === 'metrics' && (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            {(['1h', '6h', '24h'] as Range[]).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                style={{
                  padding: '5px 14px', borderRadius: '8px',
                  border: '1px solid',
                  borderColor: range === r ? 'var(--primary)' : 'var(--border)',
                  background: range === r ? 'var(--primary-soft)' : 'transparent',
                  color: range === r ? 'var(--primary)' : 'var(--text-muted)',
                  fontSize: '0.8rem', fontFamily: 'var(--font-mono)', cursor: 'pointer',
                }}
              >
                {r}
              </button>
            ))}
          </div>

          {historyLoading ? (
            <div style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', padding: '20px 0' }}>
              Lade Daten…
            </div>
          ) : historyData.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', padding: '20px 0' }}>
              Keine Daten für diesen Zeitraum
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>CPU (%)</div>
              <div style={{ marginBottom: '24px' }}>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={historyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="ts" tickFormatter={formatTs} tick={{ fontSize: 10, fill: 'var(--text-dim)' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-dim)' }} />
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-soft)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem' }}
                      labelFormatter={v => formatTs(v as number)}
                      formatter={(v: number) => [`${v.toFixed(1)}%`, 'CPU']}
                    />
                    <Area type="monotone" dataKey="cpu" stroke="var(--primary)" fill="url(#cpuGrad)" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div style={{ marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>RAM (%)</div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={historyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ramGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="ts" tickFormatter={formatTs} tick={{ fontSize: 10, fill: 'var(--text-dim)' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-dim)' }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-soft)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem' }}
                    labelFormatter={v => formatTs(v as number)}
                    formatter={(v: number) => [`${v.toFixed(1)}%`, 'RAM']}
                  />
                  <Area type="monotone" dataKey="ram" stroke="#8b5cf6" fill="url(#ramGrad)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </>
          )}
        </>
      )}

      {/* Tab: Settings */}
      {tab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '520px' }}>
          {/* Agent ID */}
          <div>
            <label style={labelStyle}>Agent-ID</label>
            <CopyField value={agent.id} />
          </div>

          {/* Name */}
          <div>
            <label style={labelStyle}>Name ändern</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                style={inputStyle}
                value={name}
                onChange={e => setName(e.target.value)}
              />
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                style={{
                  padding: '8px 18px', borderRadius: 'var(--radius)', border: 'none',
                  background: 'var(--primary)', color: 'var(--primary-fg)',
                  cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 540,
                  opacity: saving ? 0.6 : 1, whiteSpace: 'nowrap',
                }}
              >
                {saving ? '…' : 'Speichern'}
              </button>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label style={labelStyle}>Tags bearbeiten (kommagetrennt)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                style={inputStyle}
                placeholder="prod, web, europe"
                value={tagsInput}
                onChange={e => setTagsInput(e.target.value)}
              />
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                style={{
                  padding: '8px 18px', borderRadius: 'var(--radius)', border: 'none',
                  background: 'var(--primary)', color: 'var(--primary-fg)',
                  cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 540,
                  opacity: saving ? 0.6 : 1, whiteSpace: 'nowrap',
                }}
              >
                {saving ? '…' : 'Speichern'}
              </button>
            </div>
          </div>

          {/* Danger zone */}
          <div style={{
            padding: '16px', border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
            borderRadius: 'var(--radius)',
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 540, marginBottom: '10px', color: 'var(--danger, #ef4444)' }}>
              Gefahrenzone
            </div>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                style={{
                  padding: '8px 18px', borderRadius: 'var(--radius)',
                  border: '1px solid color-mix(in srgb, var(--danger) 40%, transparent)',
                  background: 'transparent', color: 'var(--danger, #ef4444)',
                  cursor: 'pointer', fontSize: '0.85rem',
                }}
              >
                Agent entfernen
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Wirklich löschen?</span>
                <button
                  onClick={handleDelete}
                  style={{
                    padding: '7px 16px', borderRadius: 'var(--radius)', border: 'none',
                    background: 'var(--danger, #ef4444)', color: '#fff',
                    cursor: 'pointer', fontWeight: 540, fontSize: '0.85rem',
                  }}
                >
                  Ja, löschen
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  style={{
                    padding: '7px 16px', borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)', background: 'transparent',
                    color: 'var(--text)', cursor: 'pointer', fontSize: '0.85rem',
                  }}
                >
                  Abbrechen
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

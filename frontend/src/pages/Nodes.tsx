// helio-app/frontend/src/pages/Nodes.tsx
import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Copy, Check, Activity, Wifi, WifiOff } from 'lucide-react';
import type { Node, PingResult, PingType } from '../types.ts';

interface NodeForm { name: string; addr: string; }
const BLANK: NodeForm = { name: '', addr: '' };

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-2)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', padding: '8px 12px',
  color: 'var(--text)', fontSize: '0.9rem', width: '100%', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  fontSize: '0.8rem', color: 'var(--text-dim)', display: 'block', marginBottom: '6px',
};

function CopyToken({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(token).catch(() => {
      const ta = document.createElement('textarea'); ta.value = token;
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    });
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ marginTop: '12px', padding: '12px', background: 'var(--surface-2)',
      borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '6px' }}>
        Auth-Token (einmalig sichtbar)
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem',
          color: 'var(--primary)', flex: 1, wordBreak: 'break-all' }}>{token}</code>
        <button onClick={copy} style={{ background: 'none', border: 'none',
          color: copied ? 'var(--ok)' : 'var(--text-dim)', cursor: 'pointer', padding: '4px' }}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={onClose}>
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '28px', width: '420px', maxWidth: '90vw' }}
        onClick={e => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 20px', fontSize: '1.1rem', fontWeight: 600 }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function PingBadge({ result }: { result: PingResult & { loading?: boolean } }) {
  if (result.loading) {
    return (
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
        color: 'var(--text-dim)', padding: '2px 8px' }}>…</span>
    );
  }
  if (!result.reachable) {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: '4px',
        fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--down)',
        background: 'color-mix(in srgb, var(--down) 12%, transparent)',
        padding: '2px 8px', borderRadius: '4px' }}>
        <WifiOff size={11} /> {result.error ?? 'unreachable'}
      </span>
    );
  }
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '4px',
      fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--ok)',
      background: 'color-mix(in srgb, var(--ok) 12%, transparent)',
      padding: '2px 8px', borderRadius: '4px' }}>
      <Wifi size={11} />
      {result.latency_ms} ms
      {result.status ? ` · ${result.status}` : ''}
    </span>
  );
}

async function runPing(type: PingType, host: string, port: number, path?: string): Promise<PingResult> {
  const res = await fetch('/api/ping', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, host, port, path }),
  });
  return res.json() as Promise<PingResult>;
}

function parseAddr(addr: string): { host: string; port: number } | null {
  const match = addr.match(/^(.+):(\d+)$/);
  if (!match) return null;
  return { host: match[1], port: Number(match[2]) };
}

export function Nodes() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editNode, setEditNode] = useState<Node | null>(null);
  const [form, setForm] = useState<NodeForm>(BLANK);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [pingResults, setPingResults] = useState<Record<string, PingResult & { loading?: boolean }>>({});

  const [ptHost, setPtHost] = useState('');
  const [ptPort, setPtPort] = useState('80');
  const [ptType, setPtType] = useState<PingType>('tcp');
  const [ptPath, setPtPath] = useState('/');
  const [ptResult, setPtResult] = useState<PingResult | null>(null);
  const [ptLoading, setPtLoading] = useState(false);

  const fetchNodes = () =>
    fetch('/api/nodes').then(r => r.json()).then(setNodes).catch(console.error);

  useEffect(() => { fetchNodes(); }, []);

  const openAdd = () => { setForm(BLANK); setNewToken(null); setShowAdd(true); };
  const openEdit = (node: Node) => { setEditNode(node); setForm({ name: node.name, addr: node.addr }); };
  const closeAll = () => { setShowAdd(false); setEditNode(null); setNewToken(null); };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/nodes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const created: Node = await res.json();
    setNewToken(created.token);
    fetchNodes();
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editNode) return;
    await fetch(`/api/nodes/${editNode.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    closeAll(); fetchNodes();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Node wirklich löschen?')) return;
    await fetch(`/api/nodes/${id}`, { method: 'DELETE' });
    fetchNodes();
  };

  const handleNodePing = async (node: Node) => {
    const parsed = parseAddr(node.addr);
    if (!parsed) return;
    setPingResults(r => ({ ...r, [node.id]: { reachable: false, latency_ms: 0, loading: true } }));
    const result = await runPing('tcp', parsed.host, parsed.port).catch(
      (err): PingResult => ({ reachable: false, latency_ms: 0, error: String(err) })
    );
    setPingResults(r => ({ ...r, [node.id]: result }));
  };

  const handlePingTool = async (e: React.FormEvent) => {
    e.preventDefault();
    setPtLoading(true); setPtResult(null);
    const result = await runPing(ptType, ptHost.trim(), Number(ptPort), ptPath || '/')
      .catch((err): PingResult => ({ reachable: false, latency_ms: 0, error: String(err) }));
    setPtResult(result); setPtLoading(false);
  };

  const btnPrimary: React.CSSProperties = {
    padding: '8px 18px', borderRadius: 'var(--radius)', border: 'none',
    background: 'var(--primary)', color: 'var(--primary-fg)',
    cursor: 'pointer', fontWeight: 540, fontSize: '0.9rem',
  };
  const btnSecondary: React.CSSProperties = {
    padding: '8px 18px', borderRadius: 'var(--radius)',
    border: '1px solid var(--border)', background: 'transparent',
    color: 'var(--text)', cursor: 'pointer', fontSize: '0.9rem',
  };

  return (
    <>
      <div className="page-header">
        <h1>Nodes</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="sub">{nodes.length} registriert</span>
          <button onClick={openAdd} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 14px', borderRadius: 'var(--radius)', border: 'none',
            background: 'var(--primary)', color: 'var(--primary-fg)',
            fontWeight: 540, cursor: 'pointer', fontSize: '0.85rem',
          }}>
            <Plus size={14} /> Node hinzufügen
          </button>
        </div>
      </div>

      {nodes.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-dim)',
          fontFamily: 'var(--font-mono)', fontSize: '0.85rem',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          Keine Nodes registriert
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {nodes.map(node => (
            <div key={node.id} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '12px 16px', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', background: 'var(--surface)',
            }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                background: node.status === 'online' ? 'var(--ok)' : 'var(--text-dim)',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, marginBottom: '2px' }}>{node.name}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem',
                  color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {node.addr}
                </div>
              </div>
              {pingResults[node.id] && <PingBadge result={pingResults[node.id]} />}
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                {node.status}
              </div>
              <button onClick={() => handleNodePing(node)} title="Ping"
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)',
                  cursor: 'pointer', padding: '6px', borderRadius: '6px' }}>
                <Activity size={15} />
              </button>
              <button onClick={() => openEdit(node)}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)',
                  cursor: 'pointer', padding: '6px', borderRadius: '6px' }}>
                <Pencil size={15} />
              </button>
              <button onClick={() => handleDelete(node.id)}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)',
                  cursor: 'pointer', padding: '6px', borderRadius: '6px' }}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Standalone Ping Tool */}
      <div style={{ marginTop: '32px', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '24px', background: 'var(--surface)' }}>
        <h2 style={{ margin: '0 0 18px', fontSize: '0.95rem', fontWeight: 600, letterSpacing: '-0.01em' }}>
          Ping-Tool
        </h2>
        <form onSubmit={handlePingTool}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '10px',
            alignItems: 'end' }}>
            <div>
              <label style={labelStyle}>Host / IP</label>
              <input style={inputStyle} placeholder="z.B. 192.168.1.10" required
                value={ptHost} onChange={e => setPtHost(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Port</label>
              <input style={{ ...inputStyle, width: '90px' }} type="number" min="1" max="65535" required
                value={ptPort} onChange={e => setPtPort(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Typ</label>
              <select style={{ ...inputStyle, width: '100px' }}
                value={ptType} onChange={e => setPtType(e.target.value as PingType)}>
                <option value="tcp">TCP</option>
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
              </select>
            </div>
            {(ptType === 'http' || ptType === 'https') && (
              <div>
                <label style={labelStyle}>Pfad</label>
                <input style={{ ...inputStyle, width: '100px' }} placeholder="/"
                  value={ptPath} onChange={e => setPtPath(e.target.value)} />
              </div>
            )}
            <button type="submit" disabled={ptLoading} style={{
              ...btnPrimary,
              display: 'flex', alignItems: 'center', gap: '6px',
              opacity: ptLoading ? 0.6 : 1,
            }}>
              <Activity size={14} /> {ptLoading ? '…' : 'Ping'}
            </button>
          </div>
        </form>

        {ptResult && (
          <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: 'var(--radius)',
            border: `1px solid ${ptResult.reachable ? 'var(--ok)' : 'var(--down)'}`,
            background: ptResult.reachable
              ? 'color-mix(in srgb, var(--ok) 8%, transparent)'
              : 'color-mix(in srgb, var(--down) 8%, transparent)',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            {ptResult.reachable ? <Wifi size={18} color="var(--ok)" /> : <WifiOff size={18} color="var(--down)" />}
            <div>
              <div style={{ fontWeight: 500, marginBottom: '2px',
                color: ptResult.reachable ? 'var(--ok)' : 'var(--down)' }}>
                {ptResult.reachable ? 'Erreichbar' : 'Nicht erreichbar'}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                {ptResult.reachable && `Latenz: ${ptResult.latency_ms} ms`}
                {ptResult.status ? ` · HTTP ${ptResult.status}` : ''}
                {ptResult.error ? ptResult.error : ''}
              </div>
            </div>
          </div>
        )}
      </div>

      {showAdd && (
        <Modal title="Node hinzufügen" onClose={closeAll}>
          {newToken ? (
            <>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '4px' }}>
                Node wurde erstellt. Kopiere den Token — er wird nur einmal angezeigt.
              </p>
              <CopyToken token={newToken} />
              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={closeAll} style={btnPrimary}>Fertig</button>
              </div>
            </>
          ) : (
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Name</label>
                <input style={inputStyle} placeholder="z.B. Prod Server 1" required
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Adresse</label>
                <input style={inputStyle} placeholder="z.B. 192.168.1.10:3001" required
                  value={form.addr} onChange={e => setForm(f => ({ ...f, addr: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button type="button" onClick={closeAll} style={btnSecondary}>Abbrechen</button>
                <button type="submit" style={btnPrimary}>Erstellen</button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {editNode && (
        <Modal title="Node bearbeiten" onClose={closeAll}>
          <form onSubmit={handleEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Name</label>
              <input style={inputStyle} required
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Adresse</label>
              <input style={inputStyle} required
                value={form.addr} onChange={e => setForm(f => ({ ...f, addr: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button type="button" onClick={closeAll} style={btnSecondary}>Abbrechen</button>
              <button type="submit" style={btnPrimary}>Speichern</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

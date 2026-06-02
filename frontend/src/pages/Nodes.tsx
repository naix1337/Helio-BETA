// helio-app/frontend/src/pages/Nodes.tsx
import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Copy, Check } from 'lucide-react';
import type { Node } from '../types.ts';

interface NodeForm {
  name: string;
  addr: string;
}

const BLANK: NodeForm = { name: '', addr: '' };

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '8px 12px',
  color: 'var(--text)',
  fontSize: '0.9rem',
  width: '100%',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--text-dim)',
  display: 'block',
  marginBottom: '6px',
};

function CopyToken({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(token).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = token;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ marginTop: '12px', padding: '12px', background: 'var(--surface-2)',
      borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '6px' }}>
        Auth-Token (einmalig sichtbar)
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem',
          color: 'var(--primary)', flex: 1, wordBreak: 'break-all' }}>
          {token}
        </code>
        <button onClick={copy} style={{ background: 'none', border: 'none',
          color: copied ? 'var(--ok)' : 'var(--text-dim)', cursor: 'pointer', padding: '4px' }}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

function Modal({ title, onClose, children }: ModalProps) {
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

export function Nodes() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editNode, setEditNode] = useState<Node | null>(null);
  const [form, setForm] = useState<NodeForm>(BLANK);
  const [newToken, setNewToken] = useState<string | null>(null);

  const fetchNodes = () =>
    fetch('/api/nodes').then(r => r.json()).then(setNodes).catch(console.error);

  useEffect(() => { fetchNodes(); }, []);

  const openAdd = () => { setForm(BLANK); setNewToken(null); setShowAdd(true); };
  const openEdit = (node: Node) => { setEditNode(node); setForm({ name: node.name, addr: node.addr }); };
  const closeAll = () => { setShowAdd(false); setEditNode(null); setNewToken(null); };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    closeAll();
    fetchNodes();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Node wirklich löschen?')) return;
    await fetch(`/api/nodes/${id}`, { method: 'DELETE' });
    fetchNodes();
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
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                {node.status}
              </div>
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

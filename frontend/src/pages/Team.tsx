// helio-app/frontend/src/pages/Team.tsx
import React, { useEffect, useState } from 'react';
import { Trash2, UserPlus, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import type { User, UserRole } from '../types.ts';

interface NewUser {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

const BLANK: NewUser = { name: '', email: '', password: '', role: 'viewer' };

const HEADER: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr auto auto auto',
  gap: '12px',
  padding: '10px 16px',
  borderBottom: '1px solid var(--border)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.7rem',
  color: 'var(--text-dim)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

const ROW: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr auto auto auto',
  gap: '12px',
  alignItems: 'center',
  padding: '11px 16px',
  borderBottom: '1px solid var(--border)',
  fontSize: '0.83rem',
};

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '8px 12px',
  color: 'var(--text)',
  fontSize: '0.9rem',
  width: '100%',
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
};

export function Team() {
  const authFetch = useAuth((s) => s.authFetch);
  const currentUser = useAuth((s) => s.currentUser);

  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewUser>(BLANK);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = async () => {
    setError(null);
    try {
      const res = await authFetch('/api/team');
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string; error?: string };
        setError(body.message ?? body.error ?? `Fehler ${res.status}`);
        return;
      }
      const data = await res.json() as User[];
      setUsers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    }
  };

  useEffect(() => { void fetchUsers(); }, []);

  const handleRoleChange = async (user: User, role: UserRole) => {
    setError(null);
    try {
      const res = await authFetch(`/api/team/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string; error?: string };
        setError(body.message ?? body.error ?? `Fehler ${res.status}`);
        return;
      }
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role } : u));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    }
  };

  const handleDelete = async (user: User) => {
    if (!window.confirm('Benutzer löschen?')) return;
    setError(null);
    try {
      const res = await authFetch(`/api/team/${user.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string; error?: string };
        setError(body.message ?? body.error ?? `Fehler ${res.status}`);
        return;
      }
      setUsers(prev => prev.filter(u => u.id !== user.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await authFetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string; error?: string };
        setFormError(body.message ?? body.error ?? `Fehler ${res.status}`);
        return;
      }
      setForm(BLANK);
      setShowForm(false);
      void fetchUsers();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Team</h1>
          <span className="sub mono">Benutzerverwaltung</span>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setFormError(null); setForm(BLANK); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 14px', borderRadius: 'var(--radius)', border: 'none',
            background: 'var(--primary)', color: 'var(--primary-fg)',
            fontWeight: 540, cursor: 'pointer', fontSize: '0.85rem',
          }}>
          {showForm ? <X size={14} /> : <UserPlus size={14} />}
          {showForm ? 'Abbrechen' : 'Benutzer hinzufügen'}
        </button>
      </div>

      {error && (
        <div style={{
          marginBottom: '16px', padding: '12px 16px',
          borderRadius: 'var(--radius)', border: '1px solid var(--down)',
          background: 'color-mix(in srgb, var(--down) 12%, transparent)',
          color: 'var(--down)', fontSize: '0.85rem', fontFamily: 'var(--font-mono)',
        }}>
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} style={{
          border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
          padding: '24px', marginBottom: '24px', background: 'var(--surface)',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px',
        }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>Name</label>
            <input
              style={inputStyle}
              value={form.name}
              required
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>E-Mail</label>
            <input
              style={inputStyle}
              type="email"
              value={form.email}
              required
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>Passwort</label>
            <input
              style={inputStyle}
              type="password"
              value={form.password}
              required
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>Rolle</label>
            <select
              style={inputStyle}
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}>
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          {formError && (
            <div style={{
              gridColumn: '1/-1', padding: '10px 14px',
              borderRadius: 'var(--radius)', border: '1px solid var(--down)',
              background: 'color-mix(in srgb, var(--down) 12%, transparent)',
              color: 'var(--down)', fontSize: '0.83rem', fontFamily: 'var(--font-mono)',
            }}>
              {formError}
            </div>
          )}
          <div style={{ gridColumn: '1/-1', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => { setShowForm(false); setFormError(null); }}
              style={{
                padding: '8px 18px', borderRadius: 'var(--radius)',
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--text)', cursor: 'pointer',
              }}>
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '8px 18px', borderRadius: 'var(--radius)', border: 'none',
                background: 'var(--primary)', color: 'var(--primary-fg)',
                cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 540,
                opacity: submitting ? 0.7 : 1,
              }}>
              {submitting ? 'Speichern…' : 'Speichern'}
            </button>
          </div>
        </form>
      )}

      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        <div style={HEADER}>
          <span>Name</span>
          <span>E-Mail</span>
          <span>Rolle</span>
          <span>Erstellt</span>
          <span>Aktionen</span>
        </div>
        {users.length === 0 && (
          <div style={{
            padding: '28px', textAlign: 'center', color: 'var(--text-dim)',
            fontFamily: 'var(--font-mono)', fontSize: '0.85rem',
          }}>
            Keine Benutzer gefunden
          </div>
        )}
        {users.map((user, i) => {
          const isSelf = currentUser?.userId === user.id;
          return (
            <div
              key={user.id}
              style={{ ...ROW, borderBottom: i < users.length - 1 ? undefined : 'none' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.83rem', fontWeight: 500 }}>
                {user.name}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {user.email}
              </span>
              {isSelf ? (
                <span style={{
                  display: 'inline-block',
                  padding: '3px 10px',
                  borderRadius: '4px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.72rem',
                  background: 'color-mix(in srgb, var(--primary) 15%, transparent)',
                  color: 'var(--primary)',
                  whiteSpace: 'nowrap',
                }}>
                  {ROLE_LABELS[user.role]}
                </span>
              ) : (
                <select
                  value={user.role}
                  onChange={e => void handleRoleChange(user, e.target.value as UserRole)}
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '4px 8px',
                    color: 'var(--text)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}>
                  <option value="admin">Admin</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              )}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                {new Date(user.created_at * 1000).toLocaleDateString('de-DE')}
              </span>
              <button
                disabled={isSelf}
                onClick={() => void handleDelete(user)}
                title={isSelf ? 'Eigenen Account nicht löschbar' : 'Benutzer löschen'}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isSelf ? 'var(--text-dim)' : 'var(--down)',
                  cursor: isSelf ? 'not-allowed' : 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'grid',
                  placeItems: 'center',
                  opacity: isSelf ? 0.3 : 1,
                }}>
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

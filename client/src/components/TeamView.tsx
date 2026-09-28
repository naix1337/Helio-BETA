import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Shield, Plus, X, Trash2, Eye } from 'lucide-react';
import { useStore, useIsAdmin, type User } from '../store/useStore';
import { apiCall } from '../api/client';

export default function TeamView() {
  const me = useStore((s) => s.user);
  const isAdmin = useIsAdmin();
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setUsers(await apiCall<User[]>('GET', '/users'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Laden fehlgeschlagen');
    }
  }, [isAdmin]);

  useEffect(() => { void load(); }, [load]);

  const changeRole = async (u: User, role: User['role']) => {
    try {
      await apiCall('PATCH', `/users/${u.id}`, { role });
      void load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler');
    }
  };

  const remove = async (u: User) => {
    if (!confirm(`Benutzer ${u.email} löschen?`)) return;
    try {
      await apiCall('DELETE', `/users/${u.id}`);
      void load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler');
    }
  };

  const list = isAdmin ? users : me ? [me] : [];

  return (
    <div className="animate-[view-fade_0.35s_cubic-bezier(0.22,1,0.36,1)]">
      <div className="flex items-center justify-between mb-4 gap-3">
        <p className="m-0 text-[0.86rem]" style={{ color: 'var(--color-text-muted)' }}>
          <b>Administratoren</b> verwalten Monitore und Einstellungen, <b>Betrachter</b> haben Lesezugriff.
        </p>
        {isAdmin && (
          <button onClick={() => setShowForm(true)} className="btn btn-primary flex-none">
            <Plus className="w-[16px] h-[16px]" /> Benutzer anlegen
          </button>
        )}
      </div>

      {error && <div className="alert alert-error mb-4">{error}</div>}

      <div className="card overflow-hidden">
        <div className="card-header">
          <span className="text-[0.85rem]" style={{ color: 'var(--color-text-dim)' }}>Mitglieder ({list.length})</span>
        </div>
        {list.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-4 px-[18px] py-[14px] border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
            <span className="w-[42px] h-[42px] rounded-[10px] flex-none grid place-items-center font-mono font-semibold text-[0.95rem]"
              style={{ color: 'var(--color-primary-fg)', background: 'linear-gradient(135deg, var(--color-primary), #0e7d72)' }}>
              {u.email.slice(0, 2).toUpperCase()}
            </span>
            <div className="flex-1 min-w-[180px]">
              <div className="font-medium text-[0.9rem]" style={{ color: 'var(--color-text)' }}>
                {u.email} {u.id === me?.id && <span className="pill pill-dim ml-1">du</span>}
              </div>
              <div className="font-mono text-[0.76rem]" style={{ color: 'var(--color-text-dim)' }}>
                seit {new Date(u.createdAt).toLocaleDateString()} · 2FA {u.totpEnabled ? 'aktiv' : 'aus'}
              </div>
            </div>
            {isAdmin && u.id !== me?.id ? (
              <div className="flex gap-2 items-center">
                <select value={u.role} onChange={(e) => changeRole(u, e.target.value as User['role'])} className="input" style={{ height: 34, width: 150 }}>
                  <option value="admin">Administrator</option>
                  <option value="user">Betrachter</option>
                </select>
                <button onClick={() => remove(u)} className="btn btn-icon btn-danger" title="Löschen"><Trash2 className="w-[14px] h-[14px]" /></button>
              </div>
            ) : (
              <span className="pill pill-primary">
                {u.role === 'admin' ? <Shield className="w-[12px] h-[12px]" /> : <Eye className="w-[12px] h-[12px]" />}
                {u.role === 'admin' ? 'Administrator' : 'Betrachter'}
              </span>
            )}
          </div>
        ))}
      </div>

      {showForm && <UserForm onClose={() => { setShowForm(false); void load(); }} />}
    </div>
  );
}

function UserForm({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiCall('POST', '/users', { email, password, role });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal flex flex-col gap-4" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="flex items-center justify-between">
          <h2 className="text-[1.1rem] font-semibold m-0" style={{ color: 'var(--color-text)' }}>Benutzer anlegen</h2>
          <button type="button" onClick={onClose} className="btn btn-icon"><X className="w-[16px] h-[16px]" /></button>
        </div>
        <div>
          <label className="label">E-Mail</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input" autoComplete="off" />
        </div>
        <div>
          <label className="label">Initiales Passwort (min. 8 Zeichen)</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="input" autoComplete="new-password" />
        </div>
        <div>
          <label className="label">Rolle</label>
          <select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'user')} className="input">
            <option value="user">Betrachter (nur lesen)</option>
            <option value="admin">Administrator</option>
          </select>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn">Abbrechen</button>
          <button type="submit" disabled={saving} className="btn btn-primary">{saving ? '…' : 'Anlegen'}</button>
        </div>
      </form>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { apiRequest } from '../api/client';
import { Copy, Plus, Trash2, Check, Key, Shield, User, Database } from 'lucide-react';

type Tab = 'profile' | '2fa' | 'api-keys' | 'retention';

export default function SettingsView() {
  const user = useStore((s) => s.user);
  const [tab, setTab] = useState<Tab>('profile');

  const tabs = [
    { id: 'profile' as Tab, label: 'Profil', icon: User },
    { id: '2fa' as Tab, label: '2FA', icon: Shield },
    { id: 'api-keys' as Tab, label: 'API-Keys', icon: Key },
    { id: 'retention' as Tab, label: 'Aufbewahrung', icon: Database },
  ];

  return (
    <div className="animate-[view-fade_0.35s_cubic-bezier(0.22,1,0.36,1)]">
      <h2 className="text-[1.05rem] font-semibold tracking-tight mb-4 m-0" style={{ color: 'var(--color-text)' }}>Einstellungen</h2>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-[var(--radius-box)]" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-2 px-4 py-[8px] rounded-[var(--radius-sm)] text-[0.85rem] font-medium border-none cursor-pointer transition-colors"
              style={{
                background: tab === t.id ? 'var(--color-surface)' : 'transparent',
                color: tab === t.id ? 'var(--color-text)' : 'var(--color-text-muted)',
                boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <Icon className="w-[16px] h-[16px]" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'profile' && <ProfileTab />}
      {tab === '2fa' && <TwoFactorTab />}
      {tab === 'api-keys' && <ApiKeysTab />}
      {tab === 'retention' && <RetentionTab />}
    </div>
  );
}

function ProfileTab() {
  const user = useStore((s) => s.user);
  return (
    <div className="border rounded-[var(--radius-lg)] p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
      <h3 className="text-[1rem] font-semibold m-0 mb-4" style={{ color: 'var(--color-text)' }}>Profil</h3>
      <div className="flex flex-col gap-4 max-w-[400px]">
        <div>
          <label className="block text-[0.82rem] font-medium mb-[4px]" style={{ color: 'var(--color-text-muted)' }}>E-Mail</label>
          <div className="font-mono text-[0.9rem] py-[10px] px-3 rounded-[var(--radius-sm)]" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
            {user?.email || '—'}
          </div>
        </div>
        <div>
          <label className="block text-[0.82rem] font-medium mb-[4px]" style={{ color: 'var(--color-text-muted)' }}>Rolle</label>
          <div className="font-mono text-[0.9rem] py-[10px] px-3 rounded-[var(--radius-sm)]" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
            {user?.role || '—'}
          </div>
        </div>
        <div>
          <label className="block text-[0.82rem] font-medium mb-[4px]" style={{ color: 'var(--color-text-muted)' }}>Erstellt am</label>
          <div className="font-mono text-[0.9rem] py-[10px] px-3 rounded-[var(--radius-sm)]" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
            {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
          </div>
        </div>
        <div>
          <label className="block text-[0.82rem] font-medium mb-[4px]" style={{ color: 'var(--color-text-muted)' }}>2FA</label>
          <div className="font-mono text-[0.9rem] py-[10px] px-3 rounded-[var(--radius-sm)]" style={{ background: 'var(--color-bg)', color: user?.totpEnabled ? 'var(--color-ok)' : 'var(--color-text-dim)' }}>
            {user?.totpEnabled ? '✅ Aktiviert' : '❌ Nicht aktiviert'}
          </div>
        </div>
      </div>
    </div>
  );
}

function TwoFactorTab() {
  const user = useStore((s) => s.user);
  const [qrUrl, setQrUrl] = useState('');
  const [token, setToken] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const setup2fa = async () => {
    setLoading(true);
    const res = await apiRequest<{ secret: string; qrCodeUrl: string }>('POST', '/auth/2fa/setup');
    if (res.data) {
      setQrUrl(res.data.qrCodeUrl);
    }
    setLoading(false);
  };

  const verify2fa = async () => {
    if (!token) return;
    setLoading(true);
    const res = await apiRequest('POST', '/auth/2fa/verify', { token });
    setMsg(res.success ? '✅ 2FA aktiviert!' : '❌ Ungültiger Token');
    setLoading(false);
    if (res.success) window.location.reload();
  };

  const disable2fa = async () => {
    if (!confirm('2FA wirklich deaktivieren?')) return;
    await apiRequest('POST', '/auth/2fa/disable');
    window.location.reload();
  };

  return (
    <div className="border rounded-[var(--radius-lg)] p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
      <h3 className="text-[1rem] font-semibold m-0 mb-2" style={{ color: 'var(--color-text)' }}>Zwei-Faktor-Authentisierung (TOTP)</h3>
      <p className="text-[0.85rem] mb-4" style={{ color: 'var(--color-text-muted)' }}>
        Richte TOTP-2FA mit einer Authenticator-App wie Google Authenticator oder Authy ein.
      </p>

      {user?.totpEnabled ? (
        <div>
          <div className="flex items-center gap-3 mb-4 p-3 rounded-[var(--radius-sm)]" style={{ background: 'var(--color-ok-soft)' }}>
            <Shield className="w-[20px] h-[20px]" style={{ color: 'var(--color-ok)' }} />
            <span className="text-[0.9rem]" style={{ color: 'var(--color-ok)' }}>2FA ist aktiviert</span>
          </div>
          <button onClick={disable2fa} className="px-4 py-[10px] rounded-[var(--radius-box)] border cursor-pointer text-[0.85rem]" style={{ borderColor: 'var(--color-down-soft)', color: 'var(--color-down)', background: 'transparent' }}>
            2FA deaktivieren
          </button>
        </div>
      ) : qrUrl ? (
        <div>
          <div className="mb-3">
            <img src={qrUrl} alt="TOTP QR Code" className="w-[160px] h-[160px] rounded-[var(--radius-sm)]" />
          </div>
          <div className="flex gap-2 mb-3">
            <input value={token} onChange={(e) => setToken(e.target.value)} maxLength={6} className="w-[140px] h-[42px] px-3 rounded-[var(--radius-box)] border text-[1.1rem] text-center font-mono outline-none" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} placeholder="000000" />
            <button onClick={verify2fa} disabled={loading || token.length < 6} className="px-4 py-[10px] rounded-[var(--radius-box)] border-0 cursor-pointer font-medium" style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}>
              {loading ? '…' : 'Bestätigen'}
            </button>
          </div>
          {msg && <div className="text-[0.85rem]" style={{ color: msg.includes('✅') ? 'var(--color-ok)' : 'var(--color-down)' }}>{msg}</div>}
        </div>
      ) : (
        <button onClick={setup2fa} disabled={loading} className="px-4 py-[10px] rounded-[var(--radius-box)] border-0 cursor-pointer font-medium" style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}>
          {loading ? '…' : '2FA einrichten'}
        </button>
      )}
    </div>
  );
}

function ApiKeysTab() {
  const [keys, setKeys] = useState<Array<{ id: string; name: string; keyPrefix: string; scopes: string[]; createdAt: string }>>([]);
  const [newKey, setNewKey] = useState('');
  const [newKeyName, setNewKeyName] = useState('');

  const loadKeys = async () => {
    const res = await apiRequest<Array<{ id: string; name: string; keyPrefix: string; scopes: string[]; createdAt: string }>>('GET', '/api-keys');
    if (res.data) setKeys(res.data);
  };

  useEffect(() => { loadKeys(); }, []);

  const createKey = async () => {
    if (!newKeyName.trim()) return;
    const res = await apiRequest<{ id: string; name: string; plainKey: string; keyPrefix: string }>('POST', '/api-keys', { name: newKeyName.trim(), scopes: ['read', 'write'] });
    if (res.data) {
      setNewKey(res.data.plainKey);
      setNewKeyName('');
      loadKeys();
    }
  };

  const deleteKey = async (id: string) => {
    await apiRequest('DELETE', `/api-keys/${id}`);
    loadKeys();
  };

  const copyKey = async (k: string) => {
    try { await navigator.clipboard.writeText(k); } catch {}
  };

  return (
    <div className="border rounded-[var(--radius-lg)] overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
      <div className="p-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <h3 className="text-[1rem] font-semibold m-0 mb-2" style={{ color: 'var(--color-text)' }}>API-Keys</h3>
        <p className="text-[0.82rem] m-0 mb-3" style={{ color: 'var(--color-text-muted)' }}>Erstelle API-Keys für den programmatischen Zugriff auf die Helio-API.</p>

        {newKey && (
          <div className="p-3 mb-3 rounded-[var(--radius-sm)]" style={{ background: 'var(--color-ok-soft)', border: '1px solid var(--color-ok-soft)' }}>
            <div className="font-medium text-[0.85rem] mb-1" style={{ color: 'var(--color-ok)' }}>API-Key erstellt!</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-[0.82rem] p-2 rounded-[4px] break-all" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>{newKey}</code>
              <button onClick={() => copyKey(newKey)} className="w-[32px] h-[32px] rounded-[6px] grid place-items-center border cursor-pointer" style={{ borderColor: 'var(--color-border)', background: 'transparent' }}>
                <Copy className="w-[15px] h-[15px]" style={{ color: 'var(--color-text-muted)' }} />
              </button>
            </div>
            <div className="text-[0.75rem] mt-1" style={{ color: 'var(--color-text-dim)' }}>⚠️ Dieser Schlüssel wird nur einmal angezeigt. Kopiere ihn jetzt.</div>
            <button onClick={() => setNewKey('')} className="mt-2 text-[0.8rem] bg-none border-none cursor-pointer" style={{ color: 'var(--color-text-dim)' }}>Schließen</button>
          </div>
        )}

        <div className="flex gap-2">
          <input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} className="flex-1 h-[40px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} placeholder="Key-Name (z.B. CI/CD)" />
          <button onClick={createKey} className="px-4 h-[40px] rounded-[var(--radius-box)] border-0 cursor-pointer inline-flex items-center gap-2 text-[0.85rem]" style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}>
            <Plus className="w-[16px] h-[16px]" /> Erstellen
          </button>
        </div>
      </div>

      <div className="p-5">
        {keys.length === 0 ? (
          <div className="text-[0.85rem]" style={{ color: 'var(--color-text-dim)' }}>Keine API-Keys vorhanden.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between p-3 rounded-[var(--radius-sm)]" style={{ background: 'var(--color-bg-soft)' }}>
                <div>
                  <div className="font-medium text-[0.85rem]" style={{ color: 'var(--color-text)' }}>{k.name}</div>
                  <div className="font-mono text-[0.78rem]" style={{ color: 'var(--color-text-dim)' }}>
                    {k.keyPrefix} · {k.scopes.join(', ')}
                  </div>
                </div>
                <button onClick={() => deleteKey(k.id)} className="w-[32px] h-[32px] rounded-[6px] grid place-items-center border cursor-pointer" style={{ borderColor: 'var(--color-border)', background: 'transparent' }}>
                  <Trash2 className="w-[14px] h-[14px]" style={{ color: 'var(--color-down)' }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RetentionTab() {
  return (
    <div className="border rounded-[var(--radius-lg)] p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
      <h3 className="text-[1rem] font-semibold m-0 mb-2" style={{ color: 'var(--color-text)' }}>Daten-Aufbewahrung</h3>
      <p className="text-[0.85rem] mb-4" style={{ color: 'var(--color-text-muted)' }}>
        Konfiguriere, wie lange Heartbeat-Rohdaten gespeichert werden.
      </p>
      <div>
        <label className="block text-[0.82rem] font-medium mb-[4px]" style={{ color: 'var(--color-text-muted)' }}>Heartbeat-Rohdaten (Tage)</label>
        <div className="flex items-center gap-3">
          <input type="number" defaultValue={7} min={1} max={90} className="w-[100px] h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] font-mono outline-none" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
          <span className="text-[0.8rem]" style={{ color: 'var(--color-text-dim)' }}>Danach werden Rohdaten zu Stundenswerten aggregiert</span>
        </div>
        <button className="mt-3 px-4 py-[8px] rounded-[var(--radius-box)] border-0 cursor-pointer text-[0.85rem]" style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}>
          Speichern
        </button>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Shield, Plus, X } from 'lucide-react';

export default function TeamView() {
  const user = useStore((s) => s.user);
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const handleInvite = () => {
    if (!email.includes('@')) { setMsg('Bitte gültige E-Mail-Adresse eingeben'); return; }
    setMsg(`✅ Einladung an ${email} versendet`);
    setEmail('');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div className="animate-[view-fade_0.35s_cubic-bezier(0.22,1,0.36,1)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[1.05rem] font-semibold m-0" style={{ color: 'var(--color-text)' }}>Team</h2>
        <button onClick={() => setShowInvite(!showInvite)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-box)] text-[0.85rem] border-0 cursor-pointer"
          style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}>
          <Plus className="w-[16px] h-[16px]" /> Mitglied einladen
        </button>
      </div>

      {showInvite && (
        <div className="mb-4 p-4 border rounded-[var(--radius-lg)]" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <div className="flex gap-3">
            <input value={email} onChange={(e) => setEmail(e.target.value)}
              className="flex-1 h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none"
              style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              placeholder="team@example.com" />
            <button onClick={handleInvite}
              className="px-4 py-2 rounded-[var(--radius-box)] border-0 cursor-pointer text-[0.85rem]"
              style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}>Einladen</button>
            <button onClick={() => setShowInvite(false)}
              className="w-[42px] h-[42px] rounded-[var(--radius-box)] border grid place-items-center cursor-pointer"
              style={{ borderColor: 'var(--color-border)', background: 'transparent', color: 'var(--color-text-dim)' }}>
              <X className="w-[16px] h-[16px]" />
            </button>
          </div>
          {msg && <div className="mt-2 text-[0.85rem]" style={{ color: msg.includes('✅') ? 'var(--color-ok)' : 'var(--color-warn)' }}>{msg}</div>}
        </div>
      )}

      <div className="border rounded-[var(--radius-lg)] overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="px-[18px] py-[14px] border-b text-[0.85rem]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-dim)' }}>
          Mitglieder ({user ? 1 : 0})
        </div>
        {user && (
          <div className="flex items-center gap-4 px-[18px] py-[14px]" style={{ borderColor: 'var(--color-border)' }}>
            <span className="w-[42px] h-[42px] rounded-[10px] flex-none grid place-items-center font-mono font-semibold text-[0.95rem]"
              style={{ color: 'var(--color-primary-fg)', background: 'linear-gradient(135deg, var(--color-primary), #0e7d72)' }}>
              {user.email.slice(0, 2).toUpperCase()}
            </span>
            <div className="flex-1">
              <div className="font-medium text-[0.9rem]" style={{ color: 'var(--color-text)' }}>{user.email}</div>
              <div className="font-mono text-[0.78rem]" style={{ color: 'var(--color-text-dim)' }}>{user.role === 'admin' ? 'Administrator' : 'Benutzer'}</div>
            </div>
            <span className="inline-flex items-center gap-[6px] font-mono text-[0.72rem] px-[8px] py-[3px] rounded-full border"
              style={{ borderColor: 'var(--color-primary-soft)', background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
              <Shield className="w-[12px] h-[12px]" /> {user.role}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

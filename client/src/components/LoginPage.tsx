import { useState, type FormEvent } from 'react';
import { useStore } from '../store/useStore';

export default function LoginPage() {
  const { login, isLoading, authError } = useStore();
  const [email, setEmail] = useState('admin@helio.local');
  const [password, setPassword] = useState('admin123');
  const [isRegister, setIsRegister] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isRegister) {
      const { register } = useStore.getState();
      await register(email, password);
    } else {
      await login(email, password);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--color-bg)' }}
    >
      <div
        className="w-full max-w-[400px] p-8 rounded-[var(--radius-lg)] border"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-[11px] mb-8">
          <span
            className="relative w-[36px] h-[36px] rounded-[10px] flex-none inline-block"
            style={{
              background: 'radial-gradient(circle at 30% 28%, var(--color-primary), #0e7d72 78%)',
              boxShadow: '0 0 0 1px var(--color-border-strong), 0 6px 18px -6px var(--color-primary-glow)',
            }}
          >
            <span
              className="absolute inset-[9px] rounded-full border-2 border-white/85"
              style={{ borderRightColor: 'transparent', borderBottomColor: 'transparent', transform: 'rotate(45deg)' }}
            />
          </span>
          <span className="text-[1.2rem] font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>Helio</span>
        </div>

        <h1 className="text-center text-[1.3rem] font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
          {isRegister ? 'Account erstellen' : 'Willkommen zurück'}
        </h1>
        <p className="text-center text-[0.9rem] mb-6" style={{ color: 'var(--color-text-muted)' }}>
          {isRegister ? 'Erstelle einen neuen Account' : 'Melde dich bei Helio an'}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>E-Mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full h-[44px] px-3 rounded-[var(--radius-box)] border text-[0.95rem] outline-none"
              style={{
                background: 'var(--color-bg)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
              }}
              placeholder="admin@pulse.local"
            />
          </div>

          <div>
            <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Passwort</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full h-[44px] px-3 rounded-[var(--radius-box)] border text-[0.95rem] outline-none"
              style={{
                background: 'var(--color-bg)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
              }}
              placeholder="admin123"
            />
          </div>

          {authError && (
            <div className="text-[0.85rem] p-3 rounded-[var(--radius-sm)]" style={{ color: 'var(--color-down)', background: 'var(--color-down-soft)' }}>
              {authError}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary w-full justify-center"
            style={{ height: 46 }}
          >
            {isLoading ? 'Wird geladen…' : isRegister ? 'Registrieren' : 'Anmelden'}
          </button>
        </form>

        <div className="text-center mt-5">
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="text-[0.85rem] bg-none border-none cursor-pointer"
            style={{ color: 'var(--color-primary)' }}
          >
            {isRegister ? 'Bereits registriert? → Anmelden' : 'Noch kein Account? → Registrieren'}
          </button>
        </div>

        <div className="mt-6 pt-4 text-center text-[0.75rem]" style={{ color: 'var(--color-text-dim)', borderTop: '1px solid var(--color-border)' }}>
          Demo: admin@helio.local / admin123
        </div>
      </div>
    </div>
  );
}

// Need btn-primary styles inline since this is outside the app shell
const style = document.createElement('style');
style.textContent = `
  .btn-primary {
    display: inline-flex; align-items: center; justify-content: center;
    font-weight: 540; font-size: 0.95rem; letter-spacing: -0.01em;
    padding: 0 20px; border-radius: var(--radius-box);
    border: 1px solid transparent; cursor: pointer; white-space: nowrap;
    transition: background-color .17s, border-color .17s, color .17s, transform .17s;
    background: var(--color-primary); color: var(--color-primary-fg);
    box-shadow: 0 1px 0 rgba(255,255,255,0.18) inset, 0 8px 24px -10px var(--color-primary-glow);
  }
  .btn-primary:hover { background: var(--color-primary-hover); }
  .btn-primary:disabled { opacity: 0.6; cursor: default; }
`;
document.head.appendChild(style);

import { useState, type FormEvent } from 'react';
import { useStore } from '../store/useStore';

function Logo() {
  return (
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
  );
}

export default function LoginPage() {
  const login = useStore((s) => s.login);
  const setup = useStore((s) => s.setup);
  const isLoading = useStore((s) => s.isLoading);
  const authError = useStore((s) => s.authError);
  const needsSetup = useStore((s) => s.needsSetup);
  const requires2fa = useStore((s) => s.requires2fa);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [totp, setTotp] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (needsSetup) {
      if (password.length < 8) { setLocalError('Passwort muss mindestens 8 Zeichen haben'); return; }
      if (password !== password2) { setLocalError('Passwörter stimmen nicht überein'); return; }
      await setup(email, password);
    } else {
      await login(email, password, requires2fa ? totp : undefined);
    }
  };

  const error = localError ?? authError;

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--color-bg)' }}>
      <div className="w-full max-w-[400px] p-8 card">
        <Logo />

        <h1 className="text-center text-[1.3rem] font-semibold mb-1 mt-0" style={{ color: 'var(--color-text)' }}>
          {needsSetup ? 'Helio einrichten' : 'Willkommen zurück'}
        </h1>
        <p className="text-center text-[0.9rem] mb-6" style={{ color: 'var(--color-text-muted)' }}>
          {needsSetup ? 'Lege den ersten Administrator-Account an' : requires2fa ? 'Gib den Code aus deiner Authenticator-App ein' : 'Melde dich bei Helio an'}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!requires2fa && (
            <>
              <div>
                <label className="label" htmlFor="email">E-Mail</label>
                <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required className="input" placeholder="admin@example.com" autoFocus />
              </div>
              <div>
                <label className="label" htmlFor="password">Passwort</label>
                <input id="password" type="password" autoComplete={needsSetup ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={needsSetup ? 8 : 1} className="input" />
              </div>
              {needsSetup && (
                <div>
                  <label className="label" htmlFor="password2">Passwort wiederholen</label>
                  <input id="password2" type="password" autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} required minLength={8} className="input" />
                </div>
              )}
            </>
          )}

          {requires2fa && (
            <div>
              <label className="label" htmlFor="totp">2FA-Code</label>
              <input id="totp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={totp}
                onChange={(e) => setTotp(e.target.value.replace(/\D/g, ''))} required autoFocus
                className="input mono text-center" style={{ fontSize: '1.3rem', letterSpacing: '0.3em' }} placeholder="000000" />
            </div>
          )}

          {error && <div className="alert alert-error">{error}</div>}

          <button type="submit" disabled={isLoading || (requires2fa && totp.length < 6)} className="btn btn-primary w-full" style={{ height: 46, fontSize: '0.95rem' }}>
            {isLoading ? 'Wird geladen…' : needsSetup ? 'Account anlegen' : requires2fa ? 'Bestätigen' : 'Anmelden'}
          </button>

          {requires2fa && (
            <button type="button" className="btn" onClick={() => { useStore.setState({ requires2fa: false, authError: null }); setTotp(''); }}>
              Zurück
            </button>
          )}
        </form>

        {!needsSetup && (
          <p className="mt-6 pt-4 mb-0 text-center text-[0.75rem]" style={{ color: 'var(--color-text-dim)', borderTop: '1px solid var(--color-border)' }}>
            Kein Account? Ein Administrator kann dich unter „Team“ anlegen.
          </p>
        )}
      </div>
    </div>
  );
}

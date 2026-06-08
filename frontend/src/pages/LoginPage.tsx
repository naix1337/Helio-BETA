// helio-app/frontend/src/pages/LoginPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuth((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: 'var(--surface)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        padding: '40px',
      }}>
        {/* Logo */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '32px',
        }}>
          <span style={{
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            flexShrink: 0,
            background: 'radial-gradient(circle at 30% 28%, var(--primary), #0e7d72 78%)',
            boxShadow: '0 0 0 1px var(--border-strong), 0 4px 12px -4px var(--primary-glow)',
          }} />
          <span style={{
            fontWeight: 640,
            fontSize: '1.05rem',
            letterSpacing: '-0.02em',
            color: 'var(--text)',
          }}>
            Helio
          </span>
        </div>

        <h1 style={{
          fontSize: '1.4rem',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: 'var(--text)',
          margin: '0 0 28px',
        }}>
          Anmelden
        </h1>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{
              fontSize: '0.82rem',
              fontWeight: 500,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-sans)',
            }}>
              E-Mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius)',
                padding: '10px 12px',
                fontSize: '0.9rem',
                fontFamily: 'var(--font-sans)',
                color: 'var(--text)',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid var(--primary)';
                e.currentTarget.style.outlineOffset = '-1px';
                e.currentTarget.style.border = '1px solid transparent';
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = 'none';
                e.currentTarget.style.border = '1px solid var(--border-strong)';
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{
              fontSize: '0.82rem',
              fontWeight: 500,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-sans)',
            }}>
              Passwort
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius)',
                padding: '10px 12px',
                fontSize: '0.9rem',
                fontFamily: 'var(--font-sans)',
                color: 'var(--text)',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid var(--primary)';
                e.currentTarget.style.outlineOffset = '-1px';
                e.currentTarget.style.border = '1px solid transparent';
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = 'none';
                e.currentTarget.style.border = '1px solid var(--border-strong)';
              }}
            />
          </div>

          {error && (
            <p style={{
              color: 'var(--down)',
              fontSize: '0.85rem',
              margin: 0,
              fontFamily: 'var(--font-sans)',
            }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? 'var(--surface-3)' : 'var(--primary)',
              color: loading ? 'var(--text-muted)' : 'var(--primary-fg)',
              border: 'none',
              borderRadius: 'var(--radius)',
              padding: '11px 16px',
              fontSize: '0.9rem',
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              cursor: loading ? 'not-allowed' : 'pointer',
              width: '100%',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.background = 'var(--primary-hover)';
            }}
            onMouseLeave={(e) => {
              if (!loading) e.currentTarget.style.background = 'var(--primary)';
            }}
          >
            {loading ? 'Anmelden …' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  );
}

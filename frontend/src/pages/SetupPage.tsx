// helio-app/frontend/src/pages/SetupPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';

export function SetupPage() {
  const navigate = useNavigate();
  const login = useAuth((s) => s.login);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        let message = 'Setup fehlgeschlagen';
        try {
          const body = (await res.json()) as { message?: string; error?: string };
          message = body.message ?? body.error ?? message;
        } catch {
          // keep default message
        }
        throw new Error(message);
      }

      // Log in with the new credentials to store the token
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
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
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.outline = '2px solid var(--primary)';
    e.currentTarget.style.outlineOffset = '-1px';
    e.currentTarget.style.border = '1px solid transparent';
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.outline = 'none';
    e.currentTarget.style.border = '1px solid var(--border-strong)';
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
          margin: '0 0 6px',
        }}>
          Helio einrichten
        </h1>
        <p style={{
          fontSize: '0.88rem',
          color: 'var(--text-muted)',
          margin: '0 0 28px',
          fontFamily: 'var(--font-sans)',
        }}>
          Erstelle deinen Admin-Account
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{
              fontSize: '0.82rem',
              fontWeight: 500,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-sans)',
            }}>
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>

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
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
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
              minLength={8}
              autoComplete="new-password"
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
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
            {loading ? 'Konto wird erstellt …' : 'Konto erstellen'}
          </button>
        </form>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';

type Status = 'loading' | 'configured' | 'unconfigured';

export function RequireSetup() {
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    fetch('/api/auth/setup-status')
      .then(r => r.json())
      .then((data: { configured: boolean }) => {
        setStatus(data.configured ? 'configured' : 'unconfigured');
      })
      .catch(() => setStatus('configured')); // fail open — don't block the app on network error
  }, []);

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bg)' }}>
        <div style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)',
          fontSize: '0.85rem' }}>
          Lade…
        </div>
      </div>
    );
  }

  if (status === 'unconfigured') {
    return <Navigate to="/setup" replace />;
  }

  return <Outlet />;
}

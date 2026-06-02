// helio-app/frontend/src/pages/StatusPage.tsx
import React, { useEffect, useState } from 'react';

interface StatusData {
  uptime_percent: number;
  nodes: unknown[];
  incidents: unknown[];
}

export function StatusPage() {
  const [data, setData] = useState<StatusData | null>(null);

  useEffect(() => {
    fetch('/api/status').then(r => r.json()).then(setData).catch(console.error);
  }, []);

  const overall = !data ? 'loading' : data.uptime_percent >= 99.9 ? 'ok' : data.uptime_percent >= 99 ? 'warn' : 'down';

  const COLORS = { ok: 'var(--ok)', warn: 'var(--warn)', down: 'var(--down)', loading: 'var(--text-dim)' };
  const LABELS = { ok: 'Alle Systeme betriebsbereit', warn: 'Teilweiser Ausfall', down: 'Systemausfall', loading: 'Lade…' };

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
          <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: COLORS[overall], display: 'block', flexShrink: 0 }} />
          <h1 style={{ fontSize: '1.6rem', fontWeight: 660, letterSpacing: '-0.02em' }}>
            {LABELS[overall]}
          </h1>
        </div>
        {data && (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Uptime (90 Tage): {data.uptime_percent}%
          </p>
        )}
      </div>
    </div>
  );
}

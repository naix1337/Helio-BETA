// helio-app/frontend/src/pages/Containers.tsx
import React, { useState } from 'react';
import { ContainerTable } from '../components/ContainerTable.tsx';
import { useMetricsStore } from '../store/metricsStore.ts';

type Filter = 'all' | 'running' | 'stopped';

export function Containers() {
  const containers = useMetricsStore((s) => s.containers);
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = containers.filter(c => {
    if (filter === 'running') return c.status === 'running';
    if (filter === 'stopped') return c.status !== 'running';
    return true;
  });

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    borderRadius: '8px',
    border: '1px solid',
    borderColor: active ? 'var(--primary)' : 'var(--border)',
    background: active ? 'var(--primary-soft)' : 'transparent',
    color: active ? 'var(--primary)' : 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8rem',
    cursor: 'pointer',
  });

  return (
    <>
      <div className="page-header">
        <h1>Container</h1>
        <span className="sub">{containers.length} total</span>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
        {(['all', 'running', 'stopped'] as Filter[]).map(f => (
          <button key={f} style={tabStyle(filter === f)} onClick={() => setFilter(f)}>
            {f === 'all' ? 'Alle' : f === 'running' ? 'Running' : 'Stopped'}
          </button>
        ))}
      </div>
      <ContainerTable containers={filtered} />
    </>
  );
}

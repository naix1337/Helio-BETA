// helio-app/frontend/src/pages/Dashboard.tsx
import React from 'react';
import { useMetrics } from '../hooks/useMetrics.ts';
import { StatCard } from '../components/StatCard.tsx';
import { CpuSparkline } from '../components/CpuSparkline.tsx';
import { RamBars } from '../components/RamBars.tsx';
import { ServerTable } from '../components/ServerTable.tsx';

export function Dashboard() {
  const { current, history } = useMetrics();

  const cpuVal = current ? current.cpu.toFixed(1) : '—';
  const ramPercent = current ? current.mem.percent.toFixed(0) : '—';
  const ramSub = current
    ? `${(current.mem.used / 1e9).toFixed(1)} / ${(current.mem.total / 1e9).toFixed(0)} GB`
    : undefined;

  return (
    <>
      <div className="page-header">
        <h1>Übersicht</h1>
        <span className="sub">Letzte 24 h · live</span>
      </div>

      <div className="stats-grid">
        <StatCard label="CPU-Auslastung" value={cpuVal} unit="%" sub={current?.cpuTemp ? `${current.cpuTemp}°C` : undefined}>
          <CpuSparkline history={history} />
        </StatCard>
        <StatCard label="Arbeitsspeicher" value={ramPercent} unit="%" sub={ramSub}>
          <RamBars history={history} />
        </StatCard>
      </div>

      <ServerTable nodes={[]} />
    </>
  );
}

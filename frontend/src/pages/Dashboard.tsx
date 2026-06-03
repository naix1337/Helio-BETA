// helio-app/frontend/src/pages/Dashboard.tsx
import React, { useEffect, useState } from 'react';
import { useMetrics } from '../hooks/useMetrics.ts';
import { useSettings } from '../hooks/useSettings.ts';
import { StatCard } from '../components/StatCard.tsx';
import { CpuSparkline } from '../components/CpuSparkline.tsx';
import { RamBars } from '../components/RamBars.tsx';
import { ServerTable } from '../components/ServerTable.tsx';
import type { Node } from '../types.ts';

export function Dashboard() {
  const { current, history } = useMetrics();
  const { settings } = useSettings();
  const [nodes, setNodes] = useState<Node[]>([]);

  useEffect(() => {
    fetch('/api/nodes').then(r => r.json()).then(setNodes).catch(console.error);
  }, []);

  const showCpu   = settings.dashboard_show_cpu   !== 'false';
  const showRam   = settings.dashboard_show_ram   !== 'false';
  const showNodes = settings.dashboard_show_nodes !== 'false';

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

      {(showCpu || showRam) && (
        <div className="stats-grid">
          {showCpu && (
            <StatCard label="CPU-Auslastung" value={cpuVal} unit="%" sub={current?.cpuTemp ? `${current.cpuTemp}°C` : undefined}>
              <CpuSparkline history={history} />
            </StatCard>
          )}
          {showRam && (
            <StatCard label="Arbeitsspeicher" value={ramPercent} unit="%" sub={ramSub}>
              <RamBars history={history} />
            </StatCard>
          )}
        </div>
      )}

      {showNodes && <ServerTable nodes={nodes} />}
    </>
  );
}

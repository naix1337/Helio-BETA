import { useEffect } from 'react';
import { Server, Bell, Activity, Clock } from 'lucide-react';
import { useStore } from '../store/useStore';
import KpiCard from './KpiCard';
import MainChart from './MainChart';
import AlertFeed from './AlertFeed';
import NodesTable from './NodesTable';
import * as monitorsApi from '../api/monitors';

export default function Overview() {
  const monitors = useStore((s) => s.monitors);
  const monitorsLoading = useStore((s) => s.monitorsLoading);
  const fetchMonitors = useStore((s) => s.fetchMonitors);

  useEffect(() => {
    fetchMonitors();
  }, [fetchMonitors]);

  if (monitorsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]" style={{ color: 'var(--color-text-muted)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
          <span className="text-[0.9rem]">Lade Monitore…</span>
        </div>
      </div>
    );
  }

  const total = monitors.length;
  const online = monitors.filter((m) => m.status === 'UP').length;
  const down = monitors.filter((m) => m.status === 'DOWN' || m.status === 'DEGRADED').length;
  const okPercent = total > 0 ? Math.round((online / total) * 100) : 0;

  return (
    <div className="animate-[view-fade_0.35s_cubic-bezier(0.22,1,0.36,1)]">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-[26px]">
        <KpiCard
          icon={<Server className="w-[15px] h-[15px]" />}
          label="Monitore"
          trend={{ value: `${online}/${total}`, type: okPercent >= 80 ? 'up' : 'down' }}
          value={<>{online}<small className="text-[0.9rem] text-[var(--color-text-dim)] font-normal"> / {total}</small></>}
          sparkColor="--color-primary"
          sparkSeed={3}
        />
        <KpiCard
          icon={<Bell className="w-[15px] h-[15px]" />}
          label="Alerts aktiv"
          trend={{ value: `${down > 0 ? '⚠' : '✓'}`, type: down > 0 ? 'down' : 'up' }}
          value={<>{down}<small className="text-[0.9rem] text-[var(--color-text-dim)] font-normal"> kritisch</small></>}
          sparkColor="--color-down"
          sparkSeed={11}
        />
        <KpiCard
          icon={<Activity className="w-[15px] h-[15px]" />}
          label="Ø Uptime (24h)"
          trend={{ value: 'letzte 24h', type: 'flat' }}
          value={<>{monitors.length > 0 ? Math.round(monitors.filter(m => m.status === 'UP').length / monitors.length * 100) : 0}<small className="text-[0.9rem] text-[var(--color-text-dim)] font-normal">%</small></>}
          sparkColor="--color-violet"
          sparkSeed={0}
          noSpark
          isViolet
        />
        <KpiCard
          icon={<Clock className="w-[15px] h-[15px]" />}
          label="Check-Intervall"
          trend={{ value: '⏱', type: 'flat' }}
          value={<>{Math.round(total > 0 ? monitors.reduce((a, m) => a + m.intervalSeconds, 0) / total / 60 : 0)}<small className="text-[0.9rem] text-[var(--color-text-dim)] font-normal"> min Ø</small></>}
          sparkColor="--color-primary"
          sparkSeed={5}
        />
      </div>

      {/* Main chart + Alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.62fr_1fr] gap-4 items-start">
        <MainChart />
        <AlertFeed />
      </div>

      {/* Nodes table */}
      <div className="mt-[30px]">
        <NodesTable
          title="Alle Monitore"
          subtitle={`${online} online · ${down} mit Problemen`}
        />
      </div>
    </div>
  );
}

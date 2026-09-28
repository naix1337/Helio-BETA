import { useMemo } from 'react';
import { Server, Bell, Activity, Gauge } from 'lucide-react';
import { useStore } from '../store/useStore';
import KpiCard from './KpiCard';
import MainChart from './MainChart';
import AlertFeed from './AlertFeed';
import NodesTable from './NodesTable';

export default function Overview() {
  const monitors = useStore((s) => s.monitors);
  const monitorsLoaded = useStore((s) => s.monitorsLoaded);
  const beats = useStore((s) => s.beats);

  const stats = useMemo(() => {
    const active = monitors.filter((m) => m.status !== 'PAUSED');
    const online = monitors.filter((m) => m.status === 'UP').length;
    const down = monitors.filter((m) => m.status === 'DOWN').length;
    const degraded = monitors.filter((m) => m.status === 'DEGRADED').length;

    let up = 0, total = 0;
    const latencyByIndex: number[][] = [];
    for (const m of active) {
      const list = beats[m.id] ?? [];
      list.forEach((b, i) => {
        if (b.status !== 'PENDING') {
          total++;
          if (b.status === 'UP' || b.status === 'DEGRADED') up++;
        }
        if (b.latencyMs !== null) {
          const idx = i + (60 - list.length);
          (latencyByIndex[idx] ??= []).push(b.latencyMs);
        }
      });
    }
    const latencySeries = latencyByIndex
      .filter((a) => a && a.length)
      .map((a) => a.reduce((x, y) => x + y, 0) / a.length);
    const avgLatency = latencySeries.length ? Math.round(latencySeries.reduce((a, b) => a + b, 0) / latencySeries.length) : null;

    return {
      total: monitors.length, online, down, degraded,
      uptime: total ? Math.round((up / total) * 1000) / 10 : null,
      avgLatency, latencySeries,
    };
  }, [monitors, beats]);

  if (!monitorsLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[300px]" style={{ color: 'var(--color-text-muted)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
          <span className="text-[0.9rem]">Lade Monitore…</span>
        </div>
      </div>
    );
  }

  const small = 'text-[0.9rem] text-[var(--color-text-dim)] font-normal';

  return (
    <div className="animate-[view-fade_0.35s_cubic-bezier(0.22,1,0.36,1)]">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-[26px]">
        <KpiCard
          icon={<Server className="w-[15px] h-[15px]" />}
          label="Monitore online"
          trend={{ value: `${stats.online}/${stats.total}`, type: stats.down > 0 ? 'down' : 'up' }}
          value={<>{stats.online}<small className={small}> / {stats.total}</small></>}
        />
        <KpiCard
          icon={<Bell className="w-[15px] h-[15px]" />}
          label="Aktive Alerts"
          trend={{ value: stats.down + stats.degraded > 0 ? 'Probleme' : 'alles ok', type: stats.down + stats.degraded > 0 ? 'down' : 'up' }}
          value={<>{stats.down}<small className={small}> down{stats.degraded ? ` · ${stats.degraded} eingeschr.` : ''}</small></>}
        />
        <KpiCard
          icon={<Activity className="w-[15px] h-[15px]" />}
          label="Uptime (letzte Checks)"
          trend={{ value: 'live', type: 'flat' }}
          value={<>{stats.uptime ?? '—'}<small className={small}>{stats.uptime !== null ? ' %' : ''}</small></>}
          isViolet
        />
        <KpiCard
          icon={<Gauge className="w-[15px] h-[15px]" />}
          label="Ø Antwortzeit"
          trend={{ value: 'ms', type: 'flat' }}
          value={<>{stats.avgLatency ?? '—'}<small className={small}>{stats.avgLatency !== null ? ' ms' : ''}</small></>}
          sparkData={stats.latencySeries}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.62fr_1fr] gap-4 items-start">
        <MainChart />
        <AlertFeed />
      </div>

      <div className="mt-[30px]">
        <NodesTable
          title="Alle Monitore"
          subtitle={`${stats.online} online · ${stats.down + stats.degraded} mit Problemen`}
        />
      </div>
    </div>
  );
}

import { useStore } from '../store/useStore';
import { Menu, Bell, Moon, Sun, Plus } from 'lucide-react';

const VIEW_TITLES: Record<string, [string, string]> = {
  overview: ['Übersicht', 'prod · alle Regionen'],
  nodes: ['Monitore', 'Übersicht aller Monitore'],
  alerts: ['Alerts', 'Aktive Warnungen und Vorfälle'],
  containers: ['Container', 'Proxmox Container/VM Metriken'],
  status: ['Status-Page', 'Öffentliche Status-Seiten'],
  metrics: ['Metriken', 'Uptime- und Leistungsdaten'],
  team: ['Team', 'Mitglieder und Rollen'],
  settings: ['Einstellungen', 'System-Konfiguration'],
};

const RANGE_VALS = ['1', '6', '24', '7d'] as const;
const RANGE_LABELS: Record<string, string> = { '1': '1h', '6': '6h', '24': '24h', '7d': '7d' };

export default function Topbar() {
  const currentView = useStore((s) => s.currentView);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const timeRange = useStore((s) => s.timeRange);
  const setTimeRange = useStore((s) => s.setTimeRange);
  const setView = useStore((s) => s.setView);
  const setShowMonitorForm = useStore((s) => s.setShowMonitorForm);

  const [title, subtitle] = VIEW_TITLES[currentView] || ['Helio', 'Monitoring'];

  return (
    <header
      className="sticky top-0 z-40 h-[64px] flex items-center gap-[14px] px-[clamp(16px,3vw,28px)] border-b border-[var(--color-border)]"
      style={{ background: 'var(--color-nav-bg)', backdropFilter: 'saturate(150%) blur(14px)', WebkitBackdropFilter: 'saturate(150%) blur(14px)' }}
    >
      {/* Mobile burger */}
      <button
        className="hidden max-md:grid w-[38px] h-[38px] rounded-[9px] border border-[var(--color-border)] bg-transparent text-[var(--color-text)] cursor-pointer place-items-center"
        onClick={toggleSidebar}
        aria-label="Navigation öffnen"
      >
        <Menu className="w-[19px] h-[19px]" />
      </button>

      {/* Page title */}
      <div className="flex flex-col">
        <h1 className="text-[1.18rem] tracking-tight font-semibold m-0 leading-tight">{title}</h1>
        <span className="font-mono text-[0.7rem] text-[var(--color-text-dim)]">{subtitle}</span>
      </div>

      <div className="flex-1" />

      {/* Live tag */}
      <span className="inline-flex items-center gap-[7px] font-mono text-[0.74rem] text-[var(--color-text-muted)] pr-1">
        <span className="relative w-[9px] h-[9px] rounded-full bg-[var(--color-ok)] inline-flex"
          style={{ boxShadow: '0 0 0 3px var(--color-ok-soft)' }}
        >
          <span className="absolute inset-0 rounded-full bg-[var(--color-ok)] animate-[live-pulse_2s_ease-out_infinite]" />
        </span>
        live
      </span>

      {/* Topbar actions */}
      <div className="flex items-center gap-2">
        {/* Time range segmented */}
        <div className="inline-flex border border-[var(--color-border)] rounded-[9px] overflow-hidden bg-[var(--color-surface-2)] max-[600px]:hidden">
          {RANGE_VALS.map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-3 py-[7px] text-[0.8rem] font-medium font-mono border-none cursor-pointer transition-colors duration-150 ${
                timeRange === r
                  ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {r === '7d' ? '7d' : `${r}h`}
            </button>
          ))}
        </div>

        {/* Notification bell — navigiert zu Alerts */}
        <button
          onClick={() => setView('alerts')}
          className="relative w-[38px] h-[38px] rounded-[9px] border border-[var(--color-border)] bg-transparent text-[var(--color-text-muted)] cursor-pointer grid place-items-center hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)] transition-all duration-150"
          aria-label="Benachrichtigungen"
        >
          <Bell className="w-[18px] h-[18px]" />
          <span className="absolute top-[8px] right-[9px] w-[7px] h-[7px] rounded-full bg-[var(--color-down)]" style={{ boxShadow: '0 0 0 2px var(--color-bg)' }} />
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-[38px] h-[38px] rounded-[9px] border border-[var(--color-border)] bg-transparent text-[var(--color-text-muted)] cursor-pointer grid place-items-center hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)] transition-all duration-150"
          aria-label="Farbschema wechseln"
        >
          {theme === 'dark' ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />}
        </button>

        {/* +Node button — öffnet MonitorForm */}
        <button
          onClick={() => setShowMonitorForm(true)}
          className="btn-primary max-sm:hidden"
        >
          <Plus className="w-[18px] h-[18px]" />
          Node
        </button>
      </div>
    </header>
  );
}

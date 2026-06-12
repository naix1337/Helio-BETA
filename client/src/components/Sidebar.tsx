import { useStore, type ViewName } from '../store/useStore';
import { Search, LayoutDashboard, Server, Box, Bell, Globe, LineChart, Users, Settings, ChevronsUpDown, Plus, LogOut } from 'lucide-react';

const NAV_GROUPS: { label: string; items: { view: ViewName; icon: React.ElementType; display: string; badgeType?: string }[] }[] = [
  {
    label: 'Monitoring',
    items: [
      { view: 'overview', icon: LayoutDashboard, display: 'Übersicht' },
      { view: 'nodes', icon: Server, display: 'Monitore' },
      { view: 'containers', icon: Box, display: 'Container' },
      { view: 'alerts', icon: Bell, display: 'Alerts', badgeType: 'down' },
    ],
  },
  {
    label: 'Transparenz',
    items: [
      { view: 'status', icon: Globe, display: 'Status-Page' },
      { view: 'metrics', icon: LineChart, display: 'Metriken' },
      { view: 'team', icon: Users, display: 'Team' },
    ],
  },
  {
    label: 'System',
    items: [
      { view: 'settings', icon: Settings, display: 'Einstellungen' },
    ],
  },
];

export default function Sidebar() {
  const currentView = useStore((s) => s.currentView);
  const setView = useStore((s) => s.setView);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const user = useStore((s) => s.user);
  const logout = useStore((s) => s.logout);
  const monitors = useStore((s) => s.monitors);
  const setShowMonitorForm = useStore((s) => s.setShowMonitorForm);
  const fetchMonitors = useStore((s) => s.fetchMonitors);

  const downCount = monitors.filter((m) => m.status === 'DOWN' || m.status === 'DEGRADED').length;

  const handleNav = (v: ViewName) => {
    setView(v);
    if (window.innerWidth <= 860) setSidebarOpen(false);
  };

  const getBadge = (view: ViewName): string | undefined => {
    if (view === 'nodes') return monitors.length > 0 ? String(monitors.length) : undefined;
    if (view === 'alerts') return downCount > 0 ? String(downCount) : undefined;
    return undefined;
  };

  const getBadgeType = (view: ViewName): string | undefined => {
    if (view === 'alerts' && downCount > 0) return 'down';
    return undefined;
  };

  return (
    <>
      {sidebarOpen && (
        <div className="fixed inset-0 z-45 bg-black/50 block md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50 w-[248px] flex flex-col
        bg-[var(--color-bg-soft)] border-r border-[var(--color-border)]
        transition-transform duration-280 ease-[cubic-bezier(0.22,1,0.36,1)]
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>
        {/* Brand */}
        <div className="flex items-center justify-between px-4 py-[18px]">
          <span className="flex items-center gap-[11px] font-semibold text-[1.08rem] tracking-tight" style={{ color: 'var(--color-text)' }}>
            <span className="relative w-[30px] h-[30px] rounded-[9px] flex-none inline-block"
              style={{
                background: 'radial-gradient(circle at 30% 28%, var(--color-primary), #0e7d72 78%)',
                boxShadow: '0 0 0 1px var(--color-border-strong), 0 6px 18px -6px var(--color-primary-glow)',
              }}
            >
              <span className="absolute inset-[8px] rounded-full border-2 border-white/85"
                style={{ borderRightColor: 'transparent', borderBottomColor: 'transparent', transform: 'rotate(45deg)' }} />
            </span>
            Helio
          </span>
          <span className="font-mono text-[0.66rem] tracking-wider uppercase px-[7px] py-[3px] rounded-[6px]" style={{ color: 'var(--color-text-dim)', border: '1px solid var(--color-border)' }}>dev build</span>
        </div>

        {/* Search + Create */}
        <div className="mx-[14px] mb-[14px] mt-[2px] flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-[11px] top-1/2 -translate-y-1/2 w-[15px] h-[15px]" style={{ color: 'var(--color-text-dim)' }} />
            <input type="search" placeholder="Suchen…" aria-label="Suchen"
              className="w-full h-[38px] pl-[34px] pr-[12px] rounded-[9px] border text-[0.86rem] outline-none focus:border-[var(--color-primary)]"
              style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            />
          </div>
          <button
            onClick={() => setShowMonitorForm(true)}
            className="w-[38px] h-[38px] rounded-[9px] grid place-items-center border cursor-pointer flex-none"
            style={{ background: 'var(--color-primary)', borderColor: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}
            title="Neuen Monitor erstellen"
          >
            <Plus className="w-[18px] h-[18px]" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-thin" aria-label="Dashboard-Navigation">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="[&+&]:mt-[18px]">
              <span className="font-mono text-[0.66rem] uppercase tracking-[0.1em] block px-[10px] mb-[7px]" style={{ color: 'var(--color-text-dim)' }}>
                {group.label}
              </span>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.view;
                const badge = getBadge(item.view);
                const bType = getBadgeType(item.view);
                return (
                  <button
                    key={item.view}
                    onClick={() => handleNav(item.view)}
                    className={`
                      flex items-center gap-[11px] w-full px-[11px] py-[9px] rounded-[9px]
                      text-left text-[0.9rem] font-[460] border-none cursor-pointer
                      transition-colors duration-150
                      ${isActive ? 'text-[var(--color-primary)] bg-[var(--color-primary-soft)] font-[520]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]'}
                    `}
                  >
                    <Icon className="w-[17px] h-[17px] flex-none opacity-85" />
                    {item.display}
                    {badge && (
                      <span className={`ml-auto font-mono text-[0.7rem] rounded-full px-[8px] py-[1px] ${
                        bType === 'down' ? 'text-[var(--color-down)] bg-[var(--color-down-soft)]' :
                        isActive ? 'text-[var(--color-primary)] bg-[var(--color-primary-soft)]' :
                        'text-[var(--color-text-dim)] bg-[var(--color-surface-3)]'
                      }`}>
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t px-[14px] py-[12px]" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-[11px] p-[6px] rounded-[10px]">
            <span className="w-[34px] h-[34px] rounded-[9px] flex-none grid place-items-center font-mono font-semibold text-[0.82rem]"
              style={{
                color: 'var(--color-primary-fg)',
                background: 'linear-gradient(135deg, var(--color-primary), #0e7d72)',
              }}
            >
              {user?.email ? user.email.slice(0, 2).toUpperCase() : '??'}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[0.86rem] font-[520] truncate" style={{ color: 'var(--color-text)' }}>{user?.email || 'Gast'}</div>
              <div className="text-[0.74rem] font-mono" style={{ color: 'var(--color-text-dim)' }}>{user?.role || '—'}</div>
            </div>
            <button onClick={logout} className="w-[28px] h-[28px] rounded-[6px] grid place-items-center border cursor-pointer" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-dim)', background: 'transparent' }} title="Abmelden">
              <LogOut className="w-[14px] h-[14px]" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

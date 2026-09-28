import { useEffect } from 'react';
import { useStore } from './store/useStore';
import { useWebSocket } from './hooks/useWebSocket';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Overview from './components/Overview';
import NodesView from './components/NodesView';
import AlertsView from './components/AlertsView';
import NotificationsView from './components/NotificationsView';
import MaintenanceView from './components/MaintenanceView';
import MonitorDetail from './components/MonitorDetail';
import StatusPageView from './components/StatusPageView';
import PublicStatusPage from './components/PublicStatusPage';
import MetricsView from './components/MetricsView';
import SettingsView from './components/SettingsView';
import TeamView from './components/TeamView';
import MonitorForm from './components/MonitorForm';
import ContainerDashboard from './components/ContainerDashboard';
import LoginPage from './components/LoginPage';

/** Public status pages are served at /status/<slug> without login */
function publicStatusSlug(): string | null {
  const m = window.location.pathname.match(/^\/status\/([a-z0-9-]+)\/?$/);
  return m ? m[1]! : null;
}

function Dashboard() {
  const theme = useStore((s) => s.theme);
  const currentView = useStore((s) => s.currentView);
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const authChecked = useStore((s) => s.authChecked);
  const checkAuth = useStore((s) => s.checkAuth);
  const detailMonitorId = useStore((s) => s.detailMonitorId);
  const showMonitorForm = useStore((s) => s.showMonitorForm);
  const editMonitorId = useStore((s) => s.editMonitorId);
  const setShowMonitorForm = useStore((s) => s.setShowMonitorForm);

  useWebSocket(isAuthenticated);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) useStore.getState().setSidebarOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!authChecked) {
    return (
      <div className="min-h-screen grid place-items-center" style={{ background: 'var(--color-bg)' }}>
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const renderView = () => {
    if (detailMonitorId) {
      return <MonitorDetail key={detailMonitorId} monitorId={detailMonitorId} onBack={() => useStore.getState().setDetailMonitor(null)} />;
    }
    switch (currentView) {
      case 'overview': return <Overview />;
      case 'nodes': return <NodesView />;
      case 'containers': return <ContainerDashboard />;
      case 'alerts': return <AlertsView />;
      case 'notifications': return <NotificationsView />;
      case 'maintenance': return <MaintenanceView />;
      case 'status': return <StatusPageView />;
      case 'metrics': return <MetricsView />;
      case 'settings': return <SettingsView />;
      case 'team': return <TeamView />;
      default: return <Overview />;
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      {showMonitorForm && <MonitorForm editId={editMonitorId || undefined} onClose={() => setShowMonitorForm(false)} />}
      <main className="main-col">
        <Topbar />
        <div className="flex-1" style={{ padding: 'clamp(16px, 3vw, 28px)' }}>
          {renderView()}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const slug = publicStatusSlug();
  if (slug) return <PublicStatusPage slug={slug} />;
  return <Dashboard />;
}

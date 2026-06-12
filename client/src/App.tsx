import { useEffect } from 'react';
import { useStore } from './store/useStore';
import { useChartLiveUpdates } from './hooks/useChartLiveUpdates';
import { useWebSocket } from './hooks/useWebSocket';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Overview from './components/Overview';
import NodesView from './components/NodesView';
import AlertsView from './components/AlertsView';
import NotificationsView from './components/NotificationsView';
import MonitorDetail from './components/MonitorDetail';
import StatusPageView from './components/StatusPageView';
import MetricsView from './components/MetricsView';
import SettingsView from './components/SettingsView';
import TeamView from './components/TeamView';
import LoginPage from './components/LoginPage';

function App() {
  const theme = useStore((s) => s.theme);
  const currentView = useStore((s) => s.currentView);
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const checkAuth = useStore((s) => s.checkAuth);
  const user = useStore((s) => s.user);
  const detailMonitorId = useStore((s) => s.detailMonitorId);

  useChartLiveUpdates();
  useWebSocket();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 860) useStore.getState().setSidebarOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const renderView = () => {
    if (detailMonitorId) {
      return <MonitorDetail monitorId={detailMonitorId} onBack={() => useStore.getState().setDetailMonitor(null)} />;
    }
    switch (currentView) {
      case 'overview': return <Overview />;
      case 'nodes': return <NodesView />;
      case 'containers': return <NotificationsView />;
      case 'alerts': return <AlertsView />;
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
      <main className="main-col">
        <Topbar />
        <div className="flex-1" style={{ padding: 'clamp(18px, 3vw, 28px)' }}>
          {renderView()}
        </div>
      </main>
    </div>
  );
}

export default App;

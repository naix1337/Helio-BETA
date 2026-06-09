// helio-app/frontend/src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { Sidebar } from './components/Sidebar.tsx';
import { ToastContainer } from './components/Toast.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { Nodes } from './pages/Nodes.tsx';
import { Alerts } from './pages/Alerts.tsx';
import { StatusPage } from './pages/StatusPage.tsx';
import { Settings } from './pages/Settings.tsx';
import { LandingPage } from './pages/LandingPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { SetupPage } from './pages/SetupPage.tsx';
import { Team } from './pages/Team.tsx';
import { Agents } from './pages/Agents.tsx';
import { AgentDetail } from './pages/AgentDetail.tsx';
import { PingMonitor } from './pages/PingMonitor.tsx';
import { RequireAuth } from './components/RequireAuth.tsx';
import { RequireSetup } from './components/RequireSetup.tsx';

function AppLayout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/status" element={<StatusPage />} />
        <Route element={<RequireSetup />}>
          <Route element={<RequireAuth />}>
            <Route path="/dashboard" element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="nodes" element={<Nodes />} />
              <Route path="alerts" element={<Alerts />} />
              <Route path="settings" element={<Settings />} />
              <Route path="team" element={<Team />} />
              <Route path="agents" element={<Agents />} />
              <Route path="agents/:id" element={<AgentDetail />} />
              <Route path="ping" element={<PingMonitor />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

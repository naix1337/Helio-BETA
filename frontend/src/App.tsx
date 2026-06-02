// helio-app/frontend/src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Sidebar } from './components/Sidebar.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { Nodes } from './pages/Nodes.tsx';
import { Containers } from './pages/Containers.tsx';
import { Alerts } from './pages/Alerts.tsx';
import { StatusPage } from './pages/StatusPage.tsx';

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

function Settings() {
  return <div style={{ padding: '24px' }}><h1>Einstellungen</h1><p style={{ color: 'var(--text-muted)', marginTop: '12px' }}>Demnächst verfügbar.</p></div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="nodes" element={<Nodes />} />
          <Route path="containers" element={<Containers />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="/status" element={<StatusPage />} />
      </Routes>
    </BrowserRouter>
  );
}

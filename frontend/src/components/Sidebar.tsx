// helio-app/frontend/src/components/Sidebar.tsx
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Server, Box, Bell, Activity,
  Settings, Users, LogOut,
} from 'lucide-react';
import { useMetricsStore } from '../store/metricsStore.ts';
import { useAuth } from '../hooks/useAuth.ts';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Übersicht', to: '/dashboard' },
  { icon: Server,          label: 'Nodes',     to: '/dashboard/nodes' },
  { icon: Box,             label: 'Container', to: '/dashboard/containers' },
  { icon: Bell,            label: 'Alerts',    to: '/dashboard/alerts' },
  { icon: Activity,        label: 'Status-Page', to: '/status' },
];

const SYSTEM_ITEMS = [
  { icon: Settings, label: 'Einstellungen', to: '/dashboard/settings' },
  { icon: Users,    label: 'Team',          to: '/dashboard/team' },
];

function WsIndicator() {
  const status = useMetricsStore((s) => s.wsStatus);
  const color = status === 'open' ? 'var(--ok)' : 'var(--text-dim)';
  return (
    <span title={`WS: ${status}`} style={{
      width: '8px', height: '8px', borderRadius: '50%',
      background: color, display: 'inline-block', flexShrink: 0,
    }} />
  );
}

export function Sidebar() {
  const currentUser = useAuth((s) => s.currentUser);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();

  const activeStyle: React.CSSProperties = {
    background: 'var(--primary-soft)',
    color: 'var(--primary)',
    fontWeight: 500,
  };

  const itemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '9px 11px', borderRadius: '8px',
    fontSize: '0.85rem', color: 'var(--text-muted)',
    transition: 'background 0.15s, color 0.15s',
    cursor: 'pointer',
  };

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const roleBadgeStyle: React.CSSProperties = {
    fontSize: '0.65rem',
    padding: '1px 5px',
    borderRadius: '4px',
    background: 'var(--primary-soft)',
    color: 'var(--primary)',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.03em',
    flexShrink: 0,
  };

  return (
    <aside style={{
      background: 'var(--bg-soft)',
      borderRight: '1px solid var(--border)',
      padding: '16px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '3px',
      overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px',
        padding: '8px 11px 18px', marginBottom: '4px' }}>
        <span style={{
          width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
          background: 'radial-gradient(circle at 30% 28%, var(--primary), #0e7d72 78%)',
          boxShadow: '0 0 0 1px var(--border-strong), 0 4px 12px -4px var(--primary-glow)',
        }} />
        <span style={{ fontWeight: 640, fontSize: '1.05rem', letterSpacing: '-0.02em' }}>Helio</span>
        <WsIndicator />
      </div>

      {NAV_ITEMS.map(({ icon: Icon, label, to }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/dashboard'}
          style={({ isActive }) => ({ ...itemStyle, ...(isActive ? activeStyle : {}) })}
        >
          <Icon size={16} />
          {label}
        </NavLink>
      ))}

      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: '0.66rem',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        color: 'var(--text-dim)', padding: '18px 11px 6px',
      }}>
        System
      </div>

      {SYSTEM_ITEMS.map(({ icon: Icon, label, to }) => (
        <NavLink
          key={to}
          to={to}
          style={({ isActive }) => ({ ...itemStyle, ...(isActive ? activeStyle : {}) })}
        >
          <Icon size={16} />
          {label}
        </NavLink>
      ))}

      {currentUser && (
        <div style={{
          marginTop: 'auto',
          paddingTop: '12px',
          borderTop: '1px solid var(--border)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 11px',
          }}>
            {/* User initial circle */}
            <span style={{
              width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
              background: 'var(--primary-soft)',
              color: 'var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem', fontWeight: 600,
            }}>
              {currentUser.email.charAt(0).toUpperCase()}
            </span>

            {/* Email + role */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '0.78rem', color: 'var(--text)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {currentUser.email}
              </div>
              <div style={{ marginTop: '2px' }}>
                <span style={roleBadgeStyle}>{currentUser.role}</span>
              </div>
            </div>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              title="Abmelden"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-dim)', padding: '4px', borderRadius: '6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'color 0.15s, background 0.15s',
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--danger, #ef4444)';
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-dim)';
                (e.currentTarget as HTMLButtonElement).style.background = 'none';
              }}
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

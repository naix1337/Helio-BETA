import { create } from 'zustand';
import type { ViewName } from '../data/mockData';
import * as authApi from '../api/auth';
import * as monitorsApi from '../api/monitors';
import * as notificationsApi from '../api/notifications';
import { getAccessToken, clearTokens } from '../api/client';

/* ---------- Types ---------- */

export interface User {
  id: string;
  email: string;
  totpEnabled: boolean;
  role: string;
  createdAt: string;
}

export interface Monitor {
  id: string;
  name: string;
  type: 'http' | 'tcp' | 'ping' | 'dns' | 'ssl' | 'push';
  config: Record<string, unknown>;
  intervalSeconds: number;
  retries: number;
  status: 'UP' | 'DOWN' | 'PENDING' | 'PAUSED' | 'DEGRADED';
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Heartbeat {
  id: string;
  monitorId: string;
  timestamp: string;
  status: string;
  latencyMs: number | null;
  message: string | null;
  statusCode: number | null;
}

export interface UptimeSummary {
  last24h: number;
  last7d: number;
  last30d: number;
  last365d: number;
}

export interface Notification {
  id: string;
  name: string;
  provider: 'webhook' | 'telegram' | 'discord' | 'email' | 'ntfy';
  config: Record<string, unknown>;
  monitorIds: string[];
  createdAt: string;
}

/* ---------- Seeded PRNG for charts ---------- */
function seeded(seed: number) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

function makeSeries(n: number) {
  const r1 = seeded(7), r2 = seeded(42);
  const cpu: number[] = [];
  const net: number[] = [];
  let c = 38, nt = 60;
  for (let i = 0; i < n; i++) {
    c += (r1() - 0.5) * 10; c = Math.max(14, Math.min(92, c));
    nt += (r2() - 0.5) * 22; nt = Math.max(20, Math.min(140, nt));
    cpu.push(c); net.push(nt);
  }
  return { cpu, net };
}

/* ---------- State ---------- */

interface ChartSeries { cpu: number[]; net: number[] }

interface AppState {
  // Auth
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;

  // Theme
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
  toggleTheme: () => void;

  // View routing
  currentView: ViewName;
  setView: (v: ViewName) => void;
  detailMonitorId: string | null;
  setDetailMonitor: (id: string | null) => void;

  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (o: boolean) => void;
  toggleSidebar: () => void;

  // Time range
  timeRange: string;
  setTimeRange: (r: string) => void;

  // Chart (demo simulations)
  mainSeries: ChartSeries;
  pushTick: (cpu: number, net: number) => void;

  // Monitors (from API)
  monitors: Monitor[];
  monitorsLoading: boolean;
  monitorsError: string | null;
  fetchMonitors: () => Promise<void>;

  // Notifications (from API)
  notifications: Notification[];
  notificationsLoading: boolean;
  fetchNotifications: () => Promise<void>;
}

function getInitialTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem('helio-theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return 'dark';
}

export const useStore = create<AppState>((set, get) => ({
  /* ---------- Auth ---------- */
  user: null,
  isAuthenticated: !!getAccessToken(),
  isLoading: false,
  authError: null,

  login: async (email, password) => {
    set({ isLoading: true, authError: null });
    try {
      const result = await authApi.login(email, password);
      if (!result) throw new Error('Login fehlgeschlagen');
      set({ user: result.user, isAuthenticated: true, isLoading: false });
      // Fetch initial data
      get().fetchMonitors();
      get().fetchNotifications();
    } catch (err) {
      set({ isLoading: false, authError: err instanceof Error ? err.message : 'Login fehlgeschlagen' });
    }
  },

  register: async (email, password) => {
    set({ isLoading: true, authError: null });
    try {
      const result = await authApi.register(email, password);
      if (!result) throw new Error('Registrierung fehlgeschlagen');
      set({ user: result.user, isAuthenticated: true, isLoading: false });
    } catch (err) {
      set({ isLoading: false, authError: err instanceof Error ? err.message : 'Registrierung fehlgeschlagen' });
    }
  },

  logout: () => {
    authApi.logout();
    set({ user: null, isAuthenticated: false, monitors: [], notifications: [] });
  },

  checkAuth: async () => {
    if (!getAccessToken()) {
      set({ isAuthenticated: false, user: null });
      return;
    }
    try {
      const profile = await authApi.getProfile();
      if (profile) {
        set({ user: profile, isAuthenticated: true });
        get().fetchMonitors();
        get().fetchNotifications();
      } else {
        set({ isAuthenticated: false, user: null });
      }
    } catch {
      set({ isAuthenticated: false, user: null });
    }
  },

  /* ---------- Theme ---------- */
  theme: getInitialTheme(),
  setTheme: (t) => { localStorage.setItem('helio-theme', t); set({ theme: t }); },
  toggleTheme: () =>
    set((s) => {
      const next = s.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('helio-theme', next);
      return { theme: next };
    }),

  /* ---------- View ---------- */
  currentView: 'overview',
  setView: (v) => set({ currentView: v, detailMonitorId: null }),
  detailMonitorId: null,
  setDetailMonitor: (id) => set({ detailMonitorId: id }),
  sidebarOpen: false,
  setSidebarOpen: (o) => set({ sidebarOpen: o }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  timeRange: '24h',
  setTimeRange: (r) => set({ timeRange: r }),

  /* ---------- Chart ---------- */
  mainSeries: makeSeries(96),
  pushTick: (cpu, net) =>
    set((s) => ({
      mainSeries: {
        cpu: [...s.mainSeries.cpu.slice(1), cpu],
        net: [...s.mainSeries.net.slice(1), net],
      },
    })),

  /* ---------- API Data ---------- */
  monitors: [],
  monitorsLoading: false,
  monitorsError: null,

  fetchMonitors: async () => {
    set({ monitorsLoading: true, monitorsError: null });
    try {
      const data = await monitorsApi.listMonitors();
      set({ monitors: data, monitorsLoading: false });
    } catch (err) {
      set({ monitorsLoading: false, monitorsError: err instanceof Error ? err.message : 'Fehler beim Laden' });
    }
  },

  notifications: [],
  notificationsLoading: false,

  fetchNotifications: async () => {
    set({ notificationsLoading: true });
    try {
      const data = await notificationsApi.listNotifications();
      set({ notifications: data, notificationsLoading: false });
    } catch {
      set({ notificationsLoading: false });
    }
  },
}));

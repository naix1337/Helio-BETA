import { create } from 'zustand';
import * as authApi from '../api/auth';
import * as monitorsApi from '../api/monitors';
import * as notificationsApi from '../api/notifications';
import { getAccessToken, onSessionExpired } from '../api/client';

/* ---------- Types ---------- */

export type User = authApi.UserPublic;
export type Monitor = monitorsApi.Monitor;
export type Heartbeat = monitorsApi.Heartbeat;
export type Beat = monitorsApi.Beat;
export type UptimeSummary = monitorsApi.UptimeSummary;
export type Notification = notificationsApi.Notification;

export type ViewName =
  | 'overview' | 'nodes' | 'containers' | 'alerts' | 'notifications' | 'maintenance'
  | 'status' | 'metrics' | 'team' | 'settings';

const MAX_BEATS = 60;

/* ---------- State ---------- */

interface AppState {
  // Auth
  user: User | null;
  isAuthenticated: boolean;
  authChecked: boolean;
  needsSetup: boolean;
  isLoading: boolean;
  authError: string | null;
  requires2fa: boolean;
  login: (email: string, password: string, totpToken?: string) => Promise<void>;
  setup: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  refreshUser: () => Promise<void>;

  // Theme
  theme: 'dark' | 'light';
  toggleTheme: () => void;

  // View routing
  currentView: ViewName;
  setView: (v: ViewName) => void;
  detailMonitorId: string | null;
  setDetailMonitor: (id: string | null) => void;

  // Sidebar / search
  sidebarOpen: boolean;
  setSidebarOpen: (o: boolean) => void;
  toggleSidebar: () => void;
  search: string;
  setSearch: (q: string) => void;

  // Time range for overview chart
  timeRange: string;
  setTimeRange: (r: string) => void;

  // Monitors
  monitors: Monitor[];
  monitorsLoaded: boolean;
  monitorsError: string | null;
  fetchMonitors: () => Promise<void>;
  beats: Record<string, Beat[]>;
  fetchBeats: () => Promise<void>;

  // Live updates (from WebSocket)
  applyHeartbeat: (monitorId: string, hb: Heartbeat) => void;
  applyStatusChange: (monitorId: string, status: Monitor['status']) => void;
  upsertMonitor: (m: Monitor) => void;
  removeMonitor: (id: string) => void;

  // Notifications
  notifications: Notification[];
  fetchNotifications: () => Promise<void>;

  // Monitor form modal
  showMonitorForm: boolean;
  setShowMonitorForm: (v: boolean) => void;
  editMonitorId: string | null;
  setEditMonitor: (id: string | null) => void;
}

function getInitialTheme(): 'dark' | 'light' {
  try {
    const saved = localStorage.getItem('helio-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* ignore */ }
  return 'dark';
}

export const useStore = create<AppState>((set, get) => ({
  /* ---------- Auth ---------- */
  user: null,
  isAuthenticated: false,
  authChecked: false,
  needsSetup: false,
  isLoading: false,
  authError: null,
  requires2fa: false,

  login: async (email, password, totpToken) => {
    set({ isLoading: true, authError: null });
    try {
      const result = await authApi.login(email, password, totpToken);
      set({ user: result.user, isAuthenticated: true, isLoading: false, requires2fa: false });
      void get().fetchMonitors();
      void get().fetchNotifications();
    } catch (err) {
      if (err instanceof authApi.TwoFactorRequiredError) {
        set({ isLoading: false, requires2fa: true, authError: totpToken ? err.message : null });
        return;
      }
      set({ isLoading: false, authError: err instanceof Error ? err.message : 'Login fehlgeschlagen' });
    }
  },

  setup: async (email, password) => {
    set({ isLoading: true, authError: null });
    try {
      const result = await authApi.setup(email, password);
      set({ user: result.user, isAuthenticated: true, isLoading: false, needsSetup: false });
      void get().fetchMonitors();
      void get().fetchNotifications();
    } catch (err) {
      set({ isLoading: false, authError: err instanceof Error ? err.message : 'Einrichtung fehlgeschlagen' });
    }
  },

  logout: () => {
    authApi.logout();
    set({
      user: null, isAuthenticated: false, monitors: [], monitorsLoaded: false, beats: {},
      notifications: [], requires2fa: false, detailMonitorId: null, currentView: 'overview',
    });
  },

  checkAuth: async () => {
    const setupNeeded = await authApi.needsSetup().catch(() => false);
    if (setupNeeded) {
      authApi.logout();
      set({ needsSetup: true, isAuthenticated: false, user: null, authChecked: true });
      return;
    }
    if (!getAccessToken()) {
      set({ isAuthenticated: false, user: null, authChecked: true, needsSetup: false });
      return;
    }
    const profile = await authApi.getProfile().catch(() => null);
    if (profile) {
      set({ user: profile, isAuthenticated: true, authChecked: true, needsSetup: false });
      void get().fetchMonitors();
      void get().fetchNotifications();
    } else {
      authApi.logout();
      set({ isAuthenticated: false, user: null, authChecked: true, needsSetup: false });
    }
  },

  refreshUser: async () => {
    const profile = await authApi.getProfile().catch(() => null);
    if (profile) set({ user: profile });
  },

  /* ---------- Theme ---------- */
  theme: getInitialTheme(),
  toggleTheme: () =>
    set((s) => {
      const next = s.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('helio-theme', next); } catch { /* ignore */ }
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
  search: '',
  setSearch: (q) => set({ search: q }),
  timeRange: '24h',
  setTimeRange: (r) => set({ timeRange: r }),

  /* ---------- Monitors ---------- */
  monitors: [],
  monitorsLoaded: false,
  monitorsError: null,

  fetchMonitors: async () => {
    try {
      const data = await monitorsApi.listMonitors();
      set({ monitors: data, monitorsLoaded: true, monitorsError: null });
      void get().fetchBeats();
    } catch (err) {
      set({ monitorsLoaded: true, monitorsError: err instanceof Error ? err.message : 'Fehler beim Laden' });
    }
  },

  beats: {},
  fetchBeats: async () => {
    try {
      set({ beats: await monitorsApi.getBeats(MAX_BEATS) });
    } catch { /* ignore */ }
  },

  applyHeartbeat: (monitorId, hb) =>
    set((s) => {
      const list = [...(s.beats[monitorId] ?? []), { status: hb.status, latencyMs: hb.latencyMs, timestamp: hb.timestamp, message: hb.message }];
      return { beats: { ...s.beats, [monitorId]: list.slice(-MAX_BEATS) } };
    }),

  applyStatusChange: (monitorId, status) =>
    set((s) => ({ monitors: s.monitors.map((m) => (m.id === monitorId ? { ...m, status } : m)) })),

  upsertMonitor: (m) =>
    set((s) => {
      const exists = s.monitors.some((x) => x.id === m.id);
      const monitors = exists ? s.monitors.map((x) => (x.id === m.id ? m : x)) : [...s.monitors, m];
      monitors.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      return { monitors };
    }),

  removeMonitor: (id) =>
    set((s) => {
      const beats = { ...s.beats };
      delete beats[id];
      return {
        monitors: s.monitors.filter((m) => m.id !== id),
        beats,
        detailMonitorId: s.detailMonitorId === id ? null : s.detailMonitorId,
      };
    }),

  /* ---------- Notifications ---------- */
  notifications: [],
  fetchNotifications: async () => {
    try {
      set({ notifications: await notificationsApi.listNotifications() });
    } catch { /* ignore */ }
  },

  /* ---------- Monitor form ---------- */
  showMonitorForm: false,
  setShowMonitorForm: (v) => set({ showMonitorForm: v, editMonitorId: null }),
  editMonitorId: null,
  setEditMonitor: (id) => set({ editMonitorId: id, showMonitorForm: id !== null }),
}));

// Session expired (refresh failed) → back to login
onSessionExpired(() => {
  if (useStore.getState().isAuthenticated) useStore.getState().logout();
});

/** Convenience selector */
export const useIsAdmin = () => useStore((s) => s.user?.role === 'admin');

// helio-app/frontend/src/store/metricsStore.ts
import { create } from 'zustand';
import type { SystemSnapshot } from '../types.ts';
import type { WsStatus } from '../hooks/useWebSocket.ts';

const HISTORY_MAX = 60;

interface MetricsStore {
  current: SystemSnapshot | null;
  history: SystemSnapshot[];
  wsStatus: WsStatus;
  alerts: unknown[];
  setMetrics: (snap: SystemSnapshot) => void;
  setWsStatus: (s: WsStatus) => void;
  setAlerts: (a: unknown[]) => void;
}

export const useMetricsStore = create<MetricsStore>((set) => ({
  current: null,
  history: [],
  wsStatus: 'connecting',
  alerts: [],

  setMetrics: (snap) =>
    set((state) => ({
      current: snap,
      history: [...state.history.slice(-(HISTORY_MAX - 1)), snap],
    })),

  setWsStatus: (wsStatus) => set({ wsStatus }),
  setAlerts: (alerts) => set({ alerts }),
}));

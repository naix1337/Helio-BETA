import { create } from 'zustand';
import type { PingTarget, PingProbeResult } from '../types.ts';

const BUFFER_MAX = 60;

interface PingStore {
  targets: PingTarget[];
  liveResults: Record<number, PingProbeResult[]>; // targetId → ring buffer
  fetchTargets: () => Promise<void>;
  addLiveResult: (targetId: number, result: PingProbeResult) => void;
  setTargets: (targets: PingTarget[]) => void;
}

export const usePingStore = create<PingStore>((set) => ({
  targets: [],
  liveResults: {},

  fetchTargets: async () => {
    try {
      const token = localStorage.getItem('helio-jwt') ?? '';
      const res = await fetch('/api/ping/targets', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json() as PingTarget[];
      set({ targets: data });
    } catch {
      // ignore
    }
  },

  setTargets: (targets) => set({ targets }),

  addLiveResult: (targetId, result) =>
    set((state) => {
      const prev = state.liveResults[targetId] ?? [];
      const updated = [...prev.slice(-(BUFFER_MAX - 1)), result];

      // Also update status and lastPing on the target
      const targets = state.targets.map((t) => {
        if (t.id !== targetId) return t;
        // compute status from last 5 results
        const last5 = updated.slice(-5).reverse();
        const last1 = last5[0];
        const last3 = last5.slice(0, 3);
        let status: PingTarget['status'];
        if (!last1 || last1.success === 0) {
          status = 'down';
        } else if (last3.every((r) => r.success === 1)) {
          status = 'up';
        } else {
          status = 'degraded';
        }
        return { ...t, status, lastPing: result };
      });

      return {
        targets,
        liveResults: { ...state.liveResults, [targetId]: updated },
      };
    }),
}));

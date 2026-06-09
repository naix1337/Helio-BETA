import { create } from 'zustand';
import type { Agent, AgentMetricSnapshot } from '../types.ts';

const BUFFER_MAX = 60;

interface AgentsStore {
  agents: Agent[];
  agentMetrics: Record<string, AgentMetricSnapshot[]>; // agentId → ring buffer
  fetchAgents: () => Promise<void>;
  updateAgent: (agentId: string, metrics: Record<string, unknown>) => void;
  setAgentOffline: (agentId: string) => void;
}

export const useAgentsStore = create<AgentsStore>((set) => ({
  agents: [],
  agentMetrics: {},

  fetchAgents: async () => {
    try {
      const token = localStorage.getItem('helio-jwt') ?? '';
      const res = await fetch('/api/agents', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json() as Agent[];
      set({ agents: data });
    } catch {
      // ignore
    }
  },

  updateAgent: (agentId, metrics) =>
    set((state) => {
      // Update agent status to online and lastSeen
      const agents = state.agents.map((a) =>
        a.id === agentId
          ? {
              ...a,
              status: 'online' as const,
              lastSeen: Math.floor(Date.now() / 1000),
              latestMetrics: {
                cpuUsage: (metrics.cpu as Record<string, unknown> | undefined)?.usage as number | null ?? null,
                memUsedPercent: (() => {
                  const mem = metrics.memory as Record<string, unknown> | undefined;
                  if (!mem) return null;
                  const total = mem.total as number | undefined;
                  const used = mem.used as number | undefined;
                  if (!total || !used) return null;
                  return Math.round((used / total) * 1000) / 10;
                })(),
                uptime: metrics.uptime as number | null ?? null,
              },
            }
          : a
      );

      // Buffer the raw snapshot
      const snap: AgentMetricSnapshot = {
        agent_id: agentId,
        ts: typeof metrics.timestamp === 'number' ? metrics.timestamp : Math.floor(Date.now() / 1000),
        cpu_usage: (metrics.cpu as Record<string, unknown> | undefined)?.usage as number | null ?? null,
        mem_used: (metrics.memory as Record<string, unknown> | undefined)?.used as number | null ?? null,
        mem_total: (metrics.memory as Record<string, unknown> | undefined)?.total as number | null ?? null,
        disk_json: metrics.disk ? JSON.stringify(metrics.disk) : null,
        net_json: metrics.network ? JSON.stringify(metrics.network) : null,
        docker_json: metrics.docker ? JSON.stringify(metrics.docker) : null,
      };
      const prev = state.agentMetrics[agentId] ?? [];
      const updated = [...prev.slice(-(BUFFER_MAX - 1)), snap];

      return { agents, agentMetrics: { ...state.agentMetrics, [agentId]: updated } };
    }),

  setAgentOffline: (agentId) =>
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === agentId ? { ...a, status: 'offline' as const } : a
      ),
    })),
}));

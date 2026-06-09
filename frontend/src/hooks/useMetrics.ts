// helio-app/frontend/src/hooks/useMetrics.ts
import { useEffect } from 'react';
import { useWebSocket } from './useWebSocket.ts';
import { useMetricsStore } from '../store/metricsStore.ts';
import { useToastStore } from '../store/toastStore.ts';
import { useAgentsStore } from '../store/agentsStore.ts';
import { usePingStore } from '../store/pingStore.ts';
import type { SystemSnapshot, AlertFireEvent, PingProbeResult } from '../types.ts';

function buildWsUrl(): string {
  // Pass the JWT as ?token= — browsers cannot send custom headers on WS upgrade
  const token = localStorage.getItem('helio-jwt') ?? '';
  const base = import.meta.env.DEV
    ? 'ws://localhost:3001/ws'
    : `ws://${window.location.host}/ws`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

export function useMetrics() {
  const { lastMessage, status } = useWebSocket(buildWsUrl());
  const { setMetrics, setWsStatus } = useMetricsStore();
  const { addToast } = useToastStore();
  const { updateAgent, setAgentOffline } = useAgentsStore();
  const { addLiveResult } = usePingStore();

  useEffect(() => { setWsStatus(status); }, [status, setWsStatus]);

  useEffect(() => {
    if (!lastMessage) return;
    const msg = lastMessage as Record<string, unknown>;
    const type = msg.type as string;

    if (type === 'metrics') {
      setMetrics(msg.data as SystemSnapshot);
    } else if (type === 'alert') {
      addToast(msg.data as AlertFireEvent);
    } else if (type === 'agent_update') {
      updateAgent(msg.agentId as string, msg.metrics as Record<string, unknown>);
    } else if (type === 'agent_offline') {
      setAgentOffline(msg.agentId as string);
    } else if (type === 'ping_update') {
      addLiveResult(msg.targetId as number, msg.result as PingProbeResult);
    }
  }, [lastMessage, setMetrics, addToast, updateAgent, setAgentOffline, addLiveResult]);

  return useMetricsStore();
}

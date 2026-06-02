// helio-app/frontend/src/hooks/useMetrics.ts
import { useEffect } from 'react';
import { useWebSocket } from './useWebSocket.ts';
import { useMetricsStore } from '../store/metricsStore.ts';
import type { SystemSnapshot } from '../types.ts';

const WS_URL = import.meta.env.DEV
  ? 'ws://localhost:3001/ws'
  : `ws://${window.location.host}/ws`;

export function useMetrics() {
  const { lastMessage, status } = useWebSocket(WS_URL);
  const { setMetrics, setWsStatus } = useMetricsStore();

  useEffect(() => { setWsStatus(status); }, [status, setWsStatus]);

  useEffect(() => {
    if (!lastMessage) return;
    const msg = lastMessage as { type: string; data: unknown };
    if (msg.type === 'metrics') {
      setMetrics(msg.data as SystemSnapshot);
    }
  }, [lastMessage, setMetrics]);

  return useMetricsStore();
}

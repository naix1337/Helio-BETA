// helio-app/frontend/src/hooks/useMetrics.ts
import { useEffect } from 'react';
import { useWebSocket } from './useWebSocket.ts';
import { useMetricsStore } from '../store/metricsStore.ts';
import { useToastStore } from '../store/toastStore.ts';
import type { SystemSnapshot, AlertFireEvent } from '../types.ts';

const WS_URL = import.meta.env.DEV
  ? 'ws://localhost:3001/ws'
  : `ws://${window.location.host}/ws`;

export function useMetrics() {
  const { lastMessage, status } = useWebSocket(WS_URL);
  const { setMetrics, setWsStatus } = useMetricsStore();
  const { addToast } = useToastStore();

  useEffect(() => { setWsStatus(status); }, [status, setWsStatus]);

  useEffect(() => {
    if (!lastMessage) return;
    const msg = lastMessage as { type: string; data: unknown };
    if (msg.type === 'metrics') {
      setMetrics(msg.data as SystemSnapshot);
    } else if (msg.type === 'alert') {
      addToast(msg.data as AlertFireEvent);
    }
  }, [lastMessage, setMetrics, addToast]);

  return useMetricsStore();
}

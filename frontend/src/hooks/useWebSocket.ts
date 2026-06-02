// helio-app/frontend/src/hooks/useWebSocket.ts
import { useEffect, useRef, useState, useCallback } from 'react';

export type WsStatus = 'connecting' | 'open' | 'closed' | 'error';

export function useWebSocket(url: string) {
  const [lastMessage, setLastMessage] = useState<unknown>(null);
  const [status, setStatus] = useState<WsStatus>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelay = useRef(1000);
  const unmounted = useRef(false);

  const connect = useCallback(() => {
    if (unmounted.current) return;
    setStatus('connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectDelay.current = 1000;
      setStatus('open');
    };

    ws.onmessage = (e) => {
      try {
        setLastMessage(JSON.parse(e.data as string));
      } catch {
        setLastMessage(e.data);
      }
    };

    ws.onclose = () => {
      if (unmounted.current) return;
      setStatus('closed');
      const delay = Math.min(reconnectDelay.current, 30_000);
      reconnectDelay.current = Math.min(delay * 2, 30_000);
      setTimeout(connect, delay);
    };

    ws.onerror = () => {
      setStatus('error');
      ws.close();
    };
  }, [url]);

  useEffect(() => {
    unmounted.current = false;
    connect();
    return () => {
      unmounted.current = true;
      wsRef.current?.close();
    };
  }, [connect]);

  return { lastMessage, status };
}

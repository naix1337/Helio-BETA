import { useEffect, useRef, useCallback } from 'react';
import { getAccessToken } from '../api/client';

const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';

type WsEventHandler = (event: { type: string; payload: unknown; timestamp: string }) => void;

const handlers = new Map<string, Set<WsEventHandler>>();

export function onWsEvent(type: string, handler: WsEventHandler): () => void {
  if (!handlers.has(type)) handlers.set(type, new Set());
  handlers.get(type)!.add(handler);
  return () => {
    handlers.get(type)?.delete(handler);
  };
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const backoffRef = useRef(1000);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const token = getAccessToken();
    const url = token ? `${WS_BASE}?token=${token}` : WS_BASE;

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        backoffRef.current = 1000; // Reset backoff on successful connection
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const typeHandlers = handlers.get(data.type);
          if (typeHandlers) {
            typeHandlers.forEach((h) => h(data));
          }
          // Also dispatch to wildcard handlers
          const wildcardHandlers = handlers.get('*');
          if (wildcardHandlers) {
            wildcardHandlers.forEach((h) => h(data));
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.onclose = () => {
        if (mountedRef.current) {
          // Reconnect with exponential backoff
          const delay = backoffRef.current;
          backoffRef.current = Math.min(backoffRef.current * 2, 30000);
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    } catch {
      // Connection failed, retry
      if (mountedRef.current) {
        reconnectTimeoutRef.current = setTimeout(connect, backoffRef.current);
        backoffRef.current = Math.min(backoffRef.current * 2, 30000);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect on intentional close
        wsRef.current.close();
      }
    };
  }, [connect]);
}

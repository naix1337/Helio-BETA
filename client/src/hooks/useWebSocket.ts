import { useEffect } from 'react';
import { ensureFreshToken, getAccessToken, wsUrl } from '../api/client';
import { useStore, type Heartbeat, type Monitor } from '../store/useStore';

export interface WsMessage {
  type: string;
  payload: unknown;
  timestamp: string;
}

type WsEventHandler = (event: WsMessage) => void;

const handlers = new Map<string, Set<WsEventHandler>>();

/** Subscribe to a WS event type ('*' for all). Returns an unsubscribe function. */
export function onWsEvent(type: string, handler: WsEventHandler): () => void {
  if (!handlers.has(type)) handlers.set(type, new Set());
  handlers.get(type)!.add(handler);
  return () => {
    handlers.get(type)?.delete(handler);
  };
}

function dispatch(msg: WsMessage) {
  handlers.get(msg.type)?.forEach((h) => h(msg));
  handlers.get('*')?.forEach((h) => h(msg));
}

/** Apply engine events to the global store */
function applyToStore(msg: WsMessage) {
  const s = useStore.getState();
  switch (msg.type) {
    case 'heartbeat:new': {
      const p = msg.payload as { monitorId: string; heartbeat: Heartbeat };
      s.applyHeartbeat(p.monitorId, p.heartbeat);
      break;
    }
    case 'monitor:status-change': {
      const p = msg.payload as { monitorId: string; newStatus: Monitor['status'] };
      s.applyStatusChange(p.monitorId, p.newStatus);
      break;
    }
    case 'monitor:created':
    case 'monitor:updated':
      s.upsertMonitor(msg.payload as Monitor);
      break;
    case 'monitor:deleted':
      s.removeMonitor((msg.payload as { id: string }).id);
      break;
  }
}

/**
 * Maintains the authenticated WebSocket connection while logged in.
 * Reconnects with exponential backoff and refreshes the access token when
 * the server rejects it.
 */
export function useWebSocket(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let backoff = 1000;
    let stopped = false;
    let hadConnection = false;

    const scheduleReconnect = () => {
      if (stopped) return;
      timer = setTimeout(connect, backoff);
      backoff = Math.min(backoff * 2, 30000);
    };

    function connect() {
      if (stopped) return;
      const token = getAccessToken();
      if (!token) return;

      ws = new WebSocket(`${wsUrl()}?token=${encodeURIComponent(token)}`);

      ws.onopen = () => {
        backoff = 1000;
        // Resync after a reconnect (events may have been missed)
        if (hadConnection) void useStore.getState().fetchMonitors();
        hadConnection = true;
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as WsMessage;
          applyToStore(msg);
          dispatch(msg);
        } catch { /* ignore malformed */ }
      };

      ws.onclose = (ev) => {
        ws = null;
        if (stopped) return;
        if (ev.code === 4001) {
          // Token expired → refresh, then reconnect
          void ensureFreshToken().then((ok) => (ok ? scheduleReconnect() : undefined));
          return;
        }
        scheduleReconnect();
      };

      ws.onerror = () => ws?.close();
    }

    connect();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [enabled]);
}

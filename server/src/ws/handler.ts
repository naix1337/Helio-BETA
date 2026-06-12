import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import type { WsEvent, StatusChangePayload, HeartbeatPayload } from '@pulse/shared';
import { onStatusChange, onHeartbeat } from '../engine/Engine.js';

interface AuthenticatedClient extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

let wss: WebSocketServer | null = null;

export function setupWebSocket(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: AuthenticatedClient, req) => {
    ws.isAlive = true;

    // Authenticate via token in query param or header
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const token = url.searchParams.get('token');

    if (token) {
      try {
        const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };
        ws.userId = decoded.userId;
      } catch {
        ws.close(4001, 'Invalid token');
        return;
      }
    } else {
      // Allow unauthenticated connections but only send public data
      // (for status pages etc.)
    }

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('close', () => {
      // Cleanup handled by the server
    });
  });

  // Heartbeat ping/pong for connection health
  const heartbeatInterval = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((client) => {
      const ws = client as AuthenticatedClient;
      if (ws.isAlive === false) {
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  // Subscribe to engine events
  onStatusChange((payload: StatusChangePayload) => {
    broadcast({
      type: 'monitor:status-change',
      payload,
      timestamp: new Date().toISOString(),
    });
  });

  onHeartbeat((payload: HeartbeatPayload) => {
    broadcast({
      type: 'heartbeat:new',
      payload,
      timestamp: new Date().toISOString(),
    });
  });

  console.log('[ws] WebSocket server ready on /ws');
  return wss;
}

export function broadcast<T>(event: WsEvent<T>): void {
  if (!wss) return;
  const message = JSON.stringify(event);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

export function broadcastToUser<T>(userId: string, event: WsEvent<T>): void {
  if (!wss) return;
  const message = JSON.stringify(event);
  wss.clients.forEach((client) => {
    const ws = client as AuthenticatedClient;
    if (ws.readyState === WebSocket.OPEN && ws.userId === userId) {
      ws.send(message);
    }
  });
}

export function closeWebSocket(): void {
  if (wss) {
    wss.close();
    wss = null;
  }
}

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import { verifyAccessToken } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
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

    const decoded = token ? verifyAccessToken(token) : null;
    if (!decoded) {
      ws.close(4001, 'Invalid token');
      return;
    }
    ws.userId = decoded.userId;

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

  logger.info('WebSocket server ready on /ws');
  return wss;
}

export function broadcast<T>(event: WsEvent<T>): void {
  if (!wss) return;
  const message = JSON.stringify(event);
  wss.clients.forEach((client) => {
    const ws = client as AuthenticatedClient;
    // Only send to authenticated clients (unauthenticated = public status page visitors)
    if (client.readyState === WebSocket.OPEN && ws.userId) {
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

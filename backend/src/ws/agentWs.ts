// helio-app/backend/src/ws/agentWs.ts
import { WebSocketServer, WebSocket } from 'ws';
import type { Server, IncomingMessage } from 'http';
import crypto from 'crypto';
import { queries } from '../db/index.js';
import { wsBroadcast } from './metricsWs.js';
import type { AgentMetricRow } from '../db/queries.js';

// Rate limiting: max 1 connection attempt per 5s per IP
const rateLimitMap = new Map<string, number>();

function sha256(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const last = rateLimitMap.get(ip) ?? 0;
  if (now - last < 5000) return true;
  rateLimitMap.set(ip, now);
  return false;
}

// Validate token against DB and ENV var HELIO_AGENT_TOKENS
function validateToken(token: string): boolean {
  const hash = sha256(token);

  // Check DB tokens
  const dbToken = queries.getAgentTokenByHash(hash);
  if (dbToken) {
    queries.updateTokenLastUsed(dbToken.id);
    return true;
  }

  // Check ENV var tokens (comma-separated list of raw tokens)
  const envTokens = (process.env.HELIO_AGENT_TOKENS ?? '').split(',').filter(Boolean);
  return envTokens.some(t => sha256(t.trim()) === hash);
}

export function attachAgentWebSocket(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req: IncomingMessage, socket, head) => {
    const url = req.url ?? '';
    if (!url.startsWith('/ws/agent')) return; // Let other handlers process other paths

    const ip = (req.socket.remoteAddress ?? 'unknown');

    if (isRateLimited(ip)) {
      socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws: WebSocket) => {
    let agentId: string | null = null;
    let metricsBuffer: AgentMetricRow[] = [];
    let registrationTimeout: NodeJS.Timeout;
    let heartbeatInterval: NodeJS.Timeout;
    let flushInterval: NodeJS.Timeout;
    let lastPong = Date.now();

    // Require registration within 10s
    registrationTimeout = setTimeout(() => {
      if (!agentId) ws.terminate();
    }, 10_000);

    ws.on('message', (raw) => {
      let msg: unknown;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (typeof msg !== 'object' || msg === null) return;
      const m = msg as Record<string, unknown>;

      if (m.type === 'agent:register') {
        // Validate token
        const token = typeof m.token === 'string' ? m.token : '';
        if (!validateToken(token)) {
          ws.send(JSON.stringify({ type: 'agent:error', error: 'Invalid token' }));
          ws.terminate();
          return;
        }

        clearTimeout(registrationTimeout);

        // Upsert agent in DB
        const id = typeof m.agentId === 'string' ? m.agentId : crypto.randomUUID();
        const name = typeof m.name === 'string' ? m.name : id;
        const tags = Array.isArray(m.tags) ? m.tags as string[] : [];
        const version = typeof m.version === 'string' ? m.version : null;
        // tokenId: look up from DB
        const tokenHash = sha256(token);
        const tokenRow = queries.getAgentTokenByHash(tokenHash);

        queries.upsertAgent(id, name, tags, tokenRow?.id ?? null, version, Math.floor(Date.now() / 1000), null);
        agentId = id;

        ws.send(JSON.stringify({ type: 'agent:registered', agentId: id }));

        // Start heartbeat
        heartbeatInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.ping();
          }
          // Check for pong timeout (90s)
          if (Date.now() - lastPong > 90_000) {
            markOffline();
            ws.terminate();
          }
        }, 30_000);

        // Flush metrics buffer every 5s
        flushInterval = setInterval(() => {
          if (metricsBuffer.length > 0) {
            queries.insertAgentMetricsBatch(metricsBuffer);
            metricsBuffer = [];
          }
        }, 5_000);

      } else if (m.type === 'agent:metrics' && agentId) {
        const metrics = m.metrics as Record<string, unknown>;
        bufferMetrics(agentId, metrics);
        // Broadcast latest snapshot to browser clients
        wsBroadcast({ type: 'agent_update', agentId, metrics });

      } else if (m.type === 'agent:metrics_bulk' && agentId) {
        const bulk = Array.isArray(m.metrics) ? m.metrics as Record<string, unknown>[] : [];
        for (const snap of bulk) {
          bufferMetrics(agentId, snap);
        }
      }
    });

    ws.on('pong', () => { lastPong = Date.now(); });

    ws.on('close', () => markOffline());
    ws.on('error', () => markOffline());

    function bufferMetrics(aid: string, snap: Record<string, unknown>): void {
      const ts = typeof snap.timestamp === 'number' ? snap.timestamp : Math.floor(Date.now() / 1000);
      const cpu = snap.cpu as Record<string, unknown> | undefined;
      const mem = snap.memory as Record<string, unknown> | undefined;
      metricsBuffer.push({
        agent_id: aid,
        ts,
        cpu_usage: typeof cpu?.usage === 'number' ? cpu.usage : null,
        mem_used: typeof mem?.used === 'number' ? mem.used : null,
        mem_total: typeof mem?.total === 'number' ? mem.total : null,
        disk_json: snap.disk ? JSON.stringify(snap.disk) : null,
        net_json: snap.network ? JSON.stringify(snap.network) : null,
        docker_json: null,
      });
    }

    function markOffline(): void {
      clearTimeout(registrationTimeout);
      clearInterval(heartbeatInterval);
      clearInterval(flushInterval);
      // Flush remaining buffer
      if (metricsBuffer.length > 0) {
        try { queries.insertAgentMetricsBatch(metricsBuffer); } catch {}
        metricsBuffer = [];
      }
      if (agentId) {
        queries.setAgentStatus(agentId, 'offline', Math.floor(Date.now() / 1000));
        wsBroadcast({ type: 'agent_offline', agentId });
        agentId = null;
      }
    }
  });
}

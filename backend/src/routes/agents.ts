// helio-app/backend/src/routes/agents.ts
import { createHash } from 'node:crypto';
import { Router } from 'express';
import { queries } from '../db/index.js';
import { requireRole } from '../middleware/auth.js';
import type { AgentMetricRow } from '../db/queries.js';

export const agentsRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

interface AgentRow {
  id: string;
  name: string;
  tags: string;
  token_id: string | null;
  version: string | null;
  first_seen: number;
  last_seen: number;
  status: string;
  os_info: string | null;
}

function parseAgent(row: AgentRow) {
  return {
    id: row.id,
    name: row.name,
    tags: (() => { try { return JSON.parse(row.tags); } catch { return []; } })(),
    tokenId: row.token_id,
    version: row.version ?? null,
    status: row.status,
    lastSeen: row.last_seen,
    firstSeen: row.first_seen,
    osInfo: (() => { try { return row.os_info ? JSON.parse(row.os_info) : null; } catch { return null; } })(),
  };
}

function metricsLatestSummary(m: AgentMetricRow | undefined) {
  if (!m) return null;
  const memUsedPercent =
    m.mem_total && m.mem_total > 0
      ? Math.round((m.mem_used! / m.mem_total) * 1000) / 10
      : null;
  return {
    cpuUsage: m.cpu_usage ?? null,
    memUsedPercent,
    uptime: null,
  };
}

const RANGE_SECONDS: Record<string, number> = {
  '1h': 3600,
  '6h': 21600,
  '24h': 86400,
};

// ── GET / — list all agents with latest metrics ───────────────────────────────

agentsRouter.get('/', (_req, res) => {
  const rows = queries.listAgents() as AgentRow[];
  const result = rows.map(row => {
    const agent = parseAgent(row);
    const latest = queries.getAgentMetricsLatest(row.id);
    return { ...agent, latestMetrics: metricsLatestSummary(latest) };
  });
  res.json(result);
});

// ── GET /:id — single agent detail ───────────────────────────────────────────

agentsRouter.get('/:id', (req, res) => {
  const row = queries.getAgent(req.params.id) as AgentRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  res.json(parseAgent(row));
});

// ── GET /:id/metrics/current ──────────────────────────────────────────────────

agentsRouter.get('/:id/metrics/current', (req, res) => {
  const agent = queries.getAgent(req.params.id) as AgentRow | undefined;
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  const m = queries.getAgentMetricsLatest(req.params.id);
  if (!m) {
    res.status(404).json({ error: 'No metrics available' });
    return;
  }
  res.json(m);
});

// ── GET /:id/metrics/history ──────────────────────────────────────────────────

agentsRouter.get('/:id/metrics/history', (req, res) => {
  const agent = queries.getAgent(req.params.id) as AgentRow | undefined;
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  const rangeParam = (req.query.range as string) ?? '24h';
  const rangeSeconds = RANGE_SECONDS[rangeParam] ?? RANGE_SECONDS['24h'];

  const now = Math.floor(Date.now() / 1000);
  const from = now - rangeSeconds;
  const rows = queries.getAgentMetricsRange(req.params.id, from, now);

  // Downsample to max 500 points
  const MAX_POINTS = 500;
  let result = rows;
  if (rows.length > MAX_POINTS) {
    const step = Math.ceil(rows.length / MAX_POINTS);
    result = rows.filter((_, i) => i % step === 0);
  }

  res.json(result);
});

// ── PUT /:id — update name and/or tags ────────────────────────────────────────

agentsRouter.put('/:id', (req, res) => {
  const row = queries.getAgent(req.params.id) as AgentRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  const { name, tags } = req.body as { name?: string; tags?: string[] };

  if (name !== undefined && typeof name !== 'string') {
    res.status(400).json({ error: 'name must be a string' });
    return;
  }
  if (tags !== undefined && !Array.isArray(tags)) {
    res.status(400).json({ error: 'tags must be an array' });
    return;
  }

  const newName = name ?? row.name;
  const newTags = tags ?? (() => { try { return JSON.parse(row.tags); } catch { return []; } })();

  const currentOsInfo = (() => {
    try { return row.os_info ? JSON.parse(row.os_info) : null; } catch { return null; }
  })();

  queries.upsertAgent(
    row.id,
    newName,
    newTags,
    row.token_id,
    row.version ?? null,
    row.last_seen,
    currentOsInfo,
  );

  const updated = queries.getAgent(req.params.id) as AgentRow;
  res.json(parseAgent(updated));
});

// ── DELETE /:id ───────────────────────────────────────────────────────────────

agentsRouter.delete('/:id', (req, res) => {
  queries.deleteAgent(req.params.id);
  res.status(204).send();
});

// ── POST /tokens — generate a new agent token ─────────────────────────────────

agentsRouter.post('/tokens', requireRole('admin'), (req, res) => {
  const { label } = req.body as { label?: string };
  const resolvedLabel = (typeof label === 'string' && label.trim()) ? label.trim() : null;

  const rawToken = crypto.randomUUID();
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const tokenId = crypto.randomUUID();

  queries.createAgentToken(tokenId, resolvedLabel, tokenHash);

  res.status(201).json({ id: tokenId, token: rawToken, label: resolvedLabel });
});

// ── DELETE /tokens/:tokenId ───────────────────────────────────────────────────

agentsRouter.delete('/tokens/:tokenId', requireRole('admin'), (req, res) => {
  queries.deleteAgentToken(req.params.tokenId);
  res.status(204).send();
});

// helio-app/backend/src/db/queries.ts
import type Database from 'better-sqlite3';
import type { SystemSnapshot, MetricRow, Alert, AlertEvent } from '../types.js';

export interface AgentMetricRow {
  agent_id: string;
  ts: number;
  cpu_usage: number | null;
  mem_used: number | null;
  mem_total: number | null;
  disk_json: string | null;
  net_json: string | null;
  docker_json: string | null;
}

export function buildQueries(db: Database.Database) {
  const stmtInsertMetric = db.prepare<{
    ts: number; cpu: number; mem_used: number; mem_total: number;
    disk_json: string; net_json: string;
  }>(`INSERT INTO metrics (ts, cpu, mem_used, mem_total, disk_json, net_json)
      VALUES (@ts, @cpu, @mem_used, @mem_total, @disk_json, @net_json)`);

  const stmtLatest = db.prepare<[], MetricRow>(
    'SELECT * FROM metrics ORDER BY ts DESC LIMIT 1'
  );

  const stmtRange = db.prepare<[number, number], MetricRow>(
    'SELECT * FROM metrics WHERE ts >= ? AND ts <= ? ORDER BY ts ASC'
  );

  const stmtGetAlerts = db.prepare<[], Alert>(
    'SELECT * FROM alerts WHERE enabled = 1'
  );

  const stmtGetAllAlerts = db.prepare<[], Alert>('SELECT * FROM alerts');

  const stmtInsertAlert = db.prepare<{
    name: string; metric: string; operator: string; threshold: number;
    channel: string; target: string; cooldown: number;
  }>(`INSERT INTO alerts (name, metric, operator, threshold, channel, target, cooldown)
      VALUES (@name, @metric, @operator, @threshold, @channel, @target, @cooldown)`);

  const stmtUpdateAlert = db.prepare<{ id: number; enabled: number }>(
    'UPDATE alerts SET enabled = @enabled WHERE id = @id'
  );

  const stmtDeleteAlert = db.prepare<[number]>('DELETE FROM alerts WHERE id = ?');

  const stmtInsertEvent = db.prepare<{
    alert_id: number; triggered_at: number; peak_value: number;
  }>(`INSERT INTO alert_events (alert_id, triggered_at, peak_value)
      VALUES (@alert_id, @triggered_at, @peak_value)`);

  const stmtLatestEvent = db.prepare<[number], AlertEvent>(
    'SELECT * FROM alert_events WHERE alert_id = ? ORDER BY triggered_at DESC LIMIT 1'
  );

  const stmtRecentEvents = db.prepare<[number], AlertEvent & { alert_name: string; alert_metric: string }>(
    `SELECT ae.*, a.name as alert_name, a.metric as alert_metric
     FROM alert_events ae
     JOIN alerts a ON ae.alert_id = a.id
     ORDER BY ae.triggered_at DESC
     LIMIT ?`
  );

  const stmtGetSettings = db.prepare<[], { key: string; value: string }>(
    'SELECT key, value FROM settings'
  );

  const stmtSetSetting = db.prepare<{ key: string; value: string }>(
    'INSERT INTO settings (key, value) VALUES (@key, @value) ON CONFLICT(key) DO UPDATE SET value = @value'
  );

  const stmtCreateUser = db.prepare<{
    email: string; name: string; password_hash: string; role: string;
  }>(`INSERT INTO users (email, name, password_hash, role)
      VALUES (@email, @name, @password_hash, @role)`);

  const stmtGetUserByEmail = db.prepare<[string], {
    id: number; email: string; name: string; password_hash: string;
    role: string; created_at: number; last_login: number | null;
  }>('SELECT * FROM users WHERE email = ?');

  const stmtGetUserById = db.prepare<[number], {
    id: number; email: string; name: string; password_hash: string;
    role: string; created_at: number; last_login: number | null;
  }>('SELECT * FROM users WHERE id = ?');

  const stmtCountUsers = db.prepare<[], { cnt: number }>(
    'SELECT COUNT(*) as cnt FROM users'
  );

  const stmtGetAllUsers = db.prepare<[], {
    id: number; email: string; name: string;
    role: string; created_at: number; last_login: number | null;
  }>('SELECT id, email, name, role, created_at, last_login FROM users');

  const stmtUpdateUserRole = db.prepare<{ id: number; role: string }>(
    'UPDATE users SET role = @role WHERE id = @id'
  );

  const stmtUpdateLastLogin = db.prepare<[number]>(
    'UPDATE users SET last_login = unixepoch() WHERE id = ?'
  );

  const stmtDeleteUser = db.prepare<[number]>(
    'DELETE FROM users WHERE id = ?'
  );

  // ── Agent Tokens ─────────────────────────────────────────────────────────────

  const stmtCreateAgentToken = db.prepare<{
    id: string; label: string | null; token_hash: string; created_at: number;
  }>(`INSERT INTO agent_tokens (id, label, token_hash, created_at)
      VALUES (@id, @label, @token_hash, @created_at)`);

  const stmtGetAgentTokenByHash = db.prepare<[string], {
    id: string; label: string | null; token_hash: string; created_at: number; last_used: number | null;
  }>('SELECT * FROM agent_tokens WHERE token_hash = ?');

  const stmtListAgentTokens = db.prepare<[], {
    id: string; label: string | null; created_at: number; last_used: number | null;
  }>('SELECT id, label, created_at, last_used FROM agent_tokens');

  const stmtUpdateTokenLastUsed = db.prepare<[string]>(
    'UPDATE agent_tokens SET last_used = unixepoch() WHERE id = ?'
  );

  const stmtDeleteAgentToken = db.prepare<[string]>(
    'DELETE FROM agent_tokens WHERE id = ?'
  );

  // ── Agents ───────────────────────────────────────────────────────────────────

  const stmtUpsertAgent = db.prepare<{
    id: string; name: string; tags: string; token_id: string | null;
    version: string | null; first_seen: number; last_seen: number;
    status: string; os_info: string | null;
  }>(`INSERT INTO agents (id, name, tags, token_id, version, first_seen, last_seen, status, os_info)
      VALUES (@id, @name, @tags, @token_id, @version, @first_seen, @last_seen, @status, @os_info)
      ON CONFLICT(id) DO UPDATE SET
        name       = excluded.name,
        tags       = excluded.tags,
        token_id   = excluded.token_id,
        version    = excluded.version,
        last_seen  = excluded.last_seen,
        status     = excluded.status,
        os_info    = excluded.os_info`);

  const stmtSetAgentStatus = db.prepare<{ id: string; status: string; last_seen: number }>(
    'UPDATE agents SET status = @status, last_seen = @last_seen WHERE id = @id'
  );

  const stmtGetAgent = db.prepare<[string], {
    id: string; name: string; tags: string; token_id: string | null;
    version: string | null; first_seen: number; last_seen: number;
    status: string; os_info: string | null;
  }>('SELECT * FROM agents WHERE id = ?');

  const stmtListAgents = db.prepare<[], {
    id: string; name: string; tags: string; token_id: string | null;
    version: string | null; first_seen: number; last_seen: number;
    status: string; os_info: string | null;
  }>('SELECT * FROM agents ORDER BY last_seen DESC');

  const stmtDeleteAgent = db.prepare<[string]>(
    'DELETE FROM agents WHERE id = ?'
  );

  // ── Agent Metrics ─────────────────────────────────────────────────────────────

  const stmtInsertAgentMetric = db.prepare<{
    agent_id: string; ts: number; cpu_usage: number | null;
    mem_used: number | null; mem_total: number | null;
    disk_json: string | null; net_json: string | null; docker_json: string | null;
  }>(`INSERT INTO agent_metrics (agent_id, ts, cpu_usage, mem_used, mem_total, disk_json, net_json, docker_json)
      VALUES (@agent_id, @ts, @cpu_usage, @mem_used, @mem_total, @disk_json, @net_json, @docker_json)`);

  const stmtGetAgentMetricsLatest = db.prepare<[string], AgentMetricRow>(
    'SELECT * FROM agent_metrics WHERE agent_id = ? ORDER BY ts DESC LIMIT 1'
  );

  const stmtGetAgentMetricsRange = db.prepare<[string, number, number], AgentMetricRow>(
    'SELECT * FROM agent_metrics WHERE agent_id = ? AND ts >= ? AND ts <= ? ORDER BY ts ASC'
  );

  const batchInsertAgentMetrics = db.transaction((rows: AgentMetricRow[]) => {
    for (const row of rows) {
      stmtInsertAgentMetric.run(row);
    }
  });

  // ── Ping Targets ──────────────────────────────────────────────────────────────

  const stmtInsertPingTarget = db.prepare<{
    name: string; host: string; type: string; port: number | null;
    interval_ms: number; timeout_ms: number; created_at: number; tags: string;
  }>(`INSERT INTO ping_targets (name, host, type, port, interval_ms, timeout_ms, created_at, tags)
      VALUES (@name, @host, @type, @port, @interval_ms, @timeout_ms, @created_at, @tags)`);

  const stmtListPingTargets = db.prepare<[], {
    id: number; name: string; host: string; type: string; port: number | null;
    interval_ms: number; timeout_ms: number; enabled: number; created_at: number; tags: string;
  }>('SELECT * FROM ping_targets');

  const stmtGetPingTarget = db.prepare<[number], {
    id: number; name: string; host: string; type: string; port: number | null;
    interval_ms: number; timeout_ms: number; enabled: number; created_at: number; tags: string;
  }>('SELECT * FROM ping_targets WHERE id = ?');

  const stmtDeletePingTarget = db.prepare<[number]>(
    'DELETE FROM ping_targets WHERE id = ?'
  );

  // ── Ping Results ──────────────────────────────────────────────────────────────

  const stmtInsertPingResult = db.prepare<{
    target_id: number; ts: number; success: number; latency_ms: number | null;
    status_code: number | null; error: string | null; icmp_fallback: number;
  }>(`INSERT INTO ping_results (target_id, ts, success, latency_ms, status_code, error, icmp_fallback)
      VALUES (@target_id, @ts, @success, @latency_ms, @status_code, @error, @icmp_fallback)`);

  const stmtGetLastNPingResults = db.prepare<[number, number], {
    id: number; target_id: number; ts: number; success: number;
    latency_ms: number | null; status_code: number | null; error: string | null; icmp_fallback: number;
  }>('SELECT * FROM ping_results WHERE target_id = ? ORDER BY ts DESC LIMIT ?');

  const stmtGetPingResultsRange = db.prepare<[number, number, number], {
    id: number; target_id: number; ts: number; success: number;
    latency_ms: number | null; status_code: number | null; error: string | null; icmp_fallback: number;
  }>('SELECT * FROM ping_results WHERE target_id = ? AND ts >= ? AND ts <= ? ORDER BY ts ASC');

  const stmtGetPingStats24h = db.prepare<[number, number], {
    uptime_percent: number; avg_latency_ms: number | null;
    min_latency_ms: number | null; max_latency_ms: number | null;
    total_checks: number; failed_checks: number;
  }>(`SELECT
        ROUND(100.0 * SUM(success) / COUNT(*), 2) AS uptime_percent,
        AVG(latency_ms)   AS avg_latency_ms,
        MIN(latency_ms)   AS min_latency_ms,
        MAX(latency_ms)   AS max_latency_ms,
        COUNT(*)          AS total_checks,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failed_checks
      FROM ping_results
      WHERE target_id = ? AND ts >= ?`);

  return {
    insertMetric(snap: SystemSnapshot): void {
      stmtInsertMetric.run({
        ts: snap.ts,
        cpu: snap.cpu,
        mem_used: snap.mem.used,
        mem_total: snap.mem.total,
        disk_json: JSON.stringify(snap.disk),
        net_json: JSON.stringify(snap.net),
      });
    },

    getLatestMetric(): MetricRow | undefined {
      return stmtLatest.get() as MetricRow | undefined;
    },

    getMetricsRange(from: number, to: number): MetricRow[] {
      return stmtRange.all(from, to) as MetricRow[];
    },

    getAlerts(): Alert[] {
      return stmtGetAlerts.all() as Alert[];
    },

    getAllAlerts(): Alert[] {
      return stmtGetAllAlerts.all() as Alert[];
    },

    insertAlert(a: Omit<Alert, 'id' | 'enabled' | 'created_at'>): number {
      const result = stmtInsertAlert.run(a as Parameters<typeof stmtInsertAlert.run>[0]);
      return Number(result.lastInsertRowid);
    },

    updateAlert(id: number, enabled: boolean): void {
      stmtUpdateAlert.run({ id, enabled: enabled ? 1 : 0 });
    },

    deleteAlert(id: number): void {
      stmtDeleteAlert.run(id);
    },

    insertAlertEvent(alertId: number, value: number): void {
      stmtInsertEvent.run({
        alert_id: alertId,
        triggered_at: Math.floor(Date.now() / 1000),
        peak_value: value,
      });
    },

    getLatestAlertEvent(alertId: number): AlertEvent | undefined {
      return stmtLatestEvent.get(alertId) as AlertEvent | undefined;
    },

    getRecentAlertEvents(limit = 50): (AlertEvent & { alert_name: string; alert_metric: string })[] {
      return stmtRecentEvents.all(limit) as (AlertEvent & { alert_name: string; alert_metric: string })[];
    },

    getSettings(): Record<string, string> {
      const rows = stmtGetSettings.all() as { key: string; value: string }[];
      return Object.fromEntries(rows.map(r => [r.key, r.value]));
    },

    setSetting(key: string, value: string): void {
      stmtSetSetting.run({ key, value });
    },

    createUser(email: string, name: string, passwordHash: string, role: string): number {
      const result = stmtCreateUser.run({ email, name, password_hash: passwordHash, role });
      return Number(result.lastInsertRowid);
    },

    getUserByEmail(email: string) {
      return stmtGetUserByEmail.get(email) ?? undefined;
    },

    getUserById(id: number) {
      return stmtGetUserById.get(id) ?? undefined;
    },

    countUsers(): number {
      const row = stmtCountUsers.get() as { cnt: number } | undefined;
      return row?.cnt ?? 0;
    },

    getAllUsers() {
      return stmtGetAllUsers.all();
    },

    updateUserRole(id: number, role: string): void {
      stmtUpdateUserRole.run({ id, role });
    },

    updateLastLogin(id: number): void {
      stmtUpdateLastLogin.run(id);
    },

    deleteUser(id: number): void {
      stmtDeleteUser.run(id);
    },

    // ── Agent Tokens ───────────────────────────────────────────────────────────

    createAgentToken(id: string, label: string | null, tokenHash: string): void {
      stmtCreateAgentToken.run({
        id,
        label,
        token_hash: tokenHash,
        created_at: Math.floor(Date.now() / 1000),
      });
    },

    getAgentTokenByHash(hash: string) {
      return stmtGetAgentTokenByHash.get(hash) ?? undefined;
    },

    listAgentTokens() {
      return stmtListAgentTokens.all();
    },

    updateTokenLastUsed(id: string): void {
      stmtUpdateTokenLastUsed.run(id);
    },

    deleteAgentToken(id: string): void {
      stmtDeleteAgentToken.run(id);
    },

    // ── Agents ────────────────────────────────────────────────────────────────

    upsertAgent(
      id: string,
      name: string,
      tags: string[],
      tokenId: string | null,
      version: string | null,
      ts: number,
      osInfo: object | null,
    ): void {
      stmtUpsertAgent.run({
        id,
        name,
        tags: JSON.stringify(tags),
        token_id: tokenId,
        version,
        first_seen: ts,
        last_seen: ts,
        status: 'online',
        os_info: osInfo !== null ? JSON.stringify(osInfo) : null,
      });
    },

    setAgentStatus(id: string, status: 'online' | 'offline', lastSeen: number): void {
      stmtSetAgentStatus.run({ id, status, last_seen: lastSeen });
    },

    getAgent(id: string) {
      return stmtGetAgent.get(id) ?? undefined;
    },

    listAgents() {
      return stmtListAgents.all();
    },

    deleteAgent(id: string): void {
      stmtDeleteAgent.run(id);
    },

    getAgentMetricsLatest(agentId: string): AgentMetricRow | undefined {
      return stmtGetAgentMetricsLatest.get(agentId) as AgentMetricRow | undefined;
    },

    getAgentMetricsRange(agentId: string, from: number, to: number): AgentMetricRow[] {
      return stmtGetAgentMetricsRange.all(agentId, from, to) as AgentMetricRow[];
    },

    insertAgentMetricsBatch(rows: AgentMetricRow[]): void {
      batchInsertAgentMetrics(rows);
    },

    // ── Ping Targets ──────────────────────────────────────────────────────────

    insertPingTarget(
      name: string,
      host: string,
      type: string,
      port: number | null,
      intervalMs: number,
      timeoutMs: number,
      tags: string[],
    ): number {
      const result = stmtInsertPingTarget.run({
        name,
        host,
        type,
        port,
        interval_ms: intervalMs,
        timeout_ms: timeoutMs,
        created_at: Math.floor(Date.now() / 1000),
        tags: JSON.stringify(tags),
      });
      return Number(result.lastInsertRowid);
    },

    listPingTargets() {
      return stmtListPingTargets.all();
    },

    getPingTarget(id: number) {
      return stmtGetPingTarget.get(id) ?? undefined;
    },

    updatePingTarget(
      id: number,
      fields: Partial<{
        name: string;
        host: string;
        type: string;
        port: number | null;
        interval_ms: number;
        timeout_ms: number;
        enabled: number;
        tags: string;
      }>,
    ): void {
      const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
      if (entries.length === 0) return;
      const setClauses = entries.map(([col]) => `${col} = @${col}`).join(', ');
      const stmt = db.prepare(`UPDATE ping_targets SET ${setClauses} WHERE id = @id`);
      stmt.run({ ...Object.fromEntries(entries), id });
    },

    deletePingTarget(id: number): void {
      stmtDeletePingTarget.run(id);
    },

    // ── Ping Results ──────────────────────────────────────────────────────────

    insertPingResult(
      targetId: number,
      ts: number,
      success: boolean,
      latencyMs: number | null,
      statusCode: number | null,
      error: string | null,
      icmpFallback: boolean,
    ): void {
      stmtInsertPingResult.run({
        target_id: targetId,
        ts,
        success: success ? 1 : 0,
        latency_ms: latencyMs,
        status_code: statusCode,
        error,
        icmp_fallback: icmpFallback ? 1 : 0,
      });
    },

    getLastNPingResults(targetId: number, n: number) {
      return stmtGetLastNPingResults.all(targetId, n);
    },

    getPingResultsRange(targetId: number, from: number, to: number) {
      return stmtGetPingResultsRange.all(targetId, from, to);
    },

    getPingStats24h(targetId: number): {
      uptime_percent: number;
      avg_latency_ms: number | null;
      min_latency_ms: number | null;
      max_latency_ms: number | null;
      total_checks: number;
      failed_checks: number;
    } {
      const since = Math.floor(Date.now() / 1000) - 86400;
      const row = stmtGetPingStats24h.get(targetId, since);
      return row ?? {
        uptime_percent: 100,
        avg_latency_ms: null,
        min_latency_ms: null,
        max_latency_ms: null,
        total_checks: 0,
        failed_checks: 0,
      };
    },
  };
}

export type Queries = ReturnType<typeof buildQueries>;

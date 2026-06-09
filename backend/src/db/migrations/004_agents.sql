-- Migration 004: Agent tables and metrics
-- Supports distributed agent deployment, authentication, and per-agent metric collection

CREATE TABLE IF NOT EXISTS agent_tokens (
  id         TEXT PRIMARY KEY,
  label      TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_used  INTEGER
);

CREATE TABLE IF NOT EXISTS agents (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  tags       TEXT NOT NULL DEFAULT '[]',
  token_id   TEXT REFERENCES agent_tokens(id) ON DELETE SET NULL,
  version    TEXT,
  first_seen INTEGER NOT NULL,
  last_seen  INTEGER NOT NULL,
  status     TEXT NOT NULL DEFAULT 'offline',
  os_info    TEXT
);

CREATE TABLE IF NOT EXISTS agent_metrics (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id    TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  ts          INTEGER NOT NULL,
  cpu_usage   REAL,
  mem_used    INTEGER,
  mem_total   INTEGER,
  disk_json   TEXT,
  net_json    TEXT,
  docker_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent_ts
  ON agent_metrics(agent_id, ts DESC);

CREATE TRIGGER IF NOT EXISTS agent_metrics_cap
  AFTER INSERT ON agent_metrics
  BEGIN
    DELETE FROM agent_metrics
    WHERE agent_id = NEW.agent_id
      AND id NOT IN (
        SELECT id FROM agent_metrics
        WHERE agent_id = NEW.agent_id
        ORDER BY ts DESC LIMIT 17280
      );
  END;

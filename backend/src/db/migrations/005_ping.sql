-- Migration 005: Ping monitoring tables
-- Supports ICMP and HTTP(S) ping targets with configurable intervals and result history

CREATE TABLE IF NOT EXISTS ping_targets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  host        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'icmp',
  port        INTEGER,
  interval_ms INTEGER NOT NULL DEFAULT 10000,
  timeout_ms  INTEGER NOT NULL DEFAULT 3000,
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL,
  tags        TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS ping_results (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  target_id     INTEGER NOT NULL REFERENCES ping_targets(id) ON DELETE CASCADE,
  ts            INTEGER NOT NULL,
  success       INTEGER NOT NULL,
  latency_ms    REAL,
  status_code   INTEGER,
  error         TEXT,
  icmp_fallback INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ping_results_target_ts
  ON ping_results(target_id, ts DESC);

CREATE TRIGGER IF NOT EXISTS ping_results_cap
  AFTER INSERT ON ping_results
  BEGIN
    DELETE FROM ping_results
    WHERE target_id = NEW.target_id
      AND id NOT IN (
        SELECT id FROM ping_results
        WHERE target_id = NEW.target_id
        ORDER BY ts DESC LIMIT 8640
      );
  END;

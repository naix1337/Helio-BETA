CREATE TABLE IF NOT EXISTS uptime_aggregations (
  id TEXT PRIMARY KEY,
  monitor_id TEXT NOT NULL,
  period TEXT NOT NULL CHECK(period IN ('hourly', 'daily')),
  timestamp TEXT NOT NULL,
  avg_latency_ms REAL NOT NULL DEFAULT 0,
  min_latency_ms REAL NOT NULL DEFAULT 0,
  max_latency_ms REAL NOT NULL DEFAULT 0,
  uptime_percent REAL NOT NULL DEFAULT 100,
  total_checks INTEGER NOT NULL DEFAULT 0,
  failed_checks INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_uptime_agg_lookup ON uptime_aggregations(monitor_id, period, timestamp DESC);
CREATE UNIQUE INDEX idx_uptime_agg_unique ON uptime_aggregations(monitor_id, period, timestamp);

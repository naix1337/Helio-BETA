CREATE TABLE IF NOT EXISTS heartbeats (
  id TEXT PRIMARY KEY,
  monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  timestamp TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('UP', 'DOWN', 'PENDING', 'DEGRADED')),
  latency_ms REAL,
  message TEXT,
  status_code INTEGER
);

CREATE INDEX idx_heartbeats_monitor_time ON heartbeats(monitor_id, timestamp DESC);
CREATE INDEX idx_heartbeats_timestamp ON heartbeats(timestamp);

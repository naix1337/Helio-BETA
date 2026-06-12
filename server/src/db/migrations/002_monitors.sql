CREATE TABLE IF NOT EXISTS monitors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('http', 'tcp', 'ping', 'dns', 'ssl', 'push')),
  config TEXT NOT NULL, -- JSON blob
  interval_seconds INTEGER NOT NULL DEFAULT 60,
  retries INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('UP', 'DOWN', 'PENDING', 'PAUSED', 'DEGRADED')),
  tags TEXT NOT NULL DEFAULT '[]', -- JSON array
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_monitors_status ON monitors(status);
CREATE INDEX idx_monitors_type ON monitors(type);

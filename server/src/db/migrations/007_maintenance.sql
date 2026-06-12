CREATE TABLE IF NOT EXISTS maintenance_windows (
  id TEXT PRIMARY KEY,
  monitor_ids TEXT NOT NULL DEFAULT '[]', -- JSON array
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_maintenance_active ON maintenance_windows(starts_at, ends_at);

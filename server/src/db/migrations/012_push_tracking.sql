-- Push tracking persistence
-- Stores last push timestamp per token so it survives restarts
CREATE TABLE IF NOT EXISTS push_tracking (
  token TEXT PRIMARY KEY,
  last_push_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_push_tracking_token ON push_tracking(token);

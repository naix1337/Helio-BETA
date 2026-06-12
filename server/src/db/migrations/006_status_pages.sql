CREATE TABLE IF NOT EXISTS status_pages (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  monitor_ids TEXT NOT NULL DEFAULT '[]', -- JSON array
  incident_banner TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_status_pages_slug ON status_pages(slug);

-- Proxmox connection config (singleton row)
CREATE TABLE IF NOT EXISTS proxmox_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  host TEXT NOT NULL,
  user TEXT NOT NULL,
  password TEXT NOT NULL,
  interval_seconds INTEGER NOT NULL DEFAULT 60,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Container metrics snapshots
CREATE TABLE IF NOT EXISTS container_metrics (
  id TEXT PRIMARY KEY,
  vmid INTEGER NOT NULL,
  name TEXT NOT NULL,
  node TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('lxc', 'qemu')),
  status TEXT NOT NULL,
  cpu REAL NOT NULL DEFAULT 0,
  mem INTEGER NOT NULL DEFAULT 0,
  maxmem INTEGER NOT NULL DEFAULT 1,
  disk INTEGER NOT NULL DEFAULT 0,
  maxdisk INTEGER NOT NULL DEFAULT 1,
  uptime INTEGER,
  ping_ms REAL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_container_metrics_lookup
  ON container_metrics(vmid, timestamp DESC);

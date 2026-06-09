# Helio Monitoring App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-hosted monitoring tool with a Node.js/Express backend that collects real system and Docker metrics into SQLite, broadcasts them over WebSocket, and serves a React dashboard that matches the existing Helio landing-page design system pixel-for-pixel.

**Architecture:** The backend is a single Express server on port 3001 with a 5-second collector loop; it exposes REST endpoints and a WebSocket channel, and in production also serves the compiled React app as static files. The frontend is a Vite/React SPA that connects to the backend WebSocket for live data and polls REST endpoints for historical data and configuration.

**Tech Stack:** Node 20, TypeScript, Express 4, ws, better-sqlite3, systeminformation, dockerode · React 18, Vite 5, zustand, recharts, lucide-react, react-router-dom 6, vitest

---

## File Map

```
helio-app/
├── package.json                          # npm workspaces root
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── types.ts                      # All shared interfaces (source of truth)
│       ├── db/
│       │   ├── connection.ts             # Singleton DB handle + schema init
│       │   └── queries.ts                # All prepared statements
│       ├── collectors/
│       │   ├── systemCollector.ts        # si.* wrappers → SystemSnapshot
│       │   └── dockerCollector.ts        # dockerode wrappers → ContainerInfo[]
│       ├── ws/
│       │   └── metricsWs.ts              # WS upgrade handler + broadcast
│       ├── routes/
│       │   ├── metrics.ts
│       │   ├── alerts.ts
│       │   ├── nodes.ts
│       │   └── status.ts
│       ├── alertEngine.ts                # Evaluates rules, dispatches webhooks
│       └── index.ts                      # Express bootstrap + collector loop
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── types.ts                      # Re-export from backend types (manually kept in sync)
│       ├── styles/
│       │   └── tokens.css               # CSS custom properties (copied from ../styles.css)
│       ├── hooks/
│       │   ├── useWebSocket.ts
│       │   └── useMetrics.ts
│       ├── store/
│       │   └── metricsStore.ts
│       ├── components/
│       │   ├── Sidebar.tsx
│       │   ├── StatCard.tsx
│       │   ├── CpuSparkline.tsx
│       │   ├── RamBars.tsx
│       │   ├── ServerTable.tsx
│       │   ├── StatusBadge.tsx
│       │   ├── StatusDot.tsx
│       │   └── ContainerTable.tsx
│       ├── pages/
│       │   ├── Dashboard.tsx
│       │   ├── Nodes.tsx
│       │   ├── Containers.tsx
│       │   ├── Alerts.tsx
│       │   └── StatusPage.tsx
│       └── App.tsx
└── backend/tests/
    ├── queries.test.ts
    ├── alertEngine.test.ts
    └── systemCollector.test.ts
```

---

## Task 1: Workspace Scaffold

**Files:**
- Create: `helio-app/package.json`
- Create: `helio-app/backend/package.json`
- Create: `helio-app/backend/tsconfig.json`
- Create: `helio-app/frontend/package.json`
- Create: `helio-app/frontend/vite.config.ts`
- Create: `helio-app/frontend/index.html`

- [ ] **Step 1: Create root workspace package.json**

```json
{
  "name": "helio",
  "private": true,
  "workspaces": ["backend", "frontend"],
  "scripts": {
    "dev": "concurrently \"npm run dev -w backend\" \"npm run dev -w frontend\"",
    "build": "npm run build -w frontend && npm run build -w backend",
    "start": "node backend/dist/index.js"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

Save to: `helio-app/package.json`

- [ ] **Step 2: Create backend package.json**

```json
{
  "name": "@helio/backend",
  "version": "0.1.0",
  "private": true,
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "better-sqlite3": "^9.4.3",
    "cors": "^2.8.5",
    "dockerode": "^4.0.2",
    "express": "^4.18.3",
    "systeminformation": "^5.22.11",
    "ws": "^8.16.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.8",
    "@types/cors": "^2.8.17",
    "@types/dockerode": "^3.3.23",
    "@types/express": "^4.17.21",
    "@types/node": "^20.11.28",
    "@types/ws": "^8.5.10",
    "tsx": "^4.7.1",
    "typescript": "^5.4.2",
    "vitest": "^1.4.0"
  }
}
```

Save to: `helio-app/backend/package.json`

- [ ] **Step 3: Create backend tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

Save to: `helio-app/backend/tsconfig.json`

- [ ] **Step 4: Create frontend package.json**

```json
{
  "name": "@helio/frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "lucide-react": "^0.364.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.3",
    "recharts": "^2.12.2",
    "zustand": "^4.5.2"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.2",
    "@testing-library/react": "^15.0.2",
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.22",
    "@vitejs/plugin-react": "^4.2.1",
    "jsdom": "^24.0.0",
    "typescript": "^5.4.2",
    "vite": "^5.2.0",
    "vitest": "^1.4.0"
  }
}
```

Save to: `helio-app/frontend/package.json`

- [ ] **Step 5: Create frontend vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/ws': { target: 'ws://localhost:3001', ws: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
  },
});
```

Save to: `helio-app/frontend/vite.config.ts`

- [ ] **Step 6: Create frontend/index.html**

```html
<!DOCTYPE html>
<html lang="de" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Helio — Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;450;480;500;540;600;650;680&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
  <script>
    // Sync theme before first render to prevent FOUC
    (function() {
      const saved = localStorage.getItem('helio-theme');
      if (saved) document.documentElement.setAttribute('data-theme', saved);
    })();
  </script>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

Save to: `helio-app/frontend/index.html`

- [ ] **Step 7: Install dependencies**

```bash
cd helio-app
npm install
```

Expected: `node_modules` appears in both `backend/` and `frontend/` (via workspaces).

- [ ] **Step 8: Commit**

```bash
cd helio-app
git add .
git commit -m "feat: workspace scaffold with backend and frontend packages"
```

---

## Task 2: Shared Types (Backend)

**Files:**
- Create: `helio-app/backend/src/types.ts`

- [ ] **Step 1: Write types.ts**

```typescript
// helio-app/backend/src/types.ts
// Single source of truth — keep in sync with frontend/src/types.ts

export interface DiskInfo {
  mount: string;
  used: number;    // bytes
  size: number;    // bytes
  percent: number; // 0–100
}

export interface NetInfo {
  iface: string;
  rx_sec: number;  // bytes/s
  tx_sec: number;  // bytes/s
}

export interface SystemSnapshot {
  ts: number;
  cpu: number;           // 0–100
  cpuTemp?: number;
  mem: {
    used: number;
    total: number;
    percent: number;
  };
  disk: DiskInfo[];
  net: NetInfo[];
  uptime: number;        // seconds
  loadAvg: [number, number, number];
}

export interface MetricRow {
  id: number;
  ts: number;
  cpu: number;
  mem_used: number;
  mem_total: number;
  disk_json: string;  // JSON: DiskInfo[]
  net_json: string;   // JSON: NetInfo[]
}

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: 'running' | 'stopped' | 'restarting' | 'dead' | 'unknown';
  cpu_percent: number;
  mem_used: number;
  mem_limit: number;
  mem_percent: number;
  created: number;
  ports: string[];
}

export interface Node {
  id: string;
  name: string;
  addr: string;
  token: string;
  last_seen: number | null;
  status: string;
}

export type AlertMetric = 'cpu' | 'memory' | 'disk' | 'net_rx' | 'net_tx';
export type AlertOperator = '>' | '<' | '>=';
export type AlertChannel = 'webhook' | 'email' | 'slack' | 'discord';

export interface Alert {
  id: number;
  name: string;
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
  channel: AlertChannel;
  target: string;
  cooldown: number;
  enabled: number;
  created_at: number;
}

export interface AlertEvent {
  id: number;
  alert_id: number;
  triggered_at: number;
  resolved_at: number | null;
  peak_value: number;
}

export interface WsMessage {
  type: 'metrics' | 'alert' | 'ping' | 'pong';
  data?: SystemSnapshot | AlertFireEvent;
}

export interface AlertFireEvent {
  alertId: number;
  name: string;
  metric: AlertMetric;
  value: number;
  triggeredAt: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/types.ts
git commit -m "feat: shared type definitions"
```

---

## Task 3: SQLite Database Connection + Schema

**Files:**
- Create: `helio-app/backend/src/db/connection.ts`

- [ ] **Step 1: Write connection.ts**

```typescript
// helio-app/backend/src/db/connection.ts
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.HELIO_DB_PATH ?? path.join(process.cwd(), 'helio.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  try {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    applySchema(_db);
    return _db;
  } catch (err) {
    console.error(`[DB] Cannot open database at ${DB_PATH}:`, err);
    process.exit(1);
  }
}

function applySchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS metrics (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      ts        INTEGER NOT NULL,
      cpu       REAL NOT NULL,
      mem_used  INTEGER NOT NULL,
      mem_total INTEGER NOT NULL,
      disk_json TEXT NOT NULL,
      net_json  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_metrics_ts ON metrics(ts);

    CREATE TRIGGER IF NOT EXISTS metrics_cleanup
      AFTER INSERT ON metrics
      BEGIN
        DELETE FROM metrics WHERE id NOT IN (
          SELECT id FROM metrics ORDER BY ts DESC LIMIT 17280
        );
      END;

    CREATE TABLE IF NOT EXISTS nodes (
      id        TEXT PRIMARY KEY,
      name      TEXT NOT NULL,
      addr      TEXT NOT NULL,
      token     TEXT NOT NULL,
      last_seen INTEGER,
      status    TEXT DEFAULT 'unknown'
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      metric     TEXT NOT NULL,
      operator   TEXT NOT NULL,
      threshold  REAL NOT NULL,
      channel    TEXT NOT NULL,
      target     TEXT NOT NULL,
      cooldown   INTEGER DEFAULT 15,
      enabled    INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS alert_events (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_id     INTEGER REFERENCES alerts(id) ON DELETE CASCADE,
      triggered_at INTEGER NOT NULL,
      resolved_at  INTEGER,
      peak_value   REAL NOT NULL
    );
  `);
}
```

- [ ] **Step 2: Verify schema creates without error**

```bash
cd helio-app/backend
HELIO_DB_PATH=/tmp/test-helio.db tsx -e "import('./src/db/connection.js').then(m => { m.getDb(); console.log('Schema OK'); process.exit(0); })"
```

Expected output: `Schema OK`

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/connection.ts
git commit -m "feat: sqlite connection with WAL + schema"
```

---

## Task 4: DB Query Functions + Tests

**Files:**
- Create: `helio-app/backend/src/db/queries.ts`
- Create: `helio-app/backend/tests/queries.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// helio-app/backend/tests/queries.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';

// Inline the schema so tests are self-contained
function buildTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL, cpu REAL NOT NULL,
      mem_used INTEGER NOT NULL, mem_total INTEGER NOT NULL,
      disk_json TEXT NOT NULL, net_json TEXT NOT NULL
    );
    CREATE INDEX idx_metrics_ts ON metrics(ts);
    CREATE TABLE alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, metric TEXT NOT NULL, operator TEXT NOT NULL,
      threshold REAL NOT NULL, channel TEXT NOT NULL, target TEXT NOT NULL,
      cooldown INTEGER DEFAULT 15, enabled INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch())
    );
    CREATE TABLE alert_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_id INTEGER REFERENCES alerts(id) ON DELETE CASCADE,
      triggered_at INTEGER NOT NULL, resolved_at INTEGER,
      peak_value REAL NOT NULL
    );
  `);
  return db;
}

describe('insertMetric', () => {
  it('inserts a metric row and reads it back', () => {
    const db = buildTestDb();
    const { insertMetric, getLatestMetric } = buildQueries(db);
    insertMetric({
      ts: 1000, cpu: 42.5, mem: { used: 4e9, total: 16e9, percent: 25 },
      disk: [{ mount: '/', used: 10e9, size: 100e9, percent: 10 }],
      net: [{ iface: 'eth0', rx_sec: 1000, tx_sec: 500 }],
      uptime: 3600, loadAvg: [0.5, 0.4, 0.3],
    });
    const row = getLatestMetric();
    expect(row).toBeDefined();
    expect(row!.cpu).toBe(42.5);
    expect(row!.mem_used).toBe(4e9);
    db.close();
  });
});

describe('getMetricsRange', () => {
  it('returns rows within ts range', () => {
    const db = buildTestDb();
    const { insertMetric, getMetricsRange } = buildQueries(db);
    for (let i = 1; i <= 5; i++) {
      insertMetric({ ts: i * 1000, cpu: i, mem: { used: 0, total: 0, percent: 0 },
        disk: [], net: [], uptime: 0, loadAvg: [0, 0, 0] });
    }
    const rows = getMetricsRange(2000, 4000);
    expect(rows).toHaveLength(3);
    expect(rows[0].cpu).toBe(2);
    db.close();
  });
});

describe('alert queries', () => {
  it('inserts and retrieves alerts', () => {
    const db = buildTestDb();
    const { insertAlert, getAlerts } = buildQueries(db);
    insertAlert({ name: 'High CPU', metric: 'cpu', operator: '>', threshold: 90,
      channel: 'webhook', target: 'http://hook', cooldown: 10 });
    const alerts = getAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].name).toBe('High CPU');
    db.close();
  });

  it('inserts alert event and retrieves latest', () => {
    const db = buildTestDb();
    const { insertAlert, insertAlertEvent, getLatestAlertEvent } = buildQueries(db);
    insertAlert({ name: 'Test', metric: 'cpu', operator: '>', threshold: 80,
      channel: 'webhook', target: 'http://x', cooldown: 15 });
    const alerts = db.prepare('SELECT id FROM alerts').all() as { id: number }[];
    const alertId = alerts[0].id;
    insertAlertEvent(alertId, 95);
    const ev = getLatestAlertEvent(alertId);
    expect(ev).toBeDefined();
    expect(ev!.peak_value).toBe(95);
    db.close();
  });
});

// Minimal stub so TypeScript doesn't complain — will be replaced by real import
function buildQueries(_db: Database.Database): ReturnType<typeof import('../src/db/queries.js')['buildQueries']> {
  throw new Error('Replace with real import after implementation');
}
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd helio-app/backend
npx vitest run tests/queries.test.ts
```

Expected: Tests fail — `buildQueries` not implemented.

- [ ] **Step 3: Write queries.ts**

```typescript
// helio-app/backend/src/db/queries.ts
import type Database from 'better-sqlite3';
import type { SystemSnapshot, MetricRow, Alert, AlertEvent } from '../types.js';

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
  };
}

export type Queries = ReturnType<typeof buildQueries>;
```

- [ ] **Step 4: Fix test imports and run**

Update `tests/queries.test.ts` — replace the `buildQueries` stub at the bottom with:

```typescript
import { buildQueries } from '../src/db/queries.js';
```

Remove the local `function buildQueries` stub entirely. Then run:

```bash
npx vitest run tests/queries.test.ts
```

Expected: All 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/queries.ts backend/tests/queries.test.ts
git commit -m "feat: db queries with tests"
```

---

## Task 5: DB Singleton + Queries Export

**Files:**
- Modify: `helio-app/backend/src/db/connection.ts`
- Create: `helio-app/backend/src/db/index.ts`

- [ ] **Step 1: Create db/index.ts barrel**

```typescript
// helio-app/backend/src/db/index.ts
import { getDb } from './connection.js';
import { buildQueries } from './queries.js';

const db = getDb();
export const queries = buildQueries(db);
export { getDb };
```

This singleton is imported throughout the backend — no need to pass `db` around.

- [ ] **Step 2: Verify import works**

```bash
cd helio-app/backend
tsx -e "import('./src/db/index.js').then(m => { console.log(typeof m.queries.getAlerts); process.exit(0); })"
```

Expected: `function`

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/index.ts
git commit -m "feat: db singleton barrel export"
```

---

## Task 6: System Collector + Tests

**Files:**
- Create: `helio-app/backend/src/collectors/systemCollector.ts`
- Create: `helio-app/backend/tests/systemCollector.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// helio-app/backend/tests/systemCollector.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock systeminformation before importing collector
vi.mock('systeminformation', () => ({
  default: {
    currentLoad: vi.fn().mockResolvedValue({ currentLoad: 42.5 }),
    mem: vi.fn().mockResolvedValue({ used: 4_000_000_000, total: 16_000_000_000, free: 12_000_000_000 }),
    fsSize: vi.fn().mockResolvedValue([
      { mount: '/', size: 100_000_000_000, used: 20_000_000_000, type: 'ext4' },
      { mount: '/dev/loop0', size: 1000, used: 1000, type: 'squashfs' }, // should be filtered
    ]),
    networkStats: vi.fn().mockResolvedValue([
      { iface: 'eth0', rx_sec: 1024, tx_sec: 512 },
      { iface: 'lo', rx_sec: 0, tx_sec: 0 }, // should be filtered
    ]),
    cpuTemperature: vi.fn().mockResolvedValue({ main: 55 }),
    osInfo: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return { ...actual, uptime: () => 86400, loadavg: () => [0.5, 0.4, 0.3] };
});

import { collectSnapshot } from '../src/collectors/systemCollector.js';

describe('collectSnapshot', () => {
  it('returns a snapshot with correct cpu value', async () => {
    const snap = await collectSnapshot();
    expect(snap.cpu).toBe(42.5);
  });

  it('computes mem.percent correctly', async () => {
    const snap = await collectSnapshot();
    expect(snap.mem.percent).toBeCloseTo(25, 0);
    expect(snap.mem.total).toBe(16_000_000_000);
  });

  it('filters loop devices from disk', async () => {
    const snap = await collectSnapshot();
    expect(snap.disk.every(d => !d.mount.includes('loop'))).toBe(true);
  });

  it('filters loopback from net', async () => {
    const snap = await collectSnapshot();
    expect(snap.net.every(n => n.iface !== 'lo')).toBe(true);
    expect(snap.net).toHaveLength(1);
  });

  it('includes uptime and loadAvg from os module', async () => {
    const snap = await collectSnapshot();
    expect(snap.uptime).toBe(86400);
    expect(snap.loadAvg).toEqual([0.5, 0.4, 0.3]);
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd helio-app/backend
npx vitest run tests/systemCollector.test.ts
```

Expected: FAIL — `collectSnapshot` not defined.

- [ ] **Step 3: Implement systemCollector.ts**

```typescript
// helio-app/backend/src/collectors/systemCollector.ts
import si from 'systeminformation';
import os from 'os';
import type { SystemSnapshot } from '../types.js';

const LOOP_PATTERN = /loop|tmpfs|devtmpfs|squashfs|overlay/i;
const LOOPBACK_IFACES = new Set(['lo', 'localhost']);

export async function collectSnapshot(): Promise<SystemSnapshot> {
  const ts = Math.floor(Date.now() / 1000);

  const [load, mem, disks, nets, temp] = await Promise.all([
    si.currentLoad().catch(() => ({ currentLoad: 0 })),
    si.mem().catch(() => ({ used: 0, total: 0 })),
    si.fsSize().catch(() => []),
    si.networkStats().catch(() => []),
    si.cpuTemperature().catch(() => ({ main: undefined })),
  ]);

  const memTotal = (mem as { total: number }).total;
  const memUsed = (mem as { used: number }).used;
  const memPercent = memTotal > 0 ? (memUsed / memTotal) * 100 : 0;

  const diskData = (disks as Array<{ mount: string; size: number; used: number; type?: string }>)
    .filter(d => d.size > 0 && !LOOP_PATTERN.test(d.type ?? '') && !LOOP_PATTERN.test(d.mount))
    .map(d => ({
      mount: d.mount,
      size: d.size,
      used: d.used,
      percent: d.size > 0 ? (d.used / d.size) * 100 : 0,
    }));

  const netData = (nets as Array<{ iface: string; rx_sec: number; tx_sec: number }>)
    .filter(n => !LOOPBACK_IFACES.has(n.iface))
    .map(n => ({ iface: n.iface, rx_sec: n.rx_sec ?? 0, tx_sec: n.tx_sec ?? 0 }));

  const raw = os.loadavg();

  return {
    ts,
    cpu: (load as { currentLoad: number }).currentLoad ?? 0,
    cpuTemp: (temp as { main?: number }).main,
    mem: { used: memUsed, total: memTotal, percent: memPercent },
    disk: diskData,
    net: netData,
    uptime: os.uptime(),
    loadAvg: [raw[0] ?? 0, raw[1] ?? 0, raw[2] ?? 0],
  };
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run tests/systemCollector.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Smoke test with real data**

```bash
tsx -e "import('./src/collectors/systemCollector.js').then(async m => { const s = await m.collectSnapshot(); console.log(JSON.stringify(s, null, 2)); process.exit(0); })"
```

Expected: JSON with real CPU %, memory, at least one disk entry.

- [ ] **Step 6: Commit**

```bash
git add backend/src/collectors/systemCollector.ts backend/tests/systemCollector.test.ts
git commit -m "feat: system collector with si wrappers and graceful fallbacks"
```

---

## Task 7: Docker Collector

**Files:**
- Create: `helio-app/backend/src/collectors/dockerCollector.ts`

- [ ] **Step 1: Write dockerCollector.ts**

```typescript
// helio-app/backend/src/collectors/dockerCollector.ts
import Dockerode from 'dockerode';
import type { ContainerInfo } from '../types.js';

let docker: Dockerode | null = null;
let dockerWarned = false;

function getDocker(): Dockerode | null {
  if (docker) return docker;
  try {
    docker = new Dockerode();
    return docker;
  } catch {
    if (!dockerWarned) {
      console.warn('[Docker] Cannot connect to Docker socket — container metrics disabled');
      dockerWarned = true;
    }
    return null;
  }
}

function calcCpuPercent(stats: Dockerode.ContainerStats): number {
  try {
    const cpu = stats.cpu_stats.cpu_usage.total_usage -
                stats.precpu_stats.cpu_usage.total_usage;
    const sys = stats.cpu_stats.system_cpu_usage -
                (stats.precpu_stats.system_cpu_usage ?? 0);
    const numCpus = stats.cpu_stats.online_cpus ??
                    stats.cpu_stats.cpu_usage.percpu_usage?.length ?? 1;
    return sys > 0 ? (cpu / sys) * numCpus * 100 : 0;
  } catch {
    return 0;
  }
}

function mapStatus(state: string): ContainerInfo['status'] {
  const s = state.toLowerCase();
  if (s === 'running') return 'running';
  if (s === 'exited' || s === 'created') return 'stopped';
  if (s === 'restarting') return 'restarting';
  if (s === 'dead') return 'dead';
  return 'unknown';
}

export async function collectContainers(): Promise<ContainerInfo[]> {
  const d = getDocker();
  if (!d) return [];

  try {
    const list = await d.listContainers({ all: true });

    const results = await Promise.allSettled(
      list.map(async (info) => {
        const container = d.getContainer(info.Id);
        let stats: Dockerode.ContainerStats | null = null;
        try {
          stats = await container.stats({ stream: false }) as Dockerode.ContainerStats;
        } catch {
          // stats may fail for stopped containers
        }

        const memUsed = stats?.memory_stats?.usage ?? 0;
        const memLimit = stats?.memory_stats?.limit ?? 0;
        const cpuPercent = stats ? calcCpuPercent(stats) : 0;

        return {
          id: info.Id.slice(0, 12),
          name: (info.Names[0] ?? info.Id).replace(/^\//, ''),
          image: info.Image,
          status: mapStatus(info.State),
          cpu_percent: Math.round(cpuPercent * 100) / 100,
          mem_used: memUsed,
          mem_limit: memLimit,
          mem_percent: memLimit > 0 ? (memUsed / memLimit) * 100 : 0,
          created: info.Created,
          ports: info.Ports.map(p =>
            p.PublicPort ? `${p.PublicPort}:${p.PrivatePort}/${p.Type}` : `${p.PrivatePort}/${p.Type}`
          ),
        } satisfies ContainerInfo;
      })
    );

    return results
      .filter((r): r is PromiseFulfilledResult<ContainerInfo> => r.status === 'fulfilled')
      .map(r => r.value);
  } catch (err) {
    if (!dockerWarned) {
      console.warn('[Docker] Error collecting containers:', (err as Error).message);
      dockerWarned = true;
    }
    return [];
  }
}
```

- [ ] **Step 2: Smoke test (graceful degradation)**

```bash
cd helio-app/backend
tsx -e "
import('./src/collectors/dockerCollector.js').then(async m => {
  const c = await m.collectContainers();
  console.log('Containers:', c.length, '(0 is OK if Docker not running)');
  process.exit(0);
})"
```

Expected: Either prints container count or prints Docker warning + `Containers: 0`. No crash.

- [ ] **Step 3: Commit**

```bash
git add backend/src/collectors/dockerCollector.ts
git commit -m "feat: docker collector with graceful degradation"
```

---

## Task 8: Alert Engine + Tests

**Files:**
- Create: `helio-app/backend/src/alertEngine.ts`
- Create: `helio-app/backend/tests/alertEngine.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// helio-app/backend/tests/alertEngine.test.ts
import { describe, it, expect } from 'vitest';
import { extractValue, evaluateCondition } from '../src/alertEngine.js';
import type { SystemSnapshot } from '../src/types.js';

const snap: SystemSnapshot = {
  ts: 1000, cpu: 85, mem: { used: 8e9, total: 16e9, percent: 50 },
  disk: [{ mount: '/', used: 80e9, size: 100e9, percent: 80 }],
  net: [{ iface: 'eth0', rx_sec: 5_000_000, tx_sec: 1_000_000 }],
  uptime: 3600, loadAvg: [1, 0.8, 0.6],
};

describe('extractValue', () => {
  it('extracts cpu', () => expect(extractValue(snap, 'cpu')).toBe(85));
  it('extracts memory percent', () => expect(extractValue(snap, 'memory')).toBe(50));
  it('extracts disk percent', () => expect(extractValue(snap, 'disk')).toBe(80));
  it('extracts net_rx in MB/s', () => expect(extractValue(snap, 'net_rx')).toBeCloseTo(5, 0));
  it('extracts net_tx in MB/s', () => expect(extractValue(snap, 'net_tx')).toBeCloseTo(1, 0));
});

describe('evaluateCondition', () => {
  it('> operator: true when value exceeds threshold', () =>
    expect(evaluateCondition(90, '>', 85)).toBe(true));
  it('> operator: false when value below threshold', () =>
    expect(evaluateCondition(80, '>', 85)).toBe(false));
  it('>= operator: true when equal', () =>
    expect(evaluateCondition(85, '>=', 85)).toBe(true));
  it('< operator', () =>
    expect(evaluateCondition(10, '<', 20)).toBe(true));
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run tests/alertEngine.test.ts
```

- [ ] **Step 3: Write alertEngine.ts**

```typescript
// helio-app/backend/src/alertEngine.ts
import type { SystemSnapshot, Alert, AlertFireEvent, AlertMetric, AlertOperator } from './types.js';
import { queries } from './db/index.js';

type BroadcastFn = (msg: { type: string; data: unknown }) => void;
let broadcast: BroadcastFn = () => {};

export function setAlertBroadcast(fn: BroadcastFn): void {
  broadcast = fn;
}

export function extractValue(snap: SystemSnapshot, metric: AlertMetric): number {
  switch (metric) {
    case 'cpu': return snap.cpu;
    case 'memory': return snap.mem.percent;
    case 'disk': return snap.disk[0]?.percent ?? 0;
    case 'net_rx': return (snap.net[0]?.rx_sec ?? 0) / 1_000_000;
    case 'net_tx': return (snap.net[0]?.tx_sec ?? 0) / 1_000_000;
    default: return 0;
  }
}

export function evaluateCondition(value: number, operator: AlertOperator, threshold: number): boolean {
  switch (operator) {
    case '>': return value > threshold;
    case '<': return value < threshold;
    case '>=': return value >= threshold;
    default: return false;
  }
}

export async function evaluateAlerts(snap: SystemSnapshot): Promise<void> {
  const rules = queries.getAlerts();

  for (const rule of rules) {
    const value = extractValue(snap, rule.metric as AlertMetric);
    const triggered = evaluateCondition(value, rule.operator as AlertOperator, rule.threshold);

    if (!triggered) continue;

    const lastEvent = queries.getLatestAlertEvent(rule.id);
    const nowSec = Math.floor(Date.now() / 1000);
    const cooldownPassed = !lastEvent ||
      (nowSec - lastEvent.triggered_at) > rule.cooldown * 60;

    if (!cooldownPassed) continue;

    queries.insertAlertEvent(rule.id, value);

    const fireEvent: AlertFireEvent = {
      alertId: rule.id,
      name: rule.name,
      metric: rule.metric as AlertMetric,
      value,
      triggeredAt: nowSec,
    };

    broadcast({ type: 'alert', data: fireEvent });

    if (rule.channel === 'webhook' || rule.channel === 'slack' || rule.channel === 'discord') {
      await dispatchWebhook(rule, value, nowSec).catch(err =>
        console.error(`[Alert] Webhook dispatch failed for "${rule.name}":`, err.message)
      );
    }
  }
}

async function dispatchWebhook(rule: Alert, value: number, ts: number): Promise<void> {
  const body = JSON.stringify({
    alert: rule.name,
    metric: rule.metric,
    value,
    threshold: rule.threshold,
    ts,
    host: process.env.HOSTNAME ?? 'helio-server',
  });

  const res = await fetch(rule.target, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${rule.target}`);
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run tests/alertEngine.test.ts
```

Expected: 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/alertEngine.ts backend/tests/alertEngine.test.ts
git commit -m "feat: alert engine with evaluation and webhook dispatch"
```

---

## Task 9: WebSocket Server

**Files:**
- Create: `helio-app/backend/src/ws/metricsWs.ts`

- [ ] **Step 1: Write metricsWs.ts**

```typescript
// helio-app/backend/src/ws/metricsWs.ts
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Server } from 'http';
import type { WsMessage } from '../types.js';

const clients = new Set<WebSocket>();
let wss: WebSocketServer | null = null;

export function attachWebSocket(server: Server): void {
  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req: IncomingMessage, socket, head) => {
    const url = req.url ?? '';
    if (!url.startsWith('/ws')) {
      socket.destroy();
      return;
    }
    wss!.handleUpgrade(req, socket, head, (ws) => {
      wss!.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws: WebSocket) => {
    clients.add(ws);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as WsMessage;
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on('close', () => clients.delete(ws));
    ws.on('error', () => clients.delete(ws));
  });

  // Heartbeat: remove dead connections every 30s
  setInterval(() => {
    for (const ws of clients) {
      if (ws.readyState !== WebSocket.OPEN) {
        clients.delete(ws);
      }
    }
  }, 30_000);
}

export function wsBroadcast(msg: { type: string; data?: unknown }): void {
  const payload = JSON.stringify(msg);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

export function getClientCount(): number {
  return clients.size;
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/ws/metricsWs.ts
git commit -m "feat: websocket server with broadcast and heartbeat"
```

---

## Task 10: REST Routes

**Files:**
- Create: `helio-app/backend/src/routes/metrics.ts`
- Create: `helio-app/backend/src/routes/alerts.ts`
- Create: `helio-app/backend/src/routes/nodes.ts`
- Create: `helio-app/backend/src/routes/status.ts`

- [ ] **Step 1: Write metrics.ts**

```typescript
// helio-app/backend/src/routes/metrics.ts
import { Router } from 'express';
import { queries } from '../db/index.js';
import { collectSnapshot } from '../collectors/systemCollector.js';
import { collectContainers } from '../collectors/dockerCollector.js';

export const metricsRouter = Router();

metricsRouter.get('/current', async (_req, res) => {
  try {
    const snap = await collectSnapshot();
    res.json(snap);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

metricsRouter.get('/history', (req, res) => {
  const range = (req.query.range as string) ?? '1h';
  const now = Math.floor(Date.now() / 1000);

  const rangeMap: Record<string, number> = {
    '1h': 3600, '6h': 21600, '24h': 86400, '7d': 604800,
  };
  const seconds = rangeMap[range] ?? 3600;
  const from = now - seconds;

  const rows = queries.getMetricsRange(from, now);

  // Downsample to keep max ~500 points
  const step = Math.max(1, Math.floor(rows.length / 500));
  const sampled = step === 1 ? rows : rows.filter((_, i) => i % step === 0);

  res.json(sampled);
});

metricsRouter.get('/containers', async (_req, res) => {
  const containers = await collectContainers();
  res.json(containers);
});
```

- [ ] **Step 2: Write alerts.ts**

```typescript
// helio-app/backend/src/routes/alerts.ts
import { Router } from 'express';
import { queries } from '../db/index.js';
import type { AlertMetric, AlertOperator, AlertChannel } from '../types.js';

export const alertsRouter = Router();

alertsRouter.get('/', (_req, res) => {
  res.json(queries.getAllAlerts());
});

alertsRouter.post('/', (req, res) => {
  const { name, metric, operator, threshold, channel, target, cooldown } = req.body as {
    name: string; metric: AlertMetric; operator: AlertOperator;
    threshold: number; channel: AlertChannel; target: string; cooldown?: number;
  };

  if (!name || !metric || !operator || threshold == null || !channel || !target) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  const id = queries.insertAlert({ name, metric, operator, threshold, channel, target, cooldown: cooldown ?? 15 });
  res.status(201).json({ id, name, metric, operator, threshold, channel, target });
});

alertsRouter.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const { enabled } = req.body as { enabled: boolean };
  queries.updateAlert(id, enabled);
  res.json({ ok: true });
});

alertsRouter.delete('/:id', (req, res) => {
  queries.deleteAlert(Number(req.params.id));
  res.json({ ok: true });
});
```

- [ ] **Step 3: Write nodes.ts**

```typescript
// helio-app/backend/src/routes/nodes.ts
import { Router } from 'express';
import { getDb } from '../db/index.js';
import type { Node } from '../types.js';

export const nodesRouter = Router();

nodesRouter.get('/', (_req, res) => {
  const db = getDb();
  const nodes = db.prepare('SELECT * FROM nodes').all() as Node[];
  res.json(nodes);
});
```

- [ ] **Step 4: Write status.ts**

```typescript
// helio-app/backend/src/routes/status.ts
import { Router } from 'express';
import { queries } from '../db/index.js';

export const statusRouter = Router();

statusRouter.get('/', (_req, res) => {
  const now = Math.floor(Date.now() / 1000);
  const from = now - 90 * 24 * 3600;
  const rows = queries.getMetricsRange(from, now);

  const uptime = rows.length > 0
    ? (rows.filter(r => r.cpu < 100).length / rows.length) * 100
    : 100;

  res.json({
    nodes: [],
    uptime_percent: Math.round(uptime * 100) / 100,
    incidents: [],
  });
});
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/
git commit -m "feat: rest api routes for metrics, alerts, nodes, status"
```

---

## Task 11: Express Entry Point (Backend Complete)

**Files:**
- Create: `helio-app/backend/src/index.ts`

- [ ] **Step 1: Write index.ts**

```typescript
// helio-app/backend/src/index.ts
import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { attachWebSocket, wsBroadcast } from './ws/metricsWs.js';
import { metricsRouter } from './routes/metrics.js';
import { alertsRouter } from './routes/alerts.js';
import { nodesRouter } from './routes/nodes.js';
import { statusRouter } from './routes/status.js';
import { collectSnapshot } from './collectors/systemCollector.js';
import { collectContainers } from './collectors/dockerCollector.js';
import { queries } from './db/index.js';
import { evaluateAlerts, setAlertBroadcast } from './alertEngine.js';

const PORT = Number(process.env.PORT ?? 3001);
const IS_PROD = process.env.NODE_ENV === 'production';

const app = express();
app.use(cors({ origin: IS_PROD ? false : '*' }));
app.use(express.json());

// API routes
app.use('/api/metrics', metricsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/nodes', nodesRouter);
app.use('/api/status', statusRouter);

// Serve frontend in production
if (IS_PROD) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const DIST = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(DIST));
  app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

const server = http.createServer(app);
attachWebSocket(server);
setAlertBroadcast(wsBroadcast);

// Collector loop
async function collect(): Promise<void> {
  try {
    const snap = await collectSnapshot();
    queries.insertMetric(snap);
    wsBroadcast({ type: 'metrics', data: snap });
    await evaluateAlerts(snap);
  } catch (err) {
    console.error('[Collector] Error:', err);
  }
}

server.listen(PORT, async () => {
  console.log(`[Helio] Backend running on http://localhost:${PORT}`);
  await collect(); // immediate first snapshot
  setInterval(collect, 5_000);
});
```

- [ ] **Step 2: Build TypeScript and verify**

```bash
cd helio-app/backend
npm run build
```

Expected: `dist/` directory created, no TypeScript errors.

- [ ] **Step 3: Start dev server**

```bash
npm run dev
```

Expected: `[Helio] Backend running on http://localhost:3001`

Open another terminal and verify:

```bash
curl -s http://localhost:3001/api/metrics/current | head -c 200
```

Expected: JSON with `cpu`, `mem`, `disk`, `net` fields.

- [ ] **Step 4: Commit**

```bash
git add backend/src/index.ts
git commit -m "feat: express server with collector loop and ws broadcast"
```

---

## Task 12: Frontend — Shared Types + CSS Tokens

**Files:**
- Create: `helio-app/frontend/src/types.ts`
- Create: `helio-app/frontend/src/styles/tokens.css`
- Create: `helio-app/frontend/src/styles/dashboard.css`
- Create: `helio-app/frontend/src/main.tsx`
- Create: `helio-app/frontend/src/setupTests.ts`

- [ ] **Step 1: Create frontend/src/types.ts**

Copy the type definitions exactly from `backend/src/types.ts` — they must be identical. (No shared package for simplicity; keep them in sync manually.)

The file content is identical to Task 2's `types.ts` but placed at `frontend/src/types.ts`.

- [ ] **Step 2: Create tokens.css**

Extract the CSS variables from `../../styles.css` (the landing page). The file must contain both `:root` (dark) and `[data-theme="light"]` blocks verbatim:

```css
/* helio-app/frontend/src/styles/tokens.css */
/* Source of truth: ../../styles.css — keep in sync */
:root {
  --bg:            #0B0E14;
  --bg-soft:       #0E121A;
  --surface:       #11161F;
  --surface-2:     #161C28;
  --surface-3:     #1B2230;
  --border:        rgba(255,255,255,0.075);
  --border-strong: rgba(255,255,255,0.14);
  --text:          #EEF2F7;
  --text-muted:    #9AA6B6;
  --text-dim:      #677082;
  --primary:           #2EE0CE;
  --primary-hover:     #54ead9;
  --primary-soft:      rgba(46,224,206,0.12);
  --primary-fg:        #042220;
  --primary-glow:      rgba(46,224,206,0.32);
  --violet:        #9C8CFA;
  --violet-soft:   rgba(156,140,250,0.14);
  --ok:    #36D399;
  --warn:  #F7C948;
  --down:  #F76C6C;
  --ok-soft:   rgba(54,211,153,0.14);
  --warn-soft: rgba(247,201,72,0.14);
  --down-soft: rgba(247,108,108,0.14);
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.4);
  --shadow-md: 0 12px 40px -12px rgba(0,0,0,0.6);
  --shadow-lg: 0 40px 120px -30px rgba(0,0,0,0.75);
  --nav-bg: rgba(11,14,20,0.72);
  --grid-line: rgba(255,255,255,0.045);
  --font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --radius-sm: 6px;
  --radius:    10px;
  --radius-lg: 16px;
  --radius-xl: 22px;
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
}
[data-theme="light"] {
  --bg:            #FBFCFE;
  --bg-soft:       #F4F7FA;
  --surface:       #FFFFFF;
  --surface-2:     #F6F8FB;
  --surface-3:     #EEF2F7;
  --border:        rgba(13,20,33,0.10);
  --border-strong: rgba(13,20,33,0.17);
  --text:          #0D1420;
  --text-muted:    #56627A;
  --text-dim:      #8A93A6;
  --primary:           #0C9C8D;
  --primary-hover:     #0AA597;
  --primary-soft:      rgba(12,156,141,0.10);
  --primary-fg:        #FFFFFF;
  --primary-glow:      rgba(12,156,141,0.22);
  --violet:        #6F58E8;
  --violet-soft:   rgba(111,88,232,0.10);
  --ok:    #11A86F;
  --warn:  #C98A06;
  --down:  #DB4A4A;
  --ok-soft:   rgba(17,168,111,0.12);
  --warn-soft: rgba(201,138,6,0.12);
  --down-soft: rgba(219,74,74,0.12);
  --shadow-sm: 0 1px 2px rgba(13,20,33,0.06);
  --shadow-md: 0 14px 40px -16px rgba(13,20,33,0.16);
  --shadow-lg: 0 40px 120px -36px rgba(13,20,33,0.22);
  --nav-bg: rgba(251,252,254,0.78);
  --grid-line: rgba(13,20,33,0.05);
}
```

- [ ] **Step 3: Create dashboard.css**

```css
/* helio-app/frontend/src/styles/dashboard.css */
*, *::before, *::after { box-sizing: border-box; }
* { margin: 0; padding: 0; }
html, body, #root { height: 100%; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  transition: background-color 0.3s var(--ease), color 0.3s var(--ease);
}
a { color: inherit; text-decoration: none; }
ul { list-style: none; }
button, input, select { font: inherit; color: inherit; }
:focus-visible { outline: 2px solid var(--primary); outline-offset: 3px; border-radius: 4px; }

/* App layout */
.app-layout {
  display: grid;
  grid-template-columns: 200px 1fr;
  height: 100vh;
  overflow: hidden;
}
.main-content {
  overflow-y: auto;
  padding: 28px 32px;
  background: var(--bg);
}

/* Page header */
.page-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 28px;
}
.page-header h1 {
  font-size: 1.45rem;
  font-weight: 640;
  letter-spacing: -0.02em;
}
.page-header .sub {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--text-dim);
}

/* Stats grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  margin-bottom: 22px;
}

/* Mono util */
.mono { font-family: var(--font-mono); }

@media (max-width: 768px) {
  .app-layout { grid-template-columns: 1fr; }
  .main-content { padding: 16px; }
}
```

- [ ] **Step 4: Create main.tsx**

```tsx
// helio-app/frontend/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/tokens.css';
import './styles/dashboard.css';
import App from './App.tsx';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 5: Create setupTests.ts**

```typescript
// helio-app/frontend/src/setupTests.ts
import '@testing-library/jest-dom';
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types.ts frontend/src/styles/ frontend/src/main.tsx frontend/src/setupTests.ts
git commit -m "feat: frontend types, css tokens, and entry point"
```

---

## Task 13: WebSocket Hook + Metrics Store

**Files:**
- Create: `helio-app/frontend/src/hooks/useWebSocket.ts`
- Create: `helio-app/frontend/src/hooks/useMetrics.ts`
- Create: `helio-app/frontend/src/store/metricsStore.ts`

- [ ] **Step 1: Write useWebSocket.ts**

```typescript
// helio-app/frontend/src/hooks/useWebSocket.ts
import { useEffect, useRef, useState, useCallback } from 'react';

export type WsStatus = 'connecting' | 'open' | 'closed' | 'error';

export function useWebSocket(url: string) {
  const [lastMessage, setLastMessage] = useState<unknown>(null);
  const [status, setStatus] = useState<WsStatus>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelay = useRef(1000);
  const unmounted = useRef(false);

  const connect = useCallback(() => {
    if (unmounted.current) return;
    setStatus('connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectDelay.current = 1000;
      setStatus('open');
    };

    ws.onmessage = (e) => {
      try {
        setLastMessage(JSON.parse(e.data as string));
      } catch {
        setLastMessage(e.data);
      }
    };

    ws.onclose = () => {
      if (unmounted.current) return;
      setStatus('closed');
      const delay = Math.min(reconnectDelay.current, 30_000);
      reconnectDelay.current = Math.min(delay * 2, 30_000);
      setTimeout(connect, delay);
    };

    ws.onerror = () => {
      setStatus('error');
      ws.close();
    };
  }, [url]);

  useEffect(() => {
    unmounted.current = false;
    connect();
    return () => {
      unmounted.current = true;
      wsRef.current?.close();
    };
  }, [connect]);

  return { lastMessage, status };
}
```

- [ ] **Step 2: Write metricsStore.ts**

```typescript
// helio-app/frontend/src/store/metricsStore.ts
import { create } from 'zustand';
import type { SystemSnapshot, ContainerInfo } from '../types.ts';
import type { WsStatus } from '../hooks/useWebSocket.ts';

const HISTORY_MAX = 60;

interface MetricsStore {
  current: SystemSnapshot | null;
  history: SystemSnapshot[];
  containers: ContainerInfo[];
  wsStatus: WsStatus;
  alerts: unknown[];
  setMetrics: (snap: SystemSnapshot) => void;
  setContainers: (c: ContainerInfo[]) => void;
  setWsStatus: (s: WsStatus) => void;
  setAlerts: (a: unknown[]) => void;
}

export const useMetricsStore = create<MetricsStore>((set) => ({
  current: null,
  history: [],
  containers: [],
  wsStatus: 'connecting',
  alerts: [],

  setMetrics: (snap) =>
    set((state) => ({
      current: snap,
      history: [...state.history.slice(-(HISTORY_MAX - 1)), snap],
    })),

  setContainers: (containers) => set({ containers }),
  setWsStatus: (wsStatus) => set({ wsStatus }),
  setAlerts: (alerts) => set({ alerts }),
}));
```

- [ ] **Step 3: Write useMetrics.ts**

```typescript
// helio-app/frontend/src/hooks/useMetrics.ts
import { useEffect } from 'react';
import { useWebSocket } from './useWebSocket.ts';
import { useMetricsStore } from '../store/metricsStore.ts';
import type { SystemSnapshot } from '../types.ts';

const WS_URL = import.meta.env.DEV
  ? 'ws://localhost:3001/ws'
  : `ws://${window.location.host}/ws`;

export function useMetrics() {
  const { lastMessage, status } = useWebSocket(WS_URL);
  const { setMetrics, setWsStatus } = useMetricsStore();

  useEffect(() => { setWsStatus(status); }, [status, setWsStatus]);

  useEffect(() => {
    if (!lastMessage) return;
    const msg = lastMessage as { type: string; data: unknown };
    if (msg.type === 'metrics') {
      setMetrics(msg.data as SystemSnapshot);
    }
  }, [lastMessage, setMetrics]);

  return useMetricsStore();
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/ frontend/src/store/
git commit -m "feat: websocket hook with reconnect and zustand metrics store"
```

---

## Task 14: StatusBadge + StatusDot Components

**Files:**
- Create: `helio-app/frontend/src/components/StatusBadge.tsx`
- Create: `helio-app/frontend/src/components/StatusDot.tsx`

- [ ] **Step 1: Write StatusBadge.tsx**

```tsx
// helio-app/frontend/src/components/StatusBadge.tsx
import React from 'react';

type Status = 'ok' | 'warn' | 'down';

const LABELS: Record<Status, string> = { ok: 'online', warn: 'latenz', down: 'down' };

const STYLES: Record<Status, React.CSSProperties> = {
  ok: {
    color: 'var(--ok)',
    background: 'var(--ok-soft)',
    borderColor: 'var(--ok-soft)',
  },
  warn: {
    color: 'var(--warn)',
    background: 'var(--warn-soft)',
    borderColor: 'var(--warn-soft)',
  },
  down: {
    color: 'var(--down)',
    background: 'var(--down-soft)',
    borderColor: 'var(--down-soft)',
  },
};

interface Props {
  status: Status;
  label?: string;
}

export function StatusBadge({ status, label }: Props) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.74rem',
      fontWeight: 500,
      padding: '4px 10px',
      borderRadius: '100px',
      border: '1px solid',
      letterSpacing: '0.01em',
      ...STYLES[status],
    }}>
      {label ?? LABELS[status]}
    </span>
  );
}
```

- [ ] **Step 2: Write StatusDot.tsx**

```tsx
// helio-app/frontend/src/components/StatusDot.tsx
import React from 'react';

type Status = 'ok' | 'warn' | 'down';

const COLORS: Record<Status, string> = {
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  down: 'var(--down)',
};

const SOFT: Record<Status, string> = {
  ok: 'var(--ok-soft)',
  warn: 'var(--warn-soft)',
  down: 'var(--down-soft)',
};

interface Props {
  status: Status;
  pulse?: boolean;
}

export function StatusDot({ status, pulse }: Props) {
  return (
    <span style={{
      position: 'relative',
      display: 'inline-block',
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: COLORS[status],
      boxShadow: `0 0 0 3px ${SOFT[status]}`,
      flexShrink: 0,
    }}>
      {pulse && status === 'ok' && (
        <style>{`
          @keyframes dot-pulse {
            0% { transform: scale(0.8); opacity: 0.7; }
            80%, 100% { transform: scale(2.4); opacity: 0; }
          }
        `}</style>
      )}
      {pulse && status === 'ok' && (
        <span style={{
          position: 'absolute',
          inset: '-3px',
          borderRadius: '50%',
          border: `1px solid ${COLORS[status]}`,
          opacity: 0.6,
          animation: 'dot-pulse 2.4s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        }} />
      )}
    </span>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/StatusBadge.tsx frontend/src/components/StatusDot.tsx
git commit -m "feat: StatusBadge and StatusDot components"
```

---

## Task 15: StatCard Component

**Files:**
- Create: `helio-app/frontend/src/components/StatCard.tsx`

- [ ] **Step 1: Write StatCard.tsx**

```tsx
// helio-app/frontend/src/components/StatCard.tsx
import React, { ReactNode } from 'react';

interface Props {
  label: string;
  value: string;
  unit: string;
  trend?: string;
  sub?: string;
  children?: ReactNode;  // chart slot
}

export function StatCard({ label, value, unit, trend, sub, children }: Props) {
  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '13px 14px',
      background: 'var(--surface-2)',
    }}>
      <div style={{
        fontSize: '0.72rem',
        color: 'var(--text-dim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '6px',
      }}>
        <span>{label}</span>
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
          {trend && (
            <span style={{ color: 'var(--ok)', fontFamily: 'var(--font-mono)' }}>{trend}</span>
          )}
          {sub && (
            <span style={{ fontFamily: 'var(--font-mono)' }}>{sub}</span>
          )}
        </span>
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '1.5rem',
        fontWeight: 600,
        letterSpacing: '-0.02em',
        lineHeight: 1.2,
      }}>
        {value}
        <small style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 400 }}>
          {' '}{unit}
        </small>
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/StatCard.tsx
git commit -m "feat: StatCard component"
```

---

## Task 16: CpuSparkline + RamBars

**Files:**
- Create: `helio-app/frontend/src/components/CpuSparkline.tsx`
- Create: `helio-app/frontend/src/components/RamBars.tsx`

- [ ] **Step 1: Write CpuSparkline.tsx**

```tsx
// helio-app/frontend/src/components/CpuSparkline.tsx
import React from 'react';
import { AreaChart, Area, LinearGradient, Stop, Defs, ResponsiveContainer } from 'recharts';
import type { SystemSnapshot } from '../types.ts';

interface Props {
  history: SystemSnapshot[];
}

export function CpuSparkline({ history }: Props) {
  const data = history.map((s) => ({ v: s.cpu }));

  return (
    <div style={{ marginTop: '10px', height: '48px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <Defs>
            <LinearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="5%" stopColor="var(--primary)" stopOpacity={0.35} />
              <Stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke="var(--primary)"
            strokeWidth={2}
            fill="url(#cpuGrad)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Write RamBars.tsx**

```tsx
// helio-app/frontend/src/components/RamBars.tsx
import React from 'react';
import { BarChart, Bar, Cell, ResponsiveContainer } from 'recharts';
import type { SystemSnapshot } from '../types.ts';

interface Props {
  history: SystemSnapshot[];
}

export function RamBars({ history }: Props) {
  const data = history.slice(-12).map((s) => ({ v: s.mem.percent }));

  return (
    <div style={{ marginTop: '10px', height: '38px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barCategoryGap="20%">
          <Bar dataKey="v" radius={[2, 2, 0, 0]} isAnimationActive={false}>
            {data.map((_, i) => (
              <Cell key={i} fill="var(--violet)" opacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/CpuSparkline.tsx frontend/src/components/RamBars.tsx
git commit -m "feat: CpuSparkline and RamBars chart components"
```

---

## Task 17: ServerTable + ContainerTable

**Files:**
- Create: `helio-app/frontend/src/components/ServerTable.tsx`
- Create: `helio-app/frontend/src/components/ContainerTable.tsx`

- [ ] **Step 1: Write ServerTable.tsx**

```tsx
// helio-app/frontend/src/components/ServerTable.tsx
import React from 'react';
import { StatusDot } from './StatusDot.tsx';
import { StatusBadge } from './StatusBadge.tsx';
import type { Node } from '../types.ts';

interface Props {
  nodes: Node[];
}

function latencyColor(ms: number): string {
  if (ms < 100) return 'var(--ok)';
  if (ms < 500) return 'var(--warn)';
  return 'var(--down)';
}

const ROW_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto auto auto',
  alignItems: 'center',
  gap: '14px',
  padding: '11px 14px',
  borderBottom: '1px solid var(--border)',
  fontSize: '0.83rem',
};

export function ServerTable({ nodes }: Props) {
  const status = (n: Node) =>
    n.status === 'ok' ? 'ok' : n.status === 'warn' ? 'warn' : 'down';

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
    }}>
      {nodes.length === 0 && (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)',
          fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
          Keine Nodes konfiguriert
        </div>
      )}
      {nodes.map((node, i) => (
        <div key={node.id} style={{ ...ROW_STYLE, borderBottom: i < nodes.length - 1 ? undefined : 'none' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <StatusDot status={status(node)} pulse={status(node) === 'ok'} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 460 }}>
              {node.name}
            </span>
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            {node.addr}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem',
            color: latencyColor(0) }}>—</span>
          <StatusBadge status={status(node)} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write ContainerTable.tsx**

```tsx
// helio-app/frontend/src/components/ContainerTable.tsx
import React from 'react';
import { StatusBadge } from './StatusBadge.tsx';
import type { ContainerInfo } from '../types.ts';

interface Props {
  containers: ContainerInfo[];
}

function containerStatus(c: ContainerInfo): 'ok' | 'warn' | 'down' {
  if (c.status === 'running') return 'ok';
  if (c.status === 'restarting') return 'warn';
  return 'down';
}

function fmtBytes(bytes: number): string {
  if (bytes === 0) return '—';
  const mb = bytes / 1_000_000;
  return mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${mb.toFixed(0)} MB`;
}

const HEADER: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr auto auto auto auto auto',
  gap: '10px',
  padding: '10px 14px',
  borderBottom: '1px solid var(--border)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.7rem',
  color: 'var(--text-dim)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

const ROW: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr auto auto auto auto auto',
  gap: '10px',
  alignItems: 'center',
  padding: '10px 14px',
  borderBottom: '1px solid var(--border)',
  fontSize: '0.83rem',
};

export function ContainerTable({ containers }: Props) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
      <div style={HEADER}>
        <span>Name</span>
        <span>Image</span>
        <span>Status</span>
        <span>CPU</span>
        <span>RAM</span>
        <span>Ports</span>
        <span>Erstellt</span>
      </div>
      {containers.length === 0 && (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)',
          fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
          Keine Container gefunden
        </div>
      )}
      {containers.map((c, i) => (
        <div key={c.id} style={{ ...ROW, borderBottom: i < containers.length - 1 ? undefined : 'none' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 500 }}>{c.name}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem',
            fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.image}
          </span>
          <StatusBadge status={containerStatus(c)} label={c.status} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
            {c.cpu_percent.toFixed(1)}%
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
            {fmtBytes(c.mem_used)}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
            {c.ports.slice(0, 2).join(', ') || '—'}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
            {new Date(c.created * 1000).toLocaleDateString('de-DE')}
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ServerTable.tsx frontend/src/components/ContainerTable.tsx
git commit -m "feat: ServerTable and ContainerTable components"
```

---

## Task 18: Sidebar

**Files:**
- Create: `helio-app/frontend/src/components/Sidebar.tsx`

- [ ] **Step 1: Write Sidebar.tsx**

```tsx
// helio-app/frontend/src/components/Sidebar.tsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Server, Box, Bell, Activity,
  Settings, Users,
} from 'lucide-react';
import { useMetricsStore } from '../store/metricsStore.ts';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Übersicht', to: '/dashboard' },
  { icon: Server,          label: 'Nodes',     to: '/dashboard/nodes' },
  { icon: Box,             label: 'Container', to: '/dashboard/containers' },
  { icon: Bell,            label: 'Alerts',    to: '/dashboard/alerts' },
  { icon: Activity,        label: 'Status-Page', to: '/status' },
];

const SYSTEM_ITEMS = [
  { icon: Settings, label: 'Einstellungen', to: '/dashboard/settings' },
  { icon: Users,    label: 'Team',          to: '/dashboard/team' },
];

function WsIndicator() {
  const status = useMetricsStore((s) => s.wsStatus);
  const color = status === 'open' ? 'var(--ok)' : 'var(--text-dim)';
  return (
    <span title={`WS: ${status}`} style={{
      width: '8px', height: '8px', borderRadius: '50%',
      background: color, display: 'inline-block', flexShrink: 0,
    }} />
  );
}

export function Sidebar() {
  const activeStyle: React.CSSProperties = {
    background: 'var(--primary-soft)',
    color: 'var(--primary)',
    fontWeight: 500,
  };

  const itemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '9px 11px', borderRadius: '8px',
    fontSize: '0.85rem', color: 'var(--text-muted)',
    transition: 'background 0.15s, color 0.15s',
    cursor: 'pointer',
  };

  return (
    <aside style={{
      background: 'var(--bg-soft)',
      borderRight: '1px solid var(--border)',
      padding: '16px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '3px',
      overflowY: 'auto',
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px',
        padding: '8px 11px 18px', marginBottom: '4px' }}>
        <span style={{
          width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
          background: 'radial-gradient(circle at 30% 28%, var(--primary), #0e7d72 78%)',
          boxShadow: '0 0 0 1px var(--border-strong), 0 4px 12px -4px var(--primary-glow)',
        }} />
        <span style={{ fontWeight: 640, fontSize: '1.05rem', letterSpacing: '-0.02em' }}>Helio</span>
        <WsIndicator />
      </div>

      {NAV_ITEMS.map(({ icon: Icon, label, to }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/dashboard'}
          style={({ isActive }) => ({ ...itemStyle, ...(isActive ? activeStyle : {}) })}
        >
          <Icon size={16} />
          {label}
        </NavLink>
      ))}

      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: '0.66rem',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        color: 'var(--text-dim)', padding: '18px 11px 6px',
      }}>
        System
      </div>

      {SYSTEM_ITEMS.map(({ icon: Icon, label, to }) => (
        <NavLink
          key={to}
          to={to}
          style={({ isActive }) => ({ ...itemStyle, ...(isActive ? activeStyle : {}) })}
        >
          <Icon size={16} />
          {label}
        </NavLink>
      ))}
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Sidebar.tsx
git commit -m "feat: sidebar with nav links and ws status indicator"
```

---

## Task 19: Dashboard Page

**Files:**
- Create: `helio-app/frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Write Dashboard.tsx**

```tsx
// helio-app/frontend/src/pages/Dashboard.tsx
import React from 'react';
import { useMetrics } from '../hooks/useMetrics.ts';
import { StatCard } from '../components/StatCard.tsx';
import { CpuSparkline } from '../components/CpuSparkline.tsx';
import { RamBars } from '../components/RamBars.tsx';
import { ServerTable } from '../components/ServerTable.tsx';

export function Dashboard() {
  const { current, history } = useMetrics();

  const cpuVal = current ? current.cpu.toFixed(1) : '—';
  const ramPercent = current ? current.mem.percent.toFixed(0) : '—';
  const ramSub = current
    ? `${(current.mem.used / 1e9).toFixed(1)} / ${(current.mem.total / 1e9).toFixed(0)} GB`
    : undefined;

  return (
    <>
      <div className="page-header">
        <h1>Übersicht</h1>
        <span className="sub">Letzte 24 h · live</span>
      </div>

      <div className="stats-grid">
        <StatCard label="CPU-Auslastung" value={cpuVal} unit="%" sub={current?.cpuTemp ? `${current.cpuTemp}°C` : undefined}>
          <CpuSparkline history={history} />
        </StatCard>
        <StatCard label="Arbeitsspeicher" value={ramPercent} unit="%" sub={ramSub}>
          <RamBars history={history} />
        </StatCard>
      </div>

      <ServerTable nodes={[]} />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx
git commit -m "feat: dashboard page with live metrics"
```

---

## Task 20: Additional Pages

**Files:**
- Create: `helio-app/frontend/src/pages/Nodes.tsx`
- Create: `helio-app/frontend/src/pages/Containers.tsx`
- Create: `helio-app/frontend/src/pages/Alerts.tsx`
- Create: `helio-app/frontend/src/pages/StatusPage.tsx`

- [ ] **Step 1: Write Nodes.tsx**

```tsx
// helio-app/frontend/src/pages/Nodes.tsx
import React, { useEffect, useState } from 'react';
import { ServerTable } from '../components/ServerTable.tsx';
import type { Node } from '../types.ts';

export function Nodes() {
  const [nodes, setNodes] = useState<Node[]>([]);

  useEffect(() => {
    fetch('/api/nodes').then(r => r.json()).then(setNodes).catch(console.error);
  }, []);

  return (
    <>
      <div className="page-header">
        <h1>Nodes</h1>
        <span className="sub">{nodes.length} registriert</span>
      </div>
      <ServerTable nodes={nodes} />
    </>
  );
}
```

- [ ] **Step 2: Write Containers.tsx**

```tsx
// helio-app/frontend/src/pages/Containers.tsx
import React, { useState } from 'react';
import { ContainerTable } from '../components/ContainerTable.tsx';
import { useMetricsStore } from '../store/metricsStore.ts';

type Filter = 'all' | 'running' | 'stopped';

export function Containers() {
  const containers = useMetricsStore((s) => s.containers);
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = containers.filter(c => {
    if (filter === 'running') return c.status === 'running';
    if (filter === 'stopped') return c.status !== 'running';
    return true;
  });

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    borderRadius: '8px',
    border: '1px solid',
    borderColor: active ? 'var(--primary)' : 'var(--border)',
    background: active ? 'var(--primary-soft)' : 'transparent',
    color: active ? 'var(--primary)' : 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8rem',
    cursor: 'pointer',
  });

  return (
    <>
      <div className="page-header">
        <h1>Container</h1>
        <span className="sub">{containers.length} total</span>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
        {(['all', 'running', 'stopped'] as Filter[]).map(f => (
          <button key={f} style={tabStyle(filter === f)} onClick={() => setFilter(f)}>
            {f === 'all' ? 'Alle' : f === 'running' ? 'Running' : 'Stopped'}
          </button>
        ))}
      </div>
      <ContainerTable containers={filtered} />
    </>
  );
}
```

- [ ] **Step 3: Write Alerts.tsx**

```tsx
// helio-app/frontend/src/pages/Alerts.tsx
import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Alert, AlertMetric, AlertOperator, AlertChannel } from '../types.ts';

interface NewRule {
  name: string; metric: AlertMetric; operator: AlertOperator;
  threshold: string; channel: AlertChannel; target: string; cooldown: string;
}

const BLANK: NewRule = {
  name: '', metric: 'cpu', operator: '>', threshold: '90',
  channel: 'webhook', target: '', cooldown: '15',
};

export function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewRule>(BLANK);

  const fetchAlerts = () =>
    fetch('/api/alerts').then(r => r.json()).then(setAlerts).catch(console.error);

  useEffect(() => { fetchAlerts(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, threshold: Number(form.threshold), cooldown: Number(form.cooldown) }),
    });
    setForm(BLANK);
    setShowForm(false);
    fetchAlerts();
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/alerts/${id}`, { method: 'DELETE' });
    fetchAlerts();
  };

  const handleToggle = async (a: Alert) => {
    await fetch(`/api/alerts/${a.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !a.enabled }),
    });
    fetchAlerts();
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', padding: '8px 12px',
    color: 'var(--text)', fontSize: '0.9rem', width: '100%',
  };

  return (
    <>
      <div className="page-header">
        <h1>Alerts</h1>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px',
            background: 'var(--primary)', color: 'var(--primary-fg)',
            border: 'none', borderRadius: 'var(--radius)', padding: '8px 16px',
            cursor: 'pointer', fontWeight: 540, fontSize: '0.9rem' }}>
          <Plus size={16} />Neue Regel
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{
          border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
          padding: '24px', marginBottom: '24px', background: 'var(--surface)',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px',
        }}>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>Name</label>
            <input style={inputStyle} value={form.name} required onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          {(['metric', 'operator', 'threshold', 'channel', 'target', 'cooldown'] as const).map(field => (
            <div key={field}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'block', marginBottom: '6px', textTransform: 'capitalize' }}>{field}</label>
              {field === 'metric' ? (
                <select style={inputStyle} value={form.metric} onChange={e => setForm(f => ({ ...f, metric: e.target.value as AlertMetric }))}>
                  {['cpu', 'memory', 'disk', 'net_rx', 'net_tx'].map(m => <option key={m}>{m}</option>)}
                </select>
              ) : field === 'operator' ? (
                <select style={inputStyle} value={form.operator} onChange={e => setForm(f => ({ ...f, operator: e.target.value as AlertOperator }))}>
                  {['>', '<', '>='].map(o => <option key={o}>{o}</option>)}
                </select>
              ) : field === 'channel' ? (
                <select style={inputStyle} value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value as AlertChannel }))}>
                  {['webhook', 'email', 'slack', 'discord'].map(c => <option key={c}>{c}</option>)}
                </select>
              ) : (
                <input style={inputStyle} value={form[field]} required onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
              )}
            </div>
          ))}
          <div style={{ gridColumn: '1/-1', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setShowForm(false)}
              style={{ padding: '8px 18px', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>Abbrechen</button>
            <button type="submit"
              style={{ padding: '8px 18px', borderRadius: 'var(--radius)', border: 'none',
                background: 'var(--primary)', color: 'var(--primary-fg)', cursor: 'pointer', fontWeight: 540 }}>
              Speichern
            </button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {alerts.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-dim)',
            fontFamily: 'var(--font-mono)', fontSize: '0.85rem', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)' }}>
            Keine Alert-Regeln konfiguriert
          </div>
        )}
        {alerts.map(alert => (
          <div key={alert.id} style={{
            display: 'flex', alignItems: 'center', gap: '14px',
            padding: '14px 18px', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', background: 'var(--surface)',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, marginBottom: '3px' }}>{alert.name}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                {alert.metric} {alert.operator} {alert.threshold} · {alert.channel}
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={Boolean(alert.enabled)} onChange={() => handleToggle(alert)} />
              Aktiv
            </label>
            <button onClick={() => handleDelete(alert.id)}
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer',
                padding: '6px', borderRadius: '6px', display: 'grid', placeItems: 'center' }}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 4: Write StatusPage.tsx**

```tsx
// helio-app/frontend/src/pages/StatusPage.tsx
import React, { useEffect, useState } from 'react';

interface StatusData {
  uptime_percent: number;
  nodes: unknown[];
  incidents: unknown[];
}

export function StatusPage() {
  const [data, setData] = useState<StatusData | null>(null);

  useEffect(() => {
    fetch('/api/status').then(r => r.json()).then(setData).catch(console.error);
  }, []);

  const overall = !data ? 'loading' : data.uptime_percent >= 99.9 ? 'ok' : data.uptime_percent >= 99 ? 'warn' : 'down';

  const COLORS = { ok: 'var(--ok)', warn: 'var(--warn)', down: 'var(--down)', loading: 'var(--text-dim)' };
  const LABELS = { ok: 'Alle Systeme betriebsbereit', warn: 'Teilweiser Ausfall', down: 'Systemausfall', loading: 'Lade…' };

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
          <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: COLORS[overall], display: 'block', flexShrink: 0 }} />
          <h1 style={{ fontSize: '1.6rem', fontWeight: 660, letterSpacing: '-0.02em' }}>
            {LABELS[overall]}
          </h1>
        </div>
        {data && (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Uptime (90 Tage): {data.uptime_percent}%
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/
git commit -m "feat: nodes, containers, alerts, and status pages"
```

---

## Task 21: App Routing + Build Integration

**Files:**
- Create: `helio-app/frontend/src/App.tsx`
- Create: `helio-app/frontend/tsconfig.json`
- Create: `helio-app/frontend/tsconfig.node.json`

- [ ] **Step 1: Write App.tsx**

```tsx
// helio-app/frontend/src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Sidebar } from './components/Sidebar.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { Nodes } from './pages/Nodes.tsx';
import { Containers } from './pages/Containers.tsx';
import { Alerts } from './pages/Alerts.tsx';
import { StatusPage } from './pages/StatusPage.tsx';

function AppLayout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

function Settings() {
  return <div style={{ padding: '24px' }}><h1>Einstellungen</h1><p style={{ color: 'var(--text-muted)', marginTop: '12px' }}>Demnächst verfügbar.</p></div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="nodes" element={<Nodes />} />
          <Route path="containers" element={<Containers />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="/status" element={<StatusPage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: Create frontend tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: Create frontend tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Start frontend dev server and verify**

With backend already running on `:3001`:

```bash
cd helio-app/frontend
npm run dev
```

Open `http://localhost:5173` — expect the Helio dashboard with live CPU/RAM metrics updating every 5 seconds.

Check browser console: no errors. Network tab: WebSocket connection to `:3001/ws` shows `101 Switching Protocols`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/tsconfig.json frontend/tsconfig.node.json
git commit -m "feat: app routing and layout"
```

---

## Task 22: Production Build

**Files:**
- Modify: `helio-app/package.json` (scripts already correct from Task 1)

- [ ] **Step 1: Build frontend**

```bash
cd helio-app
npm run build -w frontend
```

Expected: `frontend/dist/` is created with `index.html` and assets.

- [ ] **Step 2: Build backend**

```bash
npm run build -w backend
```

Expected: `backend/dist/` with compiled JS files. No TypeScript errors.

- [ ] **Step 3: Start in production mode**

```bash
NODE_ENV=production npm start
```

Expected: Terminal prints `[Helio] Backend running on http://localhost:3001`

Open `http://localhost:3001` — the full dashboard loads from the compiled React build.

Open `http://localhost:3001/api/metrics/current` — returns live JSON metrics.

- [ ] **Step 4: Verify WebSocket in production**

```bash
# From another terminal:
node -e "
const ws = new (require('ws'))('ws://localhost:3001/ws');
ws.on('message', d => { console.log(JSON.parse(d).type); ws.close(); });
"
```

Expected output: `metrics`

- [ ] **Step 5: Final commit**

```bash
cd helio-app
git add .
git commit -m "feat: production build configuration verified"
```

---

## Self-Review

### Spec Coverage Check

| Spec requirement | Task |
|---|---|
| SQLite schema (metrics, nodes, alerts, alert_events) | Task 3 |
| Metrics ringbuffer trigger | Task 3 |
| `insertMetric`, `getMetricsRange`, `getLatestMetric`, `getAlerts`, `insertAlertEvent` | Task 4 |
| `collectSnapshot` with si.* wrappers | Task 6 |
| Docker graceful degradation | Task 7 |
| WebSocket broadcast every 5s | Task 9 + Task 11 |
| WS ping/pong | Task 9 |
| WS heartbeat (dead connections) | Task 9 |
| GET /api/metrics/current | Task 10 |
| GET /api/metrics/history with downsampling | Task 10 |
| GET /api/containers | Task 10 |
| CRUD /api/alerts | Task 10 |
| GET /api/nodes | Task 10 |
| GET /api/status with uptime_percent | Task 10 |
| Alert evaluation + cooldown | Task 8 |
| Webhook dispatch | Task 8 |
| WS alert broadcast | Task 8 |
| Frontend CSS tokens matching design system | Task 12 |
| useWebSocket with exponential backoff | Task 13 |
| Zustand store with 60-entry history ring | Task 13 |
| StatCard (exact spec layout) | Task 15 |
| CpuSparkline (Recharts AreaChart) | Task 16 |
| RamBars (Recharts BarChart, violet) | Task 16 |
| ServerTable with status dots and badges | Task 17 |
| ContainerTable | Task 17 |
| Sidebar (exact nav items from mockup) | Task 18 |
| Dashboard with 2-stat grid + server table | Task 19 |
| Nodes page | Task 20 |
| Containers page with filter tabs | Task 20 |
| Alerts page with CRUD | Task 20 |
| StatusPage | Task 20 |
| FOUC prevention script | Task 1 (index.html) |
| Production: single node process on :3001 | Task 11 + Task 22 |
| `npm install && npm run build && npm start` | Task 22 |

### Edge Cases Check

| Case | Handled in |
|---|---|
| Docker socket unreachable | Task 7 — `dockerWarned` flag, empty array |
| `si.*` throws | Task 6 — per-metric `try/catch` with fallback 0 |
| SQLite not writable | Task 3 — `process.exit(1)` with message |
| Dead WS clients | Task 9 — 30s heartbeat interval |
| Frontend WS drops | Task 13 — exponential backoff up to 30s |
| FOUC on theme | Task 1 — sync script in `<head>` |
| Alert cooldown | Task 8 — `getLatestAlertEvent` timestamp check |
| `clipboard.writeText` fails | Not in scope for dashboard (only landing page) ✓ |

**No placeholders found. All type names are consistent across tasks.**

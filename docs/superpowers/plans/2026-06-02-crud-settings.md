# Helio — Nodes CRUD, Settings, Dashboard & Status Config

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full Nodes CRUD (plus-icon modal), a real Settings page, dashboard card toggles, and configurable status page title/subtitle — all persisted in SQLite.

**Architecture:** A new `settings` table (key TEXT PK, value TEXT) powers a `GET/PUT /api/settings` endpoint. The Nodes route gains POST/PUT/DELETE. Frontend pages (Nodes, Settings, Dashboard, StatusPage) consume settings via a shared `useSettings` hook. No new dependencies required.

**Tech Stack:** Node 20 · Express 4 · better-sqlite3 · React 18 · TypeScript · Zustand · crypto (Node built-in for UUID/token)

---

## File Map

| File | Change |
|------|--------|
| `backend/src/db/connection.ts` | Add `settings` table to schema |
| `backend/src/db/queries.ts` | Add `getSetting`, `setSetting`, `getSettings` helpers |
| `backend/src/types.ts` | Add `AppSettings` interface |
| `backend/src/routes/settings.ts` | **Create** – GET / PUT /api/settings |
| `backend/src/routes/nodes.ts` | Add POST, PUT /:id, DELETE /:id |
| `backend/src/index.ts` | Register `/api/settings` router |
| `frontend/src/types.ts` | Add `AppSettings` interface |
| `frontend/src/hooks/useSettings.ts` | **Create** – fetch + cache settings |
| `frontend/src/pages/Nodes.tsx` | Plus button → AddNodeModal; edit/delete per row |
| `frontend/src/pages/Settings.tsx` | **Replace stub** – full settings form |
| `frontend/src/pages/Dashboard.tsx` | Conditionally render cards based on settings |
| `frontend/src/pages/StatusPage.tsx` | Use configured title/subtitle |
| `frontend/src/App.tsx` | Import real Settings page |

---

### Task 1: Backend – settings table + queries

**Files:**
- Modify: `helio-app/backend/src/db/connection.ts`
- Modify: `helio-app/backend/src/db/queries.ts`
- Modify: `helio-app/backend/src/types.ts`
- Modify: `helio-app/frontend/src/types.ts`

- [ ] **Step 1: Add `settings` table to schema** in `backend/src/db/connection.ts` inside `applySchema()`, after the `alert_events` block:

```typescript
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT OR IGNORE INTO settings (key, value) VALUES
      ('app_title',            'Helio'),
      ('status_title',         'System Status'),
      ('status_subtitle',      'Echtzeit-Überwachung aller Systeme'),
      ('status_show_uptime',   'true'),
      ('dashboard_show_cpu',   'true'),
      ('dashboard_show_ram',   'true'),
      ('dashboard_show_nodes', 'true');
```

The full `applySchema` call becomes:

```typescript
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

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT OR IGNORE INTO settings (key, value) VALUES
      ('app_title',            'Helio'),
      ('status_title',         'System Status'),
      ('status_subtitle',      'Echtzeit-Überwachung aller Systeme'),
      ('status_show_uptime',   'true'),
      ('dashboard_show_cpu',   'true'),
      ('dashboard_show_ram',   'true'),
      ('dashboard_show_nodes', 'true');
  `);
}
```

- [ ] **Step 2: Add settings queries** to `backend/src/db/queries.ts`. Add after the `stmtLatestEvent` statement and before the `return` block:

```typescript
  const stmtGetSettings = db.prepare<[], { key: string; value: string }>(
    'SELECT key, value FROM settings'
  );

  const stmtSetSetting = db.prepare<{ key: string; value: string }>(
    'INSERT INTO settings (key, value) VALUES (@key, @value) ON CONFLICT(key) DO UPDATE SET value = @value'
  );
```

And add to the returned object:

```typescript
    getSettings(): Record<string, string> {
      const rows = stmtGetSettings.all() as { key: string; value: string }[];
      return Object.fromEntries(rows.map(r => [r.key, r.value]));
    },

    setSetting(key: string, value: string): void {
      stmtSetSetting.run({ key, value });
    },
```

- [ ] **Step 3: Add `AppSettings` type** to `backend/src/types.ts` (append at end):

```typescript
export interface AppSettings {
  app_title: string;
  status_title: string;
  status_subtitle: string;
  status_show_uptime: string;   // 'true' | 'false'
  dashboard_show_cpu: string;
  dashboard_show_ram: string;
  dashboard_show_nodes: string;
}
```

- [ ] **Step 4: Add same `AppSettings` type** to `frontend/src/types.ts` (append at end):

```typescript
export interface AppSettings {
  app_title: string;
  status_title: string;
  status_subtitle: string;
  status_show_uptime: string;
  dashboard_show_cpu: string;
  dashboard_show_ram: string;
  dashboard_show_nodes: string;
}
```

- [ ] **Step 5: Commit**

```bash
cd helio-app
git add backend/src/db/connection.ts backend/src/db/queries.ts backend/src/types.ts frontend/src/types.ts
git commit -m "feat: add settings table, queries, and AppSettings type"
```

---

### Task 2: Backend – settings REST endpoint

**Files:**
- Create: `helio-app/backend/src/routes/settings.ts`
- Modify: `helio-app/backend/src/index.ts`

- [ ] **Step 1: Create `backend/src/routes/settings.ts`**:

```typescript
// helio-app/backend/src/routes/settings.ts
import { Router } from 'express';
import { queries } from '../db/index.js';

export const settingsRouter = Router();

settingsRouter.get('/', (_req, res) => {
  res.json(queries.getSettings());
});

settingsRouter.put('/', (req, res) => {
  const updates = req.body as Record<string, string>;
  const allowed = new Set([
    'app_title', 'status_title', 'status_subtitle',
    'status_show_uptime', 'dashboard_show_cpu',
    'dashboard_show_ram', 'dashboard_show_nodes',
  ]);
  for (const [key, value] of Object.entries(updates)) {
    if (allowed.has(key) && typeof value === 'string') {
      queries.setSetting(key, value);
    }
  }
  res.json(queries.getSettings());
});
```

- [ ] **Step 2: Register router** in `backend/src/index.ts`. Add import after the existing route imports:

```typescript
import { settingsRouter } from './routes/settings.js';
```

Add after `app.use('/api/status', statusRouter);`:

```typescript
app.use('/api/settings', settingsRouter);
```

- [ ] **Step 3: Verify manually**

Start dev server: `npm run dev` (from `helio-app/`)
Run: `curl http://localhost:3001/api/settings`
Expected JSON with 7 keys including `app_title: "Helio"`.

Run: `curl -X PUT http://localhost:3001/api/settings -H "Content-Type: application/json" -d '{"app_title":"MyHelio"}'`
Expected: returns full settings object with `app_title: "MyHelio"`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/settings.ts backend/src/index.ts
git commit -m "feat: add GET/PUT /api/settings endpoint"
```

---

### Task 3: Backend – Nodes CRUD (POST / PUT / DELETE)

**Files:**
- Modify: `helio-app/backend/src/routes/nodes.ts`

- [ ] **Step 1: Replace `backend/src/routes/nodes.ts`** with full CRUD:

```typescript
// helio-app/backend/src/routes/nodes.ts
import { Router } from 'express';
import { randomUUID, randomBytes } from 'crypto';
import { getDb } from '../db/index.js';
import type { Node } from '../types.js';

export const nodesRouter = Router();

nodesRouter.get('/', (_req, res) => {
  const db = getDb();
  const nodes = db.prepare('SELECT * FROM nodes').all() as Node[];
  res.json(nodes);
});

nodesRouter.post('/', (req, res) => {
  const { name, addr } = req.body as { name?: string; addr?: string };
  if (!name || !addr) {
    res.status(400).json({ error: 'name and addr are required' });
    return;
  }
  const id = randomUUID();
  const token = randomBytes(32).toString('hex');
  const db = getDb();
  db.prepare(
    'INSERT INTO nodes (id, name, addr, token, status) VALUES (?, ?, ?, ?, ?)'
  ).run(id, name.trim(), addr.trim(), token, 'unknown');
  const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(id) as Node;
  res.status(201).json(node);
});

nodesRouter.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, addr, status } = req.body as { name?: string; addr?: string; status?: string };
  const db = getDb();
  const existing = db.prepare('SELECT * FROM nodes WHERE id = ?').get(id) as Node | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Node not found' });
    return;
  }
  db.prepare(
    'UPDATE nodes SET name = ?, addr = ?, status = ? WHERE id = ?'
  ).run(
    name?.trim() ?? existing.name,
    addr?.trim() ?? existing.addr,
    status ?? existing.status,
    id
  );
  const updated = db.prepare('SELECT * FROM nodes WHERE id = ?').get(id) as Node;
  res.json(updated);
});

nodesRouter.delete('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const result = db.prepare('DELETE FROM nodes WHERE id = ?').run(id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Node not found' });
    return;
  }
  res.status(204).send();
});
```

- [ ] **Step 2: Verify manually**

Ensure dev server is running.
Create a node:
```bash
curl -X POST http://localhost:3001/api/nodes \
  -H "Content-Type: application/json" \
  -d '{"name":"Server 1","addr":"192.168.1.10:3001"}'
```
Expected: `201` with `{ id, name, addr, token, status: "unknown", last_seen: null }`.

List: `curl http://localhost:3001/api/nodes` → array with 1 node.

Delete: `curl -X DELETE http://localhost:3001/api/nodes/<id>` → `204`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/nodes.ts
git commit -m "feat: add POST/PUT/DELETE /api/nodes endpoints"
```

---

### Task 4: Frontend – useSettings hook

**Files:**
- Create: `helio-app/frontend/src/hooks/useSettings.ts`

- [ ] **Step 1: Create `frontend/src/hooks/useSettings.ts`**:

```typescript
// helio-app/frontend/src/hooks/useSettings.ts
import { useState, useEffect } from 'react';
import type { AppSettings } from '../types.ts';

const DEFAULTS: AppSettings = {
  app_title: 'Helio',
  status_title: 'System Status',
  status_subtitle: 'Echtzeit-Überwachung aller Systeme',
  status_show_uptime: 'true',
  dashboard_show_cpu: 'true',
  dashboard_show_ram: 'true',
  dashboard_show_nodes: 'true',
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((data: AppSettings) => setSettings({ ...DEFAULTS, ...data }))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const saveSettings = async (updates: Partial<AppSettings>): Promise<void> => {
    const updated = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).then(r => r.json()) as AppSettings;
    setSettings({ ...DEFAULTS, ...updated });
  };

  return { settings, loading, saveSettings };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useSettings.ts
git commit -m "feat: add useSettings hook"
```

---

### Task 5: Frontend – Nodes page with Add/Edit/Delete modal

**Files:**
- Modify: `helio-app/frontend/src/pages/Nodes.tsx`

- [ ] **Step 1: Replace `frontend/src/pages/Nodes.tsx`** with full CRUD UI:

```typescript
// helio-app/frontend/src/pages/Nodes.tsx
import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Copy, Check } from 'lucide-react';
import { ServerTable } from '../components/ServerTable.tsx';
import type { Node } from '../types.ts';

interface NodeForm {
  name: string;
  addr: string;
}

const BLANK: NodeForm = { name: '', addr: '' };

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '8px 12px',
  color: 'var(--text)',
  fontSize: '0.9rem',
  width: '100%',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--text-dim)',
  display: 'block',
  marginBottom: '6px',
};

function CopyToken({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(token).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = token;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ marginTop: '12px', padding: '12px', background: 'var(--surface-2)',
      borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '6px' }}>
        Auth-Token (einmalig sichtbar)
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem',
          color: 'var(--primary)', flex: 1, wordBreak: 'break-all' }}>
          {token}
        </code>
        <button onClick={copy} style={{ background: 'none', border: 'none',
          color: copied ? 'var(--ok)' : 'var(--text-dim)', cursor: 'pointer', padding: '4px' }}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={onClose}>
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '28px', width: '420px', maxWidth: '90vw' }}
        onClick={e => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 20px', fontSize: '1.1rem', fontWeight: 600 }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Nodes() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editNode, setEditNode] = useState<Node | null>(null);
  const [form, setForm] = useState<NodeForm>(BLANK);
  const [newToken, setNewToken] = useState<string | null>(null);

  const fetchNodes = () =>
    fetch('/api/nodes').then(r => r.json()).then(setNodes).catch(console.error);

  useEffect(() => { fetchNodes(); }, []);

  const openAdd = () => { setForm(BLANK); setNewToken(null); setShowAdd(true); };
  const openEdit = (node: Node) => { setEditNode(node); setForm({ name: node.name, addr: node.addr }); };
  const closeAll = () => { setShowAdd(false); setEditNode(null); setNewToken(null); };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const created: Node = await res.json();
    setNewToken(created.token);
    fetchNodes();
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editNode) return;
    await fetch(`/api/nodes/${editNode.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    closeAll();
    fetchNodes();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Node wirklich löschen?')) return;
    await fetch(`/api/nodes/${id}`, { method: 'DELETE' });
    fetchNodes();
  };

  const btnPrimary: React.CSSProperties = {
    padding: '8px 18px', borderRadius: 'var(--radius)', border: 'none',
    background: 'var(--primary)', color: 'var(--primary-fg)',
    cursor: 'pointer', fontWeight: 540, fontSize: '0.9rem',
  };
  const btnSecondary: React.CSSProperties = {
    padding: '8px 18px', borderRadius: 'var(--radius)',
    border: '1px solid var(--border)', background: 'transparent',
    color: 'var(--text)', cursor: 'pointer', fontSize: '0.9rem',
  };

  return (
    <>
      <div className="page-header">
        <h1>Nodes</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="sub">{nodes.length} registriert</span>
          <button onClick={openAdd} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 14px', borderRadius: 'var(--radius)', border: 'none',
            background: 'var(--primary)', color: 'var(--primary-fg)',
            fontWeight: 540, cursor: 'pointer', fontSize: '0.85rem',
          }}>
            <Plus size={14} /> Node hinzufügen
          </button>
        </div>
      </div>

      {/* Nodes list with edit/delete actions */}
      {nodes.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-dim)',
          fontFamily: 'var(--font-mono)', fontSize: '0.85rem',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          Keine Nodes registriert
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {nodes.map(node => (
            <div key={node.id} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '12px 16px', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', background: 'var(--surface)',
            }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                background: node.status === 'online' ? 'var(--ok)' : 'var(--text-dim)',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, marginBottom: '2px' }}>{node.name}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem',
                  color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {node.addr}
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                {node.status}
              </div>
              <button onClick={() => openEdit(node)}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)',
                  cursor: 'pointer', padding: '6px', borderRadius: '6px' }}>
                <Pencil size={15} />
              </button>
              <button onClick={() => handleDelete(node.id)}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)',
                  cursor: 'pointer', padding: '6px', borderRadius: '6px' }}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <Modal title="Node hinzufügen" onClose={closeAll}>
          {newToken ? (
            <>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '4px' }}>
                Node wurde erstellt. Kopiere den Token — er wird nur einmal angezeigt.
              </p>
              <CopyToken token={newToken} />
              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={closeAll} style={btnPrimary}>Fertig</button>
              </div>
            </>
          ) : (
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Name</label>
                <input style={inputStyle} placeholder="z.B. Prod Server 1" required
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Adresse</label>
                <input style={inputStyle} placeholder="z.B. 192.168.1.10:3001" required
                  value={form.addr} onChange={e => setForm(f => ({ ...f, addr: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button type="button" onClick={closeAll} style={btnSecondary}>Abbrechen</button>
                <button type="submit" style={btnPrimary}>Erstellen</button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* Edit modal */}
      {editNode && (
        <Modal title="Node bearbeiten" onClose={closeAll}>
          <form onSubmit={handleEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Name</label>
              <input style={inputStyle} required
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Adresse</label>
              <input style={inputStyle} required
                value={form.addr} onChange={e => setForm(f => ({ ...f, addr: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button type="button" onClick={closeAll} style={btnSecondary}>Abbrechen</button>
              <button type="submit" style={btnPrimary}>Speichern</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify** – navigate to `/dashboard/nodes`, click "Node hinzufügen", fill in name/address, submit. Token appears. Close, verify node in list. Click pencil, change name, save. Click trash, confirm, verify gone.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Nodes.tsx
git commit -m "feat: nodes page with add/edit/delete modal and token display"
```

---

### Task 6: Frontend – Settings page

**Files:**
- Modify: `helio-app/frontend/src/pages/Settings.tsx` (currently a stub in App.tsx — extract to own file)
- Modify: `helio-app/frontend/src/App.tsx`

- [ ] **Step 1: Create `frontend/src/pages/Settings.tsx`**:

```typescript
// helio-app/frontend/src/pages/Settings.tsx
import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { useSettings } from '../hooks/useSettings.ts';
import type { AppSettings } from '../types.ts';

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '8px 12px',
  color: 'var(--text)',
  fontSize: '0.9rem',
  width: '100%',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.82rem',
  color: 'var(--text-muted)',
  display: 'block',
  marginBottom: '6px',
  fontWeight: 500,
};

interface SectionProps { title: string; children: React.ReactNode; }

function Section({ title, children }: SectionProps) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
      padding: '24px', background: 'var(--surface)', marginBottom: '20px' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: '0.95rem', fontWeight: 600,
        color: 'var(--text)', letterSpacing: '-0.01em' }}>{title}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {children}
      </div>
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
      <div>
        <div style={{ fontSize: '0.9rem', fontWeight: 500, marginBottom: '2px' }}>{label}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{description}</div>
      </div>
      <label style={{ position: 'relative', width: '42px', height: '24px', flexShrink: 0, cursor: 'pointer' }}>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
          style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
        <span style={{
          position: 'absolute', inset: 0, borderRadius: '12px', transition: 'background 0.2s',
          background: checked ? 'var(--primary)' : 'var(--border-strong)',
        }} />
        <span style={{
          position: 'absolute', top: '3px', left: checked ? '21px' : '3px',
          width: '18px', height: '18px', borderRadius: '50%',
          background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </label>
    </div>
  );
}

export function Settings() {
  const { settings, loading, saveSettings } = useSettings();
  const [form, setForm] = useState<AppSettings>(settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setForm(settings); }, [settings]);

  if (loading) return <div style={{ padding: '24px', color: 'var(--text-dim)' }}>Lade…</div>;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const set = (key: keyof AppSettings) => (value: string) =>
    setForm(f => ({ ...f, [key]: value }));

  const setBool = (key: keyof AppSettings) => (value: boolean) =>
    setForm(f => ({ ...f, [key]: value ? 'true' : 'false' }));

  return (
    <>
      <div className="page-header">
        <h1>Einstellungen</h1>
      </div>
      <form onSubmit={handleSave} style={{ maxWidth: '600px' }}>
        <Section title="Allgemein">
          <div>
            <label style={labelStyle}>App-Titel</label>
            <input style={inputStyle} value={form.app_title}
              onChange={e => set('app_title')(e.target.value)} />
          </div>
        </Section>

        <Section title="Übersicht (Dashboard)">
          <ToggleRow
            label="CPU-Auslastung anzeigen"
            description="CPU-Karte mit Sparkline-Diagramm"
            checked={form.dashboard_show_cpu === 'true'}
            onChange={setBool('dashboard_show_cpu')}
          />
          <ToggleRow
            label="Arbeitsspeicher anzeigen"
            description="RAM-Karte mit Balkendiagramm"
            checked={form.dashboard_show_ram === 'true'}
            onChange={setBool('dashboard_show_ram')}
          />
          <ToggleRow
            label="Nodes-Tabelle anzeigen"
            description="Liste der registrierten Monitoring-Nodes"
            checked={form.dashboard_show_nodes === 'true'}
            onChange={setBool('dashboard_show_nodes')}
          />
        </Section>

        <Section title="Status-Page">
          <div>
            <label style={labelStyle}>Titel</label>
            <input style={inputStyle} value={form.status_title}
              onChange={e => set('status_title')(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Untertitel</label>
            <input style={inputStyle} value={form.status_subtitle}
              onChange={e => set('status_subtitle')(e.target.value)} />
          </div>
          <ToggleRow
            label="Uptime-Prozentsatz anzeigen"
            description="Zeigt den 90-Tage-Uptime-Wert auf der öffentlichen Statusseite"
            checked={form.status_show_uptime === 'true'}
            onChange={setBool('status_show_uptime')}
          />
        </Section>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '9px 20px', borderRadius: 'var(--radius)', border: 'none',
            background: saved ? 'var(--ok)' : 'var(--primary)',
            color: 'var(--primary-fg)', fontWeight: 540, cursor: 'pointer',
            fontSize: '0.9rem', transition: 'background 0.2s',
          }}>
            <Save size={15} />
            {saved ? 'Gespeichert ✓' : 'Speichern'}
          </button>
        </div>
      </form>
    </>
  );
}
```

- [ ] **Step 2: Update `frontend/src/App.tsx`** — replace inline `Settings` stub with import:

Remove the inline function:
```typescript
function Settings() {
  return <div style={{ padding: '24px' }}><h1>Einstellungen</h1><p style={{ color: 'var(--text-muted)', marginTop: '12px' }}>Demnächst verfügbar.</p></div>;
}
```

Add import at the top with the other page imports:
```typescript
import { Settings } from './pages/Settings.tsx';
```

Full updated `frontend/src/App.tsx`:

```typescript
// helio-app/frontend/src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Sidebar } from './components/Sidebar.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { Nodes } from './pages/Nodes.tsx';
import { Containers } from './pages/Containers.tsx';
import { Alerts } from './pages/Alerts.tsx';
import { StatusPage } from './pages/StatusPage.tsx';
import { Settings } from './pages/Settings.tsx';

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

- [ ] **Step 3: Verify** – navigate to `/dashboard/settings`. See three sections: Allgemein, Übersicht, Status-Page. Toggle a card off, click Speichern, see button flash green "Gespeichert ✓".

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Settings.tsx frontend/src/App.tsx
git commit -m "feat: real Settings page with app/dashboard/status-page config"
```

---

### Task 7: Frontend – Dashboard reads settings

**Files:**
- Modify: `helio-app/frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Replace `frontend/src/pages/Dashboard.tsx`**:

```typescript
// helio-app/frontend/src/pages/Dashboard.tsx
import React from 'react';
import { useMetrics } from '../hooks/useMetrics.ts';
import { useSettings } from '../hooks/useSettings.ts';
import { StatCard } from '../components/StatCard.tsx';
import { CpuSparkline } from '../components/CpuSparkline.tsx';
import { RamBars } from '../components/RamBars.tsx';
import { ServerTable } from '../components/ServerTable.tsx';

export function Dashboard() {
  const { current, history } = useMetrics();
  const { settings } = useSettings();

  const showCpu   = settings.dashboard_show_cpu   !== 'false';
  const showRam   = settings.dashboard_show_ram   !== 'false';
  const showNodes = settings.dashboard_show_nodes !== 'false';

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

      {(showCpu || showRam) && (
        <div className="stats-grid">
          {showCpu && (
            <StatCard label="CPU-Auslastung" value={cpuVal} unit="%" sub={current?.cpuTemp ? `${current.cpuTemp}°C` : undefined}>
              <CpuSparkline history={history} />
            </StatCard>
          )}
          {showRam && (
            <StatCard label="Arbeitsspeicher" value={ramPercent} unit="%" sub={ramSub}>
              <RamBars history={history} />
            </StatCard>
          )}
        </div>
      )}

      {showNodes && <ServerTable nodes={[]} />}
    </>
  );
}
```

- [ ] **Step 2: Verify** – go to Settings, toggle off CPU card, save. Go to Dashboard — CPU card gone, RAM still visible. Toggle it back on.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx
git commit -m "feat: dashboard respects show/hide settings for CPU/RAM/nodes cards"
```

---

### Task 8: Frontend – Status page reads settings

**Files:**
- Modify: `helio-app/frontend/src/pages/StatusPage.tsx`

- [ ] **Step 1: Replace `frontend/src/pages/StatusPage.tsx`**:

```typescript
// helio-app/frontend/src/pages/StatusPage.tsx
import React, { useEffect, useState } from 'react';
import { useSettings } from '../hooks/useSettings.ts';

interface StatusData {
  uptime_percent: number;
  nodes: unknown[];
  incidents: unknown[];
}

export function StatusPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const { settings, loading: settingsLoading } = useSettings();

  useEffect(() => {
    fetch('/api/status').then(r => r.json()).then(setData).catch(console.error);
  }, []);

  const overall = !data ? 'loading' : data.uptime_percent >= 99.9 ? 'ok' : data.uptime_percent >= 99 ? 'warn' : 'down';
  const COLORS = { ok: 'var(--ok)', warn: 'var(--warn)', down: 'var(--down)', loading: 'var(--text-dim)' };
  const STATUS_LABELS = { ok: 'Alle Systeme betriebsbereit', warn: 'Teilweiser Ausfall', down: 'Systemausfall', loading: 'Lade…' };

  if (settingsLoading) return null;

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: '8px' }}>
          {settings.status_title}
        </h1>
        {settings.status_subtitle && (
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginBottom: '24px' }}>
            {settings.status_subtitle}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
          <span style={{ width: '14px', height: '14px', borderRadius: '50%',
            background: COLORS[overall], display: 'block', flexShrink: 0 }} />
          <span style={{ fontSize: '1.1rem', fontWeight: 560 }}>
            {STATUS_LABELS[overall]}
          </span>
        </div>
        {data && settings.status_show_uptime === 'true' && (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Uptime (90 Tage): {data.uptime_percent}%
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify** – open `/status` page. Title shows "System Status", subtitle visible, uptime visible. Go to Settings, change status title to "Mein Status", save. Reload `/status` — title updated.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/StatusPage.tsx
git commit -m "feat: status page uses configurable title/subtitle/uptime-toggle from settings"
```

---

### Task 9: Build, test, push

**Files:** none (build artifact)

- [ ] **Step 1: Run full build** from `helio-app/`:

```bash
npm run build
```

Expected: `frontend/dist/` created, `backend/dist/` created, no TypeScript errors.

- [ ] **Step 2: Smoke-test production build**

```bash
npm start
```

Open `http://localhost:3001` — should load dashboard. Check `/dashboard/nodes`, `/dashboard/settings`, `/status`.

- [ ] **Step 3: Push to GitHub**

```bash
git push
```

- [ ] **Step 4: Update PM2 on server** (run on the Linux server):

```bash
cd /root/helio && git pull && npm install && npm run build
pm2 restart helio
```

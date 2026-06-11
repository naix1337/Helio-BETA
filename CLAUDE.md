# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

This repo contains two distinct projects:

| Path | What it is |
|------|-----------|
| `index.html` / `styles.css` / `app.js` | Static marketing landing page (German, dark-themed) |
| `helio-app/` | Full-stack monitoring application |
| `helio-app/backend/` | Node.js/Express/TypeScript API + WebSocket server |
| `helio-app/frontend/` | React 18 + Vite SPA |
| `design_extracted/` | Source design files — read-only reference |

## Development Commands

All commands must be run from the relevant subdirectory.

**Backend** (`helio-app/backend/`):
```
npm run dev      # tsx watch — hot-reloads TypeScript
npm run build    # tsc compile to dist/
npm start        # run compiled dist/index.js
npm test         # vitest run
```

**Frontend** (`helio-app/frontend/`):
```
npm run dev      # Vite dev server (proxies WS to localhost:3001)
npm run build    # tsc + vite build → dist/
npm test         # vitest run
```

**Env vars** (backend):
- `PORT` — default `3001`
- `HELIO_DB_PATH` — default `./helio.db`
- `NODE_ENV=production` — serves `frontend/dist/` and locks CORS

## Architecture

### Backend data flow

Every 5 seconds:
1. `collectSnapshot()` (systeminformation) + `collectContainers()` (dockerode)
2. `queries.insertMetric(snap)` → SQLite
3. `wsBroadcast({ type: 'metrics', data: snap })` → all connected clients
4. `evaluateAlerts(snap)` → fires webhook/Slack/Discord POSTs + broadcasts `type: 'alert'`

### Database

SQLite with WAL mode (`better-sqlite3`). Schema is applied idempotently at startup via `getDb()` in `db/connection.ts`. A trigger keeps the `metrics` table capped at **17,280 rows** (24 h at 5 s cadence). Tables: `metrics`, `nodes`, `alerts`, `alert_events`, `settings`.

### Frontend state

`useWebSocket` (reconnects with exponential backoff) → `useMetrics` hook → **Zustand** `metricsStore`. Pages read from the store; they don't fetch REST on their own for live data.

REST calls are used for CRUD: alerts, nodes, settings, and the one-shot ping tool (`POST /api/ping`).

### Types

`helio-app/backend/src/types.ts` is the single source of truth for shared types. A copy lives at `helio-app/frontend/src/types.ts` — **keep them in sync manually** when adding or changing interfaces.

### Routing (frontend)

React Router 6 nested layout: `AppLayout` (with `Sidebar`) wraps `/dashboard/*`. The public status page lives at `/status` outside the layout.

### Production build

`NODE_ENV=production` causes the backend to serve `frontend/dist/` as static files and handle `GET *` → `index.html`. WebSocket path is `/ws` in both dev and prod.

## Known Issues / Gotchas

- `better-sqlite3` requires a native build. **Node v26 breaks the native addon** — use Node v20 LTS.
- `helio-app/.worktrees/` and `helio-app/.claude/worktrees/` are git worktree artifacts — ignore them when searching source.
- The alert engine currently only dispatches webhooks for `webhook`, `slack`, and `discord` channels. `email` and other channels are stored in the DB but silently skipped.

# Helio — Self-Hosted Server Monitoring

> Lightweight, open-source server monitoring with a real-time React dashboard. Runs as a single Node.js process — no cloud, no subscription, full control.

## Screenshots

| Dark Mode | Light Mode |
|-----------|------------|
| ![Dark](https://placehold.co/580x340/0B0E14/2EE0CE?text=Dashboard+Dark) | ![Light](https://placehold.co/580x340/FBFCFE/0C9C8D?text=Dashboard+Light) |

## Features

- **Live metrics** — CPU, RAM, disk, network updated every 5 seconds
- **Docker monitoring** — container CPU/RAM/status (gracefully skipped if Docker isn't running)
- **Configurable alerts** — threshold rules with webhook, Slack, or Discord notifications + cooldown
- **24-hour history** — SQLite ring buffer (17,280 rows ≈ 24 h at 5 s intervals, WAL mode)
- **WebSocket streaming** — real-time push with automatic exponential-backoff reconnect
- **Dark / light mode** — CSS custom properties, persisted via `localStorage`, zero flash on load
- **Single process** — Express serves the compiled React app on port 3001 in production

## Tech Stack

| | |
|---|---|
| **Backend** | Node 20 · TypeScript · Express 4 · ws · better-sqlite3 · systeminformation · dockerode |
| **Frontend** | React 18 · Vite 5 · TypeScript · Zustand · Recharts · Lucide · React Router 6 |
| **Tests** | Vitest — unit tests for DB queries, collectors, and alert engine |

## Quick Start

### Prerequisites

- Node.js 20+
- **Visual Studio Build Tools** with "Desktop development with C++" (needed by `better-sqlite3`)
  ```
  winget install Microsoft.VisualStudio.2022.BuildTools
  ```

### Run

```bash
git clone https://github.com/naix1337/helio.git
cd helio
npm install
npm run build
NODE_ENV=production npm start
# → http://localhost:3001
```

### Development (hot reload)

```bash
npm run dev
# Backend  → http://localhost:3001  (tsx watch)
# Frontend → http://localhost:5173  (Vite + API proxy)
```

## Project Structure

```
helio/
├── backend/src/
│   ├── types.ts              # Shared interfaces (source of truth)
│   ├── db/                   # SQLite connection, schema, queries
│   ├── collectors/           # systemCollector, dockerCollector
│   ├── ws/metricsWs.ts       # WebSocket server + heartbeat
│   ├── routes/               # REST: /api/metrics  /api/alerts  /api/nodes  /api/status
│   ├── alertEngine.ts        # Rule evaluation + webhook dispatch
│   └── index.ts              # Express bootstrap + 5 s collector loop
└── frontend/src/
    ├── styles/               # CSS tokens (design system) + layout
    ├── hooks/                # useWebSocket, useMetrics
    ├── store/                # Zustand — 60-entry history ring buffer
    ├── components/           # StatCard, CpuSparkline, RamBars, tables, badges
    └── pages/                # Dashboard, Nodes, Containers, Alerts, StatusPage
```

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/metrics/current` | Live system snapshot |
| `GET` | `/api/metrics/history?range=1h\|6h\|24h\|7d` | Historical metrics (≤ 500 points) |
| `GET` | `/api/metrics/containers` | Docker container list |
| `GET` | `/api/alerts` | All alert rules |
| `POST` | `/api/alerts` | Create rule |
| `PUT` | `/api/alerts/:id` | Enable / disable rule |
| `DELETE` | `/api/alerts/:id` | Delete rule |
| `GET` | `/api/nodes` | Registered nodes |
| `GET` | `/api/status` | Public uptime data |
| `WS` | `/ws` | Live metrics stream |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | HTTP server port |
| `NODE_ENV` | — | Set to `production` to serve frontend build |
| `HELIO_DB_PATH` | `./helio.db` | SQLite database path |

## License

MIT

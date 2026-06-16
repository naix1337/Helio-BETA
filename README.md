# Helio BETA — Self-hosted Uptime & Container Monitoring

![Version](https://img.shields.io/badge/version-2.0.0-2EE0CE)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6)
![React](https://img.shields.io/badge/React-19-61DAFB)
![License](https://img.shields.io/badge/license-MIT-green)

Helio ist eine moderne, selbst-gehostete Monitoring-Plattform — Alternative zu **Uptime Kuma** und **Grafana** — mit Fokus auf saubere REST-API, erweiterbare Checker-Architektur, WebSocket-Live-Updates, **Proxmox Container-Monitoring** und ein Dark-First Dashboard. Ideal für Homelab-Betreiber, DevOps-Teams und Self-Hoster.
<img width="1661" height="709" alt="image" src="https://github.com/user-attachments/assets/2b5792d8-c8c9-4b1f-bf2d-84156a1243d7" />

---

## Features

### 📡 6 Uptime-Monitor-Typen
| Typ | Beschreibung |
|-----|-------------|
| **HTTP(s)** | Status-Code-Range, Keyword, JSONPath, Redirects, Timeout, Basic Auth, Ignore-TLS |
| **TCP-Port** | Host + Port, Connect-Timeout |
| **Ping (ICMP)** | System-`ping`, Fallback TCP Echo |
| **DNS** | A/AAAA/CNAME/MX/TXT, erwarteter Wert, eigener Resolver |
| **SSL/TLS** | Zertifikats-Ablauf, Warning-Schwellwert → DEGRADED |
| **Push (Heartbeat)** | Token-URL, Grace-Period |

### 🐳 Proxmox Container-Monitoring
- **Live-Polling** aller LXC-Container und QEMU-VMs via Proxmox VE API
- **Metriken**: CPU, RAM, Disk, Netzwerk-I/O, Ping-Latenz
- **Per-Container Charts** mit umschaltbaren Tabs (CPU/RAM/Disk/Netzwerk)
- **Auto-Discovery**: Erkennt alle Container im Cluster
- Self-Signed Cert Support, Poll-Intervall konfigurierbar

### 📢 Benachrichtigungen (Provider-Pattern)
Mehrere Benachrichtigungen pro Monitor zuweisbar: **Webhook**, **Telegram**, **Discord** (Embeds), **E-Mail (SMTP)**, **ntfy** — alle mit Test-Button.

### 🔧 Monitoring-Engine
- Scheduler-basiert (eigener Intervall pro Monitor, min 20s)
- Status-Transitionen (UP→DOWN feuert Events → Notifications + WS-Broadcast)
- Heartbeat-Retention (7d Rohdaten, dann stündliche Aggregation)
- Graceful Shutdown

### 🎨 Dashboard
- **Übersicht** — Live-KPIs, Latenz-Chart, Alert-Feed, Monitor-Tabelle
- **Monitor-Detail** — Latenz-Chart (Canvas), Uptime-%, Heartbeat-Tabelle, Pause/Resume/Edit/Delete
- **Monitor-Formular** — Dynamisch je nach Typ, Editieren bestehender Monitore
- **Container** — Proxmox-Dashboard mit CPU/RAM/Disk/Ping-Tabelle und Metric-Tabs
- **Benachrichtigungen** — CRUD + Test + Edit, Monitor-Zuweisung
- **Status-Pages** — Öffentliche Seiten ohne Auth, Monitor-Auswahl
- **Metriken** — Uptime-Tabelle (24h/7d/30d)
- **Einstellungen** — Profil, TOTP-2FA, API-Keys, Aufbewahrung
- **Dark/Light-Mode** — Umschaltbar, persistiert

---

## Architektur

```
helio/
├── shared/              # TypeScript-Types (Monitor, Heartbeat, Notification, User…)
│   └── src/types.ts
│
├── server/              # Express-API + Engine
│   ├── src/
│   │   ├── checkers/      → HTTP, TCP, Ping, DNS, SSL, Push
│   │   ├── collectors/    → Proxmox-VE-API-Client
│   │   ├── db/            → SQLite (better-sqlite3), 11 Migrationen, CRUD-Queries
│   │   ├── engine/        → Scheduler, Engine, ContainerCollector, Aggregation
│   │   ├── middleware/     → JWT-Auth, API-Key-Auth, Error-Handler
│   │   ├── notifications/ → Webhook, Telegram, Discord, Email, ntfy
│   │   ├── routes/        → /api/v1/* (Auth, Monitore, Container, Notifications, …)
│   │   ├── utils/         → URL-Safety (SSRF-Schutz)
│   │   ├── ws/            → WebSocket (heartbeat:new, monitor:status-change)
│   │   └── index.ts       → Server-Einstieg, Graceful Shutdown
│   └── Dockerfile
│
├── client/              # React + Vite + TypeScript + TailwindCSS v4
│   └── src/
│       ├── api/          → Typisierte API-Clients
│       ├── components/   → 20+ UI-Komponenten
│       ├── hooks/        → useWebSocket, useChartLiveUpdates
│       ├── store/        → Zustand (Auth, Theme, View-Routing, API-Data)
│       └── utils/        → Canvas-Chart-Engine (retina)
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Quick Start

### Mit Docker
```bash
git clone https://github.com/naix1337/helio-v2.git
cd helio
docker compose up -d
# http://localhost:3001
```

### Ohne Docker
```bash
npm install
npm run seed              # Demo-Daten + Admin
npm run dev:server        # → http://localhost:3001
# Terminal 2:
npm run dev:client        # → http://localhost:5173 (optional)
```

### Demo-Zugang
```
E-Mail:    admin@helio.local
Passwort:  admin123
```

---

## Umgebungsvariablen

| Variable | Default | Beschreibung |
|----------|---------|-------------|
| `PORT` | `3001` | Server-Port |
| `DB_PATH` | `./helio.db` | SQLite-Datenbank |
| `JWT_SECRET` | (random) | JWT-Secret |
| `CORS_ORIGIN` | `*` | CORS |
| `RETENTION_RAW_DAYS` | `7` | Heartbeat-Aufbewahrung |
| `NTFY_DEFAULT_SERVER` | `https://ntfy.sh` | Default ntfy-Server |

---

## API-Referenz

### Auth
```
POST /api/v1/auth/register   { email, password }
POST /api/v1/auth/login      { email, password }
POST /api/v1/auth/refresh    { refreshToken }
POST /api/v1/auth/2fa/setup  (JWT)
POST /api/v1/auth/2fa/verify { token }  (JWT)
GET  /api/v1/auth/me         (JWT)
```

### Monitore
```
GET    /api/v1/monitors              (JWT/API-Key)
POST   /api/v1/monitors              { name, type, config, intervalSeconds, tags }  (JWT)
GET    /api/v1/monitors/:id          (JWT/API-Key)
PATCH  /api/v1/monitors/:id          { name?, config?, intervalSeconds?, … }  (JWT)
DELETE /api/v1/monitors/:id          (JWT)
POST   /api/v1/monitors/:id/pause    (JWT)
POST   /api/v1/monitors/:id/resume   (JWT)
GET    /api/v1/monitors/:id/heartbeats?range=24h|7d|30d  (JWT/API-Key)
GET    /api/v1/monitors/:id/uptime   (JWT/API-Key)
```

### Container (Proxmox)
```
GET    /api/v1/containers              — Aktuelle Metriken aller Container/VM
GET    /api/v1/containers/:vmid/history — Metrik-Verlauf
GET    /api/v1/containers/config       — Proxmox-Config (ohne Passwort)
POST   /api/v1/containers/config       { host, user, password, intervalSeconds }
POST   /api/v1/containers/test         { host, user, password } — Verbindung testen
DELETE /api/v1/containers/config       — Config löschen + Polling stoppen
```

### Benachrichtigungen
```
GET    /api/v1/notifications           (JWT)
POST   /api/v1/notifications           { name, provider, config, monitorIds }
PATCH  /api/v1/notifications/:id       { name?, config?, monitorIds? }
DELETE /api/v1/notifications/:id
POST   /api/v1/notifications/:id/test  (sendet Test)
```

### Status-Pages
```
GET    /api/v1/status-pages                  (JWT)
POST   /api/v1/status-pages                  { title, slug, monitorIds }
GET    /api/v1/status-pages/public/:slug     (öffentlich, kein Auth)
DELETE /api/v1/status-pages/:id
```

### API-Keys
```
GET    /api/v1/api-keys     (JWT)
POST   /api/v1/api-keys     { name, scopes: ["read","write"] }
DELETE /api/v1/api-keys/:id (JWT)
```
Verwendung: `X-API-Key: pk_<Ihr-Key>` als Header.

---

## Container-Monitoring (Proxmox)

### Konfiguration
1. **Container → Konfiguration** in der Sidebar
2. Host: `https://dein-proxmox:8006`
3. User: `root@pam`
4. Passwort + Poll-Intervall
5. **"Speichern & verbinden"**

### Anzeige
- **KPI-Cards**: Container-Anzahl, CPU/RAM/Disk gesamt
- **Container-Tabelle**: Name, VMID, Node, CPU/RAM/Disk Mini-Bars, Ping, Status
- **Detail-Panel** (Klick auf Container): Metric-Tabs für CPU/RAM/Disk/Netzwerk mit Liniendiagramm

---

## Entwicklung

```bash
git clone https://github.com/naix1337/helio-v2.git
cd helio
npm install
npm run seed
npm run dev:server   # Terminal 1
npm run dev:client   # Terminal 2 (optional)
```

### Docker Build
```bash
docker compose build
docker compose up -d
```

---

## Lizenz

MIT — gebaut mit ❤️ für die Self-Hoster-Community.

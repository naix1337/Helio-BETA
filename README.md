# Helio — Self-hosted Uptime Monitoring

![Version](https://img.shields.io/badge/version-1.0.0-2EE0CE)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6)
![React](https://img.shields.io/badge/React-19-61DAFB)
![License](https://img.shields.io/badge/license-MIT-green)

Helio ist eine moderne, selbst-gehostete Uptime-Monitoring-Alternative zu **Uptime Kuma** — mit Fokus auf eine saubere REST-API, erweiterbare Checker-Architektur, WebSocket-Live-Updates und ein Dark-First Dashboard. Ideal für Homelab-Betreiber, DevOps-Teams und Self-Hoster.

---

## Screenshots

> Dashboard-Übersicht, Monitor-Detail, Latenz-Charts, Benachrichtigungen, Status-Pages, Metriken, Einstellungen

---

## Architektur

```
helio/
├── shared/              # Gemeinsame TypeScript-Types
│   └── src/types.ts     → Monitor, Heartbeat, Notification, User, ApiKey, …
│
├── server/              # Express-API + Monitoring-Engine
│   ├── src/
│   │   ├── checkers/    → HTTP, TCP, Ping, DNS, SSL, Push (IChecker-Interface)
│   │   ├── db/          → SQLite (better-sqlite3), 9 Migrationen, CRUD-Queries
│   │   ├── engine/      → Scheduler (eigener Intervall pro Monitor), Engine, Aggregation
│   │   ├── middleware/  → JWT-Auth, API-Key-Auth, Error-Handler
│   │   ├── notifications/ → Webhook, Telegram, Discord, E-Mail (nodemailer), ntfy
│   │   ├── routes/      → /api/v1/* — Auth, Monitore, Notifications, Status-Pages, …
│   │   ├── ws/          → WebSocket-Server (Events: heartbeat:new, monitor:status-change)
│   │   └── index.ts     → Server-Einstieg, Graceful Shutdown
│   └── Dockerfile       → Multi-Stage Build
│
├── client/              # React + Vite + TypeScript + TailwindCSS v4
│   └── src/
│       ├── api/         → Typisierte API-Clients (auth, monitors, notifications)
│       ├── components/  → UI-Komponenten (Sidebar, Topbar, Overview, MonitorForm, …)
│       ├── hooks/       → useWebSocket, useChartLiveUpdates
│       ├── store/       → Zustand-Store (Auth, Theme, View-Routing, API-Data)
│       └── utils/       → Canvas-Chart-Engine (retina-scharf, smooth paths)
│
├── docker-compose.yml   → Single-Service-Setup mit Volume
├── .env.example
└── README.md
```

---

## Features

### 6 Monitor-Typen

| Typ | Beschreibung |
|-----|-------------|
| **HTTP(s)** | Status-Code-Range (z.B. 200-299), Keyword-Check im Body, JSON-Path, Redirects, Timeout, Basic Auth, Ignore-TLS |
| **TCP-Port** | Host + Port, Connect-Timeout |
| **Ping (ICMP)** | System-`ping`-Befehl, Fallback auf TCP Echo |
| **DNS** | Record-Typ (A, AAAA, CNAME, MX, TXT), erwarteter Wert, eigener Resolver |
| **SSL/TLS** | Zertifikats-Ablauf, Warnschwellwert in Tagen → Status DEGRADED |
| **Push (Heartbeat)** | Token-URL wird generiert, externer Dienst ruft `/api/push/:token` auf |

Jeder Monitor läuft mit eigenem **konfigurierbaren Intervall** (min. 20s), **Retries**, **Tags** und **Status** (UP / DOWN / PENDING / PAUSED / DEGRADED).

### Monitoring-Engine

- **Scheduler-basiert** — kein Cron-Paket, eigener Interval-Manager pro Monitor
- **Status-Transitionen** — bei UP→DOWN / DOWN→UP werden Events gefeuert
- **Heartbeat-Retention** — Rohdaten 7 Tage, dann stündliche Aggregation (avg/min/max Latenz, Uptime-%)

### Benachrichtigungen (Provider-Pattern)

Mehrere Benachrichtigungen pro Monitor zuweisbar, mit Test-Button:

- **Webhook** — POST mit JSON-Payload, custom Headers
- **Telegram** — Bot-Token + Chat-ID
- **Discord** — Webhook-URL, Embed-Format
- **E-Mail (SMTP)** — nodemailer
- **ntfy** — Topic + Server-URL

### REST-API

Vollständige REST-API unter `/api/v1`:

| Bereich | Endpunkte |
|---------|-----------|
| **Auth** | POST register, login, refresh, 2FA-setup/verify/disable |
| **Monitore** | CRUD, heartbeats, uptime, pause, resume |
| **Benachrichtigungen** | CRUD, test |
| **Status-Pages** | CRUD, öffentliche Route (Slug) |
| **Wartungsfenster** | CRUD, aktive Abfrage |
| **API-Keys** | Erstellen (einmalige Anzeige), Löschen, Scopes |
| **Push** | `GET /api/push/:token` |

### WebSocket

- Events: `heartbeat:new`, `monitor:status-change`, `monitor:created/updated/deleted`
- JWT-Auth beim Handshake
- Client-Reconnect mit Backoff (1s, 2s, 4s, … max 30s)

### Dashboard

- **Übersicht** — Live-KPIs, Latenz-Chart, Alert-Feed, Monitor-Tabelle
- **Monitor-Detail** — Latenz-Chart (Canvas), Uptime-%, Heartbeat-Historie, Pause/Resume/Delete
- **Monitor-Formular** — dynamisches Formular je nach Typ (HTTP, TCP, Ping, DNS, SSL, Push)
- **Benachrichtigungen** — Provider-Verwaltung mit Test-Button und Monitor-Zuweisung
- **Status-Pages** — öffentliche Seite ohne Auth, Monitor-Auswahl
- **Metriken** — Uptime-Tabelle (24h/7d/30d)
- **Einstellungen** — Profil, 2FA (TOTP), API-Keys, Aufbewahrung
- **Dark/Light-Mode** — umschaltbar, persistiert

---

## Quick Start

### Mit Docker

```bash
# Repository klonen und starten
git clone https://github.com/naix1337/helio-v2.git
cd helio

# Starten
docker compose up -d

# Dashboard: http://localhost:3001
# API: http://localhost:3001/api/v1
```

### Ohne Docker (Entwicklung)

```bash
# Abhängigkeiten installieren
npm install

# Mit Seed-Daten starten (Admin + Demo-Monitore)
npm run seed

# Server starten (mit auto-restart)
npm run dev:server

# Frontend starten (separates Terminal)
npm run dev:client
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
| `HOST` | `0.0.0.0` | Server-Host |
| `DB_PATH` | `./helio.db` | Pfad zur SQLite-Datenbank |
| `JWT_SECRET` | (random) | Secret für JWT-Tokens |
| `CORS_ORIGIN` | `*` | CORS-Origin |
| `RETENTION_RAW_DAYS` | `7` | Heartbeat-Aufbewahrung in Tagen |
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
PATCH  /api/v1/monitors/:id          { name?, config?, intervalSeconds?, status? }  (JWT)
DELETE /api/v1/monitors/:id          (JWT)
POST   /api/v1/monitors/:id/pause    (JWT)
POST   /api/v1/monitors/:id/resume   (JWT)
GET    /api/v1/monitors/:id/heartbeats?range=24h|7d|30d  (JWT/API-Key)
GET    /api/v1/monitors/:id/uptime   (JWT/API-Key)
```

**Config pro Monitor-Typ:**

```json
// HTTP
{ "url": "https://example.com", "method": "GET", "statusCodeMin": 200, "statusCodeMax": 299 }

// TCP
{ "host": "localhost", "port": 6379, "timeoutMs": 5000 }

// Ping
{ "host": "8.8.8.8", "count": 2 }

// DNS
{ "host": "example.com", "recordType": "A", "expectedValue": "93.184.216.34" }

// SSL
{ "host": "example.com", "port": 443, "warningDays": 30 }

// Push
{ "graceSeconds": 300 }
```

### Benachrichtigungen

```
GET    /api/v1/notifications          (JWT)
POST   /api/v1/notifications          { name, provider, config, monitorIds }
PATCH  /api/v1/notifications/:id      { name?, config?, monitorIds? }
DELETE /api/v1/notifications/:id
POST   /api/v1/notifications/:id/test (sendet Test-Benachrichtigung)
```

### Status-Pages

```
GET    /api/v1/status-pages                  (JWT)
POST   /api/v1/status-pages                  { title, slug, monitorIds }
PATCH  /api/v1/status-pages/:id              { title?, slug?, monitorIds?, incidentBanner? }
DELETE /api/v1/status-pages/:id
GET    /api/v1/status-pages/public/:slug     (öffentlich, kein Auth)
```

### API-Keys

```
GET    /api/v1/api-keys     (JWT)
POST   /api/v1/api-keys     { name, scopes: ["read","write"] }
DELETE /api/v1/api-keys/:id (JWT)
```

Verwendung: `X-API-Key: pk_<Ihr-Key>` als Header.

### Push-Endpunkt (öffentlich)

```
GET /api/push/:token
```

### Wartungsfenster

```
GET    /api/v1/maintenance        (JWT)
POST   /api/v1/maintenance        { monitorIds, startsAt, endsAt, description }
GET    /api/v1/maintenance/active (JWT)
DELETE /api/v1/maintenance/:id    (JWT)
```

---

## Projekt-Setup (für Entwickler)

```bash
# Repository
git clone https://github.com/naix1337/helio-v2.git
cd helio

# Installieren (Workspaces: shared, server, client)
npm install

# Build (optional)
npm run build:client

# Seed-Daten
npm run seed

# Entwicklung (2 Terminals)
npm run dev:server   # → http://localhost:3001
npm run dev:client   # → http://localhost:5173
```

### Docker Build

```bash
docker compose build
docker compose up -d
```

---

## Was wurde gebaut? (Dokumentation)

### Tag 1: Dashboard-Design

Das Frontend wurde pixelgenau nach einem **Helio Dashboard HTML-Design** umgesetzt. Die Design-Datei lag als exportierter HTML-Prototyp vor (aus Claude Design) und wurde in ein produktionsreifes **React + TypeScript + Vite + TailwindCSS v4** Projekt überführt.

**Umgesetzte Design-Elemente:**
- **Dark-First Theme** mit vollständigem Light-Mode — Cyan-Primary (#2EE0CE), Violet-Accent (#9C8CFA)
- **Sidebar** mit Logo, Navigation (3 Gruppen), Live-Badges, User-Footer
- **Topbar** mit Time-Range-Segmented-Control, Notification-Bell, Theme-Toggle
- **4 KPI-Cards** mit Canvas-Sparklines (retina-scharf)
- **Main-Chart** — CPU + Netzwerk als gestapelte Flächenkurven auf Canvas, live-aktualisierend
- **Alert-Feed**, **Nodes-Tabelle**, **Container-Grid**, **Alerts-Liste**
- Responsive Layout (Sidebar → Burger-Menü auf Mobile)

### Tag 2: Backend + API

Das komplette Backend wurde als **Node.js + TypeScript + Express** App gebaut:

**Datenbank (SQLite / better-sqlite3):**
- 9 Migrationen für alle Entitäten
- WAL-Mode, Foreign Keys
- CRUD-Queries für User, Monitore, Heartbeats, Notifications, API-Keys, Status-Pages, Maintenance-Windows, Uptime-Aggregations

**Checker-Engine:**
- `IChecker`-Interface + Registry-Pattern → neue Checker brauchen nur eine Klasse + Register
- **HttpChecker**: fetch-basiert, Status-Code-Range, Keyword, JSONPath, Basic Auth, Timeout, Ignore-TLS
- **TcpChecker**: net.connect mit Timeout
- **PingChecker**: System-ping + TCP-Echo-Fallback (Hinweis für CAP_NET_RAW)
- **DnsChecker**: dns.promises, alle Record-Typen, custom Resolver
- **SslChecker**: tls.connect, Zertifikats-Ablauf, DEGRADED-Status bei Unterschreitung
- **PushChecker**: Token-basiert, Grace-Period

**Monitoring-Engine:**
- Scheduler: eigener setInterval pro Monitor, `startMonitor(id, interval, fn)`
- Status-Transition-Detection (UP→DOWN feuert Events)
- Notification-Dispatch bei Transitionen
- Heartbeat-Aggregation (stündlich) + Pruning (7 Tage)
- Graceful Shutdown (stoppt alle Intervalle, schließt DB)

**Notification-Provider (5 Stück):**
- WebhookProvider, TelegramProvider, DiscordProvider, EmailProvider (nodemailer), NtfyProvider
- Einheitliches `INotificationProvider`-Interface
- Test-Funktion pro Provider
- SSRF-Schutz (URL-Validierung gegen Private-IPs)

**REST-API (30+ Endpunkte unter /api/v1):**
- Auth (Register, Login, Refresh, 2FA/TOTP)
- Monitor-CRUD + Heartbeats + Uptime + Pause/Resume
- Notification-CRUD + Test
- Status-Pages (CRUD + öffentliche Route)
- Maintenance-Windows
- API-Keys (mit Scopes)
- Push-Endpunkt

**WebSocket:**
- JWT-Auth beim Handshake
- Events: heartbeat:new, monitor:status-change
- Broadcast an alle authentifizierten Clients

### Tag 3: Frontend-Produktivschaltung + Rebranding

**Login + Auth:**
- Login/Register-Seite mit JWT-Token-Management
- Auto-Refresh bei 401
- Protected Routes

**API-Integration:**
- Alle Views laden echte Daten von der API (keine Mock-Daten mehr)
- Loading/Error-States

**Monitor-Formular:**
- Dynamisches Formular je nach Typ (HTTP: URL/Methode/Keyword, TCP: Host/Port, Ping: Host, DNS: Host/Record-Typ, SSL: Host/Port/Tage, Push: Grace)
- Live-Erstellung über API

**Monitor-Detail:**
- Latenz-Chart mit Zeitachsen-Labels
- Uptime-Cards (24h/7d/365d)
- Heartbeat-Tabelle
- Pause/Resume/Delete

**Weitere Views:**
- Benachrichtigungen (CRUD + Test + Edit)
- Status-Pages (Erstellen + öffentliche URL)
- Metriken (Uptime-Übersicht pro Monitor)
- Einstellungen (Profil, 2FA, API-Keys, Aufbewahrung)
- Team-Ansicht

**Rebranding:**
- "Pulse" → "Helio"
- "prod" → "dev build"

---

## Lizenz

MIT — gebaut mit ❤️ für die Self-Hoster-Community.

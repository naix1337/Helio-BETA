# Helio BETA — Self-hosted Uptime & Container Monitoring

![Version](https://img.shields.io/badge/version-2.1.0-2EE0CE)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6)
![React](https://img.shields.io/badge/React-19-61DAFB)
![License](https://img.shields.io/badge/license-MIT-green)
![Production Ready](https://img.shields.io/badge/production-ready-22BB33)

Helio ist eine moderne, **produktionsreife**, selbst-gehostete Monitoring-Plattform — Alternative zu **Uptime Kuma** und **Grafana** — mit Fokus auf saubere REST-API, erweiterbare Checker-Architektur, WebSocket-Live-Updates, **Proxmox Container-Monitoring** und ein Dark-First Dashboard. Ideal für Homelab-Betreiber, DevOps-Teams und Self-Hoster.

> **v2.1.0** — Production-Ready Release mit Security-Hardening, Observability, Deployment-Verbesserungen und Bugfixes. [Changelog](CHANGELOG.md)

<img width="1661" height="709" alt="image" src="https://github.com/user-attachments/assets/2b5792d8-c8c9-4b1f-bf2d-84156a1243d7" />

---

## Inhaltsverzeichnis

- [Features](#features)
- [Architektur](#architektur)
- [Quick Start](#quick-start)
- [Produktions-Deployment](#produktions-deployment)
- [Umgebungsvariablen](#umgebungsvariablen)
- [API-Referenz](#api-referenz)
- [Sicherheit](#sicherheit)
- [Entwicklung](#entwicklung)
- [Lizenz](#lizenz)

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
| **Push (Heartbeat)** | Token-URL, Grace-Period, **persistiert in SQLite** |

### 🐳 Proxmox Container-Monitoring
- **Live-Polling** aller LXC-Container und QEMU-VMs via Proxmox VE API
- **Metriken**: CPU, RAM, Disk, Netzwerk-I/O, Ping-Latenz
- **Per-Container Charts** mit umschaltbaren Tabs (CPU/RAM/Disk/Netzwerk)
- **Auto-Discovery**: Erkennt alle Container im Cluster
- Self-Signed Cert Support, Poll-Intervall konfigurierbar
- **Passwort-Verschlüsselung**: AES-256-GCM in der Datenbank

### 📢 Benachrichtigungen (Provider-Pattern)
Mehrere Benachrichtigungen pro Monitor zuweisbar: **Webhook**, **Telegram**, **Discord** (Embeds), **E-Mail (SMTP)**, **ntfy** — alle mit Test-Button und **SSRF-Schutz**.

### 🔧 Monitoring-Engine
- Scheduler-basiert (eigener Intervall pro Monitor, min 20s)
- **Retry-Logik** (konfigurierbare Anzahl Wiederholungen)
- Status-Transitionen (UP→DOWN feuert Events → Notifications + WS-Broadcast)
- Heartbeat-Retention (7d Rohdaten, dann stündliche Aggregation)
- Graceful Shutdown mit Queue-Drain

### 🛡️ Sicherheit
- **Helmet.js** Sicherheits-Header (XSS, Clickjacking, MIME-Sniffing)
- **Rate-Limiting** für Auth-Endpunkte (10 Versuche/15min)
- **API-Key Auth** mit SHA256-Hashing + Scope-Prüfung
- **TOTP-2FA** via Authenticator-App
- **SSRF-Schutz** für alle Notification-Provider
- **Shell-Injection-Schutz** im PingChecker
- **Proxmox-Passwort-Verschlüsselung** (AES-256-GCM)
- **Non-Root Docker** Container
- CORS, Security-Header, Request-Logging

### 📊 Observability
- **Strukturiertes Logging** (Pino) mit JSON-Output in Produktion
- **Liveness/Readiness/Health-Endpoints** für Kubernetes/Docker
- **Automatische DB-Backups** (täglich, konfigurierbare Aufbewahrung)
- **Prometheus-kompatibel** über Strukturierte Logs
- Request-Logging mit Dauer, Status-Code, Pfad

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
│   │   ├── db/            → SQLite (better-sqlite3), 13 Migrationen, CRUD-Queries
│   │   ├── engine/        → Scheduler mit Jitter, Engine mit Retry, ContainerCollector
│   │   ├── middleware/     → JWT-Auth, API-Key-Auth, Error-Handler, Rate-Limiter
│   │   ├── notifications/ → Webhook, Telegram, Discord, Email, ntfy (+ Zod-Schemas)
│   │   ├── routes/        → /api/v1/* (Auth, Monitore, Container, Notifications, …)
│   │   ├── utils/         → URL-Safety (SSRF-Schutz), Encryption (AES-256-GCM), Logger (Pino), Backup
│   │   ├── ws/            → WebSocket (heartbeat:new, monitor:status-change)
│   │   └── index.ts       → Server-Einstieg mit Helmet, Rate-Limiting, Graceful Shutdown
│   └── Dockerfile         → Non-Root, Multi-Stage, dumb-init
│
├── client/              # React + Vite + TypeScript + TailwindCSS v4
│   └── src/
│       ├── api/          → Typisierte API-Clients
│       ├── components/   → 20+ UI-Komponenten
│       ├── hooks/        → useWebSocket, useChartLiveUpdates
│       ├── store/        → Zustand (Auth, Theme, View-Routing, API-Data)
│       └── utils/        → Canvas-Chart-Engine (retina)
│
├── docker-compose.yml         # Dev-Deployment
├── docker-compose.prod.yml    # Production-Deployment
├── .env.example               # Env-Vorlage
├── nginx/helio.conf           # Nginx-Reverse-Proxy-Konfiguration
└── README.md
```

---

## Quick Start

### Mit Docker (Entwicklung)
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

## Produktions-Deployment

### Docker Compose (Produktion)

```bash
# 1. Config vorbereiten
cp .env.example .env
# JWT_SECRET generieren:
openssl rand -hex 64

# 2. Starten
docker compose -f docker-compose.prod.yml up -d

# 3. Health-Check
curl http://localhost:3001/api/v1/health
```

### Mit Nginx Reverse Proxy

1. `docker compose -f docker-compose.prod.yml up -d helio`
2. Nginx-Konfiguration aus `nginx/helio.conf` anpassen
3. SSL-Zertifikate via Let's Encrypt/Certbot einrichten
4. Nginx starten

### Wichtige Produktions-Einstellungen

| Einstellung | Empfehlung |
|------------|------------|
| `JWT_SECRET` | `openssl rand -hex 64` |
| `CORS_ORIGIN` | Deine Domain (z.B. `https://helio.example.com`) |
| `NODE_ENV` | `production` |
| `LOG_LEVEL` | `info` (Produktion) oder `debug` (Fehlersuche) |
| `BACKUP_ENABLED` | `true` |
| `RETENTION_RAW_DAYS` | `7` (Rohdaten) / `30` (Backups) |

### Health-Checks (für Kubernetes / Docker)

| Endpoint | Zweck |
|----------|-------|
| `GET /api/v1/live` | Liveness — Server läuft |
| `GET /api/v1/ready` | Readiness — DB verbunden |
| `GET /api/v1/health` | Health — Details (Version, Uptime, Engine-Status) |

---

## Umgebungsvariablen

| Variable | Default | Beschreibung |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Production schaltet Fehlerdetails aus |
| `PORT` | `3001` | Server-Port |
| `HOST` | `0.0.0.0` | Server-Host |
| `LOG_LEVEL` | `info` | Pino-Loglevel (debug/info/warn/error) |
| `DB_PATH` | `./helio.db` | SQLite-Datenbank |
| `JWT_SECRET` | (random) | JWT-Secret (in Produktion **zwingend setzen**) |
| `JWT_ACCESS_EXPIRY` | `15m` | Access-Token-Laufzeit |
| `JWT_REFRESH_EXPIRY` | `7d` | Refresh-Token-Laufzeit |
| `CORS_ORIGIN` | `*` | CORS (Produktion auf Domain beschränken) |
| `RETENTION_RAW_DAYS` | `7` | Heartbeat-Aufbewahrung |
| `NTFY_DEFAULT_SERVER` | `https://ntfy.sh` | Default ntfy-Server |
| `BACKUP_ENABLED` | `true` | Automatische DB-Backups |
| `BACKUP_DIR` | `/app/data/backups` | Backup-Verzeichnis |
| `BACKUP_RETENTION_DAYS` | `30` | Backup-Aufbewahrung |

---

## API-Referenz

Alle Endpunkte sind unter `http(s)://dein-server:3001/api/v1` erreichbar.

### Auth
```
POST /api/v1/auth/register   { email, password }           → Rate Limited 10/15min
POST /api/v1/auth/login      { email, password }           → Rate Limited 10/15min
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
POST   /api/v1/notifications/:id/test  (JWT, Rate Limited 5/min)
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

### Health
```
GET    /api/v1/live          — Liveness Probe
GET    /api/v1/ready         — Readiness Probe
GET    /api/v1/health        — Detail-Health (Version, DB, Engine)
```

---

## Sicherheit

### OWASP-Maßnahmen

| Maßnahme | Status |
|----------|--------|
| Rate Limiting (Auth) | ✅ Implementiert |
| Helmet Security Header | ✅ Implementiert |
| SQL Injection Prevention | ✅ Prepared Statements |
| SSRF Protection | ✅ URL-Validierung + DNS-Check |
| XSS Protection | ✅ Helmet + React |
| CSRF (API via JWT) | ✅ Token-basiert |
| Secrets Encryption (Proxmox) | ✅ AES-256-GCM |
| Shell Injection Prevention | ✅ Host-Validierung |
| Non-Root Container | ✅ Docker User |
| No-new-privileges | ✅ Docker Security Opt |

### Security-Konfiguration

```bash
# JWT-Secret (64 Zeichen Hex):
openssl rand -hex 64

# CORS auf Domain beschränken:
CORS_ORIGIN=https://helio.example.com

# Rate-Limiting (eingebaut):
POST /api/v1/auth/login    → 10 Versuche / 15 Minuten
POST /api/v1/auth/register → 10 Versuche / 15 Minuten
```

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

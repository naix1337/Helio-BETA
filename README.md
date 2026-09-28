# Helio BETA — Self-hosted Uptime & Container Monitoring

![Version](https://img.shields.io/badge/version-2.2.0-2EE0CE)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6)
![React](https://img.shields.io/badge/React-19-61DAFB)
![License](https://img.shields.io/badge/license-MIT-green)
![Production Ready](https://img.shields.io/badge/production-ready-22BB33)

Helio ist eine moderne, **produktionsreife**, selbst-gehostete Monitoring-Plattform — Alternative zu **Uptime Kuma** und **Grafana** — mit Fokus auf saubere REST-API, erweiterbare Checker-Architektur, WebSocket-Live-Updates, **Proxmox Container-Monitoring** und ein Dark-First Dashboard. Ideal für Homelab-Betreiber, DevOps-Teams und Self-Hoster.

> **v2.2.0** — Stabilisierung: korrekte Status-Engine, Heartbeat-Balken & öffentliche Status-Seiten wie Uptime Kuma, Erst-Einrichtung statt offener Registrierung, 2FA-Login, Benutzerverwaltung, funktionierender Docker-Build. [Changelog](CHANGELOG.md)

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
| **Push (Heartbeat)** | Token-URL (Uptime-Kuma-kompatibel: `?status=up|down&msg=&ping=`), Grace-Period |

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
- **Erst-Einrichtung** statt offener Registrierung — weitere Benutzer legt ein Admin an
- **Rollen**: Administrator (Vollzugriff) / Betrachter (nur lesen)
- **Rate-Limiting** für Login (20 Fehlversuche/15min) und API
- **API-Key Auth** mit SHA256-Hashing + Scope-Prüfung
- **TOTP-2FA** via Authenticator-App (wird beim Login erzwungen)
- **SSRF-Schutz** für Notification-Provider (abschaltbar für LAN-Ziele: `NOTIFICATION_ALLOW_PRIVATE=true`)
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
- **Übersicht** — Live-KPIs, Latenz-Chart, Alert-Feed, Monitor-Tabelle mit **Heartbeat-Balken** (Live via WebSocket)
- **Monitor-Detail** — Latenz-Chart (Canvas), Uptime-%, Heartbeat-Tabelle, Pause/Resume/Edit/Delete
- **Monitor-Formular** — Dynamisch je nach Typ, Editieren bestehender Monitore
- **Container** — Proxmox-Dashboard mit CPU/RAM/Disk/Ping-Tabelle und Metric-Tabs
- **Benachrichtigungen** — CRUD + Test + Edit, Monitor-Zuweisung
- **Status-Pages** — Öffentliche Seiten unter `/status/<slug>` ohne Login (Heartbeat-Balken, Uptime, Wartungshinweise)
- **Alerts** — Aktive Probleme + Ereignis-Historie (Statuswechsel)
- **Wartung** — Wartungsfenster planen (keine Checks/Alarme)
- **Team** — Benutzer anlegen, Rollen ändern, löschen
- **Metriken** — Uptime-Tabelle (24h/7d/30d)
- **Einstellungen** — Profil & Passwort, TOTP-2FA, API-Keys, Server-Konfiguration
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
│       ├── hooks/        → useWebSocket (Live-Updates in den Store)
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

### Mit Docker (empfohlen)
```bash
git clone https://github.com/naix1337/Helio-BETA.git
cd Helio-BETA
docker compose up -d --build
# → http://localhost:3001 — beim ersten Aufruf Admin-Account anlegen
```

### Ohne Docker (Node.js ≥ 20)
```bash
npm install
npm run build             # Client + Server bauen
npm start                 # → http://localhost:3001
```

### Entwicklung
```bash
npm install
npm run dev:server        # API + Engine → http://localhost:3001
npm run dev:client        # Vite mit Proxy → http://localhost:5173
npm test                  # API-Tests (Server)
```
Optional Demo-Daten: `npm run seed` (legt `admin@helio.local` / `admin12345` an).

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
| `JWT_SECRET` | (generiert) | JWT-/Verschlüsselungs-Secret. Ohne Angabe wird eins erzeugt und neben der DB in `.helio-secret` gespeichert |
| `JWT_ACCESS_EXPIRY` | `15m` | Access-Token-Laufzeit |
| `JWT_REFRESH_EXPIRY` | `7d` | Refresh-Token-Laufzeit |
| `CORS_ORIGIN` | `*` | CORS (nur nötig, wenn Frontend auf anderer Domain läuft) |
| `TRUST_PROXY` | – | Hinter Reverse-Proxy auf `1` setzen (echte Client-IPs fürs Rate-Limit) |
| `API_RATE_LIMIT` | `600` | API-Requests pro Minute und IP |
| `NOTIFICATION_ALLOW_PRIVATE` | `false` | Webhook/ntfy-Ziele im LAN erlauben (Docker-Quickstart: `true`) |
| `RETENTION_RAW_DAYS` | `7` | Heartbeat-Aufbewahrung |
| `NTFY_DEFAULT_SERVER` | `https://ntfy.sh` | Default ntfy-Server |
| `BACKUP_ENABLED` | `false` | Tägliche DB-Backups (SQLite Online-Backup) |
| `BACKUP_DIR` | `<DB-Ordner>/backups` | Backup-Verzeichnis |
| `BACKUP_RETENTION_DAYS` | `30` | Backup-Aufbewahrung |

---

## API-Referenz

Alle Endpunkte sind unter `http(s)://dein-server:3001/api/v1` erreichbar.

Lesende Endpunkte: jeder angemeldete Benutzer bzw. API-Key mit Scope `read`.
Schreibende Endpunkte: nur Administratoren bzw. API-Keys (eines Admins) mit Scope `write`.

### Auth
```
GET  /api/v1/auth/setup      → { needsSetup }  (öffentlich)
POST /api/v1/auth/setup      { email, password }   → erster Admin, danach gesperrt
POST /api/v1/auth/login      { email, password, totpToken? }
POST /api/v1/auth/refresh    { refreshToken }
POST /api/v1/auth/password   { currentPassword, newPassword }
POST /api/v1/auth/2fa/setup | /2fa/verify { token } | /2fa/disable { token }
GET  /api/v1/auth/me
```

### Benutzer (Admin)
```
GET    /api/v1/users
POST   /api/v1/users         { email, password, role: "admin"|"user" }
PATCH  /api/v1/users/:id     { role?, password? }
DELETE /api/v1/users/:id
```

### Push (öffentlich, Uptime-Kuma-kompatibel)
```
GET|POST /api/push/:token?status=up|down&msg=OK&ping=123
```

### Monitore
```
GET    /api/v1/monitors              (JWT/API-Key)
GET    /api/v1/monitors/beats?count=40   — letzte Heartbeats aller Monitore
GET    /api/v1/monitors/events           — Statuswechsel (Ereignisse)
POST   /api/v1/monitors              { name, type, config, intervalSeconds, retries, tags, notificationIds }
GET    /api/v1/monitors/:id          (JWT/API-Key)
PATCH  /api/v1/monitors/:id          { name?, config?, intervalSeconds?, … }  (JWT)
DELETE /api/v1/monitors/:id          (JWT)
POST   /api/v1/monitors/:id/pause    (JWT)
POST   /api/v1/monitors/:id/resume   (JWT)
GET    /api/v1/monitors/:id/heartbeats?range=1h|6h|24h|7d|30d  (JWT/API-Key)
POST   /api/v1/monitors/:id/check    — Check sofort ausführen (ohne Speichern)
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
POST   /api/v1/notifications/:id/test  (Rate Limited 10/min)
POST   /api/v1/notifications/test      { provider, config } — ungespeicherte Config testen
```

### Status-Pages
```
GET    /api/v1/status-pages                  (JWT)
POST   /api/v1/status-pages                  { title, slug, monitorIds, logoUrl?, incidentBanner? }
PATCH  /api/v1/status-pages/:id
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
POST /api/v1/auth/login    → 20 Fehlversuche / 15 Minuten
/api/v1/*                  → API_RATE_LIMIT pro Minute
```

---

## Entwicklung

```bash
git clone https://github.com/naix1337/Helio-BETA.git
cd Helio-BETA
npm install
npm run dev:server   # Terminal 1 → :3001
npm run dev:client   # Terminal 2 → :5173 (proxied /api + /ws)
npm test             # Server-API-Tests
npm run lint && npm run typecheck
```

### Docker Build
```bash
docker compose build
docker compose up -d
```

---

## Lizenz

MIT — gebaut mit ❤️ für die Self-Hoster-Community.

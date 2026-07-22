# Changelog

## v2.1.0 (2026-07-22)

### 🛡️ Security Hardening (OWASP Top 10)

- **Rate Limiting** — Auth-Endpunkte (`/login`, `/register`) jetzt limitiert auf 10 Versuche/15min; API-Limit 120/min; Notification-Tests 5/min
- **Helmet.js** — Sicherheits-Header für XSS, Clickjacking, MIME-Sniffing, etc.
- **Shell Injection Prevention** — PingChecker host-validiert jetzt via Regex (IP/Hostname-only); `exec` wird mit `shell: false` aufgerufen
- **SSRF Protection für ALLE Provider** — WebhookProvider hat jetzt SSRF-Schutz (vorher nur Discord/ntfy)
- **Proxmox Passwort-Verschlüsselung** — AES-256-GCM mit JWT-Secret als Key; kein Klartext mehr in SQLite
- **Push-Tracker Persistenz** — In-Memory Map durch SQLite-Tabelle ersetzt; überlebt Server-Neustarts
- **Non-Root Docker User** — Container läuft als `helio:helio` (UID 1001) statt root
- **`no-new-privileges`** Docker Security Option
- **`x-powered-by` entfernt** — Kein Fingerprinting mehr
- **CORS-Validierung** verbessert (Produktion auf Domain beschränkbar)

### 📊 Observability

- **Strukturiertes Logging** — Pino mit JSON-Output in Produktion, Pretty-Print in Dev
- **Request-Logging** — Pfad, Methode, Status-Code, Dauer automatisch geloggt
- **Sensitive-Data-Redaction** — Passwörter, Tokens, API-Keys werden aus Logs entfernt
- **Health-Endpoints** — `GET /api/v1/live` (Liveness), `GET /api/v1/ready` (Readiness), `GET /api/v1/health` (Details mit Version/DB/Engine)
- **Automatische DB-Backups** — Tägliche SQLite-Kopie mit konfigurierbarer Aufbewahrung (Default 30 Tage)

### 🔧 Engine & Scheduler Verbesserungen

- **Retry-Logik** — `retries`-Feld wird jetzt von der Engine berücksichtigt; linearer Backoff zwischen Versuchen
- **Scheduler-Jitter** — Bis zu 10% zufälliger Versatz beim ersten Check verhindert Thundering-Herd
- **Concurrency-Schutz** — Überspringt Ticks wenn vorheriger Check noch läuft (mit Log-Warnung)
- **Push-Tracking Pruning** — Alte Push-Timestamps werden bei Aggregation bereinigt
- **Container-Metrics Index** — Neuer Index auf `container_metrics.timestamp` für effizientes Pruning

### 🐛 Bugfixes

- **Shell Injection (Kritisch)** — PingChecker erlaubte Command-Injection via `host`-Feld
- **Push-Tracker Datenverlust (Kritisch)** — In-Memory Map verlor alle Daten bei Neustart
- **DNS-Checker Performance** — Dynamisches `import()` pro Check entfernt; stattdessen statischer Resolver
- **Fake-Daten entfernt** — Seeded PRNG aus `chart.ts` und `useStore.ts` komplett entfernt; alle Charts zeigen echte API-Daten
- **Notification-Config fehlende Validierung** — Provider-spezifische Zod-Schemas validieren jetzt die Konfigurationsstruktur
- **Notification-Test ohne Rate-Limit** — Auf 5 Tests pro Minute limitiert

### 📦 Architektur & Code-Qualität

- **AES-256-GCM Encryption Utility** — Für Secrets in der Datenbank
- **Structured Error Handling** — `AppError`-Klasse mit Status-Code + operational/technical Unterscheidung
- **Backup Utility** — Automatische tägliche Backups mit Rotation
- **Dockerfile optimiert** — Multi-stage mit separatem Client-Build; non-root User
- **docker-compose.prod.yml** — Separates Production-Compose mit Security-Best-Practices
- **Nginx-Reverse-Proxy-Konfiguration** — Inkl. WebSocket-Support, SSL, Caching für Assets
- **Verbesserte .env.example** — Mit Produktions-Kommentaren und Sicherheitshinweisen

### ⬆️ Neue Abhängigkeiten

- `helmet` — Security Header
- `express-rate-limit` — Rate Limiting
- `pino` + `pino-pretty` — Strukturiertes Logging

## v2.0.0 (2026-06-12)

### 🚀 Neue Features

- **Proxmox Container-Monitoring** — Live-Polling aller LXC + QEMU VMs
  - Verbindung via Proxmox VE API (Ticket-Auth, Self-Signed TLS)
  - CPU/RAM/Disk/Ping pro Container mit Mini-Bars
  - Detail-Panel mit umschaltbaren Metric-Tabs (CPU/RAM/Disk/Netzwerk)
  - Konfigurierbares Poll-Intervall
  - Speichert Metrik-Verlauf in SQLite
- **Monitor-Editor** — Bestehende Monitore bearbeiten (IP, Port, Config, Tags)
  - Bearbeiten-Button in Monitor-Tabelle und Detail-Ansicht
  - Lädt bestehende Konfiguration, speichert via PATCH
- **Team-Einladung** — UI zum Hinzufügen von Teammitgliedern
- **Latenz-Chart** — Echte Heartbeat-Daten statt Fake-CPU-Chart

### 🔒 Security

- **SSRF-Schutz** — URL-Validierung für Notification-Provider (Discord, ntfy)
  - Blockiert Private-IPs (127.0.0.1, 10.x.x.x, 192.168.x.x, etc.)
- **WebSocket-Broadcast** — Nur noch an authentifizierte Clients
  - Unauthentifizierte Status-Page-Besucher erhalten keine Monitor-Daten
- **API-Key Auth** — `X-API-Key` Header wird jetzt akzeptiert
  - Fallback wenn kein JWT-Token vorhanden
- **TOTP-2FA** — Zwei-Faktor-Authentisierung via Authenticator-App

### 🐛 Bugfixes

- Monitor-Config war doppelt gewrappt → Checker fanden keine Konfiguration
- Time-Range Buttons zeigten "1hh", "6hh" statt "1h", "6h"
- 🔔 Glocke in Topbar hatte kein onClick
- "+ Node" Button in Topbar hatte kein onClick
- KPI Sparklines verwendeten gefakte Seed-Daten
- Entfernt: alle Mock-Daten, Platzhalter, `useChartLiveUpdates`
- `timeRange` Default war `'24h'` statt `'24'` (inkompatibel mit neuem Format)
- Division by Zero im Latenz-Chart bei nur 1 Heartbeat
- `seeded()` PRNG erzeugte deterministische Fake-Daten

### 📦 Technisch

- Monorepo mit npm Workspaces (shared, server, client)
- 11 SQLite-Migrationen
- Canvas-Chart-Engine (retina-scharf, self-signed TLS via https.request)
- TailwindCSS v4

## v1.0.0 (2026-06-11)

- Initiale Version: Dashboard-Design, Uptime-Monitore, Benachrichtigungen
- 6 Checker-Typen: HTTP, TCP, Ping, DNS, SSL, Push
- 5 Notification-Provider: Webhook, Telegram, Discord, Email, ntfy
- REST-API unter /api/v1 (30+ Endpoints)
- JWT-Auth + Refresh-Token-Rotation
- Dark/Light Theme

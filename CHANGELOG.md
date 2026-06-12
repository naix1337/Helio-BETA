# Changelog

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

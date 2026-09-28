# Helio Client

React 19 + Vite + Tailwind v4 dashboard for Helio.

```bash
npm run dev -w client     # http://localhost:5173 (proxies /api and /ws to http://localhost:3001)
npm run build -w client   # output: client/dist (served by the server)
```

Set `HELIO_BACKEND` to proxy to another backend during development.

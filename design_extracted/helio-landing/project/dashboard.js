/* ============================================================
   Helio Dashboard — app logic
   theme · sidebar · view routing · live canvas charts · data
   ============================================================ */
(function () {
  "use strict";

  const root = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const css = (v) => getComputedStyle(root).getPropertyValue(v).trim();

  /* ---------- Theme (shared key) ---------- */
  const THEME_KEY = "helio-theme";
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) root.setAttribute("data-theme", saved);
  document.querySelectorAll("[data-theme-toggle]").forEach((b) =>
    b.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.setAttribute("data-theme", next);
      localStorage.setItem(THEME_KEY, next);
      redrawAll();
    })
  );

  /* ---------- Mobile sidebar ---------- */
  const aside = document.getElementById("aside");
  const backdrop = document.querySelector("[data-side-close]");
  const mburger = document.querySelector(".mburger");
  const closeSide = () => { aside.classList.remove("open"); backdrop.classList.remove("show"); };
  if (mburger) mburger.addEventListener("click", () => {
    const open = aside.classList.toggle("open"); backdrop.classList.toggle("show", open);
  });
  if (backdrop) backdrop.addEventListener("click", closeSide);
  window.addEventListener("resize", () => { if (window.innerWidth > 860) closeSide(); });

  /* ---------- View routing ---------- */
  const titles = {
    overview: ["Übersicht", "prod · alle Regionen"],
    nodes: ["Nodes", "12 Nodes · 4 Regionen"],
    containers: ["Container", "14 laufend · auto-discovered"],
    alerts: ["Alerts", "3 aktiv · 1 kritisch"],
    status: ["Status-Page", "öffentlich · status.helio.sh"],
    metrics: ["Metriken", "2,4 M Datenpunkte / min"],
    team: ["Team", "4 Mitglieder"],
    settings: ["Einstellungen", "Instanz-Konfiguration"],
  };
  const navItems = Array.prototype.slice.call(document.querySelectorAll(".anav-item"));
  const VIEW_KEY = "helio-dash-view";

  function setView(view) {
    if (!titles[view]) view = "overview";
    document.querySelectorAll(".content").forEach((c) => c.classList.remove("active"));
    const el = document.getElementById("view-" + view);
    if (el) el.classList.add("active");
    navItems.forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    document.getElementById("pageTitle").textContent = titles[view][0];
    document.getElementById("pageCrumb").textContent = titles[view][1];
    document.title = titles[view][0] + " — Helio Dashboard";
    localStorage.setItem(VIEW_KEY, view);
    if (window.innerWidth <= 860) closeSide();
    window.scrollTo(0, 0);
  }
  navItems.forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
  document.querySelectorAll("[data-goto]").forEach((a) =>
    a.addEventListener("click", (e) => { e.preventDefault(); setView(a.dataset.goto); })
  );
  setView(localStorage.getItem(VIEW_KEY) || "overview");

  /* ---------- Time-range segmented ---------- */
  const rangeLabels = { "1h": "letzte Stunde", "6h": "letzte 6 h", "24h": "letzte 24 h", "7d": "letzte 7 Tage" };
  document.querySelectorAll("#rangeSeg button").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("#rangeSeg button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      const sub = document.getElementById("chartSub");
      if (sub) sub.textContent = "CPU & Netzwerk · " + rangeLabels[b.dataset.range];
      mainSeries = makeSeries(rangePoints(b.dataset.range));
      drawMain();
    })
  );
  function rangePoints(r) { return r === "1h" ? 60 : r === "6h" ? 72 : r === "24h" ? 96 : 84; }

  /* ============================================================
     DATA
     ============================================================ */
  const REGIONS = ["fra-1", "ams-1", "sfo-1", "sgp-1"];
  const NODES = [
    { name: "web-01", region: "ams-1", cpu: 87, ram: 64, disk: 42, lat: 24, st: "warn" },
    { name: "web-02", region: "ams-1", cpu: 41, ram: 52, disk: 38, lat: 22, st: "ok" },
    { name: "db-primary", region: "fra-1", cpu: 56, ram: 71, disk: 78, lat: 11, st: "ok" },
    { name: "db-replica", region: "fra-1", cpu: 34, ram: 66, disk: 74, lat: 13, st: "ok" },
    { name: "cache-02", region: "fra-1", cpu: 0, ram: 0, disk: 12, lat: 0, st: "down" },
    { name: "worker-eu-1", region: "ams-1", cpu: 62, ram: 48, disk: 30, lat: 32, st: "ok" },
    { name: "worker-eu-2", region: "fra-1", cpu: 58, ram: 45, disk: 28, lat: 29, st: "ok" },
    { name: "cdn-edge-1", region: "sfo-1", cpu: 23, ram: 31, disk: 19, lat: 48, st: "ok" },
    { name: "cdn-edge-3", region: "sfo-1", cpu: 27, ram: 34, disk: 22, lat: 51, st: "ok" },
    { name: "queue-01", region: "sgp-1", cpu: 44, ram: 39, disk: 25, lat: 86, st: "ok" },
    { name: "metrics-01", region: "fra-1", cpu: 51, ram: 58, disk: 61, lat: 14, st: "ok" },
    { name: "gateway-01", region: "ams-1", cpu: 38, ram: 42, disk: 33, lat: 26, st: "ok" },
  ];
  const CONTAINERS = [
    { name: "helio-api", img: "helio/api:2.8.1", cpu: 12, mem: 184, st: "ok" },
    { name: "postgres", img: "postgres:16-alpine", cpu: 22, mem: 512, st: "ok" },
    { name: "redis", img: "redis:7.2", cpu: 4, mem: 64, st: "ok" },
    { name: "nginx", img: "nginx:1.27", cpu: 3, mem: 28, st: "ok" },
    { name: "grafana-import", img: "helio/import:latest", cpu: 0, mem: 0, st: "down" },
    { name: "worker-default", img: "helio/worker:2.8.1", cpu: 18, mem: 220, st: "ok" },
    { name: "worker-cron", img: "helio/worker:2.8.1", cpu: 7, mem: 142, st: "ok" },
    { name: "minio", img: "minio/minio:latest", cpu: 9, mem: 196, st: "ok" },
    { name: "prometheus", img: "prom/prometheus:2.54", cpu: 15, mem: 308, st: "warn" },
  ];

  /* deterministic-ish pseudo random so charts look natural but stable per load */
  function seeded(seed) { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }

  function makeSeries(n) {
    const r1 = seeded(7), r2 = seeded(42);
    const cpu = [], net = [];
    let c = 38, nt = 60;
    for (let i = 0; i < n; i++) {
      c += (r1() - 0.5) * 10; c = Math.max(14, Math.min(92, c));
      nt += (r2() - 0.5) * 22; nt = Math.max(20, Math.min(140, nt));
      cpu.push(c); net.push(nt);
    }
    return { cpu, net };
  }
  let mainSeries = makeSeries(96);

  /* ============================================================
     CHART DRAWING (canvas, retina-aware)
     ============================================================ */
  function prep(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }
  function pts(data, w, h, pad, min, max) {
    const n = data.length; const span = max - min || 1;
    return data.map((v, i) => ({
      x: pad + (i / (n - 1)) * (w - pad * 2),
      y: h - pad - ((v - min) / span) * (h - pad * 2),
    }));
  }
  function smoothPath(ctx, p) {
    ctx.moveTo(p[0].x, p[0].y);
    for (let i = 0; i < p.length - 1; i++) {
      const xc = (p[i].x + p[i + 1].x) / 2, yc = (p[i].y + p[i + 1].y) / 2;
      ctx.quadraticCurveTo(p[i].x, p[i].y, xc, yc);
    }
    ctx.lineTo(p[p.length - 1].x, p[p.length - 1].y);
  }

  function drawMain() {
    const canvas = document.getElementById("mainChart");
    if (!canvas) return;
    const { ctx, w, h } = prep(canvas);
    ctx.clearRect(0, 0, w, h);
    const pad = 8;
    const primary = css("--primary"), violet = css("--violet"), grid = css("--grid-line") || "rgba(255,255,255,0.05)";

    // horizontal gridlines
    ctx.strokeStyle = grid; ctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) {
      const y = pad + (g / 4) * (h - pad * 2);
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke();
    }

    // net (violet) — area + line
    const np = pts(mainSeries.net, w, h, pad, 0, 160);
    let grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, hexA(violet, 0.22)); grad.addColorStop(1, hexA(violet, 0));
    ctx.beginPath(); smoothPath(ctx, np); ctx.lineTo(w - pad, h - pad); ctx.lineTo(pad, h - pad); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath(); smoothPath(ctx, np); ctx.strokeStyle = violet; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.stroke();

    // cpu (primary) — area + line on top
    const cp = pts(mainSeries.cpu, w, h, pad, 0, 100);
    grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, hexA(primary, 0.28)); grad.addColorStop(1, hexA(primary, 0));
    ctx.beginPath(); smoothPath(ctx, cp); ctx.lineTo(w - pad, h - pad); ctx.lineTo(pad, h - pad); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath(); smoothPath(ctx, cp); ctx.strokeStyle = primary; ctx.lineWidth = 2.4; ctx.lineJoin = "round"; ctx.stroke();

    // last-point dot
    const last = cp[cp.length - 1];
    ctx.beginPath(); ctx.arc(last.x, last.y, 3.5, 0, Math.PI * 2); ctx.fillStyle = primary; ctx.fill();
    ctx.beginPath(); ctx.arc(last.x, last.y, 6.5, 0, Math.PI * 2); ctx.strokeStyle = hexA(primary, 0.4); ctx.lineWidth = 2; ctx.stroke();
  }

  /* sparkline canvases */
  function drawSpark(canvas) {
    const { ctx, w, h } = prep(canvas);
    ctx.clearRect(0, 0, w, h);
    const colKey = canvas.dataset.color === "violet" ? "--violet" : "--primary";
    const color = css(colKey);
    const seedMap = { nodes: 3, cpu: 11, ram: 19, uptime: 5 };
    const r = seeded(seedMap[canvas.dataset.spark] || 9);
    const n = 28, data = [];
    let v = 50;
    for (let i = 0; i < n; i++) { v += (r() - 0.5) * 16; v = Math.max(20, Math.min(90, v)); data.push(v); }
    if (canvas.dataset.spark === "uptime") for (let i = 0; i < n; i++) data[i] = 78 + r() * 14;
    const pad = 3;
    const p = pts(data, w, h, pad, 10, 100);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, hexA(color, 0.25)); grad.addColorStop(1, hexA(color, 0));
    ctx.beginPath(); smoothPath(ctx, p); ctx.lineTo(w - pad, h - pad); ctx.lineTo(pad, h - pad); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath(); smoothPath(ctx, p); ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.lineJoin = "round"; ctx.stroke();
  }

  /* row sparkline (small, in tables) */
  function drawRowSpark(canvas, seed, state) {
    const { ctx, w, h } = prep(canvas);
    ctx.clearRect(0, 0, w, h);
    const color = state === "down" ? css("--down") : state === "warn" ? css("--warn") : css("--primary");
    const r = seeded(seed);
    const n = 20, data = [];
    let v = 45;
    for (let i = 0; i < n; i++) { v += (r() - 0.5) * 20; v = Math.max(10, Math.min(95, v)); data.push(state === "down" ? 6 : v); }
    const pad = 2;
    const p = pts(data, w, h, pad, 0, 100);
    ctx.beginPath(); smoothPath(ctx, p); ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.lineJoin = "round"; ctx.stroke();
  }

  /* color helpers: turn a hex or rgb into rgba with alpha */
  function hexA(c, a) {
    c = c.trim();
    if (c.startsWith("#")) {
      let h = c.slice(1);
      if (h.length === 3) h = h.split("").map((x) => x + x).join("");
      const n = parseInt(h, 16);
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    }
    if (c.startsWith("rgb")) {
      const nums = c.match(/[\d.]+/g);
      return `rgba(${nums[0]}, ${nums[1]}, ${nums[2]}, ${a})`;
    }
    return c;
  }

  function redrawAll() {
    drawMain();
    document.querySelectorAll(".kspark").forEach(drawSpark);
    document.querySelectorAll(".row-spark").forEach((c) => drawRowSpark(c, +c.dataset.seed, c.dataset.state));
  }

  /* ============================================================
     TABLE / GRID POPULATION
     ============================================================ */
  function statusBadge(st) {
    const map = { ok: ["ok", "online"], warn: ["warn", "latenz"], down: ["down", "offline"] };
    const [cls, label] = map[st] || map.ok;
    return `<span class="badge badge-status ${cls}">${label}</span>`;
  }
  function bar(val, st) {
    const cls = st === "down" ? "down" : val >= 80 ? "warn" : "";
    return `<span class="mini-bar"><i class="${cls}" style="width:${val}%"></i></span>`;
  }

  function fillNodeTable(tbodySel, full) {
    const tb = document.querySelector(tbodySel + " tbody");
    if (!tb) return;
    tb.innerHTML = NODES.map((nd, i) => {
      const lat = nd.st === "down" ? "—" : nd.lat + " ms";
      const cpu = nd.st === "down" ? "—" : nd.cpu + " %";
      const ram = nd.st === "down" ? "—" : nd.ram + " %";
      const disk = nd.st === "down" ? "—" : nd.disk + " %";
      let cols = `
        <td><span class="nname"><span class="s-dot ${nd.st}"></span><span class="nm">${nd.name}</span></span></td>
        <td class="col-hide sub">${nd.region}</td>
        <td><span class="metric">${cpu}</span> ${bar(nd.cpu, nd.st)}</td>`;
      if (full) {
        cols += `<td><span class="metric">${ram}</span> ${bar(nd.ram, nd.st)}</td>
                 <td class="col-hide"><span class="metric">${disk}</span></td>`;
      } else {
        cols += `<td class="col-hide"><span class="metric">${ram}</span> ${bar(nd.ram, nd.st)}</td>`;
      }
      cols += `<td class="col-hide"><canvas class="row-spark" data-seed="${i + 2}" data-state="${nd.st}"></canvas></td>
               <td class="right metric">${lat}</td>
               <td class="right">${statusBadge(nd.st)}</td>`;
      return `<tr>${cols}</tr>`;
    }).join("");
  }

  function fillContainers() {
    const grid = document.getElementById("containerGrid");
    if (!grid) return;
    grid.innerHTML = CONTAINERS.map((c) => `
      <div class="ccard">
        <div class="ccard-top">
          <span class="cc-name"><i data-lucide="box"></i><span class="nm">${c.name}</span></span>
          ${statusBadge(c.st)}
        </div>
        <div class="cc-img">${c.img}</div>
        <div class="ccard-stats">
          <div class="cs"><div class="l">CPU</div><div class="v">${c.st === "down" ? "—" : c.cpu + " %"}</div></div>
          <div class="cs"><div class="l">RAM</div><div class="v">${c.st === "down" ? "—" : c.mem + " MB"}</div></div>
        </div>
      </div>`).join("");
  }

  fillNodeTable("#nodeTableOverview", false);
  fillNodeTable("#nodeTableFull", true);
  fillContainers();
  if (window.__helioIcons) window.__helioIcons();

  // initial draw (after layout)
  requestAnimationFrame(redrawAll);
  setTimeout(redrawAll, 200);
  window.addEventListener("resize", debounce(redrawAll, 150));

  /* ============================================================
     LIVE UPDATES — shift the main chart + nudge readouts
     ============================================================ */
  function tickChart() {
    const s = mainSeries;
    const r = Math.random;
    let c = s.cpu[s.cpu.length - 1] + (r() - 0.5) * 9; c = Math.max(14, Math.min(92, c));
    let n = s.net[s.net.length - 1] + (r() - 0.5) * 20; n = Math.max(20, Math.min(150, n));
    s.cpu.push(c); s.cpu.shift(); s.net.push(n); s.net.shift();
    drawMain();
    // readouts
    document.querySelectorAll('[data-readout="cpu"]').forEach((e) => e.innerHTML = Math.round(c) + "<small>%</small>");
    const cpu2 = document.querySelector('[data-readout="cpu2"]'); if (cpu2) cpu2.textContent = c.toFixed(1).replace(".", ",") + " %";
  }
  function tickJitter() {
    document.querySelectorAll("[data-jitter2]").forEach((el) => {
      const base = +el.dataset.jitter2;
      el.textContent = Math.max(8, base + (Math.random() - 0.5) * 8).toFixed(0) + " ms";
    });
  }
  if (!reduce) {
    setInterval(tickChart, 2600);
    setInterval(tickJitter, 2000);
  }

  /* ---------- utils ---------- */
  function debounce(fn, ms) { let t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }
})();

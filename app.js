/* ============================================================
   Helio — interactions
   theme · nav scroll · burger · accordion · copy · counters · reveal
   ============================================================ */
(function () {
  "use strict";

  /* ---------- Theme toggle (persisted) ---------- */
  const root = document.documentElement;
  const THEME_KEY = "helio-theme";
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) root.setAttribute("data-theme", saved);

  function toggleTheme() {
    const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
  }
  document.querySelectorAll("[data-theme-toggle]").forEach((b) =>
    b.addEventListener("click", toggleTheme)
  );

  /* ---------- Navbar scrolled state ---------- */
  const nav = document.querySelector(".nav");
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 12);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Mobile menu ---------- */
  const burger = document.querySelector(".burger");
  const menu = document.querySelector(".mobile-menu");
  if (burger && menu) {
    const close = () => { menu.classList.remove("open"); burger.setAttribute("aria-expanded", "false"); };
    burger.addEventListener("click", () => {
      const open = menu.classList.toggle("open");
      burger.setAttribute("aria-expanded", String(open));
    });
    menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));
    window.addEventListener("resize", () => { if (window.innerWidth > 860) close(); });
  }

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll(".faq-item").forEach((item) => {
    const q = item.querySelector(".faq-q");
    const a = item.querySelector(".faq-a");
    q.addEventListener("click", () => {
      const isOpen = item.classList.contains("open");
      // close siblings
      document.querySelectorAll(".faq-item.open").forEach((o) => {
        if (o !== item) { o.classList.remove("open"); o.querySelector(".faq-a").style.height = "0px"; }
      });
      if (isOpen) {
        a.style.height = a.scrollHeight + "px"; requestAnimationFrame(() => (a.style.height = "0px"));
        item.classList.remove("open");
      } else {
        item.classList.add("open");
        a.style.height = a.scrollHeight + "px";
        a.addEventListener("transitionend", function te() { if (item.classList.contains("open")) a.style.height = "auto"; a.removeEventListener("transitionend", te); });
      }
      q.setAttribute("aria-expanded", String(!isOpen));
    });
  });

  /* ---------- Copy buttons ---------- */
  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const text = btn.getAttribute("data-copy");
      try { await navigator.clipboard.writeText(text); }
      catch (e) {
        const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta);
        ta.select(); document.execCommand("copy"); ta.remove();
      }
      btn.classList.add("copied");
      const lbl = btn.querySelector(".copy-label");
      if (lbl) { const o = lbl.textContent; lbl.textContent = "Kopiert!"; setTimeout(() => (lbl.textContent = o), 1600); }
      setTimeout(() => btn.classList.remove("copied"), 1600);
    });
  });

  /* ---------- Feature card pointer glow ---------- */
  document.querySelectorAll(".feat-card").forEach((c) => {
    c.addEventListener("pointermove", (e) => {
      const r = c.getBoundingClientRect();
      c.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%");
      c.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 100 + "%");
    });
  });

  /* ---------- Scroll reveal (degrades safely — content is ALWAYS shown) ---------- */
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const reveals = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  const show = (el) => el.classList.add("in");

  if (reduce) {
    reveals.forEach(show);
  } else {
    // 1) Anything already within (or near) the viewport on load is shown immediately.
    const markInView = () => {
      const vh = window.innerHeight || document.documentElement.clientHeight;
      reveals.forEach((el) => {
        if (el.classList.contains("in")) return;
        const r = el.getBoundingClientRect();
        if (r.top < vh * 0.92 && r.bottom > 0) show(el);
      });
    };
    markInView();

    // 2) IntersectionObserver enhances the rest as they scroll into view.
    let ioFired = false;
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => entries.forEach((en) => {
          ioFired = true;
          if (en.isIntersecting) { show(en.target); io.unobserve(en.target); }
        }),
        { threshold: 0.1, rootMargin: "0px 0px -6% 0px" }
      );
      reveals.forEach((el) => { if (!el.classList.contains("in")) io.observe(el); });
    }

    // 3) Scroll/resize backstop in case the observer is throttled.
    window.addEventListener("scroll", markInView, { passive: true });
    window.addEventListener("resize", markInView);

    // 4) Hard fallback: if the observer never delivered a callback, reveal everything.
    setTimeout(() => { if (!ioFired) reveals.forEach(show); }, 1200);
  }

  /* ---------- Animated counters ---------- */
  function animateCount(el) {
    const target = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || "0", 10);
    const dur = 1700;
    const start = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    function frame(now) {
      const p = Math.min((now - start) / dur, 1);
      const v = target * ease(p);
      el.textContent = v.toLocaleString("de-DE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = target.toLocaleString("de-DE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }
    requestAnimationFrame(frame);
  }
  const counters = document.querySelectorAll("[data-count]");
  const setFinal = (el) => {
    const d = parseInt(el.dataset.decimals || "0", 10);
    el.textContent = parseFloat(el.dataset.count).toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });
  };
  if (reduce) {
    counters.forEach(setFinal);
  } else {
    let started = false;
    const runAll = () => { started = true; counters.forEach((el) => { if (!el.dataset.done) { el.dataset.done = "1"; animateCount(el); } }); };
    if ("IntersectionObserver" in window) {
      const cio = new IntersectionObserver(
        (entries) => entries.forEach((en) => { if (en.isIntersecting && !en.target.dataset.done) { started = true; en.target.dataset.done = "1"; animateCount(en.target); cio.unobserve(en.target); } }),
        { threshold: 0.5 }
      );
      counters.forEach((el) => cio.observe(el));
    }
    // Fallback: if nothing started after 1.4s, animate them all.
    setTimeout(() => { if (!started) runAll(); }, 1400);
  }

  /* ---------- Live-demo tiny CPU jitter (keeps mockup feeling alive) ---------- */
  const liveLatency = document.querySelectorAll("[data-jitter]");
  if (!reduce && liveLatency.length) {
    setInterval(() => {
      liveLatency.forEach((el) => {
        const base = parseFloat(el.dataset.jitter);
        const v = base + (Math.random() - 0.5) * 6;
        el.textContent = Math.max(1, v).toFixed(0) + "ms";
      });
    }, 2200);
  }
})();

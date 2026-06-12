/* ============================================================
   Helio Docs — interactions
   theme · sidebar · search filter · copy · scrollspy · "/" focus
   ============================================================ */
(function () {
  "use strict";

  /* ---------- Theme toggle (shares key with landing page) ---------- */
  const root = document.documentElement;
  const THEME_KEY = "helio-theme";
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) root.setAttribute("data-theme", saved);
  document.querySelectorAll("[data-theme-toggle]").forEach((b) =>
    b.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.setAttribute("data-theme", next);
      localStorage.setItem(THEME_KEY, next);
    })
  );

  /* ---------- Mobile sidebar ---------- */
  const side = document.getElementById("dside");
  const burger = document.querySelector(".dburger");
  const backdrop = document.querySelector("[data-side-close]");
  function closeSide() { side.classList.remove("open"); backdrop.classList.remove("show"); burger.setAttribute("aria-expanded", "false"); }
  function openSide() { side.classList.add("open"); backdrop.classList.add("show"); burger.setAttribute("aria-expanded", "true"); }
  if (burger) burger.addEventListener("click", () => (side.classList.contains("open") ? closeSide() : openSide()));
  if (backdrop) backdrop.addEventListener("click", closeSide);
  side.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => { if (window.innerWidth <= 860) closeSide(); }));
  window.addEventListener("resize", () => { if (window.innerWidth > 860) closeSide(); });

  /* ---------- Language switch ---------- */
  document.querySelectorAll(".lang-switch button").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll(".lang-switch button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
    })
  );

  /* ---------- Sidebar search filter ---------- */
  const search = document.getElementById("docSearch");
  const groups = Array.prototype.slice.call(document.querySelectorAll(".dnav-group"));
  const empty = document.getElementById("navEmpty");
  if (search) {
    search.addEventListener("input", () => {
      const q = search.value.trim().toLowerCase();
      let any = false;
      groups.forEach((g) => {
        let groupHas = false;
        g.querySelectorAll("li").forEach((li) => {
          const match = !q || li.textContent.toLowerCase().includes(q);
          li.style.display = match ? "" : "none";
          if (match) groupHas = true;
        });
        g.style.display = groupHas ? "" : "none";
        if (groupHas) any = true;
      });
      if (empty) {
        empty.style.display = any ? "none" : "block";
        const sp = empty.querySelector("span"); if (sp) sp.textContent = q;
      }
    });
    // "/" focuses search
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement !== search && !/input|textarea/i.test(document.activeElement.tagName)) {
        e.preventDefault(); search.focus();
      }
      if (e.key === "Escape" && document.activeElement === search) { search.value = ""; search.dispatchEvent(new Event("input")); search.blur(); }
    });
  }

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
      if (lbl) { lbl.textContent = "Kopiert!"; }
      setTimeout(() => { btn.classList.remove("copied"); if (lbl) lbl.textContent = "Kopieren"; }, 1600);
    });
  });

  /* ---------- Scrollspy for right TOC ---------- */
  const tocLinks = Array.prototype.slice.call(document.querySelectorAll(".dtoc a"));
  const sections = tocLinks
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);
  if (sections.length && "IntersectionObserver" in window) {
    const seen = new Map();
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => seen.set(en.target.id, en.isIntersecting ? en.intersectionRatio : 0));
        // pick the topmost visible section
        let bestId = null, bestTop = Infinity;
        sections.forEach((s) => {
          const r = s.getBoundingClientRect();
          if (r.top < window.innerHeight * 0.5 && r.bottom > 90 && r.top < bestTop) { bestTop = r.top; bestId = s.id; }
        });
        if (bestId) {
          tocLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + bestId));
        }
      },
      { rootMargin: "-80px 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] }
    );
    sections.forEach((s) => spy.observe(s));
  }
})();

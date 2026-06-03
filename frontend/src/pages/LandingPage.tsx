// helio-app/frontend/src/pages/LandingPage.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard, Server, Box, Bell, Activity, Settings, Users,
  Lock, Moon, Sun, Menu, Play, CheckCircle2, Star,
  LineChart, BellRing, ShieldCheck, Globe, Network,
  Check, AlertOctagon, AlertTriangle, Mail, MessageSquare,
  Terminal, Cpu, Zap, Gauge, HardDrive, BookOpen, Copy,
  MessageCircle, Rss,
} from 'lucide-react';
import '../styles/landing.css';

const GH_ICON = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15" aria-hidden="true">
    <path d="M12 .5C5.73.5.5 5.73.5 12.18c0 5.16 3.35 9.53 8 11.08.58.11.79-.26.79-.57v-2.2c-3.26.72-3.95-1.4-3.95-1.4-.53-1.36-1.3-1.72-1.3-1.72-1.06-.74.08-.72.08-.72 1.18.08 1.8 1.23 1.8 1.23 1.04 1.82 2.74 1.3 3.41.99.1-.77.41-1.3.74-1.6-2.6-.3-5.34-1.32-5.34-5.87 0-1.3.46-2.36 1.22-3.19-.12-.3-.53-1.51.12-3.15 0 0 1-.32 3.3 1.22a11.4 11.4 0 0 1 6 0c2.28-1.54 3.29-1.22 3.29-1.22.65 1.64.24 2.85.12 3.15.76.83 1.21 1.89 1.21 3.19 0 4.56-2.75 5.56-5.36 5.86.42.37.8 1.1.8 2.22v3.29c0 .31.21.69.8.57 4.65-1.55 8-5.92 8-11.08C23.5 5.73 18.27.5 12 .5z"/>
  </svg>
);
const X_ICON = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="17" height="17" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817-5.97 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
  </svg>
);

const FAQ_ITEMS = [
  { q: 'Muss ich Helio wirklich selbst hosten?', a: 'Ja — und genau das ist der Punkt. Helio läuft vollständig auf deiner eigenen Infrastruktur, sodass deine Metriken niemals einen fremden Server erreichen. Du brauchst nur Docker oder ein einzelnes Binary; eine externe Datenbank ist nicht erforderlich.' },
  { q: 'Wie unterscheidet sich Helio von Grafana oder Uptime Kuma?', a: 'Helio kombiniert Metrik-Erfassung, Alerting und Status-Pages in einem einzigen Tool — ohne dass du Prometheus, Grafana und einen Uptime-Checker separat betreiben und verbinden musst. Der Fokus liegt auf einfacher Einrichtung und einem schlanken Footprint von rund 42 MB RAM.' },
  { q: 'Welche Systeme und Plattformen werden unterstützt?', a: 'Linux (x86-64 & ARM, inkl. Raspberry Pi), Docker und Kubernetes. Agents laufen auf praktisch jedem Host; das Dashboard funktioniert in jedem modernen Browser. macOS- und Windows-Hosts werden über den Agent ebenfalls überwacht.' },
  { q: 'Ist Helio wirklich Open Source?', a: 'Ja. Der Kern von Helio steht unter der Apache-2.0-Lizenz und ist vollständig auf GitHub einsehbar. Die kostenpflichtigen Pläne fügen lediglich gehostete Komfortfunktionen und Team-Features hinzu — die self-hosted Variante bleibt für immer frei.' },
  { q: 'Wie funktioniert das Alerting genau?', a: 'Du definierst Regeln auf Basis von Schwellwerten oder Ausfällen und ordnest ihnen Kanäle zu — Webhook, E-Mail, Slack, Discord, Telegram oder PagerDuty. Eskalationsstufen, Ruhezeiten und automatisches Auto-Resolve sind eingebaut, und Alarme werden gruppiert, um Benachrichtigungs-Spam zu vermeiden.' },
  { q: 'Kann ich von einem anderen Tool migrieren?', a: 'In den meisten Fällen ja. Helio importiert Prometheus-kompatible Metriken und kann bestehende Uptime-Checks übernehmen. Unsere Docs enthalten Schritt-für-Schritt-Anleitungen für die gängigsten Setups.' },
];

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const faqRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Nav scroll state
  useEffect(() => {
    const handler = () => setNavScrolled(window.scrollY > 12);
    handler();
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Close mobile menu on resize
  useEffect(() => {
    const handler = () => { if (window.innerWidth > 860) setMenuOpen(false); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Scroll reveal
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const reveals = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
    const show = (el: HTMLElement) => el.classList.add('in');
    if (reduce) { reveals.forEach(show); return; }

    const markInView = () => {
      const vh = window.innerHeight;
      reveals.forEach(el => {
        if (el.classList.contains('in')) return;
        const r = el.getBoundingClientRect();
        if (r.top < vh * 0.92 && r.bottom > 0) show(el);
      });
    };
    markInView();

    if (typeof window.IntersectionObserver !== 'undefined') {
      const io = new IntersectionObserver(
        entries => entries.forEach(en => { if (en.isIntersecting) { show(en.target as HTMLElement); io.unobserve(en.target); } }),
        { threshold: 0.1, rootMargin: '0px 0px -6% 0px' }
      );
      reveals.forEach(el => { if (!el.classList.contains('in')) io.observe(el); });
      return () => io.disconnect();
    }
    const w = window as Window & typeof globalThis;
    w.addEventListener('scroll', markInView, { passive: true });
    return () => w.removeEventListener('scroll', markInView);
  }, []);

  // Animated counters
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const counters = Array.from(document.querySelectorAll<HTMLElement>('[data-count]'));
    const setFinal = (el: HTMLElement) => {
      const d = parseInt(el.dataset.decimals ?? '0', 10);
      el.textContent = parseFloat(el.dataset.count!).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
    };
    if (reduce) { counters.forEach(setFinal); return; }

    const animate = (el: HTMLElement) => {
      const target = parseFloat(el.dataset.count!);
      const decimals = parseInt(el.dataset.decimals ?? '0', 10);
      const dur = 1700;
      const start = performance.now();
      const ease = (t: number) => 1 - Math.pow(1 - t, 3);
      const frame = (now: number) => {
        const p = Math.min((now - start) / dur, 1);
        el.textContent = (target * ease(p)).toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        if (p < 1) requestAnimationFrame(frame);
        else setFinal(el);
      };
      requestAnimationFrame(frame);
    };

    if ('IntersectionObserver' in window) {
      const cio = new IntersectionObserver(
        entries => entries.forEach(en => { if (en.isIntersecting && !en.target.getAttribute('data-done')) { (en.target as HTMLElement).dataset.done = '1'; animate(en.target as HTMLElement); cio.unobserve(en.target); } }),
        { threshold: 0.5 }
      );
      counters.forEach(el => cio.observe(el));
      return () => cio.disconnect();
    }
  }, []);

  // Feature card pointer glow
  useEffect(() => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>('.feat-card'));
    const handlers: [HTMLElement, (e: PointerEvent) => void][] = cards.map(c => {
      const h = (e: PointerEvent) => {
        const r = c.getBoundingClientRect();
        c.style.setProperty('--mx', ((e.clientX - r.left) / r.width) * 100 + '%');
        c.style.setProperty('--my', ((e.clientY - r.top) / r.height) * 100 + '%');
      };
      c.addEventListener('pointermove', h);
      return [c, h];
    });
    return () => handlers.forEach(([c, h]) => c.removeEventListener('pointermove', h));
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    localStorage.setItem('helio-theme', next);
  };

  const toggleFaq = (i: number) => {
    const el = faqRefs.current[i];
    if (!el) return;
    if (openFaq === i) {
      el.style.height = el.scrollHeight + 'px';
      requestAnimationFrame(() => { el.style.height = '0px'; });
      setOpenFaq(null);
    } else {
      if (openFaq !== null && faqRefs.current[openFaq]) {
        faqRefs.current[openFaq]!.style.height = '0px';
      }
      setOpenFaq(i);
      el.style.height = el.scrollHeight + 'px';
      el.addEventListener('transitionend', function te() {
        if (openFaq !== i) el.style.height = 'auto';
        el.removeEventListener('transitionend', te);
      });
    }
  };

  const handleCopy = async () => {
    const text = 'curl -fsSL helio.sh/install | sh';
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement('textarea'); ta.value = text;
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <>
      {/* NAVBAR */}
      <header className={`nav${navScrolled ? ' scrolled' : ''}`}>
        <div className="container nav-inner">
          <a href="#top" className="brand">
            <span className="brand-mark" aria-hidden="true" />
            Helio
          </a>
          <nav className="nav-links" aria-label="Hauptnavigation">
            <a href="#features">Features</a>
            <a href="#preise">Preise</a>
            <a href="#docs">Docs</a>
            <a href="#github"><GH_ICON />GitHub</a>
          </nav>
          <div className="nav-actions">
            <button className="theme-toggle" onClick={toggleTheme} aria-label="Farbschema wechseln">
              <Moon size={18} className="icon-moon" />
              <Sun size={18} className="icon-sun" />
            </button>
            <Link to="/dashboard" className="btn btn-primary btn-sm">Jetzt starten</Link>
            <button className="burger" aria-label="Menü öffnen" aria-expanded={menuOpen}
              onClick={() => setMenuOpen(v => !v)}>
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>

      <nav className={`mobile-menu${menuOpen ? ' open' : ''}`} aria-label="Mobile Navigation">
        <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
        <a href="#preise" onClick={() => setMenuOpen(false)}>Preise</a>
        <a href="#docs" onClick={() => setMenuOpen(false)}>Docs</a>
        <a href="#github" onClick={() => setMenuOpen(false)}>GitHub</a>
        <Link to="/dashboard" className="btn btn-primary" onClick={() => setMenuOpen(false)}>Jetzt starten</Link>
      </nav>

      <main id="top">

        {/* HERO */}
        <section className="hero section-pad">
          <div className="hero-bg" aria-hidden="true" />
          <div className="container hero-inner">
            <a href="#github" className="gh-pill reveal">
              <span className="gh-l"><GH_ICON />helio/helio</span>
              <span className="gh-r"><Star size={14} />8.247</span>
            </a>
            <h1 className="display reveal d1">
              Monitoring, das dir gehört.<br /><span className="accent">Auf deinem Server.</span>
            </h1>
            <p className="lead reveal d2">
              Helio überwacht Server, Container und Dienste in Echtzeit — komplett self-hosted, Open Source und ohne Cloud-Zwang. Metriken, Alerting und Status-Pages in einem schlanken Binary.
            </p>
            <div className="hero-cta reveal d3">
              <Link to="/dashboard" className="btn btn-primary btn-lg">Kostenlos hosten</Link>
              <a href="#demo" className="btn btn-secondary btn-lg"><Play size={18} />Demo ansehen</a>
            </div>
            <p className="hero-note reveal d3"><CheckCircle2 size={15} />Ein Binary · keine Datenbank nötig · in unter 60 Sekunden live</p>

            <div className="mockup-wrap reveal d4">
              <div className="mockup">
                <div className="mockup-bar">
                  <span className="traffic" aria-hidden="true"><i /><i /><i /></span>
                  <span className="mockup-url"><Lock size={12} />helio.dein-server.de/dashboard</span>
                </div>
                <div className="mockup-body">
                  <aside className="mock-side">
                    <div className="si active"><LayoutDashboard size={16} />Übersicht</div>
                    <div className="si"><Server size={16} />Nodes</div>
                    <div className="si"><Box size={16} />Container</div>
                    <div className="si"><Bell size={16} />Alerts</div>
                    <div className="si"><Activity size={16} />Status-Page</div>
                    <div className="si-label">System</div>
                    <div className="si"><Settings size={16} />Einstellungen</div>
                    <div className="si"><Users size={16} />Team</div>
                  </aside>
                  <div className="mock-main">
                    <div className="mock-h">
                      <h4>Übersicht</h4>
                      <span className="sub">Letzte 24 h · live</span>
                    </div>
                    <div className="mock-stats">
                      <div className="stat-card">
                        <div className="lbl"><span>CPU-Auslastung</span><span className="t up">↘ 4,2 %</span></div>
                        <div className="val">37,4<small> %</small></div>
                        <svg className="spark" viewBox="0 0 280 56" preserveAspectRatio="none" width="100%" height="48" aria-hidden="true">
                          <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0" stopColor="var(--primary)" stopOpacity="0.35"/>
                            <stop offset="1" stopColor="var(--primary)" stopOpacity="0"/>
                          </linearGradient></defs>
                          <path d="M0,40 L24,36 48,42 72,30 96,33 120,22 144,28 168,18 192,26 216,14 240,20 264,12 280,16 L280,56 L0,56 Z" fill="url(#g1)"/>
                          <path d="M0,40 L24,36 48,42 72,30 96,33 120,22 144,28 168,18 192,26 216,14 240,20 264,12 280,16" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <div className="stat-card">
                        <div className="lbl"><span>Arbeitsspeicher</span><span className="t">12,1 / 32 GB</span></div>
                        <div className="val">38<small> %</small></div>
                        <div className="bars" aria-hidden="true">
                          <i style={{height:'42%'}}/><i style={{height:'55%'}}/><i style={{height:'48%'}}/><i style={{height:'67%'}}/>
                          <i style={{height:'60%'}}/><i style={{height:'72%'}}/><i style={{height:'51%'}}/><i style={{height:'80%'}}/>
                          <i style={{height:'64%'}}/><i style={{height:'58%'}}/><i style={{height:'74%'}}/><i style={{height:'46%'}}/>
                        </div>
                      </div>
                    </div>
                    <div className="mock-servers">
                      {[
                        {nm:'web-01', sla:'99,99 % SLA', ms:'24', status:'ok', label:'online'},
                        {nm:'db-primary', sla:'99,97 % SLA', ms:'11', status:'ok', label:'online'},
                        {nm:'cache-02', sla:'98,40 % SLA', ms:'86', status:'warn', label:'latenz'},
                        {nm:'worker-eu-1', sla:'99,95 % SLA', ms:'32', status:'ok', label:'online'},
                      ].map(s => (
                        <div key={s.nm} className="srow">
                          <span className="name"><span className={`dot dot-${s.status}${s.status==='ok'?' pulse':''}`} /><span className="nm">{s.nm}</span></span>
                          <span className="meta">{s.sla}</span>
                          <span className="meta">{s.ms}ms</span>
                          <span className={`badge badge-status ${s.status}`}>{s.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TRUSTED BY */}
        <section className="trusted divider">
          <div className="container">
            <p className="reveal">Vertraut von Homelabs &amp; Teams weltweit</p>
            <div className="logo-row reveal d1">
              {[
                {name:'Nimbus', shape:'circle'},
                {name:'Forgelab', shape:''},
                {name:'OctaHosting', shape:'diamond'},
                {name:'kern.io', shape:'circle'},
                {name:'Stratus', shape:''},
                {name:'HomeRack', shape:'diamond'},
              ].map(l => (
                <span key={l.name} className="logo-ph">
                  <span className={`lm${l.shape ? ' '+l.shape : ''}`} />
                  {l.name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="section-pad divider" id="features">
          <div className="container">
            <div className="section-head center">
              <span className="eyebrow reveal">Funktionen</span>
              <h2 className="h2 reveal d1">Alles, was du zum Überwachen brauchst</h2>
              <p className="lead reveal d2">Ein einziges Tool für Metriken, Alarme und Transparenz — ohne fünf verschiedene Dienste zusammenzukleben.</p>
            </div>
            <div className="feat-grid">
              {[
                {icon:<LineChart/>, title:'Echtzeit-Metriken', text:'CPU, RAM, Disk, Netzwerk und I/O im Sekundentakt. Sauber gerenderte Charts mit historischen Daten und frei wählbaren Zeitfenstern.', v:false, delay:''},
                {icon:<BellRing/>, title:'Alerting', text:'Regelbasierte Alarme per Webhook, E-Mail, Slack oder Discord. Definiere Schwellwerte, Eskalationen und Ruhezeiten exakt nach Bedarf.', v:false, delay:'d1'},
                {icon:<Box/>, title:'Docker-Integration', text:'Container werden automatisch erkannt. Pro-Container-Metriken, Logs und Health-Checks — ganz ohne manuelle Konfiguration.', v:true, delay:'d2'},
                {icon:<ShieldCheck/>, title:'Self-Hosted & Privacy-First', text:'Deine Daten verlassen nie deinen Server. Keine Telemetrie, keine Account-Pflicht, keine Cloud-Abhängigkeit — du behältst die Kontrolle.', v:false, delay:''},
                {icon:<Globe/>, title:'Status-Page', text:'Öffentliche oder interne Status-Seite mit einem Klick. Zeige Uptime, laufende Vorfälle und geplante Wartungen transparent an.', v:false, delay:'d1'},
                {icon:<Network/>, title:'Multi-Node', text:'Überwache hunderte Nodes aus einem Dashboard. Leichtgewichtige Agents verbinden sich verschlüsselt mit deiner zentralen Instanz.', v:true, delay:'d2'},
              ].map(f => (
                <article key={f.title} className={`feat-card${f.v?' v':''} reveal${f.delay?' '+f.delay:''}`}>
                  <div className="feat-ico">{f.icon}</div>
                  <h3 className="h3">{f.title}</h3>
                  <p>{f.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* SPLIT HIGHLIGHTS */}
        <section className="section-pad divider">
          <div className="container">
            <div className="split">
              <div className="split-text reveal">
                <span className="eyebrow">Alerting</span>
                <h2 className="h2">Erfahre von Problemen, bevor deine Nutzer es tun</h2>
                <p className="lead">Definiere präzise Regeln und lass Helio den Rest erledigen. Alarme landen dort, wo dein Team ohnehin schon ist.</p>
                <ul className="split-list">
                  <li><span className="ci"><Check size={14}/></span><div><b>Flexible Kanäle</b><span>Webhook, E-Mail, Slack, Discord, Telegram oder PagerDuty.</span></div></li>
                  <li><span className="ci"><Check size={14}/></span><div><b>Smarte Schwellwerte</b><span>Eskalationsstufen, Ruhezeiten und automatisches Auto-Resolve.</span></div></li>
                  <li><span className="ci"><Check size={14}/></span><div><b>Kein Alarm-Spam</b><span>Gruppierung &amp; Deduplizierung verhindern Benachrichtigungs-Fluten.</span></div></li>
                </ul>
              </div>
              <div className="split-visual reveal d2">
                <div className="panel">
                  <div className="panel-head">
                    <span className="pt"><BellRing size={16}/>Alert-Verlauf</span>
                    <span className="badge"><span className="dot dot-ok"/>3 aktiv</span>
                  </div>
                  <div className="panel-body">
                    <div className="alert-item down"><span className="ai-ico"><AlertOctagon size={16}/></span><div className="ai-main"><div className="ai-t">cache-02 antwortet nicht</div><div className="ai-d">HTTP 503 · 3 Versuche fehlgeschlagen</div></div><span className="ai-time">vor 2 min</span></div>
                    <div className="alert-item warn"><span className="ai-ico"><AlertTriangle size={16}/></span><div className="ai-main"><div className="ai-t">web-01 CPU &gt; 85 %</div><div className="ai-d">Schwellwert seit 4 min überschritten</div></div><span className="ai-time">vor 6 min</span></div>
                    <div className="alert-item ok"><span className="ai-ico"><Check size={16}/></span><div className="ai-main"><div className="ai-t">db-primary wiederhergestellt</div><div className="ai-d">Latenz wieder im Normalbereich</div></div><span className="ai-time">vor 18 min</span></div>
                    <div className="chip-row">
                      <span className="chip"><Cpu size={13}/>Webhook</span>
                      <span className="chip"><Mail size={13}/>E-Mail</span>
                      <span className="chip"><MessageSquare size={13}/>Slack</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="split rev">
              <div className="split-text reveal">
                <span className="eyebrow">Container</span>
                <h2 className="h2">Docker-Monitoring ohne Setup-Schmerzen</h2>
                <p className="lead">Helio findet deine Container von selbst und beginnt sofort mit dem Sammeln von Metriken. Ein Befehl, fertig.</p>
                <ul className="split-list">
                  <li><span className="ci"><Check size={14}/></span><div><b>Auto-Discovery</b><span>Neue Container erscheinen automatisch im Dashboard.</span></div></li>
                  <li><span className="ci"><Check size={14}/></span><div><b>Pro-Container-Metriken</b><span>CPU, RAM, Netzwerk-I/O und Restart-Counts je Service.</span></div></li>
                  <li><span className="ci"><Check size={14}/></span><div><b>Health-Checks &amp; Logs</b><span>Live-Logs und Status direkt aus dem Dashboard.</span></div></li>
                </ul>
              </div>
              <div className="split-visual reveal d2">
                <div className="panel">
                  <div className="panel-head">
                    <span className="pt"><Terminal size={16}/>Schnellstart</span>
                    <span className="badge mono">docker</span>
                  </div>
                  <div className="panel-body">
                    <div className="term">
                      <div className="term-line"><span className="pr">$</span><span className="cm">docker run -d --name helio \</span></div>
                      <div className="term-line out">-v /var/run/docker.sock:/var/run/docker.sock \</div>
                      <div className="term-line out">-p 9300:9300 helio/helio:latest</div>
                      <div className="term-line out"><span className="g">✓</span> Helio läuft auf :9300</div>
                      <div className="term-line out"><span className="g">✓</span> 14 Container automatisch erkannt</div>
                      <div className="term-line out"><span className="g">✓</span> Sammle Metriken …</div>
                    </div>
                    <div className="chip-row">
                      <span className="chip"><span className="dot dot-ok"/>14 Container</span>
                      <span className="chip"><Cpu size={13}/>Auto-Discovery</span>
                      <span className="chip"><Activity size={13}/>Live-Logs</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* LIVE DEMO */}
        <section className="live section-pad" id="demo">
          <div className="container">
            <div className="section-head center">
              <span className="eyebrow reveal">Live</span>
              <h2 className="h2 reveal d1">Über tausende Instanzen im Einsatz</h2>
              <p className="lead reveal d2">Eine leichtgewichtige Engine, die mitwächst — vom Single-Board-Computer bis zum Multi-Node-Cluster.</p>
            </div>
            <div className="live-grid">
              {[
                {icon:<Server/>, count:'48210', decimals:'0', unit:'', label:'überwachte Nodes', delay:''},
                {icon:<Zap/>, count:'2.4', decimals:'1', unit:' M', label:'Metriken pro Minute', delay:'d1'},
                {icon:<Gauge/>, count:'99.98', decimals:'2', unit:' %', label:'durchschn. Uptime', delay:'d2'},
                {icon:<HardDrive/>, count:'42', decimals:'0', unit:' MB', label:'RAM-Footprint', delay:'d3'},
              ].map(c => (
                <div key={c.label} className={`live-card reveal${c.delay?' '+c.delay:''}`}>
                  <div className="lc-ico">{c.icon}</div>
                  <div className="live-num">
                    <span data-count={c.count} data-decimals={c.decimals}>0</span>
                    {c.unit && <span className="u">{c.unit}</span>}
                  </div>
                  <div className="lc-lbl">{c.label}</div>
                </div>
              ))}
            </div>
            <div className="live-status reveal d3">
              <span className="dot"/>Alle Systeme betriebsbereit · Status live aktualisiert
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section className="section-pad divider" id="preise">
          <div className="container">
            <div className="section-head center">
              <span className="eyebrow reveal">Preise</span>
              <h2 className="h2 reveal d1">Fair &amp; transparent — für alle Größen</h2>
              <p className="lead reveal d2">Self-Hosted ist und bleibt kostenlos. Bezahlte Pläne fügen Komfort und Team-Funktionen hinzu.</p>
            </div>
            <div className="price-grid">
              <article className="price-card reveal">
                <div className="price-name">Self-Hosted</div>
                <p className="price-desc">Für Homelabs und Einzelprojekte. Open Source, für immer kostenlos.</p>
                <div className="price-amt"><span className="num">€0</span><span className="per">/ für immer</span></div>
                <Link to="/dashboard" className="btn btn-secondary">Loslegen</Link>
                <ul className="price-feats">
                  {['Unbegrenzte Nodes & Container','Echtzeit-Metriken & Charts','Webhook- & E-Mail-Alerts','1 Status-Page','Community-Support'].map(f=>(
                    <li key={f}><span className="ck"><Check size={18}/></span>{f}</li>
                  ))}
                </ul>
              </article>
              <article className="price-card feat reveal d1">
                <span className="price-pop">Beliebt</span>
                <div className="price-name">Pro</div>
                <p className="price-desc">Für ernsthafte Self-Hoster, die mehr Komfort und Integrationen wollen.</p>
                <div className="price-amt"><span className="num">€12</span><span className="per">/ Monat</span></div>
                <Link to="/dashboard" className="btn btn-primary">14 Tage testen</Link>
                <ul className="price-feats">
                  {['Alles aus Self-Hosted','Slack, Discord & PagerDuty','1 Jahr Metrik-Historie','Unbegrenzte Status-Pages','Priorisierter Support'].map(f=>(
                    <li key={f}><span className="ck"><Check size={18}/></span>{f}</li>
                  ))}
                </ul>
              </article>
              <article className="price-card reveal d2">
                <div className="price-name">Team</div>
                <p className="price-desc">Für Teams mit Rollen, Audit-Logs und SSO-Anforderungen.</p>
                <div className="price-amt"><span className="num">€39</span><span className="per">/ Monat</span></div>
                <Link to="/dashboard" className="btn btn-secondary">Vertrieb kontaktieren</Link>
                <ul className="price-feats">
                  {['Alles aus Pro','Rollen & Berechtigungen','SSO (SAML / OIDC)','Audit-Logs','SLA & dedizierter Support'].map(f=>(
                    <li key={f}><span className="ck"><Check size={18}/></span>{f}</li>
                  ))}
                </ul>
              </article>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="section-pad divider" id="docs">
          <div className="container">
            <div className="section-head center">
              <span className="eyebrow reveal">FAQ</span>
              <h2 className="h2 reveal d1">Häufige Fragen</h2>
            </div>
            <div className="faq reveal d1">
              {FAQ_ITEMS.map((item, i) => (
                <div key={i} className={`faq-item${openFaq === i ? ' open' : ''}`}>
                  <button className="faq-q" aria-expanded={openFaq === i} onClick={() => toggleFaq(i)}>
                    {item.q}<span className="pm" aria-hidden="true" />
                  </button>
                  <div
                    className="faq-a"
                    ref={el => { faqRefs.current[i] = el; }}
                    style={{ height: openFaq === i ? undefined : '0px' }}
                  >
                    <div className="faq-a-inner">{item.a}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="section-pad cta" id="start">
          <div className="container">
            <div className="cta-box reveal">
              <span className="eyebrow" style={{justifyContent:'center'}}>Loslegen</span>
              <h2 className="h2" style={{marginTop:'14px'}}>In 60 Sekunden live</h2>
              <p className="lead">Ein Befehl genügt. Kein Account, keine Kreditkarte, keine Cloud. Starte Helio jetzt auf deinem eigenen Server.</p>
              <div className="cta-actions">
                <Link to="/dashboard" className="btn btn-primary btn-lg">Kostenlos hosten</Link>
                <a href="#docs" className="btn btn-secondary btn-lg"><BookOpen size={18}/>Zur Dokumentation</a>
              </div>
              <div className="code-snip">
                <code><span className="pr">$</span> curl -fsSL helio.sh/install | sh</code>
                <button className={`copy-btn${copied ? ' copied' : ''}`} onClick={handleCopy} aria-label="Befehl kopieren">
                  {copied ? <Check size={17}/> : <Copy size={17}/>}
                </button>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="footer" id="github">
        <div className="container">
          <div className="footer-top">
            <div className="footer-brand">
              <a href="#top" className="brand"><span className="brand-mark" aria-hidden="true"/>Helio</a>
              <p>Open-Source-Monitoring für Server und Container, das du selbst hostest. Privacy-first, schlank und schnell.</p>
              <div className="footer-social">
                <a href="#github" aria-label="GitHub"><GH_ICON /></a>
                <a href="#" aria-label="Discord"><MessageCircle size={17}/></a>
                <a href="#" aria-label="X"><X_ICON /></a>
                <a href="#" aria-label="RSS"><Rss size={17}/></a>
              </div>
            </div>
            <div className="footer-col"><h5>Produkt</h5><ul>
              <li><a href="#features">Features</a></li><li><a href="#preise">Preise</a></li>
              <li><a href="#demo">Live-Demo</a></li><li><a href="#">Changelog</a></li>
            </ul></div>
            <div className="footer-col"><h5>Ressourcen</h5><ul>
              <li><a href="#docs">Dokumentation</a></li><li><a href="#">Installation</a></li>
              <li><a href="#">API-Referenz</a></li><li><a href="#">Status-Page-Guide</a></li>
            </ul></div>
            <div className="footer-col"><h5>Community</h5><ul>
              <li><a href="#github">GitHub</a></li><li><a href="#">Discord</a></li>
              <li><a href="#">Roadmap</a></li><li><a href="#">Beitragen</a></li>
            </ul></div>
            <div className="footer-col"><h5>Rechtliches</h5><ul>
              <li><a href="#">Impressum</a></li><li><a href="#">Datenschutz</a></li>
              <li><a href="#">Lizenz (Apache 2.0)</a></li><li><a href="#">Sicherheit</a></li>
            </ul></div>
          </div>
          <div className="footer-bottom">
            <p>© 2026 Helio. Open Source unter Apache 2.0.</p>
            <span className="fb-status"><span className="dot dot-ok"/>Alle Systeme betriebsbereit</span>
          </div>
        </div>
      </footer>
    </>
  );
}

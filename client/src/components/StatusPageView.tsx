import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { apiRequest } from '../api/client';
import { Globe, Copy, Check } from 'lucide-react';

export default function StatusPageView() {
  const monitors = useStore((s) => s.monitors);
  const fetchMonitors = useStore((s) => s.fetchMonitors);
  const [pages, setPages] = useState<Array<{ id: string; title: string; slug: string; logoUrl: string | null; monitorIds: string[]; incidentBanner: string | null }>>([]);
  const [showForm, setShowForm] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const loadPages = async () => {
    const res = await apiRequest<Array<{ id: string; title: string; slug: string; logoUrl: string | null; monitorIds: string[]; incidentBanner: string | null }>>('GET', '/status-pages');
    if (res.data) setPages(res.data);
  };

  useEffect(() => {
    fetchMonitors();
    loadPages();
  }, []);

  const copyUrl = (slug: string) => {
    const url = `${window.location.origin}/api/v1/status-pages/public/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(slug);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="animate-[view-fade_0.35s_cubic-bezier(0.22,1,0.36,1)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[1.05rem] font-semibold tracking-tight m-0" style={{ color: 'var(--color-text)' }}>Status-Pages</h2>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-4 py-[8px] rounded-[var(--radius-box)] border-0 cursor-pointer text-[0.85rem]" style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}>
          + Neue Seite
        </button>
      </div>

      {pages.length === 0 && !showForm ? (
        <div className="border rounded-[var(--radius-lg)] p-10 text-center" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <Globe className="w-[32px] h-[32px] mx-auto mb-3" style={{ color: 'var(--color-primary)' }} />
          <p className="m-0 text-[0.9rem]" style={{ color: 'var(--color-text-muted)' }}>
            Noch keine Status-Seiten erstellt. Eine Status-Seite zeigt den aktuellen Zustand ausgewählter Monitore öffentlich an.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {pages.map((page) => (
            <div key={page.id} className="border rounded-[var(--radius-lg)] p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-[1rem] font-semibold m-0" style={{ color: 'var(--color-text)' }}>{page.title}</h3>
                  <span className="font-mono text-[0.78rem]" style={{ color: 'var(--color-text-dim)' }}>
                    /status/{page.slug} · {page.monitorIds.length} Monitore
                  </span>
                </div>
                <button onClick={() => copyUrl(page.slug)} className="flex items-center gap-2 px-3 py-[6px] rounded-[var(--radius-sm)] border cursor-pointer text-[0.8rem]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)', background: 'transparent' }}>
                  {copied === page.slug ? <Check className="w-[14px] h-[14px]" style={{ color: 'var(--color-ok)' }} /> : <Copy className="w-[14px] h-[14px]" />}
                  {copied === page.slug ? 'Kopiert!' : 'API-URL kopieren'}
                </button>
              </div>

              {/* Assigned monitors */}
              <div className="flex flex-wrap gap-2">
                {page.monitorIds.map((mid) => {
                  const m = monitors.find((m) => m.id === mid);
                  if (!m) return null;
                  return (
                    <span key={mid}
                      className="inline-flex items-center gap-2 px-3 py-[6px] rounded-full border font-mono text-[0.78rem]"
                      style={{
                        borderColor: 'var(--color-border)',
                        background: 'var(--color-bg-soft)',
                        color: m.status === 'UP' ? 'var(--color-ok)' : m.status === 'DOWN' ? 'var(--color-down)' : 'var(--color-warn)',
                      }}
                    >
                      <span className={`w-[7px] h-[7px] rounded-full ${
                        m.status === 'UP' ? 'bg-[var(--color-ok)]' : m.status === 'DOWN' ? 'bg-[var(--color-down)]' : 'bg-[var(--color-warn)]'
                      }`} />
                      {m.name}
                    </span>
                  );
                })}
                {page.monitorIds.length === 0 && (
                  <span className="text-[0.82rem]" style={{ color: 'var(--color-text-dim)' }}>Keine Monitore zugewiesen</span>
                )}
              </div>

              {page.incidentBanner && (
                <div className="mt-3 p-3 rounded-[var(--radius-sm)] text-[0.85rem]" style={{ background: 'var(--color-warn-soft)', color: 'var(--color-warn)' }}>
                  ⚠️ {page.incidentBanner}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && <StatusPageForm onClose={() => { setShowForm(false); loadPages(); }} monitors={monitors} />}
    </div>
  );
}

function StatusPageForm({ onClose, monitors }: { onClose: () => void; monitors: { id: string; name: string; status: string }[] }) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const create = async () => {
    if (!title.trim() || !slug.trim()) return;
    const res = await apiRequest('POST', '/status-pages', { title: title.trim(), slug: slug.trim(), monitorIds: selected });
    if (res.success) onClose();
  };

  const toggle = (id: string) => setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[60px]" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-[480px] border rounded-[var(--radius-lg)] p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[1rem] font-semibold m-0 mb-4" style={{ color: 'var(--color-text)' }}>Neue Status-Seite</h3>

        <div className="flex flex-col gap-3 mb-4">
          <div>
            <label className="block text-[0.8rem] font-medium mb-[4px]" style={{ color: 'var(--color-text-muted)' }}>Titel</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full h-[40px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} placeholder="Mein Status" />
          </div>
          <div>
            <label className="block text-[0.8rem] font-medium mb-[4px]" style={{ color: 'var(--color-text-muted)' }}>Slug (URL-Pfad)</label>
            <input value={slug} onChange={(e) => setSlug(e.target.value.replace(/\s+/g, '-').toLowerCase())} className="w-full h-[40px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] font-mono outline-none" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} placeholder="mein-status" />
          </div>
          <div>
            <label className="block text-[0.8rem] font-medium mb-[4px]" style={{ color: 'var(--color-text-muted)' }}>Monitore</label>
            <div className="flex flex-wrap gap-2 max-h-[160px] overflow-y-auto">
              {monitors.map((m) => (
                <button key={m.id} onClick={() => toggle(m.id)}
                  className="px-3 py-[6px] rounded-full border text-[0.8rem] font-mono cursor-pointer transition-colors"
                  style={{
                    background: selected.includes(m.id) ? 'var(--color-primary-soft)' : 'var(--color-bg)',
                    borderColor: selected.includes(m.id) ? 'var(--color-primary)' : 'var(--color-border)',
                    color: selected.includes(m.id) ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  }}
                >{m.name}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-[8px] rounded-[var(--radius-box)] border cursor-pointer text-[0.85rem]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)', background: 'transparent' }}>Abbrechen</button>
          <button onClick={create} className="px-4 py-[8px] rounded-[var(--radius-box)] border-0 cursor-pointer text-[0.85rem]" style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}>Erstellen</button>
        </div>
      </div>
    </div>
  );
}

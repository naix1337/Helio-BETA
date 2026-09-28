import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Globe, ExternalLink, Edit3, Trash2, Plus, X } from 'lucide-react';
import { useStore, useIsAdmin } from '../store/useStore';
import { apiCall } from '../api/client';
import CopyField from './CopyField';
import { statusColor, publicStatusUrl } from '../utils/format';

interface StatusPage {
  id: string;
  title: string;
  slug: string;
  logoUrl: string | null;
  monitorIds: string[];
  incidentBanner: string | null;
}

export default function StatusPageView() {
  const monitors = useStore((s) => s.monitors);
  const isAdmin = useIsAdmin();
  const [pages, setPages] = useState<StatusPage[]>([]);
  const [editing, setEditing] = useState<StatusPage | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPages(await apiCall<StatusPage[]>('GET', '/status-pages'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Laden fehlgeschlagen');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const remove = async (p: StatusPage) => {
    if (!confirm(`Status-Seite "${p.title}" löschen?`)) return;
    try {
      await apiCall('DELETE', `/status-pages/${p.id}`);
      void load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler');
    }
  };

  return (
    <div className="animate-[view-fade_0.35s_cubic-bezier(0.22,1,0.36,1)]">
      <div className="flex items-center justify-between mb-4 gap-3">
        <p className="m-0 text-[0.86rem]" style={{ color: 'var(--color-text-muted)' }}>
          Öffentliche Status-Seiten zeigen den Zustand ausgewählter Monitore ohne Login an.
        </p>
        {isAdmin && (
          <button onClick={() => setEditing('new')} className="btn btn-primary flex-none">
            <Plus className="w-[16px] h-[16px]" /> Neue Seite
          </button>
        )}
      </div>

      {error && <div className="alert alert-error mb-4">{error}</div>}

      {pages.length === 0 ? (
        <div className="card p-10 text-center">
          <Globe className="w-[32px] h-[32px] mx-auto mb-3" style={{ color: 'var(--color-primary)' }} />
          <p className="m-0 text-[0.9rem]" style={{ color: 'var(--color-text-muted)' }}>Noch keine Status-Seiten erstellt.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {pages.map((page) => (
            <div key={page.id} className="card p-5">
              <div className="flex items-start justify-between mb-3 gap-3 flex-wrap">
                <div className="min-w-0">
                  <h3 className="text-[1rem] font-semibold m-0" style={{ color: 'var(--color-text)' }}>{page.title}</h3>
                  <span className="font-mono text-[0.78rem]" style={{ color: 'var(--color-text-dim)' }}>
                    /status/{page.slug} · {page.monitorIds.length} Monitore
                  </span>
                </div>
                <div className="flex gap-2">
                  <a href={`/status/${page.slug}`} target="_blank" rel="noreferrer" className="btn btn-sm no-underline"><ExternalLink className="w-[14px] h-[14px]" /> Öffnen</a>
                  {isAdmin && <button onClick={() => setEditing(page)} className="btn btn-sm"><Edit3 className="w-[14px] h-[14px]" /></button>}
                  {isAdmin && <button onClick={() => remove(page)} className="btn btn-sm btn-danger"><Trash2 className="w-[14px] h-[14px]" /></button>}
                </div>
              </div>

              <div className="mb-3"><CopyField value={publicStatusUrl(page.slug)} /></div>

              <div className="flex flex-wrap gap-2">
                {page.monitorIds.map((mid) => {
                  const m = monitors.find((x) => x.id === mid);
                  if (!m) return null;
                  return (
                    <span key={mid} className="pill" style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-soft)', color: statusColor(m.status) }}>
                      <span className="w-[7px] h-[7px] rounded-full" style={{ background: statusColor(m.status) }} />
                      {m.name}
                    </span>
                  );
                })}
                {page.monitorIds.length === 0 && <span className="text-[0.82rem]" style={{ color: 'var(--color-text-dim)' }}>Keine Monitore zugewiesen</span>}
              </div>

              {page.incidentBanner && <div className="alert alert-warn mt-3">⚠️ {page.incidentBanner}</div>}
            </div>
          ))}
        </div>
      )}

      {editing && <StatusPageForm page={editing === 'new' ? null : editing} onClose={() => { setEditing(null); void load(); }} />}
    </div>
  );
}

function StatusPageForm({ onClose, page }: { onClose: () => void; page: StatusPage | null }) {
  const monitors = useStore((s) => s.monitors);
  const [title, setTitle] = useState(page?.title ?? '');
  const [slug, setSlug] = useState(page?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(!!page);
  const [logoUrl, setLogoUrl] = useState(page?.logoUrl ?? '');
  const [banner, setBanner] = useState(page?.incidentBanner ?? '');
  const [selected, setSelected] = useState<string[]>(page?.monitorIds ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = { title: title.trim(), slug: slug.trim(), logoUrl: logoUrl.trim() || null, incidentBanner: banner.trim() || null, monitorIds: selected };
      if (page) await apiCall('PATCH', `/status-pages/${page.id}`, body);
      else await apiCall('POST', '/status-pages', body);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setSaving(false);
    }
  };

  const toggle = (id: string) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal flex flex-col gap-4" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="flex items-center justify-between">
          <h2 className="text-[1.1rem] font-semibold m-0" style={{ color: 'var(--color-text)' }}>{page ? 'Status-Seite bearbeiten' : 'Neue Status-Seite'}</h2>
          <button type="button" onClick={onClose} className="btn btn-icon"><X className="w-[16px] h-[16px]" /></button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Titel *</label>
            <input value={title} onChange={(e) => {
              setTitle(e.target.value);
              if (!slugTouched) setSlug(e.target.value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
            }} required className="input" placeholder="Mein Status" />
          </div>
          <div>
            <label className="label">Slug (URL) *</label>
            <input value={slug} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')); }} required pattern="[a-z0-9\-]+" className="input mono" placeholder="mein-status" />
          </div>
        </div>
        <div>
          <label className="label">Logo-URL (optional)</label>
          <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className="input mono" placeholder="https://…/logo.png" />
        </div>
        <div>
          <label className="label">Hinweis-Banner (optional)</label>
          <textarea value={banner} onChange={(e) => setBanner(e.target.value)} className="input" rows={2} placeholder="z.B. Wir untersuchen aktuell Probleme mit …" />
        </div>
        <div>
          <label className="label">Monitore</label>
          <div className="flex flex-wrap gap-2 max-h-[180px] overflow-y-auto">
            {monitors.map((m) => (
              <button key={m.id} type="button" onClick={() => toggle(m.id)} className={`chip ${selected.includes(m.id) ? 'active' : ''}`}>{m.name}</button>
            ))}
          </div>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn">Abbrechen</button>
          <button type="submit" disabled={saving} className="btn btn-primary">{saving ? '…' : page ? 'Speichern' : 'Erstellen'}</button>
        </div>
      </form>
    </div>
  );
}

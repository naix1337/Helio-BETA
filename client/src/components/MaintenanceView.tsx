import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Plus, Trash2, X, Wrench } from 'lucide-react';
import { useStore, useIsAdmin } from '../store/useStore';
import { apiCall } from '../api/client';

interface MaintenanceWindow {
  id: string;
  monitorIds: string[];
  startsAt: string;
  endsAt: string;
  description: string;
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MaintenanceView() {
  const monitors = useStore((s) => s.monitors);
  const isAdmin = useIsAdmin();
  const [windows, setWindows] = useState<MaintenanceWindow[]>([]);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try { setWindows(await apiCall<MaintenanceWindow[]>('GET', '/maintenance')); } catch { /* ignore */ }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const remove = async (w: MaintenanceWindow) => {
    if (!confirm('Wartungsfenster löschen?')) return;
    try { await apiCall('DELETE', `/maintenance/${w.id}`); void load(); } catch (err) { alert(err instanceof Error ? err.message : 'Fehler'); }
  };

  const [now] = useState(() => Date.now());
  const stateOf = (w: MaintenanceWindow) => {
    const s = new Date(w.startsAt).getTime();
    const e = new Date(w.endsAt).getTime();
    if (now < s) return ['geplant', 'pill-primary'] as const;
    if (now > e) return ['beendet', 'pill-dim'] as const;
    return ['aktiv', 'pill-warn'] as const;
  };

  return (
    <div className="animate-[view-fade_0.35s_cubic-bezier(0.22,1,0.36,1)]">
      <div className="flex items-center justify-between mb-4 gap-3">
        <p className="m-0 text-[0.86rem]" style={{ color: 'var(--color-text-muted)' }}>
          Während eines Wartungsfensters werden die Monitore nicht geprüft und es gibt keine Alarme.
        </p>
        {isAdmin && (
          <button onClick={() => setShowForm(true)} className="btn btn-primary flex-none"><Plus className="w-[16px] h-[16px]" /> Wartung planen</button>
        )}
      </div>

      {windows.length === 0 ? (
        <div className="card p-10 text-center">
          <Wrench className="w-[30px] h-[30px] mx-auto mb-3" style={{ color: 'var(--color-primary)' }} />
          <p className="m-0 text-[0.9rem]" style={{ color: 'var(--color-text-muted)' }}>Keine Wartungsfenster geplant.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {windows.map((w) => {
            const [label, cls] = stateOf(w);
            const names = w.monitorIds.map((id) => monitors.find((m) => m.id === id)?.name).filter(Boolean);
            return (
              <div key={w.id} className="flex flex-wrap items-center gap-3 px-[18px] py-[14px] border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex-1 min-w-[220px]">
                  <div className="font-medium text-[0.92rem]" style={{ color: 'var(--color-text)' }}>{w.description}</div>
                  <div className="font-mono text-[0.76rem] mt-1" style={{ color: 'var(--color-text-dim)' }}>
                    {new Date(w.startsAt).toLocaleString()} – {new Date(w.endsAt).toLocaleString()}
                  </div>
                  <div className="text-[0.78rem] mt-1" style={{ color: 'var(--color-text-muted)' }}>{names.join(', ') || '—'}</div>
                </div>
                <span className={`pill ${cls}`}>{label}</span>
                {isAdmin && <button onClick={() => remove(w)} className="btn btn-icon btn-danger" title="Löschen"><Trash2 className="w-[14px] h-[14px]" /></button>}
              </div>
            );
          })}
        </div>
      )}

      {showForm && <MaintenanceForm onClose={() => { setShowForm(false); void load(); }} />}
    </div>
  );
}

function MaintenanceForm({ onClose }: { onClose: () => void }) {
  const monitors = useStore((s) => s.monitors);
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState(() => toLocalInput(new Date()));
  const [endsAt, setEndsAt] = useState(() => toLocalInput(new Date(Date.now() + 60 * 60 * 1000)));
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (selected.length === 0) { setError('Mindestens einen Monitor auswählen'); return; }
    try {
      await apiCall('POST', '/maintenance', {
        description: description.trim(),
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        monitorIds: selected,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    }
  };

  const toggle = (id: string) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal flex flex-col gap-4" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="flex items-center justify-between">
          <h2 className="text-[1.1rem] font-semibold m-0" style={{ color: 'var(--color-text)' }}>Wartung planen</h2>
          <button type="button" onClick={onClose} className="btn btn-icon"><X className="w-[16px] h-[16px]" /></button>
        </div>
        <div>
          <label className="label">Beschreibung *</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} required maxLength={500} className="input" placeholder="z.B. Kernel-Update" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Beginn</label>
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required className="input" />
          </div>
          <div>
            <label className="label">Ende</label>
            <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required className="input" />
          </div>
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
          <button type="submit" className="btn btn-primary">Speichern</button>
        </div>
      </form>
    </div>
  );
}

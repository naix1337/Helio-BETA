// helio-app/frontend/src/pages/Alerts.tsx
import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Alert, AlertEvent, AlertMetric, AlertOperator, AlertChannel } from '../types.ts';

interface AlertEventWithName extends AlertEvent {
  alert_name: string;
  alert_metric: string;
}

interface NewRule {
  name: string; metric: AlertMetric; operator: AlertOperator;
  threshold: string; channel: AlertChannel; target: string; cooldown: string;
}

const BLANK: NewRule = {
  name: '', metric: 'cpu', operator: '>', threshold: '90',
  channel: 'webhook', target: '', cooldown: '15',
};

export function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [events, setEvents] = useState<AlertEventWithName[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewRule>(BLANK);

  const fetchAlerts = () =>
    fetch('/api/alerts').then(r => r.json()).then(setAlerts).catch(console.error);

  const fetchEvents = () =>
    fetch('/api/alerts/events').then(r => r.json()).then(setEvents).catch(console.error);

  useEffect(() => { fetchAlerts(); fetchEvents(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, threshold: Number(form.threshold), cooldown: Number(form.cooldown) }),
    });
    setForm(BLANK);
    setShowForm(false);
    fetchAlerts();
    fetchEvents();
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/alerts/${id}`, { method: 'DELETE' });
    fetchAlerts();
  };

  const handleToggle = async (a: Alert) => {
    await fetch(`/api/alerts/${a.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !a.enabled }),
    });
    fetchAlerts();
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', padding: '8px 12px',
    color: 'var(--text)', fontSize: '0.9rem', width: '100%',
  };

  return (
    <>
      <div className="page-header">
        <h1>Alerts</h1>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 14px', borderRadius: 'var(--radius)', border: 'none',
            background: 'var(--primary)', color: 'var(--primary-fg)',
            fontWeight: 540, cursor: 'pointer', fontSize: '0.85rem',
          }}>
          <Plus size={14} /> Neue Regel
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{
          border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
          padding: '24px', marginBottom: '24px', background: 'var(--surface)',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px',
        }}>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>Name</label>
            <input style={inputStyle} value={form.name} required onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          {(['metric', 'operator', 'threshold', 'channel', 'target', 'cooldown'] as const).map(field => (
            <div key={field}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'block', marginBottom: '6px', textTransform: 'capitalize' }}>{field}</label>
              {field === 'metric' ? (
                <select style={inputStyle} value={form.metric} onChange={e => setForm(f => ({ ...f, metric: e.target.value as AlertMetric }))}>
                  {['cpu', 'memory', 'disk', 'net_rx', 'net_tx'].map(m => <option key={m}>{m}</option>)}
                </select>
              ) : field === 'operator' ? (
                <select style={inputStyle} value={form.operator} onChange={e => setForm(f => ({ ...f, operator: e.target.value as AlertOperator }))}>
                  {['>', '<', '>='].map(o => <option key={o}>{o}</option>)}
                </select>
              ) : field === 'channel' ? (
                <select style={inputStyle} value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value as AlertChannel }))}>
                  {['webhook', 'email', 'slack', 'discord'].map(c => <option key={c}>{c}</option>)}
                </select>
              ) : (
                <input style={inputStyle} value={form[field]} required onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
              )}
            </div>
          ))}
          <div style={{ gridColumn: '1/-1', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setShowForm(false)}
              style={{ padding: '8px 18px', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>Abbrechen</button>
            <button type="submit"
              style={{ padding: '8px 18px', borderRadius: 'var(--radius)', border: 'none',
                background: 'var(--primary)', color: 'var(--primary-fg)', cursor: 'pointer', fontWeight: 540 }}>
              Speichern
            </button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {alerts.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-dim)',
            fontFamily: 'var(--font-mono)', fontSize: '0.85rem', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)' }}>
            Keine Alert-Regeln konfiguriert
          </div>
        )}
        {alerts.map(alert => (
          <div key={alert.id} style={{
            display: 'flex', alignItems: 'center', gap: '14px',
            padding: '14px 18px', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', background: 'var(--surface)',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, marginBottom: '3px' }}>{alert.name}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                {alert.metric} {alert.operator} {alert.threshold} · {alert.channel}
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={Boolean(alert.enabled)} onChange={() => handleToggle(alert)} />
              Aktiv
            </label>
            <button onClick={() => handleDelete(alert.id)}
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer',
                padding: '6px', borderRadius: '6px', display: 'grid', placeItems: 'center' }}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '40px' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 540, marginBottom: '16px', color: 'var(--text-dim)' }}>
          Letzte Ereignisse
        </h2>
        {events.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)',
            fontFamily: 'var(--font-mono)', fontSize: '0.85rem', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)' }}>
            Noch keine Ereignisse
          </div>
        ) : (
          <div style={{
            border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            overflow: 'hidden',
          }}>
            {events.map((ev, i) => {
              const ts = new Date(ev.triggered_at * 1000);
              const dateStr = ts.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
              const timeStr = ts.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              return (
                <div key={ev.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '11px 16px',
                  borderBottom: i < events.length - 1 ? '1px solid var(--border)' : 'none',
                  fontSize: '0.83rem',
                }}>
                  <div>
                    <span style={{ fontWeight: 500 }}>{ev.alert_name}</span>
                    <span style={{
                      marginLeft: '10px', fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem', color: 'var(--text-dim)',
                    }}>
                      {ev.alert_metric} = {ev.peak_value.toFixed(1)}
                    </span>
                  </div>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '0.75rem',
                    color: 'var(--text-dim)',
                  }}>
                    {dateStr} {timeStr}
                  </span>
                  <span style={{
                    fontSize: '0.72rem', fontFamily: 'var(--font-mono)',
                    padding: '2px 8px', borderRadius: '4px',
                    background: ev.resolved_at ? 'color-mix(in srgb, var(--ok) 15%, transparent)' : 'color-mix(in srgb, var(--warn) 15%, transparent)',
                    color: ev.resolved_at ? 'var(--ok)' : 'var(--warn)',
                  }}>
                    {ev.resolved_at ? 'gelöst' : 'aktiv'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

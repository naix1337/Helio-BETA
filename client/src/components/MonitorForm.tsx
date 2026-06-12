import { useState, useEffect, type FormEvent } from 'react';
import { useStore } from '../store/useStore';
import * as monitorsApi from '../api/monitors';
import { X } from 'lucide-react';
import type { Monitor } from '../store/useStore';

const MONITOR_TYPES = [
  { value: 'http', label: 'HTTP(s)' },
  { value: 'tcp', label: 'TCP-Port' },
  { value: 'ping', label: 'Ping (ICMP)' },
  { value: 'dns', label: 'DNS' },
  { value: 'ssl', label: 'SSL/TLS' },
  { value: 'push', label: 'Push (Heartbeat)' },
] as const;

interface MonitorFormProps {
  onClose: () => void;
  editId?: string;
}

function extractConfigData(config: Record<string, unknown>): Record<string, unknown> {
  const inner = config as { data?: Record<string, unknown> };
  return inner.data ?? config;
}

export default function MonitorForm({ onClose, editId }: MonitorFormProps) {
  const fetchMonitors = useStore((s) => s.fetchMonitors);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<'http' | 'tcp' | 'ping' | 'dns' | 'ssl' | 'push'>('http');
  const [name, setName] = useState('');
  const [intervalSeconds, setIntervalSeconds] = useState(60);
  const [retries, setRetries] = useState(0);
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Type-specific config
  const [url, setUrl] = useState('');
  const [method, setMethod] = useState('GET');
  const [statusCodeMin, setStatusCodeMin] = useState(200);
  const [statusCodeMax, setStatusCodeMax] = useState(299);
  const [keyword, setKeyword] = useState('');
  const [timeoutMs, setTimeoutMs] = useState(15000);

  const [tcpHost, setTcpHost] = useState('');
  const [tcpPort, setTcpPort] = useState(80);
  const [tcpTimeout, setTcpTimeout] = useState(5000);

  const [pingHost, setPingHost] = useState('');

  const [dnsHost, setDnsHost] = useState('');
  const [dnsRecordType, setDnsRecordType] = useState('A');
  const [dnsExpected, setDnsExpected] = useState('');

  const [sslHost, setSslHost] = useState('');
  const [sslPort, setSslPort] = useState(443);
  const [sslWarningDays, setSslWarningDays] = useState(30);

  const [pushGrace, setPushGrace] = useState(60);

  // Load existing monitor data when editing
  useEffect(() => {
    if (!editId) return;
    setLoading(true);
    monitorsApi.getMonitor(editId).then((m) => {
      if (!m) return;
      setName(m.name);
      setType(m.type as typeof type);
      setIntervalSeconds(m.intervalSeconds);
      setRetries(m.retries);
      setTags(m.tags.join(', '));

      const cfg = extractConfigData(m.config as Record<string, unknown>);

      switch (m.type) {
        case 'http':
          setUrl((cfg.url as string) || '');
          setMethod((cfg.method as string) || 'GET');
          setStatusCodeMin((cfg.statusCodeMin as number) ?? 200);
          setStatusCodeMax((cfg.statusCodeMax as number) ?? 299);
          setKeyword((cfg.keyword as string) || '');
          setTimeoutMs((cfg.timeoutMs as number) ?? 15000);
          break;
        case 'tcp':
          setTcpHost((cfg.host as string) || '');
          setTcpPort((cfg.port as number) ?? 80);
          setTcpTimeout((cfg.timeoutMs as number) ?? 5000);
          break;
        case 'ping':
          setPingHost((cfg.host as string) || '');
          break;
        case 'dns':
          setDnsHost((cfg.host as string) || '');
          setDnsRecordType((cfg.recordType as string) || 'A');
          setDnsExpected((cfg.expectedValue as string) || '');
          break;
        case 'ssl':
          setSslHost((cfg.host as string) || '');
          setSslPort((cfg.port as number) ?? 443);
          setSslWarningDays((cfg.warningDays as number) ?? 30);
          break;
        case 'push':
          setPushGrace((cfg.graceSeconds as number) ?? 60);
          break;
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [editId]);

  const buildConfig = () => {
    switch (type) {
      case 'http':
        return { url: url || undefined, method, statusCodeMin, statusCodeMax, keyword: keyword || undefined, timeoutMs };
      case 'tcp':
        return { host: tcpHost, port: tcpPort, timeoutMs: tcpTimeout };
      case 'ping':
        return { host: pingHost, count: 2 };
      case 'dns':
        return { host: dnsHost, recordType: dnsRecordType, expectedValue: dnsExpected || undefined };
      case 'ssl':
        return { host: sslHost, port: sslPort, warningDays: sslWarningDays };
      case 'push':
        return { graceSeconds: pushGrace };
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name ist erforderlich'); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        type,
        config: buildConfig() as Record<string, unknown>,
        intervalSeconds,
        retries,
        tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      };
      if (editId) {
        await monitorsApi.updateMonitor(editId, payload as any);
      } else {
        await monitorsApi.createMonitor(payload as any);
      }
      await fetchMonitors();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : (editId ? 'Fehler beim Speichern' : 'Fehler beim Erstellen'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[60px]" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
        <div className="w-full max-w-[560px] border rounded-[var(--radius-lg)] p-6 text-center" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="w-8 h-8 border-2 rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
          <p className="mt-3 text-[0.9rem]" style={{ color: 'var(--color-text-muted)' }}>Lade Monitordaten…</p>
        </div>
      </div>
    );
  }

  const inputStyle = { background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' } as React.CSSProperties;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[60px]" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-[560px] max-h-[80vh] overflow-y-auto border rounded-[var(--radius-lg)] p-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[1.15rem] font-semibold m-0" style={{ color: 'var(--color-text)' }}>
            {editId ? 'Monitor bearbeiten' : 'Neuen Monitor erstellen'}
          </h2>
          <button onClick={onClose} className="w-[34px] h-[34px] rounded-[8px] grid place-items-center border cursor-pointer" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-dim)', background: 'transparent' }}>
            <X className="w-[16px] h-[16px]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <div>
            <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none focus:border-[var(--color-primary)]" style={inputStyle} placeholder="z.B. Meine Webseite" />
          </div>

          {/* Type (disabled when editing — changing type would break config) */}
          <div>
            <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Typ</label>
            <div className="grid grid-cols-3 gap-2">
              {MONITOR_TYPES.map((t) => (
                <button key={t.value} type="button" onClick={() => !editId && setType(t.value as typeof type)}
                  disabled={!!editId}
                  className="px-3 py-[10px] rounded-[var(--radius-sm)] border text-[0.85rem] font-medium transition-colors"
                  style={{
                    background: type === t.value ? 'var(--color-primary-soft)' : 'var(--color-bg)',
                    borderColor: type === t.value ? 'var(--color-primary)' : 'var(--color-border)',
                    color: type === t.value ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    opacity: editId && type !== t.value ? 0.5 : 1,
                    cursor: editId ? 'default' : 'pointer',
                  }}
                >{t.label}</button>
              ))}
            </div>
          </div>

          {/* Type-specific fields */}
          {type === 'http' && (
            <>
              <div>
                <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>URL *</label>
                <input value={url} onChange={(e) => setUrl(e.target.value)} required className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none font-mono focus:border-[var(--color-primary)]" style={inputStyle} placeholder="https://example.com" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Methode</label>
                  <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none" style={inputStyle}>
                    {['GET', 'POST', 'HEAD', 'PUT', 'PATCH', 'DELETE'].map((m) => (<option key={m} value={m}>{m}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Keyword (optional)</label>
                  <input value={keyword} onChange={(e) => setKeyword(e.target.value)} className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none font-mono focus:border-[var(--color-primary)]" style={inputStyle} placeholder="z.B. Welcome" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Status Min</label>
                  <input type="number" value={statusCodeMin} onChange={(e) => setStatusCodeMin(Number(e.target.value))} className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none font-mono focus:border-[var(--color-primary)]" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Status Max</label>
                  <input type="number" value={statusCodeMax} onChange={(e) => setStatusCodeMax(Number(e.target.value))} className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none font-mono focus:border-[var(--color-primary)]" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Timeout (ms)</label>
                  <input type="number" value={timeoutMs} onChange={(e) => setTimeoutMs(Math.max(1000, Number(e.target.value)))} className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none font-mono focus:border-[var(--color-primary)]" style={inputStyle} />
                </div>
              </div>
            </>
          )}

          {type === 'tcp' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Host *</label>
                <input value={tcpHost} onChange={(e) => setTcpHost(e.target.value)} required className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none font-mono focus:border-[var(--color-primary)]" style={inputStyle} placeholder="localhost" />
              </div>
              <div>
                <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Port *</label>
                <input type="number" value={tcpPort} onChange={(e) => setTcpPort(Number(e.target.value))} required className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none font-mono focus:border-[var(--color-primary)]" style={inputStyle} />
              </div>
              <div>
                <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Timeout (ms)</label>
                <input type="number" value={tcpTimeout} onChange={(e) => setTcpTimeout(Math.max(1000, Number(e.target.value)))} className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none font-mono focus:border-[var(--color-primary)]" style={inputStyle} />
              </div>
            </div>
          )}

          {type === 'ping' && (
            <div>
              <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Host *</label>
              <input value={pingHost} onChange={(e) => setPingHost(e.target.value)} required className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none font-mono focus:border-[var(--color-primary)]" style={inputStyle} placeholder="8.8.8.8" />
            </div>
          )}

          {type === 'dns' && (
            <>
              <div>
                <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Host *</label>
                <input value={dnsHost} onChange={(e) => setDnsHost(e.target.value)} required className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none font-mono focus:border-[var(--color-primary)]" style={inputStyle} placeholder="example.com" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Record-Typ</label>
                  <select value={dnsRecordType} onChange={(e) => setDnsRecordType(e.target.value)} className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none" style={inputStyle}>
                    {['A', 'AAAA', 'CNAME', 'MX', 'TXT'].map((t) => (<option key={t}>{t}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Erwarteter Wert</label>
                  <input value={dnsExpected} onChange={(e) => setDnsExpected(e.target.value)} className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none font-mono focus:border-[var(--color-primary)]" style={inputStyle} />
                </div>
              </div>
            </>
          )}

          {type === 'ssl' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Host *</label>
                <input value={sslHost} onChange={(e) => setSslHost(e.target.value)} required className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none font-mono focus:border-[var(--color-primary)]" style={inputStyle} placeholder="example.com" />
              </div>
              <div>
                <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Port</label>
                <input type="number" value={sslPort} onChange={(e) => setSslPort(Number(e.target.value))} className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none font-mono focus:border-[var(--color-primary)]" style={inputStyle} />
              </div>
              <div>
                <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Warnung (Tage)</label>
                <input type="number" value={sslWarningDays} onChange={(e) => setSslWarningDays(Number(e.target.value))} className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none font-mono focus:border-[var(--color-primary)]" style={inputStyle} />
              </div>
            </div>
          )}

          {type === 'push' && (
            <div>
              <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Grace-Periode (Sekunden)</label>
              <input type="number" value={pushGrace} onChange={(e) => setPushGrace(Math.max(10, Number(e.target.value)))} className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none font-mono focus:border-[var(--color-primary)]" style={inputStyle} />
              <p className="text-[0.75rem] mt-1" style={{ color: 'var(--color-text-dim)' }}>Nach Ablauf des Intervalls + Grace wird der Monitor als DOWN markiert.</p>
            </div>
          )}

          {/* Interval + Retries + Tags */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Intervall (s)</label>
              <input type="number" value={intervalSeconds} onChange={(e) => setIntervalSeconds(Math.max(20, Number(e.target.value)))} className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none font-mono focus:border-[var(--color-primary)]" style={inputStyle} />
            </div>
            <div>
              <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Retries</label>
              <input type="number" value={retries} onChange={(e) => setRetries(Math.max(0, Number(e.target.value)))} className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none font-mono focus:border-[var(--color-primary)]" style={inputStyle} />
            </div>
            <div>
              <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Tags (komma)</label>
              <input value={tags} onChange={(e) => setTags(e.target.value)} className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none font-mono focus:border-[var(--color-primary)]" style={inputStyle} placeholder="prod,web" />
            </div>
          </div>

          {error && (
            <div className="text-[0.85rem] p-3 rounded-[var(--radius-sm)]" style={{ color: 'var(--color-down)', background: 'var(--color-down-soft)' }}>
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 mt-2">
            <button type="button" onClick={onClose} className="px-4 py-[10px] rounded-[var(--radius-box)] border cursor-pointer text-[0.9rem]" style={{ borderColor: 'var(--color-border-strong)', color: 'var(--color-text)', background: 'transparent' }}>Abbrechen</button>
            <button type="submit" disabled={saving} className="px-4 py-[10px] rounded-[var(--radius-box)] border-0 cursor-pointer text-[0.9rem]" style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}>
              {saving ? 'Wird gespeichert…' : editId ? 'Speichern' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

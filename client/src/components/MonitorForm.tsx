import { useState, type FormEvent } from 'react';
import { useStore } from '../store/useStore';
import * as monitorsApi from '../api/monitors';
import { X } from 'lucide-react';

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

export default function MonitorForm({ onClose, editId }: MonitorFormProps) {
  const fetchMonitors = useStore((s) => s.fetchMonitors);
  const [type, setType] = useState<'http' | 'tcp' | 'ping' | 'dns' | 'ssl' | 'push'>('http');
  const [name, setName] = useState('');
  const [intervalSeconds, setIntervalSeconds] = useState(60);
  const [retries, setRetries] = useState(0);
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Type-specific config
  const [url, setUrl] = useState('https://');
  const [method, setMethod] = useState('GET');
  const [statusCodeMin, setStatusCodeMin] = useState(200);
  const [statusCodeMax, setStatusCodeMax] = useState(299);
  const [keyword, setKeyword] = useState('');

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

  const buildConfig = () => {
    switch (type) {
      case 'http':
        return { url, method, statusCodeMin, statusCodeMax, keyword: keyword || undefined, timeoutMs: 15000 };
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
      await monitorsApi.createMonitor({
        name: name.trim(),
        type,
        config: buildConfig() as Record<string, unknown>,
        intervalSeconds,
        retries,
        tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      } as any);
      await fetchMonitors();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Erstellen');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    background: 'var(--color-bg)',
    borderColor: 'var(--color-border)',
    color: 'var(--color-text)',
  } as React.CSSProperties;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[60px]" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div
        className="w-full max-w-[560px] max-h-[80vh] overflow-y-auto border rounded-[var(--radius-lg)] p-6"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[1.15rem] font-semibold m-0" style={{ color: 'var(--color-text)' }}>
            {editId ? 'Monitor bearbeiten' : 'Neuen Monitor erstellen'}
          </h2>
          <button onClick={onClose} className="w-[34px] h-[34px] rounded-[8px] grid place-items-center border bg-none cursor-pointer" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-dim)' }}>
            <X className="w-[16px] h-[16px]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <div>
            <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none focus:border-[var(--color-primary)]" style={inputStyle} placeholder="z.B. Meine Webseite" />
          </div>

          {/* Type */}
          <div>
            <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Typ *</label>
            <div className="grid grid-cols-3 gap-2">
              {MONITOR_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value as typeof type)}
                  className="px-3 py-[10px] rounded-[var(--radius-sm)] border text-[0.85rem] font-medium cursor-pointer transition-colors"
                  style={{
                    background: type === t.value ? 'var(--color-primary-soft)' : 'var(--color-bg)',
                    borderColor: type === t.value ? 'var(--color-primary)' : 'var(--color-border)',
                    color: type === t.value ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  }}
                >
                  {t.label}
                </button>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Status-Code Min</label>
                  <input type="number" value={statusCodeMin} onChange={(e) => setStatusCodeMin(Number(e.target.value))} className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none font-mono focus:border-[var(--color-primary)]" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Status-Code Max</label>
                  <input type="number" value={statusCodeMax} onChange={(e) => setStatusCodeMax(Number(e.target.value))} className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none font-mono focus:border-[var(--color-primary)]" style={inputStyle} />
                </div>
              </div>
            </>
          )}

          {type === 'tcp' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Host *</label>
                <input value={tcpHost} onChange={(e) => setTcpHost(e.target.value)} required className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none font-mono focus:border-[var(--color-primary)]" style={inputStyle} placeholder="localhost" />
              </div>
              <div>
                <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Port *</label>
                <input type="number" value={tcpPort} onChange={(e) => setTcpPort(Number(e.target.value))} required className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none font-mono focus:border-[var(--color-primary)]" style={inputStyle} />
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
            <>
              <div>
                <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Host *</label>
                <input value={sslHost} onChange={(e) => setSslHost(e.target.value)} required className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none font-mono focus:border-[var(--color-primary)]" style={inputStyle} placeholder="example.com" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Port</label>
                  <input type="number" value={sslPort} onChange={(e) => setSslPort(Number(e.target.value))} className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none font-mono focus:border-[var(--color-primary)]" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Warnung vor (Tage)</label>
                  <input type="number" value={sslWarningDays} onChange={(e) => setSslWarningDays(Number(e.target.value))} className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none font-mono focus:border-[var(--color-primary)]" style={inputStyle} />
                </div>
              </div>
            </>
          )}

          {type === 'push' && (
            <div>
              <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Grace-Periode (Sekunden)</label>
              <input type="number" value={pushGrace} onChange={(e) => setPushGrace(Number(e.target.value))} className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none font-mono focus:border-[var(--color-primary)]" style={inputStyle} />
              <p className="text-[0.75rem] mt-1" style={{ color: 'var(--color-text-dim)' }}>
                Nach Ablauf des Intervalls + Grace wird der Monitor als DOWN markiert.
              </p>
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

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-2">
            <button type="button" onClick={onClose} className="btn-secondary" style={{ height: 42, fontSize: '0.9rem' }}>
              Abbrechen
            </button>
            <button type="submit" disabled={saving} className="btn-primary" style={{ height: 42, fontSize: '0.9rem' }}>
              {saving ? 'Wird erstellt…' : editId ? 'Speichern' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const style = document.createElement('style');
style.textContent = `
  .btn-primary { display:inline-flex;align-items:center;justify-content:center;font-weight:540;font-size:0.95rem;padding:0 20px;border-radius:var(--radius-box);border:1px solid transparent;cursor:pointer;transition:background-color .17s,border-color .17s,color .17s,transform .17s;background:var(--color-primary);color:var(--color-primary-fg);box-shadow:0 1px 0 rgba(255,255,255,0.18) inset,0 8px 24px -10px var(--color-primary-glow); }
  .btn-primary:hover { background:var(--color-primary-hover); }
  .btn-primary:disabled { opacity:0.6;cursor:default; }
  .btn-secondary { display:inline-flex;align-items:center;justify-content:center;font-weight:540;font-size:0.95rem;padding:0 20px;border-radius:var(--radius-box);cursor:pointer;transition:background-color .17s,border-color .17s,color .17s,transform .17s;background:transparent;color:var(--color-text);border-color:var(--color-border-strong); }
  .btn-secondary:hover { background:var(--color-surface-2);border-color:var(--color-text-dim); }
`;
document.head.appendChild(style);

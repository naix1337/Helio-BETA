import { useState, useEffect, type FormEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useStore } from '../store/useStore';
import * as monitorsApi from '../api/monitors';
import { serverOrigin } from '../api/client';
import CopyField from './CopyField';
import { pushUrl as buildPushUrl } from '../utils/format';

const pushUrl = (token: string) => buildPushUrl(serverOrigin(), token);

type MonitorType = monitorsApi.MonitorType;

const MONITOR_TYPES: { value: MonitorType; label: string }[] = [
  { value: 'http', label: 'HTTP(s)' },
  { value: 'tcp', label: 'TCP-Port' },
  { value: 'ping', label: 'Ping' },
  { value: 'dns', label: 'DNS' },
  { value: 'ssl', label: 'SSL-Zertifikat' },
  { value: 'push', label: 'Push' },
];

interface MonitorFormProps {
  onClose: () => void;
  editId?: string;
}

function Field({ label, children, hint, className = '' }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="hint m-0">{hint}</p>}
    </div>
  );
}

export default function MonitorForm({ onClose, editId }: MonitorFormProps) {
  const notifications = useStore((s) => s.notifications);
  const fetchNotifications = useStore((s) => s.fetchNotifications);
  const upsertMonitor = useStore((s) => s.upsertMonitor);

  const [loading, setLoading] = useState(!!editId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<monitorsApi.Monitor | null>(null);

  const [type, setType] = useState<MonitorType>('http');
  const [name, setName] = useState('');
  const [intervalSeconds, setIntervalSeconds] = useState(60);
  const [retries, setRetries] = useState(1);
  const [tags, setTags] = useState('');
  const [notificationIds, setNotificationIds] = useState<string[]>([]);

  // HTTP
  const [url, setUrl] = useState('');
  const [method, setMethod] = useState('GET');
  const [statusCodeMin, setStatusCodeMin] = useState(200);
  const [statusCodeMax, setStatusCodeMax] = useState(299);
  const [keyword, setKeyword] = useState('');
  const [invertKeyword, setInvertKeyword] = useState(false);
  const [jsonPath, setJsonPath] = useState('');
  const [jsonPathExpected, setJsonPathExpected] = useState('');
  const [timeoutMs, setTimeoutMs] = useState(30000);
  const [ignoreTls, setIgnoreTls] = useState(false);
  const [followRedirects, setFollowRedirects] = useState(true);
  const [basicAuthUser, setBasicAuthUser] = useState('');
  const [basicAuthPass, setBasicAuthPass] = useState('');
  const [headersJson, setHeadersJson] = useState('');
  const [body, setBody] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Host-based
  const [host, setHost] = useState('');
  const [port, setPort] = useState(80);
  const [tcpTimeout, setTcpTimeout] = useState(10000);
  const [pingCount, setPingCount] = useState(3);
  const [dnsRecordType, setDnsRecordType] = useState('A');
  const [dnsExpected, setDnsExpected] = useState('');
  const [dnsResolver, setDnsResolver] = useState('');
  const [sslPort, setSslPort] = useState(443);
  const [sslWarningDays, setSslWarningDays] = useState(14);

  // Push
  const [pushGrace, setPushGrace] = useState(60);
  const [pushToken, setPushToken] = useState<string | null>(null);

  useEffect(() => { void fetchNotifications(); }, [fetchNotifications]);

  useEffect(() => {
    if (!editId) return;
    monitorsApi.getMonitor(editId).then((m) => {
      setName(m.name);
      setType(m.type);
      setIntervalSeconds(m.intervalSeconds);
      setRetries(m.retries);
      setTags(m.tags.join(', '));
      setNotificationIds(m.notificationIds ?? []);

      const cfg = monitorsApi.monitorConfig(m);
      const str = (k: string, d = '') => (cfg[k] as string | undefined) ?? d;
      const num = (k: string, d: number) => (cfg[k] as number | undefined) ?? d;
      switch (m.type) {
        case 'http':
          setUrl(str('url'));
          setMethod(str('method', 'GET'));
          setStatusCodeMin(num('statusCodeMin', 200));
          setStatusCodeMax(num('statusCodeMax', 299));
          setKeyword(str('keyword'));
          setInvertKeyword(Boolean(cfg['invertKeyword']));
          setJsonPath(str('jsonPath'));
          setJsonPathExpected(str('jsonPathExpected'));
          setTimeoutMs(num('timeoutMs', 30000));
          setIgnoreTls(Boolean(cfg['ignoreTls']));
          setFollowRedirects(cfg['followRedirects'] !== false);
          setBasicAuthUser(str('basicAuthUser'));
          setBasicAuthPass(str('basicAuthPass'));
          setHeadersJson(cfg['headers'] ? JSON.stringify(cfg['headers'], null, 2) : '');
          setBody(str('body'));
          if (cfg['keyword'] || cfg['jsonPath'] || cfg['basicAuthUser'] || cfg['headers'] || cfg['body']) setShowAdvanced(true);
          break;
        case 'tcp':
          setHost(str('host')); setPort(num('port', 80)); setTcpTimeout(num('timeoutMs', 10000));
          break;
        case 'ping':
          setHost(str('host')); setPingCount(num('count', 3));
          break;
        case 'dns':
          setHost(str('host')); setDnsRecordType(str('recordType', 'A')); setDnsExpected(str('expectedValue')); setDnsResolver(str('resolver'));
          break;
        case 'ssl':
          setHost(str('host')); setSslPort(num('port', 443)); setSslWarningDays(num('warningDays', 14));
          break;
        case 'push':
          setPushGrace(num('graceSeconds', 60)); setPushToken(str('token') || null);
          break;
      }
      setLoading(false);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Monitor konnte nicht geladen werden');
      setLoading(false);
    });
  }, [editId]);

  const buildConfig = (): Record<string, unknown> => {
    switch (type) {
      case 'http': {
        let headers: Record<string, string> | undefined;
        if (headersJson.trim()) {
          const parsed = JSON.parse(headersJson) as unknown;
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Header müssen ein JSON-Objekt sein, z.B. {"X-Token": "abc"}');
          headers = Object.fromEntries(Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [k, String(v)]));
        }
        return {
          url: url.trim(), method, statusCodeMin, statusCodeMax, timeoutMs,
          keyword: keyword || undefined, invertKeyword: keyword ? invertKeyword : undefined,
          jsonPath: jsonPath || undefined, jsonPathExpected: jsonPath && jsonPathExpected ? jsonPathExpected : undefined,
          ignoreTls, followRedirects,
          basicAuthUser: basicAuthUser || undefined, basicAuthPass: basicAuthUser ? basicAuthPass : undefined,
          headers, body: body || undefined,
        };
      }
      case 'tcp': return { host: host.trim(), port, timeoutMs: tcpTimeout };
      case 'ping': return { host: host.trim(), count: pingCount };
      case 'dns': return { host: host.trim(), recordType: dnsRecordType, expectedValue: dnsExpected || undefined, resolver: dnsResolver.trim() || undefined };
      case 'ssl': return { host: host.trim(), port: sslPort, warningDays: sslWarningDays };
      case 'push': return { graceSeconds: pushGrace, ...(pushToken ? { token: pushToken } : {}) };
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name ist erforderlich'); return; }
    setSaving(true);
    setError(null);
    try {
      const payload: monitorsApi.MonitorInput = {
        name: name.trim(),
        type,
        config: buildConfig(),
        intervalSeconds,
        retries,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        notificationIds,
      };
      const saved = editId ? await monitorsApi.updateMonitor(editId, payload) : await monitorsApi.createMonitor(payload);
      upsertMonitor(saved);
      if (!editId && saved.type === 'push') {
        // Show the generated push URL before closing
        setCreated(saved);
        return;
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  const toggleNotification = (id: string) =>
    setNotificationIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const header = (
    <div className="flex items-center justify-between mb-5">
      <h2 className="text-[1.15rem] font-semibold m-0" style={{ color: 'var(--color-text)' }}>
        {editId ? 'Monitor bearbeiten' : 'Neuen Monitor erstellen'}
      </h2>
      <button type="button" onClick={onClose} className="btn btn-icon" aria-label="Schließen">
        <X className="w-[16px] h-[16px]" />
      </button>
    </div>
  );

  if (created) {
    const token = (monitorsApi.monitorConfig(created)['token'] as string) ?? '';
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          {header}
          <div className="alert alert-ok mb-4">Push-Monitor „{created.name}“ wurde erstellt.</div>
          <Field label="Push-URL" hint="Rufe diese URL regelmäßig auf (GET oder POST), z.B. per Cronjob: curl -fsS '<URL>'. Optional: status=down, msg=…, ping=…">
            <CopyField value={pushUrl(token)} />
          </Field>
          <div className="flex justify-end mt-5">
            <button className="btn btn-primary" onClick={onClose}>Fertig</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {header}

        {loading ? (
          <div className="py-10 grid place-items-center">
            <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label="Typ">
              <div className="grid grid-cols-3 gap-2">
                {MONITOR_TYPES.map((t) => (
                  <button key={t.value} type="button" onClick={() => !editId && setType(t.value)}
                    disabled={!!editId && type !== t.value}
                    className={`chip ${type === t.value ? 'active' : ''}`}
                    style={{ borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontWeight: 500, cursor: editId ? 'default' : 'pointer', opacity: editId && type !== t.value ? 0.45 : 1 }}
                  >{t.label}</button>
                ))}
              </div>
            </Field>

            <Field label="Name *">
              <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} className="input" placeholder="z.B. Meine Webseite" autoFocus={!editId} />
            </Field>

            {type === 'http' && (
              <>
                <Field label="URL *">
                  <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} required className="input mono" placeholder="https://example.com/health" />
                </Field>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Field label="Methode">
                    <select value={method} onChange={(e) => setMethod(e.target.value)} className="input">
                      {['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </Field>
                  <Field label="Status min">
                    <input type="number" min={100} max={599} value={statusCodeMin} onChange={(e) => setStatusCodeMin(Number(e.target.value))} className="input mono" />
                  </Field>
                  <Field label="Status max">
                    <input type="number" min={100} max={599} value={statusCodeMax} onChange={(e) => setStatusCodeMax(Number(e.target.value))} className="input mono" />
                  </Field>
                  <Field label="Timeout (s)">
                    <input type="number" min={1} max={120} value={Math.round(timeoutMs / 1000)} onChange={(e) => setTimeoutMs(Math.max(1, Number(e.target.value)) * 1000)} className="input mono" />
                  </Field>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  <label className="check"><input type="checkbox" checked={ignoreTls} onChange={(e) => setIgnoreTls(e.target.checked)} /> TLS-Fehler ignorieren (self-signed)</label>
                  <label className="check"><input type="checkbox" checked={followRedirects} onChange={(e) => setFollowRedirects(e.target.checked)} /> Redirects folgen</label>
                </div>
                <button type="button" className="btn btn-sm self-start" onClick={() => setShowAdvanced((v) => !v)}>
                  {showAdvanced ? '− Erweiterte Optionen' : '+ Erweiterte Optionen (Keyword, JSON, Auth, Header)'}
                </button>
                {showAdvanced && (
                  <div className="flex flex-col gap-4 p-4 rounded-[var(--radius-box)]" style={{ background: 'var(--color-bg-soft)', border: '1px solid var(--color-border)' }}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Keyword im Body">
                        <input value={keyword} onChange={(e) => setKeyword(e.target.value)} className="input mono" placeholder="z.B. OK" />
                      </Field>
                      <div className="flex items-end pb-3">
                        <label className="check"><input type="checkbox" checked={invertKeyword} disabled={!keyword} onChange={(e) => setInvertKeyword(e.target.checked)} /> Invertieren (DOWN wenn gefunden)</label>
                      </div>
                      <Field label="JSONPath" hint="z.B. $.status oder $.data[0].ok">
                        <input value={jsonPath} onChange={(e) => setJsonPath(e.target.value)} className="input mono" placeholder="$.status" />
                      </Field>
                      <Field label="Erwarteter Wert (optional)">
                        <input value={jsonPathExpected} onChange={(e) => setJsonPathExpected(e.target.value)} disabled={!jsonPath} className="input mono" placeholder="ok" />
                      </Field>
                      <Field label="Basic-Auth Benutzer">
                        <input value={basicAuthUser} onChange={(e) => setBasicAuthUser(e.target.value)} className="input" autoComplete="off" />
                      </Field>
                      <Field label="Basic-Auth Passwort">
                        <input type="password" value={basicAuthPass} onChange={(e) => setBasicAuthPass(e.target.value)} className="input" autoComplete="new-password" />
                      </Field>
                    </div>
                    <Field label="Header (JSON)">
                      <textarea value={headersJson} onChange={(e) => setHeadersJson(e.target.value)} className="input mono" rows={3} placeholder='{"Authorization": "Bearer …"}' />
                    </Field>
                    {!['GET', 'HEAD'].includes(method) && (
                      <Field label="Body">
                        <textarea value={body} onChange={(e) => setBody(e.target.value)} className="input mono" rows={3} />
                      </Field>
                    )}
                  </div>
                )}
              </>
            )}

            {(type === 'tcp' || type === 'ping' || type === 'dns' || type === 'ssl') && (
              <Field label="Host *">
                <input value={host} onChange={(e) => setHost(e.target.value)} required className="input mono" placeholder={type === 'ping' || type === 'tcp' ? '192.168.1.10 oder server.lan' : 'example.com'} />
              </Field>
            )}

            {type === 'tcp' && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Port *">
                  <input type="number" min={1} max={65535} value={port} onChange={(e) => setPort(Number(e.target.value))} required className="input mono" />
                </Field>
                <Field label="Timeout (s)">
                  <input type="number" min={1} max={120} value={Math.round(tcpTimeout / 1000)} onChange={(e) => setTcpTimeout(Math.max(1, Number(e.target.value)) * 1000)} className="input mono" />
                </Field>
              </div>
            )}

            {type === 'ping' && (
              <Field label="Pakete pro Check">
                <input type="number" min={1} max={10} value={pingCount} onChange={(e) => setPingCount(Number(e.target.value))} className="input mono" />
              </Field>
            )}

            {type === 'dns' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Record-Typ">
                  <select value={dnsRecordType} onChange={(e) => setDnsRecordType(e.target.value)} className="input">
                    {['A', 'AAAA', 'CNAME', 'MX', 'TXT'].map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Erwarteter Wert">
                  <input value={dnsExpected} onChange={(e) => setDnsExpected(e.target.value)} className="input mono" placeholder="optional" />
                </Field>
                <Field label="DNS-Server">
                  <input value={dnsResolver} onChange={(e) => setDnsResolver(e.target.value)} className="input mono" placeholder="z.B. 1.1.1.1" />
                </Field>
              </div>
            )}

            {type === 'ssl' && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Port">
                  <input type="number" min={1} max={65535} value={sslPort} onChange={(e) => setSslPort(Number(e.target.value))} className="input mono" />
                </Field>
                <Field label="Warnung ab (Tage)" hint="Status „eingeschränkt“ wenn das Zertifikat bald abläuft">
                  <input type="number" min={0} max={365} value={sslWarningDays} onChange={(e) => setSslWarningDays(Number(e.target.value))} className="input mono" />
                </Field>
              </div>
            )}

            {type === 'push' && (
              <>
                <Field label="Grace-Periode (Sekunden)" hint="Kommt innerhalb von Intervall + Grace kein Push, wird der Monitor DOWN.">
                  <input type="number" min={0} value={pushGrace} onChange={(e) => setPushGrace(Math.max(0, Number(e.target.value)))} className="input mono" />
                </Field>
                {pushToken
                  ? <Field label="Push-URL"><CopyField value={pushUrl(pushToken)} /></Field>
                  : <p className="hint m-0">Die Push-URL wird nach dem Erstellen angezeigt.</p>}
              </>
            )}

            <div className="grid grid-cols-3 gap-3">
              <Field label="Intervall (s)">
                <input type="number" min={20} value={intervalSeconds} onChange={(e) => setIntervalSeconds(Number(e.target.value))} onBlur={() => setIntervalSeconds((v) => Math.max(20, v || 60))} className="input mono" />
              </Field>
              <Field label="Wiederholungen" hint="vor DOWN">
                <input type="number" min={0} max={10} value={retries} onChange={(e) => setRetries(Math.min(10, Math.max(0, Number(e.target.value))))} className="input mono" disabled={type === 'push'} />
              </Field>
              <Field label="Tags">
                <input value={tags} onChange={(e) => setTags(e.target.value)} className="input mono" placeholder="prod, web" />
              </Field>
            </div>

            <Field label="Benachrichtigungen">
              {notifications.length === 0 ? (
                <p className="hint m-0">Noch keine Benachrichtigungen eingerichtet (Menü „Benachrichtigungen“).</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {notifications.map((n) => (
                    <button key={n.id} type="button" onClick={() => toggleNotification(n.id)} className={`chip ${notificationIds.includes(n.id) ? 'active' : ''}`}>
                      {n.name} <span style={{ opacity: 0.6 }}>· {n.provider}</span>
                    </button>
                  ))}
                </div>
              )}
            </Field>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="flex justify-end gap-3 mt-1">
              <button type="button" onClick={onClose} className="btn">Abbrechen</button>
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? 'Wird gespeichert…' : editId ? 'Speichern' : 'Erstellen'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Plus, Trash2, Send, X, Edit3 } from 'lucide-react';
import { useStore, useIsAdmin, type Notification } from '../store/useStore';
import * as api from '../api/notifications';

const PROVIDERS: { value: api.ProviderType; label: string }[] = [
  { value: 'discord', label: 'Discord' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'ntfy', label: 'ntfy' },
  { value: 'email', label: 'E-Mail' },
  { value: 'webhook', label: 'Webhook' },
];

const PROVIDER_NAMES = Object.fromEntries(PROVIDERS.map((p) => [p.value, p.label])) as Record<string, string>;

export default function NotificationsView() {
  const notifications = useStore((s) => s.notifications);
  const fetchNotifications = useStore((s) => s.fetchNotifications);
  const isAdmin = useIsAdmin();
  const [editing, setEditing] = useState<Notification | null | 'new'>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  useEffect(() => { void fetchNotifications(); }, [fetchNotifications]);

  const handleTest = async (id: string) => {
    setTestResult({ id, success: true, message: 'sende…' });
    try {
      const r = await api.testNotification(id);
      setTestResult({ id, ...r });
    } catch (err) {
      setTestResult({ id, success: false, message: err instanceof Error ? err.message : 'Test fehlgeschlagen' });
    }
    setTimeout(() => setTestResult((t) => (t?.id === id ? null : t)), 6000);
  };

  const handleDelete = async (n: Notification) => {
    if (!confirm(`Benachrichtigung "${n.name}" löschen?`)) return;
    try {
      await api.deleteNotification(n.id);
      void fetchNotifications();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Löschen fehlgeschlagen');
    }
  };

  return (
    <div className="animate-[view-fade_0.35s_cubic-bezier(0.22,1,0.36,1)]">
      <div className="flex items-center justify-between mb-4 gap-3">
        <p className="m-0 text-[0.86rem]" style={{ color: 'var(--color-text-muted)' }}>
          Benachrichtigungen werden bei Statuswechseln (DOWN, eingeschränkt, wieder online) der zugewiesenen Monitore gesendet.
        </p>
        {isAdmin && (
          <button onClick={() => setEditing('new')} className="btn btn-primary flex-none">
            <Plus className="w-[16px] h-[16px]" /> Neu
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="m-0 text-[0.9rem]" style={{ color: 'var(--color-text-muted)' }}>Keine Benachrichtigungen eingerichtet.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {notifications.map((n) => (
            <div key={n.id} className="flex flex-wrap gap-3 items-center px-[18px] py-[14px] border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex-1 min-w-[200px]">
                <div className="font-medium text-[0.92rem]" style={{ color: 'var(--color-text)' }}>{n.name}</div>
                <div className="font-mono text-[0.78rem] mt-[2px]" style={{ color: 'var(--color-text-dim)' }}>
                  {PROVIDER_NAMES[n.provider] || n.provider} · {n.monitorIds?.length || 0} Monitore
                </div>
              </div>
              {testResult?.id === n.id && (
                <span className={`pill ${testResult.success ? 'pill-ok' : 'pill-down'} max-w-[320px] truncate`} title={testResult.message}>
                  {testResult.message}
                </span>
              )}
              {isAdmin && (
                <div className="flex gap-2">
                  <button onClick={() => handleTest(n.id)} className="btn btn-icon" title="Test senden"><Send className="w-[15px] h-[15px]" /></button>
                  <button onClick={() => setEditing(n)} className="btn btn-icon" title="Bearbeiten"><Edit3 className="w-[14px] h-[14px]" /></button>
                  <button onClick={() => handleDelete(n)} className="btn btn-icon btn-danger" title="Löschen"><Trash2 className="w-[15px] h-[15px]" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <NotificationForm
          editing={editing === 'new' ? null : editing}
          onClose={() => { setEditing(null); void fetchNotifications(); void useStore.getState().fetchMonitors(); }}
        />
      )}
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="hint m-0">{hint}</p>}
    </div>
  );
}

function NotificationForm({ onClose, editing }: { onClose: () => void; editing: Notification | null }) {
  const monitors = useStore((s) => s.monitors);
  const initial = editing ? api.notificationConfig(editing) : {};
  const str = (k: string) => (initial[k] as string | undefined) ?? '';

  const [name, setName] = useState(editing?.name ?? '');
  const [provider, setProvider] = useState<api.ProviderType>(editing?.provider ?? 'discord');
  const [selectedMonitors, setSelectedMonitors] = useState<string[]>(editing?.monitorIds ?? []);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [webhookUrl, setWebhookUrl] = useState(str('url'));
  const [webhookHeaders, setWebhookHeaders] = useState(initial['headers'] ? JSON.stringify(initial['headers']) : '');
  const [botToken, setBotToken] = useState(str('botToken'));
  const [chatId, setChatId] = useState(str('chatId'));
  const [discordUrl, setDiscordUrl] = useState(str('webhookUrl'));
  const [smtpHost, setSmtpHost] = useState(str('smtpHost'));
  const [smtpPort, setSmtpPort] = useState<number>((initial['smtpPort'] as number) ?? 587);
  const [smtpUser, setSmtpUser] = useState(str('smtpUser'));
  const [smtpPass, setSmtpPass] = useState(str('smtpPass'));
  const [fromEmail, setFromEmail] = useState(str('fromEmail'));
  const [toEmail, setToEmail] = useState(str('toEmail'));
  const [ntfyTopic, setNtfyTopic] = useState(str('topic'));
  const [ntfyServer, setNtfyServer] = useState(str('serverUrl'));
  const [ntfyToken, setNtfyToken] = useState(str('accessToken'));

  const buildConfig = (): Record<string, unknown> => {
    switch (provider) {
      case 'webhook': {
        let headers: Record<string, string> | undefined;
        if (webhookHeaders.trim()) {
          const parsed = JSON.parse(webhookHeaders) as Record<string, unknown>;
          headers = Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, String(v)]));
        }
        return { url: webhookUrl.trim(), ...(headers ? { headers } : {}) };
      }
      case 'telegram': return { botToken: botToken.trim(), chatId: chatId.trim() };
      case 'discord': return { webhookUrl: discordUrl.trim() };
      case 'email': return { smtpHost: smtpHost.trim(), smtpPort: Number(smtpPort), smtpUser, smtpPass, fromEmail: fromEmail.trim(), toEmail: toEmail.trim() };
      case 'ntfy': return { topic: ntfyTopic.trim(), ...(ntfyServer.trim() ? { serverUrl: ntfyServer.trim() } : {}), ...(ntfyToken ? { accessToken: ntfyToken } : {}) };
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestMsg(null);
    try {
      const r = await api.testNotificationConfig(provider, buildConfig());
      setTestMsg({ ok: r.success, text: r.success ? `Gesendet (${r.message})` : r.message });
    } catch (err) {
      setTestMsg({ ok: false, text: err instanceof Error ? err.message : 'Test fehlgeschlagen' });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload = { name: name.trim(), provider, config: buildConfig(), monitorIds: selectedMonitors };
      if (editing) await api.updateNotification(editing.id, payload);
      else await api.createNotification(payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  const toggleMonitor = (id: string) => setSelectedMonitors((p) => (p.includes(id) ? p.filter((m) => m !== id) : [...p, id]));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[1.15rem] font-semibold m-0" style={{ color: 'var(--color-text)' }}>{editing ? 'Benachrichtigung bearbeiten' : 'Neue Benachrichtigung'}</h2>
          <button onClick={onClose} className="btn btn-icon" aria-label="Schließen"><X className="w-[16px] h-[16px]" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Name *">
            <input value={name} onChange={(e) => setName(e.target.value)} required className="input" placeholder="z.B. Discord #alerts" />
          </Field>

          <Field label="Dienst">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {PROVIDERS.map((p) => (
                <button key={p.value} type="button" onClick={() => setProvider(p.value)} className={`chip ${provider === p.value ? 'active' : ''}`} style={{ borderRadius: 'var(--radius-sm)', fontFamily: 'inherit' }}>
                  {p.label}
                </button>
              ))}
            </div>
          </Field>

          {provider === 'discord' && (
            <Field label="Discord Webhook-URL *" hint="Kanal-Einstellungen → Integrationen → Webhooks">
              <input value={discordUrl} onChange={(e) => setDiscordUrl(e.target.value)} required className="input mono" placeholder="https://discord.com/api/webhooks/…" />
            </Field>
          )}
          {provider === 'telegram' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Bot-Token *" hint="von @BotFather">
                <input value={botToken} onChange={(e) => setBotToken(e.target.value)} required className="input mono" placeholder="123456:ABC-…" />
              </Field>
              <Field label="Chat-ID *" hint="z.B. über @userinfobot">
                <input value={chatId} onChange={(e) => setChatId(e.target.value)} required className="input mono" placeholder="-100123456789" />
              </Field>
            </div>
          )}
          {provider === 'ntfy' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Topic *">
                <input value={ntfyTopic} onChange={(e) => setNtfyTopic(e.target.value)} required className="input mono" placeholder="helio-alerts" />
              </Field>
              <Field label="Server" hint="leer = ntfy.sh">
                <input value={ntfyServer} onChange={(e) => setNtfyServer(e.target.value)} className="input mono" placeholder="https://ntfy.sh" />
              </Field>
              <Field label="Access-Token (optional)">
                <input type="password" value={ntfyToken} onChange={(e) => setNtfyToken(e.target.value)} className="input mono" autoComplete="off" />
              </Field>
            </div>
          )}
          {provider === 'email' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="SMTP-Host *"><input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} required className="input mono" placeholder="smtp.example.com" /></Field>
              <Field label="Port" hint="465 = SSL, 587 = STARTTLS"><input type="number" value={smtpPort} onChange={(e) => setSmtpPort(Number(e.target.value))} className="input mono" /></Field>
              <Field label="Benutzer"><input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} className="input mono" autoComplete="off" /></Field>
              <Field label="Passwort"><input type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} className="input mono" autoComplete="new-password" /></Field>
              <Field label="Absender *"><input type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} required className="input mono" /></Field>
              <Field label="Empfänger *"><input type="email" value={toEmail} onChange={(e) => setToEmail(e.target.value)} required className="input mono" /></Field>
            </div>
          )}
          {provider === 'webhook' && (
            <>
              <Field label="URL *" hint="POST mit JSON-Payload (monitorName, status, previousStatus, errorMessage, …)">
                <input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} required className="input mono" placeholder="https://hooks.example.com/…" />
              </Field>
              <Field label="Header (JSON, optional)">
                <input value={webhookHeaders} onChange={(e) => setWebhookHeaders(e.target.value)} className="input mono" placeholder='{"Authorization": "Bearer …"}' />
              </Field>
            </>
          )}

          <Field label="Monitore">
            {monitors.length === 0 ? <p className="hint m-0">Noch keine Monitore vorhanden.</p> : (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="chip" onClick={() => setSelectedMonitors(selectedMonitors.length === monitors.length ? [] : monitors.map((m) => m.id))}>
                  {selectedMonitors.length === monitors.length ? 'keine' : 'alle'}
                </button>
                {monitors.map((m) => (
                  <button key={m.id} type="button" onClick={() => toggleMonitor(m.id)} className={`chip ${selectedMonitors.includes(m.id) ? 'active' : ''}`}>{m.name}</button>
                ))}
              </div>
            )}
          </Field>

          {error && <div className="alert alert-error">{error}</div>}
          {testMsg && <div className={`alert ${testMsg.ok ? 'alert-ok' : 'alert-error'}`}>{testMsg.text}</div>}

          <div className="flex justify-between gap-3 mt-1 flex-wrap">
            <button type="button" onClick={handleTest} disabled={testing} className="btn"><Send className="w-[14px] h-[14px]" /> {testing ? 'Sende…' : 'Test senden'}</button>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="btn">Abbrechen</button>
              <button type="submit" disabled={saving} className="btn btn-primary">{saving ? '…' : editing ? 'Speichern' : 'Erstellen'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

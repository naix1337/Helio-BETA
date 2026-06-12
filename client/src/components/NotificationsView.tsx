import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { apiRequest } from '../api/client';
import { Plus, Trash2, Play, X, Edit3 } from 'lucide-react';

const PROVIDER_NAMES: Record<string, string> = {
  webhook: 'Webhook', telegram: 'Telegram', discord: 'Discord', email: 'E-Mail', ntfy: 'ntfy',
};

interface NotifData {
  id: string; name: string; provider: string; config: Record<string, unknown>; monitorIds: string[]; createdAt: string;
}

export default function NotificationsView() {
  const [notifications, setNotifications] = useState<NotifData[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  const load = async () => {
    const res = await apiRequest<NotifData[]>('GET', '/notifications');
    if (res.data) setNotifications(res.data);
  };

  useEffect(() => { load(); }, []);

  const handleTest = async (id: string) => {
    const res = await apiRequest<{ success: boolean; message: string }>('POST', `/notifications/${id}/test`);
    const data = res.data;
    setTestResult({ id, success: data?.success ?? false, message: data?.message ?? 'Test fehlgeschlagen' });
    setTimeout(() => setTestResult(null), 3000);
  };

  const handleDelete = async (id: string) => {
    await apiRequest('DELETE', `/notifications/${id}`);
    load();
  };

  const openEdit = (n: NotifData) => {
    setEditId(n.id);
    setShowForm(true);
  };

  return (
    <div className="animate-[view-fade_0.35s_cubic-bezier(0.22,1,0.36,1)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[1.05rem] font-semibold m-0" style={{ color: 'var(--color-text)' }}>Benachrichtigungen</h2>
        <button onClick={() => { setEditId(null); setShowForm(true); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-box)] text-[0.88rem] border-0 cursor-pointer" style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}>
          <Plus className="w-[16px] h-[16px]" /> Neu
        </button>
      </div>

      {notifications.length === 0 ? (
        <div className="border rounded-[var(--radius-lg)] p-10 text-center" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <p className="m-0 text-[0.9rem]" style={{ color: 'var(--color-text-muted)' }}>Keine Benachrichtigungen eingerichtet.</p>
        </div>
      ) : (
        <div className="border rounded-[var(--radius-lg)] overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          {notifications.map((n) => (
            <div key={n.id} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-[18px] py-[14px] border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <div className="font-medium text-[0.92rem]" style={{ color: 'var(--color-text)' }}>{n.name}</div>
                <div className="font-mono text-[0.78rem] mt-[2px]" style={{ color: 'var(--color-text-dim)' }}>
                  {PROVIDER_NAMES[n.provider] || n.provider} · {n.monitorIds?.length || 0} Monitore
                </div>
              </div>
              {testResult?.id === n.id && (
                <span className={`text-[0.8rem] font-mono ${testResult.success ? 'text-[var(--color-ok)]' : 'text-[var(--color-down)]'}`}>
                  {testResult.message}
                </span>
              )}
              <button onClick={() => handleTest(n.id)} className="w-[34px] h-[34px] rounded-[8px] grid place-items-center border cursor-pointer" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)', background: 'transparent' }} title="Test">
                <Play className="w-[15px] h-[15px]" />
              </button>
              <button onClick={() => openEdit(n)} className="w-[34px] h-[34px] rounded-[8px] grid place-items-center border cursor-pointer" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)', background: 'transparent' }} title="Bearbeiten">
                <Edit3 className="w-[14px] h-[14px]" />
              </button>
              <button onClick={() => handleDelete(n.id)} className="w-[34px] h-[34px] rounded-[8px] grid place-items-center border cursor-pointer" style={{ borderColor: 'var(--color-border)', color: 'var(--color-down)', background: 'transparent' }} title="Löschen">
                <Trash2 className="w-[15px] h-[15px]" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && <NotificationForm onClose={() => { setShowForm(false); load(); }} editId={editId} notifications={notifications} />}
    </div>
  );
}

function NotificationForm({ onClose, editId, notifications }: { onClose: () => void; editId: string | null; notifications: NotifData[] }) {
  const monitors = useStore((s) => s.monitors);
  const fetchMonitors = useStore((s) => s.fetchMonitors);
  const editing = editId ? notifications.find((n) => n.id === editId) : null;

  const [name, setName] = useState(editing?.name || '');
  const [provider, setProvider] = useState<'webhook' | 'telegram' | 'discord' | 'email' | 'ntfy'>((editing?.provider as any) || 'webhook');
  const [selectedMonitors, setSelectedMonitors] = useState<string[]>(editing?.monitorIds || []);
  const [saving, setSaving] = useState(false);

  // Provider config
  const [webhookUrl, setWebhookUrl] = useState('');
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [discordUrl, setDiscordUrl] = useState('');
  const [smtpHost, setSmtpHost] = useState(''); const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState(''); const [smtpPass, setSmtpPass] = useState('');
  const [fromEmail, setFromEmail] = useState(''); const [toEmail, setToEmail] = useState('');
  const [ntfyTopic, setNtfyTopic] = useState('');
  const [ntfyServer, setNtfyServer] = useState('');

  useEffect(() => { fetchMonitors(); }, []);

  // Load editing data
  useEffect(() => {
    if (!editing) return;
    const cfg = (editing.config as any)?.data || editing.config;
    if (editing.provider === 'webhook') setWebhookUrl(cfg?.url || '');
    if (editing.provider === 'telegram') { setBotToken(cfg?.botToken || ''); setChatId(cfg?.chatId || ''); }
    if (editing.provider === 'discord') setDiscordUrl(cfg?.webhookUrl || '');
    if (editing.provider === 'email') {
      setSmtpHost(cfg?.smtpHost || ''); setSmtpPort(cfg?.smtpPort || 587);
      setSmtpUser(cfg?.smtpUser || ''); setSmtpPass(cfg?.smtpPass || '');
      setFromEmail(cfg?.fromEmail || ''); setToEmail(cfg?.toEmail || '');
    }
    if (editing.provider === 'ntfy') { setNtfyTopic(cfg?.topic || ''); setNtfyServer(cfg?.serverUrl || ''); }
  }, [editing?.id]);

  const buildConfig = () => {
    switch (provider) {
      case 'webhook': return { url: webhookUrl, headers: {} };
      case 'telegram': return { botToken, chatId };
      case 'discord': return { webhookUrl: discordUrl };
      case 'email': return { smtpHost, smtpPort: Number(smtpPort), smtpUser, smtpPass, fromEmail, toEmail };
      case 'ntfy': return { topic: ntfyTopic, serverUrl: ntfyServer || undefined };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = { name: name.trim(), provider, config: buildConfig(), monitorIds: selectedMonitors };
      if (editId) {
        await apiRequest('PATCH', `/notifications/${editId}`, payload);
      } else {
        await apiRequest('POST', '/notifications', payload);
      }
      onClose();
    } catch {} finally { setSaving(false); }
  };

  const toggleMonitor = (id: string) => setSelectedMonitors((p) => p.includes(id) ? p.filter((m) => m !== id) : [...p, id]);
  const inputStyle = { background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' } as React.CSSProperties;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[60px]" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-[520px] max-h-[80vh] overflow-y-auto border rounded-[var(--radius-lg)] p-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[1.15rem] font-semibold m-0" style={{ color: 'var(--color-text)' }}>{editId ? 'Bearbeiten' : 'Neue Benachrichtigung'}</h2>
          <button onClick={onClose} className="w-[34px] h-[34px] rounded-[8px] grid place-items-center border cursor-pointer" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-dim)', background: 'transparent' }}>
            <X className="w-[16px] h-[16px]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] outline-none" style={inputStyle} />
          </div>

          <div>
            <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Provider</label>
            <div className="grid grid-cols-5 gap-2">
              {['webhook', 'telegram', 'discord', 'email', 'ntfy'].map((p) => (
                <button key={p} type="button" onClick={() => setProvider(p as any)}
                  className="px-2 py-[8px] rounded-[var(--radius-sm)] border text-[0.78rem] font-medium cursor-pointer"
                  style={{
                    background: provider === p ? 'var(--color-primary-soft)' : 'var(--color-bg)',
                    borderColor: provider === p ? 'var(--color-primary)' : 'var(--color-border)',
                    color: provider === p ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  }}
                >{p}</button>
              ))}
            </div>
          </div>

          {provider === 'webhook' && (
            <input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} required className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] font-mono outline-none" style={inputStyle} placeholder="https://hooks.example.com/..." />
          )}
          {provider === 'telegram' && (
            <><input value={botToken} onChange={(e) => setBotToken(e.target.value)} required className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] font-mono outline-none" style={inputStyle} placeholder="Bot Token" />
            <input value={chatId} onChange={(e) => setChatId(e.target.value)} required className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] font-mono outline-none" style={inputStyle} placeholder="Chat ID" /></>
          )}
          {provider === 'discord' && (
            <input value={discordUrl} onChange={(e) => setDiscordUrl(e.target.value)} required className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] font-mono outline-none" style={inputStyle} placeholder="Discord Webhook URL" />
          )}
          {provider === 'ntfy' && (
            <><input value={ntfyTopic} onChange={(e) => setNtfyTopic(e.target.value)} required className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] font-mono outline-none" style={inputStyle} placeholder="Topic" />
            <input value={ntfyServer} onChange={(e) => setNtfyServer(e.target.value)} className="w-full h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] font-mono outline-none" style={inputStyle} placeholder="Server (ntfy.sh)" /></>
          )}
          {provider === 'email' && (
            <div className="grid grid-cols-2 gap-3">
              <input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} required className="col-span-2 h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] font-mono outline-none" style={inputStyle} placeholder="SMTP Host" />
              <input type="number" value={smtpPort} onChange={(e) => setSmtpPort(Number(e.target.value))} className="h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] font-mono outline-none" style={inputStyle} placeholder="587" />
              <input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} required className="h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] font-mono outline-none" style={inputStyle} placeholder="SMTP User" />
              <input type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} required className="h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] font-mono outline-none" style={inputStyle} placeholder="SMTP Pass" />
              <input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} required className="h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] font-mono outline-none" style={inputStyle} placeholder="From" />
              <input value={toEmail} onChange={(e) => setToEmail(e.target.value)} required className="h-[42px] px-3 rounded-[var(--radius-box)] border text-[0.9rem] font-mono outline-none" style={inputStyle} placeholder="To" />
            </div>
          )}

          <div>
            <label className="block text-[0.85rem] font-medium mb-[6px]" style={{ color: 'var(--color-text-muted)' }}>Monitore</label>
            <div className="flex flex-wrap gap-2">
              {monitors.map((m) => (
                <button key={m.id} type="button" onClick={() => toggleMonitor(m.id)}
                  className="px-3 py-[6px] rounded-full border text-[0.8rem] font-mono cursor-pointer transition-colors"
                  style={{
                    background: selectedMonitors.includes(m.id) ? 'var(--color-primary-soft)' : 'var(--color-bg)',
                    borderColor: selectedMonitors.includes(m.id) ? 'var(--color-primary)' : 'var(--color-border)',
                    color: selectedMonitors.includes(m.id) ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  }}
                >{m.name}</button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-2">
            <button type="button" onClick={onClose} className="px-4 py-[10px] rounded-[var(--radius-box)] border cursor-pointer text-[0.9rem]" style={{ borderColor: 'var(--color-border-strong)', color: 'var(--color-text)', background: 'transparent' }}>Abbrechen</button>
            <button type="submit" disabled={saving} className="px-4 py-[10px] rounded-[var(--radius-box)] border-0 cursor-pointer text-[0.9rem]" style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}>
              {saving ? '…' : editId ? 'Speichern' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { Users, Mail, Shield } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function TeamView() {
  const user = useStore((s) => s.user);

  return (
    <div className="animate-[view-fade_0.35s_cubic-bezier(0.22,1,0.36,1)]">
      <h2 className="text-[1.05rem] font-semibold tracking-tight mb-4 m-0" style={{ color: 'var(--color-text)' }}>Team</h2>

      <div className="border rounded-[var(--radius-lg)] overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="px-[18px] py-[14px] border-b font-medium text-[0.9rem]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
          Mitglieder (1)
        </div>

        {user && (
          <div className="flex items-center gap-4 px-[18px] py-[14px] border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
            <span className="w-[42px] h-[42px] rounded-[10px] flex-none grid place-items-center font-mono font-semibold text-[0.95rem]"
              style={{
                color: 'var(--color-primary-fg)',
                background: 'linear-gradient(135deg, var(--color-primary), #0e7d72)',
              }}
            >
              {user.email.slice(0, 2).toUpperCase()}
            </span>
            <div className="flex-1">
              <div className="font-medium text-[0.9rem]" style={{ color: 'var(--color-text)' }}>{user.email}</div>
              <div className="font-mono text-[0.78rem]" style={{ color: 'var(--color-text-dim)' }}>
                {user.role === 'admin' ? 'Administrator' : 'Benutzer'}
              </div>
            </div>
            <span className="inline-flex items-center gap-[6px] font-mono text-[0.72rem] px-[8px] py-[3px] rounded-full border" style={{ borderColor: 'var(--color-primary-soft)', background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
              <Shield className="w-[12px] h-[12px]" />
              {user.role}
            </span>
          </div>
        )}
      </div>

      <div className="mt-4 p-4 border rounded-[var(--radius-lg)] text-center" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <p className="m-0 text-[0.85rem]" style={{ color: 'var(--color-text-muted)' }}>
          Team-Verwaltung mit Einladungen und Rollen ist in Entwicklung.
        </p>
      </div>
    </div>
  );
}

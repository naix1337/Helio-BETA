import type { ReactNode } from 'react';

interface PlaceholderViewProps {
  icon: ReactNode;
  message: string;
}

export default function PlaceholderView({ icon, message }: PlaceholderViewProps) {
  return (
    <div className="animate-[view-fade_0.35s_cubic-bezier(0.22,1,0.36,1)]">
      <div className="border border-[var(--color-border)] rounded-[var(--radius-lg)] bg-[var(--color-surface)] overflow-hidden mt-4">
        <div className="p-[18px] text-center" style={{ padding: '60px 20px', color: 'var(--color-text-dim)' }}>
          <div className="flex justify-center mb-[14px]" style={{ color: 'var(--color-primary)' }}>
            {icon}
          </div>
          <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>{message}</p>
        </div>
      </div>
    </div>
  );
}

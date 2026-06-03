// helio-app/frontend/src/components/Toast.tsx
import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useToastStore } from '../store/toastStore.ts';

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();
  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', top: '20px', right: '20px',
      display: 'flex', flexDirection: 'column', gap: '10px',
      zIndex: 1000, pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div key={t.id} className="toast-item" style={{
          display: 'flex', alignItems: 'flex-start', gap: '12px',
          padding: '14px 16px', borderRadius: 'var(--radius)',
          background: 'var(--surface)', border: '1px solid var(--warn)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          minWidth: '280px', maxWidth: '360px',
          pointerEvents: 'all',
        }}>
          <AlertTriangle size={16} color="var(--warn)" style={{ marginTop: '2px', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 540, fontSize: '0.85rem', marginBottom: '3px' }}>
              {t.event.name}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              {t.event.metric} = {t.event.value.toFixed(1)}
            </div>
          </div>
          <button
            onClick={() => removeToast(t.id)}
            style={{
              background: 'none', border: 'none', color: 'var(--text-dim)',
              cursor: 'pointer', padding: '2px', flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

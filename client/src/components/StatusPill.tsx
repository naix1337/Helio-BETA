import type { Monitor } from '../store/useStore';

const MAP: Record<Monitor['status'], [string, string]> = {
  UP: ['pill-ok', 'online'],
  DOWN: ['pill-down', 'offline'],
  DEGRADED: ['pill-warn', 'eingeschränkt'],
  PENDING: ['pill-warn', 'ausstehend'],
  PAUSED: ['pill-dim', 'pausiert'],
};

export default function StatusPill({ status }: { status: Monitor['status'] }) {
  const [cls, label] = MAP[status] ?? ['pill-dim', status];
  return <span className={`pill ${cls}`}>{label}</span>;
}

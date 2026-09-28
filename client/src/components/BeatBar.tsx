import type { Beat } from '../store/useStore';

interface BeatBarProps {
  beats: Pick<Beat, 'status' | 'latencyMs' | 'timestamp'>[];
  /** number of slots to render (empty slots are shown grey on the left) */
  slots?: number;
  className?: string;
}

/** Uptime-Kuma style heartbeat bar — newest beat on the right */
export default function BeatBar({ beats, slots = 30, className = '' }: BeatBarProps) {
  const shown = beats.slice(-slots);
  const empty = Math.max(0, slots - shown.length);
  return (
    <div className={`beat-bar ${className}`} aria-label="Heartbeat-Verlauf">
      {Array.from({ length: empty }).map((_, i) => <span key={`e${i}`} className="beat" />)}
      {shown.map((b, i) => (
        <span
          key={`${b.timestamp}-${i}`}
          className={`beat beat-${b.status}`}
          title={`${new Date(b.timestamp).toLocaleString()} · ${b.status}${b.latencyMs !== null ? ` · ${b.latencyMs} ms` : ''}`}
        />
      ))}
    </div>
  );
}

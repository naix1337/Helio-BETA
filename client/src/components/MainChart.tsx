import { useEffect, useRef } from 'react';
import { drawMainChart } from '../utils/chart';
import { useStore } from '../store/useStore';

const RANGE_LABELS: Record<string, string> = {
  '1h': 'letzte Stunde',
  '6h': 'letzte 6 h',
  '24h': 'letzte 24 h',
  '7d': 'letzte 7 Tage',
};

export default function MainChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const series = useStore((s) => s.mainSeries);
  const timeRange = useStore((s) => s.timeRange);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => drawMainChart(canvas, series);
    draw();
    const onResize = () => setTimeout(draw, 50);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [series]);

  return (
    <div className="border border-[var(--color-border)] rounded-[var(--radius-lg)] bg-[var(--color-surface)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-[18px] py-[16px] border-b border-[var(--color-border)]">
        <div>
          <h3 className="text-[0.96rem] font-semibold m-0">Auslastung</h3>
          <div className="font-mono text-[0.76rem] text-[var(--color-text-dim)] mt-[2px]">
            CPU &amp; Netzwerk · {RANGE_LABELS[timeRange] || 'letzte 24 h'}
          </div>
        </div>
        <div className="flex gap-4">
          <span className="inline-flex items-center gap-[7px] text-[0.78rem] text-[var(--color-text-muted)] font-mono">
            <i className="w-[10px] h-[10px] rounded-[3px] bg-[var(--color-primary)]" />
            CPU %
          </span>
          <span className="inline-flex items-center gap-[7px] text-[0.78rem] text-[var(--color-text-muted)] font-mono">
            <i className="w-[10px] h-[10px] rounded-[3px] bg-[var(--color-violet)]" />
            Netz MB/s
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="p-[18px]">
        <div className="relative w-full h-[240px]">
          <canvas ref={canvasRef} className="w-full h-full block" />
        </div>

        {/* Footer stats */}
        <div
          className="grid grid-cols-3 max-[600px]:grid-cols-1 gap-px mt-4 border border-[var(--color-border)] rounded-[var(--radius-box)] overflow-hidden"
          style={{ background: 'var(--color-border)' }}
        >
          {[
            { label: 'CPU jetzt', value: '37,4 %' },
            { label: 'Netz Peak', value: '128 MB/s' },
            { label: 'Antwortzeit', value: '24 ms', ok: true },
          ].map((s) => (
            <div key={s.label} className="bg-[var(--color-surface)] px-[14px] py-[12px]">
              <div className="text-[0.72rem] text-[var(--color-text-dim)]">{s.label}</div>
              <div className={`font-mono text-[1.05rem] font-semibold mt-[3px] ${s.ok ? 'text-[var(--color-ok)]' : ''}`}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

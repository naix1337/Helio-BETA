import { useEffect, useRef } from 'react';
import { drawSparklineFromData } from '../utils/chart';
import type { ReactNode } from 'react';

interface KpiCardProps {
  icon: ReactNode;
  label: string;
  trend: { value: string; type: 'up' | 'down' | 'flat' };
  value: ReactNode;
  sparkColor?: string;
  sparkData?: number[];
  isViolet?: boolean;
}

export default function KpiCard({ icon, label, trend, value, sparkColor = '--color-primary', sparkData, isViolet }: KpiCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasSpark = !!sparkData && sparkData.length >= 2;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sparkData) return;
    const draw = () => drawSparklineFromData(canvas, sparkData, sparkColor);
    draw();
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [sparkColor, sparkData]);

  const trendClass =
    trend.type === 'up' ? 'text-[var(--color-ok)] bg-[var(--color-ok-soft)]' :
    trend.type === 'down' ? 'text-[var(--color-down)] bg-[var(--color-down-soft)]' :
    'text-[var(--color-text-dim)] bg-[var(--color-surface-2)]';

  return (
    <div className="card p-[18px] overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.82rem] text-[var(--color-text-muted)] flex items-center gap-2 min-w-0">
          <span className={`w-[28px] h-[28px] rounded-[8px] grid place-items-center flex-none ${isViolet ? 'bg-[var(--color-violet-soft)] text-[var(--color-violet)]' : 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'}`}>
            {icon}
          </span>
          <span className="truncate">{label}</span>
        </span>
        <span className={`font-mono text-[0.72rem] font-medium px-[7px] py-[2px] rounded-[6px] whitespace-nowrap ${trendClass}`}>
          {trend.value}
        </span>
      </div>
      <div className="font-mono text-[2rem] font-[650] tracking-tight mt-[14px] leading-none" style={{ color: 'var(--color-text)' }}>
        {value}
      </div>
      {hasSpark ? <canvas ref={canvasRef} className="mt-[12px] h-[40px] w-full block" /> : <div className="mt-[12px] h-[40px]" />}
    </div>
  );
}

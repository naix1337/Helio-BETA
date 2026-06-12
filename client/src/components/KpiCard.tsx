import { useEffect, useRef } from 'react';
import { drawSparkline } from '../utils/chart';
import type { ReactNode } from 'react';

interface KpiCardProps {
  icon: ReactNode;
  label: string;
  trend: { value: string; type: 'up' | 'down' | 'flat' };
  value: ReactNode;
  sparkColor: string;
  sparkSeed: number;
  sparkClamp?: { min: number; max: number };
  isViolet?: boolean;
}

export default function KpiCard({ icon, label, trend, value, sparkColor, sparkSeed, sparkClamp, isViolet }: KpiCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => drawSparkline(canvas, sparkColor, sparkSeed, undefined, sparkClamp);
    draw();
    const onResize = () => setTimeout(draw, 50);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [sparkColor, sparkSeed, sparkClamp]);

  const trendClass =
    trend.type === 'up' ? 'text-[var(--color-ok)] bg-[var(--color-ok-soft)]' :
    trend.type === 'down' ? 'text-[var(--color-down)] bg-[var(--color-down-soft)]' :
    'text-[var(--color-text-dim)] bg-[var(--color-surface-2)]';

  return (
    <div className="border border-[var(--color-border)] rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-[18px] overflow-hidden">
      <div className="flex items-center justify-between">
        <span className="text-[0.82rem] text-[var(--color-text-muted)] flex items-center gap-2">
          <span className={`w-[28px] h-[28px] rounded-[8px] grid place-items-center ${isViolet ? 'bg-[var(--color-violet-soft)] text-[var(--color-violet)]' : 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'}`}>
            {icon}
          </span>
          {label}
        </span>
        <span className={`font-mono text-[0.72rem] font-medium px-[7px] py-[2px] rounded-[6px] ${trendClass}`}>
          {trend.value}
        </span>
      </div>
      <div className="font-mono text-[2rem] font-[650] tracking-tight mt-[14px] leading-none">
        {value}
      </div>
      <canvas ref={canvasRef} className="mt-[12px] h-[40px] w-full block" />
    </div>
  );
}

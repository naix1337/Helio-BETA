// helio-app/frontend/src/components/CpuSparkline.tsx
import React from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import type { SystemSnapshot } from '../types.ts';

interface Props {
  history: SystemSnapshot[];
}

export function CpuSparkline({ history }: Props) {
  const data = history.map((s) => ({ v: s.cpu }));

  return (
    <div style={{ marginTop: '10px', height: '48px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.35} />
              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke="var(--primary)"
            strokeWidth={2}
            fill="url(#cpuGrad)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

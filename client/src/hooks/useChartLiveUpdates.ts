import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';

/**
 * Pushes a random walk tick into the chart series on an interval.
 * Also jitters visible latency readouts.
 */
export function useChartLiveUpdates() {
  const pushTick = useStore((s) => s.pushTick);
  const cpuRef = useRef(38);
  const netRef = useRef(60);

  useEffect(() => {
    const tick = () => {
      const c = cpuRef.current + (Math.random() - 0.5) * 9;
      cpuRef.current = Math.max(14, Math.min(92, c));
      const n = netRef.current + (Math.random() - 0.5) * 20;
      netRef.current = Math.max(20, Math.min(150, n));
      pushTick(cpuRef.current, netRef.current);
    };
    const interval = setInterval(tick, 2600);
    return () => clearInterval(interval);
  }, [pushTick]);
}

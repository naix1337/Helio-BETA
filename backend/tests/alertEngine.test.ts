// helio-app/backend/tests/alertEngine.test.ts
import { describe, it, expect } from 'vitest';
import { extractValue, evaluateCondition } from '../src/alertEngine.js';
import type { SystemSnapshot } from '../src/types.js';

const snap: SystemSnapshot = {
  ts: 1000, cpu: 85, mem: { used: 8e9, total: 16e9, percent: 50 },
  disk: [{ mount: '/', used: 80e9, size: 100e9, percent: 80 }],
  net: [{ iface: 'eth0', rx_sec: 5_000_000, tx_sec: 1_000_000 }],
  uptime: 3600, loadAvg: [1, 0.8, 0.6],
};

describe('extractValue', () => {
  it('extracts cpu', () => expect(extractValue(snap, 'cpu')).toBe(85));
  it('extracts memory percent', () => expect(extractValue(snap, 'memory')).toBe(50));
  it('extracts disk percent', () => expect(extractValue(snap, 'disk')).toBe(80));
  it('extracts net_rx in MB/s', () => expect(extractValue(snap, 'net_rx')).toBeCloseTo(5, 0));
  it('extracts net_tx in MB/s', () => expect(extractValue(snap, 'net_tx')).toBeCloseTo(1, 0));
});

describe('evaluateCondition', () => {
  it('> operator: true when value exceeds threshold', () =>
    expect(evaluateCondition(90, '>', 85)).toBe(true));
  it('> operator: false when value below threshold', () =>
    expect(evaluateCondition(80, '>', 85)).toBe(false));
  it('>= operator: true when equal', () =>
    expect(evaluateCondition(85, '>=', 85)).toBe(true));
  it('< operator', () =>
    expect(evaluateCondition(10, '<', 20)).toBe(true));
});

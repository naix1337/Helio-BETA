// helio-app/backend/tests/pingCollector.test.ts
import { describe, it, expect } from 'vitest';
import { computePingStatus } from '../src/collectors/pingCollector.js';

describe('computePingStatus', () => {
  it('returns "down" when no results', () => {
    expect(computePingStatus([])).toBe('down');
  });

  it('returns "down" when most recent result is a failure', () => {
    expect(computePingStatus([{ success: false }])).toBe('down');
    expect(
      computePingStatus([
        { success: false },
        { success: true },
        { success: true },
        { success: true },
        { success: true },
      ]),
    ).toBe('down');
  });

  it('returns "up" when last 3 are all successful', () => {
    expect(
      computePingStatus([
        { success: true },
        { success: true },
        { success: true },
      ]),
    ).toBe('up');
  });

  it('returns "up" when only 1 result and it is successful', () => {
    expect(computePingStatus([{ success: true }])).toBe('up');
  });

  it('returns "up" when last 3 are all successful (with more history)', () => {
    expect(
      computePingStatus([
        { success: true },
        { success: true },
        { success: true },
        { success: false },
        { success: false },
      ]),
    ).toBe('up');
  });

  it('returns "degraded" when last result is success but fewer than 3 of last 5 are successful', () => {
    // last1 is success (not down), last3 has a failure (not "up"), last5 has only 2 successes
    expect(
      computePingStatus([
        { success: true },
        { success: false },
        { success: false },
        { success: false },
        { success: false },
      ]),
    ).toBe('degraded');
  });

  it('returns "degraded" for mixed results where success count is exactly 2 of 5', () => {
    expect(
      computePingStatus([
        { success: true },
        { success: false },
        { success: true },
        { success: false },
        { success: false },
      ]),
    ).toBe('degraded');
  });

  it('returns "up" when last result is success and 3 of last 5 are successful (not all 3 in a row)', () => {
    // last1: success, last3 = [T, F, T] => not all success, so check last5 count = 3 >= 3 => "up"
    expect(
      computePingStatus([
        { success: true },
        { success: false },
        { success: true },
        { success: true },
        { success: false },
      ]),
    ).toBe('up');
  });

  it('handles only 2 results both successful', () => {
    expect(
      computePingStatus([{ success: true }, { success: true }]),
    ).toBe('up');
  });

  it('handles only 2 results with last success but one failure', () => {
    // last1 = success, last3 = [T, F], not every true => check last5 = [T, F] => 1 success < 3 => degraded
    expect(
      computePingStatus([{ success: true }, { success: false }]),
    ).toBe('degraded');
  });
});

import type { MonitorType } from '@pulse/shared';
import type { IChecker } from './IChecker.js';

const registry = new Map<MonitorType, IChecker>();

export function registerChecker(checker: IChecker): void {
  registry.set(checker.type, checker);
}

export function getChecker(type: MonitorType): IChecker | null {
  return registry.get(type) ?? null;
}

export function getAllTypes(): MonitorType[] {
  return Array.from(registry.keys());
}

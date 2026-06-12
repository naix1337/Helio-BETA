import type { MonitorType, MonitorStatus } from '@pulse/shared';

export interface CheckResult {
  status: MonitorStatus;
  latencyMs: number | null;
  message: string | null;
  statusCode: number | null;
}

export interface IChecker {
  readonly type: MonitorType;
  check(config: unknown): Promise<CheckResult>;
}

import type { NotificationPayload } from '@pulse/shared';

export interface INotificationProvider {
  readonly name: string;
  send(config: Record<string, unknown>, payload: NotificationPayload): Promise<boolean>;
  test(config: Record<string, unknown>): Promise<{ success: boolean; message: string }>;
}

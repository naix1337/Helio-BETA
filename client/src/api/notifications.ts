import { apiCall } from './client';

export type ProviderType = 'webhook' | 'telegram' | 'discord' | 'email' | 'ntfy';

export interface Notification {
  id: string;
  name: string;
  provider: ProviderType;
  config: { provider?: string; data?: Record<string, unknown> } & Record<string, unknown>;
  monitorIds: string[];
  createdAt: string;
}

export interface NotificationInput {
  name: string;
  provider: ProviderType;
  config: Record<string, unknown>;
  monitorIds: string[];
}

export function notificationConfig(n: Pick<Notification, 'config'>): Record<string, unknown> {
  return (n.config?.data ?? n.config ?? {}) as Record<string, unknown>;
}

export const listNotifications = () => apiCall<Notification[]>('GET', '/notifications');
export const createNotification = (data: NotificationInput) => apiCall<Notification>('POST', '/notifications', data);
export const updateNotification = (id: string, data: Partial<NotificationInput>) => apiCall<Notification>('PATCH', `/notifications/${id}`, data);
export const deleteNotification = (id: string) => apiCall<null>('DELETE', `/notifications/${id}`);
export const testNotification = (id: string) => apiCall<{ success: boolean; message: string }>('POST', `/notifications/${id}/test`);
export const testNotificationConfig = (provider: ProviderType, config: Record<string, unknown>) =>
  apiCall<{ success: boolean; message: string }>('POST', '/notifications/test', { provider, config });

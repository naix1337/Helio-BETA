import { apiRequest } from './client';

export interface Notification {
  id: string;
  name: string;
  provider: 'webhook' | 'telegram' | 'discord' | 'email' | 'ntfy';
  config: Record<string, unknown>;
  monitorIds: string[];
  createdAt: string;
}

export async function listNotifications(): Promise<Notification[]> {
  const res = await apiRequest<Notification[]>('GET', '/notifications');
  return res.data ?? [];
}

export async function createNotification(data: Partial<Notification>): Promise<Notification | null> {
  const res = await apiRequest<Notification>('POST', '/notifications', data);
  return res.data ?? null;
}

export async function updateNotification(id: string, data: Partial<Notification>): Promise<Notification | null> {
  const res = await apiRequest<Notification>('PATCH', `/notifications/${id}`, data);
  return res.data ?? null;
}

export async function deleteNotification(id: string): Promise<boolean> {
  const res = await apiRequest('DELETE', `/notifications/${id}`);
  return res.success;
}

export async function testNotification(id: string): Promise<boolean> {
  const res = await apiRequest<{ success: boolean }>('POST', `/notifications/${id}/test`);
  return res.data?.success ?? false;
}

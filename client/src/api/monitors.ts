import { apiRequest } from './client';

export interface Monitor {
  id: string;
  name: string;
  type: 'http' | 'tcp' | 'ping' | 'dns' | 'ssl' | 'push';
  config: Record<string, unknown>;
  intervalSeconds: number;
  retries: number;
  status: 'UP' | 'DOWN' | 'PENDING' | 'PAUSED' | 'DEGRADED';
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Heartbeat {
  id: string;
  monitorId: string;
  timestamp: string;
  status: string;
  latencyMs: number | null;
  message: string | null;
  statusCode: number | null;
}

export interface UptimeSummary {
  last24h: number;
  last7d: number;
  last30d: number;
  last365d: number;
}

export async function listMonitors(status?: string, type?: string): Promise<Monitor[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (type) params.set('type', type);
  const qs = params.toString();
  const res = await apiRequest<Monitor[]>('GET', `/monitors${qs ? '?' + qs : ''}`);
  return res.data ?? [];
}

export async function getMonitor(id: string): Promise<Monitor | null> {
  const res = await apiRequest<Monitor>('GET', `/monitors/${id}`);
  return res.data ?? null;
}

export async function createMonitor(data: Partial<Monitor>): Promise<Monitor | null> {
  const res = await apiRequest<Monitor>('POST', '/monitors', data);
  return res.data ?? null;
}

export async function updateMonitor(id: string, data: Partial<Monitor>): Promise<Monitor | null> {
  const res = await apiRequest<Monitor>('PATCH', `/monitors/${id}`, data);
  return res.data ?? null;
}

export async function deleteMonitor(id: string): Promise<boolean> {
  const res = await apiRequest('DELETE', `/monitors/${id}`);
  return res.success;
}

export async function pauseMonitor(id: string): Promise<Monitor | null> {
  const res = await apiRequest<Monitor>('POST', `/monitors/${id}/pause`);
  return res.data ?? null;
}

export async function resumeMonitor(id: string): Promise<Monitor | null> {
  const res = await apiRequest<Monitor>('POST', `/monitors/${id}/resume`);
  return res.data ?? null;
}

export async function getHeartbeats(monitorId: string, range?: string): Promise<Heartbeat[]> {
  const params = range ? `?range=${range}` : '';
  const res = await apiRequest<Heartbeat[]>('GET', `/monitors/${monitorId}/heartbeats${params}`);
  return res.data ?? [];
}

export async function getUptime(monitorId: string): Promise<UptimeSummary | null> {
  const res = await apiRequest<{ summary: UptimeSummary }>('GET', `/monitors/${monitorId}/uptime`);
  return res.data?.summary ?? null;
}

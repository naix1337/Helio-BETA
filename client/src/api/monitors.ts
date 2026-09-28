import { apiCall, apiRequest } from './client';

export type MonitorType = 'http' | 'tcp' | 'ping' | 'dns' | 'ssl' | 'push';
export type MonitorStatus = 'UP' | 'DOWN' | 'PENDING' | 'PAUSED' | 'DEGRADED';

export interface Monitor {
  id: string;
  name: string;
  type: MonitorType;
  config: { type?: string; data?: Record<string, unknown> } & Record<string, unknown>;
  intervalSeconds: number;
  retries: number;
  status: MonitorStatus;
  tags: string[];
  notificationIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Heartbeat {
  id: string;
  monitorId: string;
  timestamp: string;
  status: MonitorStatus;
  latencyMs: number | null;
  message: string | null;
  statusCode: number | null;
}

export interface Beat {
  status: MonitorStatus;
  latencyMs: number | null;
  timestamp: string;
  message: string | null;
}

export interface UptimeSummary {
  last24h: number;
  last7d: number;
  last30d: number;
  last365d: number;
}

export interface MonitorInput {
  name: string;
  type: MonitorType;
  config: Record<string, unknown>;
  intervalSeconds: number;
  retries: number;
  tags: string[];
  notificationIds: string[];
}

export function monitorConfig(m: Pick<Monitor, 'config'>): Record<string, unknown> {
  return (m.config?.data ?? m.config ?? {}) as Record<string, unknown>;
}

export async function listMonitors(): Promise<Monitor[]> {
  return apiCall<Monitor[]>('GET', '/monitors');
}

export async function getMonitor(id: string): Promise<Monitor> {
  return apiCall<Monitor>('GET', `/monitors/${id}`);
}

export async function createMonitor(data: MonitorInput): Promise<Monitor> {
  return apiCall<Monitor>('POST', '/monitors', data);
}

export async function updateMonitor(id: string, data: Partial<MonitorInput>): Promise<Monitor> {
  const { type: _type, ...rest } = data;
  void _type;
  return apiCall<Monitor>('PATCH', `/monitors/${id}`, rest);
}

export async function deleteMonitor(id: string): Promise<void> {
  await apiCall('DELETE', `/monitors/${id}`);
}

export async function pauseMonitor(id: string): Promise<Monitor> {
  return apiCall<Monitor>('POST', `/monitors/${id}/pause`);
}

export async function resumeMonitor(id: string): Promise<Monitor> {
  return apiCall<Monitor>('POST', `/monitors/${id}/resume`);
}

export async function getHeartbeats(monitorId: string, range?: string): Promise<Heartbeat[]> {
  const params = range ? `?range=${range}` : '';
  const res = await apiRequest<Heartbeat[]>('GET', `/monitors/${monitorId}/heartbeats${params}`);
  return res.data ?? [];
}

export async function getBeats(count = 40): Promise<Record<string, Beat[]>> {
  const res = await apiRequest<Record<string, Beat[]>>('GET', `/monitors/beats?count=${count}`);
  return res.data ?? {};
}

export async function getUptime(monitorId: string): Promise<UptimeSummary | null> {
  const res = await apiRequest<{ summary: UptimeSummary }>('GET', `/monitors/${monitorId}/uptime`);
  return res.data?.summary ?? null;
}

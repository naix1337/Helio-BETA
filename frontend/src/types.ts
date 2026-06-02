// helio-app/frontend/src/types.ts
// Keep in sync with backend/src/types.ts

export interface DiskInfo {
  mount: string;
  used: number;
  size: number;
  percent: number;
}

export interface NetInfo {
  iface: string;
  rx_sec: number;
  tx_sec: number;
}

export interface SystemSnapshot {
  ts: number;
  cpu: number;
  cpuTemp?: number;
  mem: {
    used: number;
    total: number;
    percent: number;
  };
  disk: DiskInfo[];
  net: NetInfo[];
  uptime: number;
  loadAvg: [number, number, number];
}

export interface MetricRow {
  id: number;
  ts: number;
  cpu: number;
  mem_used: number;
  mem_total: number;
  disk_json: string;
  net_json: string;
}

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: 'running' | 'stopped' | 'restarting' | 'dead' | 'unknown';
  cpu_percent: number;
  mem_used: number;
  mem_limit: number;
  mem_percent: number;
  created: number;
  ports: string[];
}

export interface Node {
  id: string;
  name: string;
  addr: string;
  token: string;
  last_seen: number | null;
  status: string;
}

export type AlertMetric = 'cpu' | 'memory' | 'disk' | 'net_rx' | 'net_tx';
export type AlertOperator = '>' | '<' | '>=';
export type AlertChannel = 'webhook' | 'email' | 'slack' | 'discord';

export interface Alert {
  id: number;
  name: string;
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
  channel: AlertChannel;
  target: string;
  cooldown: number;
  enabled: number;
  created_at: number;
}

export interface AlertEvent {
  id: number;
  alert_id: number;
  triggered_at: number;
  resolved_at: number | null;
  peak_value: number;
}

export interface WsMessage {
  type: 'metrics' | 'alert' | 'ping' | 'pong';
  data?: SystemSnapshot | AlertFireEvent;
}

export interface AlertFireEvent {
  alertId: number;
  name: string;
  metric: AlertMetric;
  value: number;
  triggeredAt: number;
}

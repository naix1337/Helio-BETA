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
  type: 'metrics' | 'alert' | 'ping' | 'pong' | 'agent_update' | 'agent_offline' | 'ping_update';
  data?: SystemSnapshot | AlertFireEvent;
}

export interface AlertFireEvent {
  alertId: number;
  name: string;
  metric: AlertMetric;
  value: number;
  triggeredAt: number;
}

export interface AppSettings {
  app_title: string;
  status_title: string;
  status_subtitle: string;
  status_show_uptime: string;
  dashboard_show_cpu: string;
  dashboard_show_ram: string;
  dashboard_show_nodes: string;
}

export type PingType = 'tcp' | 'http' | 'https';

export interface PingRequest {
  type: PingType;
  host: string;
  port: number;
  path?: string;
}

export interface PingResult {
  reachable: boolean;
  latency_ms: number;
  status?: number;
  error?: string;
}

export type UserRole = 'admin' | 'editor' | 'viewer';

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  created_at: number;
  last_login: number | null;
}

export interface AuthToken {
  userId: number;
  email: string;
  role: UserRole;
}

// ── Agent types ──────────────────────────────────────────────────────────────

export interface AgentOsInfo {
  platform: string;
  distro: string;
  release: string;
  hostname: string;
  arch: string;
}

export interface AgentLatestMetrics {
  cpuUsage: number | null;
  memUsedPercent: number | null;
  uptime: number | null;
}

export interface Agent {
  id: string;
  name: string;
  tags: string[];
  tokenId: string | null;
  version: string | null;
  status: 'online' | 'offline';
  lastSeen: number;
  firstSeen: number;
  osInfo: AgentOsInfo | null;
  latestMetrics?: AgentLatestMetrics | null;
}

export interface AgentMetricSnapshot {
  agent_id: string;
  ts: number;
  cpu_usage: number | null;
  mem_used: number | null;
  mem_total: number | null;
  disk_json: string | null;
  net_json: string | null;
  docker_json: string | null;
}

export interface AgentToken {
  id: string;
  label: string | null;
  created_at: number;
  last_used: number | null;
}

// ── Ping Monitor types ────────────────────────────────────────────────────────

export interface PingTarget {
  id: number;
  name: string;
  host: string;
  type: 'icmp' | 'http' | 'tcp';
  port: number | null;
  interval_ms: number;
  timeout_ms: number;
  enabled: number;
  created_at: number;
  tags: string[];
  status?: 'up' | 'degraded' | 'down';
  lastPing?: PingProbeResult | null;
  stats24h?: PingStats | null;
}

export interface PingProbeResult {
  id: number;
  target_id: number;
  ts: number;
  success: number;  // SQLite integer (0 or 1)
  latency_ms: number | null;
  status_code: number | null;
  error: string | null;
  icmp_fallback: number;  // SQLite integer (0 or 1)
}

export interface PingStats {
  total: number;
  successes: number;
  failures: number;
  uptimePercent: number;
  avgLatency: number | null;
  minLatency: number | null;
  maxLatency: number | null;
}

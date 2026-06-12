/* ============================================================
   Pulse — Shared Types
   ============================================================ */

/* ---------- Monitor ---------- */

export type MonitorType = 'http' | 'tcp' | 'ping' | 'dns' | 'ssl' | 'push';
export type MonitorStatus = 'UP' | 'DOWN' | 'PENDING' | 'PAUSED' | 'DEGRADED';

/** HTTP-specific monitor configuration */
export interface HttpConfig {
  url: string;
  method?: 'GET' | 'POST' | 'HEAD' | 'PUT' | 'PATCH' | 'DELETE';
  statusCodeMin?: number;
  statusCodeMax?: number;
  keyword?: string;
  jsonPath?: string;
  followRedirects?: boolean;
  timeoutMs?: number;
  headers?: Record<string, string>;
  basicAuthUser?: string;
  basicAuthPass?: string;
  ignoreTls?: boolean;
  body?: string;
}

export interface TcpConfig {
  host: string;
  port: number;
  timeoutMs?: number;
}

export interface PingConfig {
  host: string;
  count?: number;
}

export interface DnsConfig {
  host: string;
  recordType?: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT';
  expectedValue?: string;
  resolver?: string;
}

export interface SslConfig {
  host: string;
  port?: number;
  warningDays?: number;
}

export interface PushConfig {
  token?: string;
  graceSeconds?: number;
}

export type MonitorConfig =
  | { type: 'http'; data: HttpConfig }
  | { type: 'tcp'; data: TcpConfig }
  | { type: 'ping'; data: PingConfig }
  | { type: 'dns'; data: DnsConfig }
  | { type: 'ssl'; data: SslConfig }
  | { type: 'push'; data: PushConfig };

export interface Monitor {
  id: string;
  name: string;
  type: MonitorType;
  config: MonitorConfig;
  intervalSeconds: number;
  retries: number;
  status: MonitorStatus;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type CreateMonitorInput = Omit<Monitor, 'id' | 'status' | 'createdAt' | 'updatedAt'>;
export type UpdateMonitorInput = Partial<Omit<Monitor, 'id' | 'createdAt'>>;

/* ---------- Heartbeat ---------- */

export interface Heartbeat {
  id: string;
  monitorId: string;
  timestamp: string;
  status: MonitorStatus;
  latencyMs: number | null;
  message: string | null;
  statusCode: number | null;
}

/* ---------- Notification ---------- */

export type NotificationProviderType = 'webhook' | 'telegram' | 'discord' | 'email' | 'ntfy';

export interface WebhookConfig {
  url: string;
  headers?: Record<string, string>;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export interface DiscordConfig {
  webhookUrl: string;
}

export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fromEmail: string;
  toEmail: string;
}

export interface NtfyConfig {
  topic: string;
  serverUrl?: string;
}

export type NotificationConfig =
  | { provider: 'webhook'; data: WebhookConfig }
  | { provider: 'telegram'; data: TelegramConfig }
  | { provider: 'discord'; data: DiscordConfig }
  | { provider: 'email'; data: EmailConfig }
  | { provider: 'ntfy'; data: NtfyConfig };

export interface Notification {
  id: string;
  name: string;
  provider: NotificationProviderType;
  config: NotificationConfig;
  monitorIds: string[];
  createdAt: string;
}

export type CreateNotificationInput = Omit<Notification, 'id' | 'createdAt'>;

export interface NotificationPayload {
  monitorName: string;
  monitorId: string;
  status: MonitorStatus;
  latencyMs?: number;
  errorMessage?: string;
  timestamp: string;
  previousStatus?: MonitorStatus;
  previousStatusDurationMs?: number;
}

/* ---------- User ---------- */

export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  totpSecret: string | null;
  totpEnabled: boolean;
  role: UserRole;
  createdAt: string;
}

export interface UserPublic {
  id: string;
  email: string;
  totpEnabled: boolean;
  role: UserRole;
  createdAt: string;
}

/* ---------- API Key ---------- */

export type ApiKeyScope = 'read' | 'write';

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  scopes: ApiKeyScope[];
  lastUsedAt: string | null;
  createdAt: string;
}

export interface ApiKeyWithSecret extends ApiKey {
  plainKey: string;
}

/* ---------- Status Page ---------- */

export interface StatusPage {
  id: string;
  title: string;
  slug: string;
  logoUrl: string | null;
  monitorIds: string[];
  incidentBanner: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ---------- Maintenance Window ---------- */

export interface MaintenanceWindow {
  id: string;
  monitorIds: string[];
  startsAt: string;
  endsAt: string;
  description: string;
  createdAt: string;
}

/* ---------- Uptime Aggregation ---------- */

export type AggregationPeriod = 'hourly' | 'daily';

export interface UptimeAggregation {
  id: string;
  monitorId: string;
  period: AggregationPeriod;
  timestamp: string;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  uptimePercent: number;
  totalChecks: number;
  failedChecks: number;
}

export interface UptimeSummary {
  last24h: number;
  last7d: number;
  last30d: number;
  last365d: number;
}

/* ---------- Auth ---------- */

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserPublic;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface Setup2faResponse {
  secret: string;
  qrCodeUrl: string;
}

/* ---------- API ---------- */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/* ---------- WebSocket Events ---------- */

export type WsEventType =
  | 'heartbeat:new'
  | 'monitor:status-change'
  | 'monitor:created'
  | 'monitor:updated'
  | 'monitor:deleted';

export interface WsEvent<T = unknown> {
  type: WsEventType;
  payload: T;
  timestamp: string;
}

export interface StatusChangePayload {
  monitorId: string;
  monitorName: string;
  previousStatus: MonitorStatus;
  newStatus: MonitorStatus;
  latencyMs?: number;
  message?: string;
}

export interface HeartbeatPayload {
  monitorId: string;
  heartbeat: Heartbeat;
}

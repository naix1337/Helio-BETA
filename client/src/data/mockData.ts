export interface NodeData {
  name: string;
  region: string;
  cpu: number;
  ram: number;
  disk: number;
  lat: number;
  st: 'ok' | 'warn' | 'down';
}

export interface ContainerData {
  name: string;
  img: string;
  cpu: number;
  mem: number;
  st: 'ok' | 'warn' | 'down';
}

export interface AlertData {
  type: 'down' | 'warn' | 'ok' | 'info';
  icon: string;
  title: string;
  desc: string;
  time: string;
}

export const REGIONS = ['fra-1', 'ams-1', 'sfo-1', 'sgp-1'] as const;

export const NODES: NodeData[] = [
  { name: 'web-01', region: 'ams-1', cpu: 87, ram: 64, disk: 42, lat: 24, st: 'warn' },
  { name: 'web-02', region: 'ams-1', cpu: 41, ram: 52, disk: 38, lat: 22, st: 'ok' },
  { name: 'db-primary', region: 'fra-1', cpu: 56, ram: 71, disk: 78, lat: 11, st: 'ok' },
  { name: 'db-replica', region: 'fra-1', cpu: 34, ram: 66, disk: 74, lat: 13, st: 'ok' },
  { name: 'cache-02', region: 'fra-1', cpu: 0, ram: 0, disk: 12, lat: 0, st: 'down' },
  { name: 'worker-eu-1', region: 'ams-1', cpu: 62, ram: 48, disk: 30, lat: 32, st: 'ok' },
  { name: 'worker-eu-2', region: 'fra-1', cpu: 58, ram: 45, disk: 28, lat: 29, st: 'ok' },
  { name: 'cdn-edge-1', region: 'sfo-1', cpu: 23, ram: 31, disk: 19, lat: 48, st: 'ok' },
  { name: 'cdn-edge-3', region: 'sfo-1', cpu: 27, ram: 34, disk: 22, lat: 51, st: 'ok' },
  { name: 'queue-01', region: 'sgp-1', cpu: 44, ram: 39, disk: 25, lat: 86, st: 'ok' },
  { name: 'metrics-01', region: 'fra-1', cpu: 51, ram: 58, disk: 61, lat: 14, st: 'ok' },
  { name: 'gateway-01', region: 'ams-1', cpu: 38, ram: 42, disk: 33, lat: 26, st: 'ok' },
];

export const CONTAINERS: ContainerData[] = [
  { name: 'helio-api', img: 'helio/api:2.8.1', cpu: 12, mem: 184, st: 'ok' },
  { name: 'postgres', img: 'postgres:16-alpine', cpu: 22, mem: 512, st: 'ok' },
  { name: 'redis', img: 'redis:7.2', cpu: 4, mem: 64, st: 'ok' },
  { name: 'nginx', img: 'nginx:1.27', cpu: 3, mem: 28, st: 'ok' },
  { name: 'grafana-import', img: 'helio/import:latest', cpu: 0, mem: 0, st: 'down' },
  { name: 'worker-default', img: 'helio/worker:2.8.1', cpu: 18, mem: 220, st: 'ok' },
  { name: 'worker-cron', img: 'helio/worker:2.8.1', cpu: 7, mem: 142, st: 'ok' },
  { name: 'minio', img: 'minio/minio:latest', cpu: 9, mem: 196, st: 'ok' },
  { name: 'prometheus', img: 'prom/prometheus:2.54', cpu: 15, mem: 308, st: 'warn' },
];

export const ALERTS_FEED: AlertData[] = [
  { type: 'down', icon: 'AlertOctagon', title: 'cache-02 antwortet nicht', desc: 'HTTP 503 · 3× fehlgeschlagen', time: '2 min' },
  { type: 'warn', icon: 'AlertTriangle', title: 'web-01 CPU > 85 %', desc: 'Schwellwert seit 4 min', time: '6 min' },
  { type: 'warn', icon: 'AlertTriangle', title: 'db-primary Disk 78 %', desc: 'Warnschwelle erreicht', time: '22 min' },
  { type: 'ok', icon: 'Check', title: 'worker-eu-1 wiederhergestellt', desc: 'Latenz wieder normal', time: '38 min' },
  { type: 'info', icon: 'GitCommitHorizontal', title: 'Deploy abgeschlossen', desc: 'api v2.8.1 · 4 Nodes', time: '1 Std' },
];

export const ALERTS_FULL: AlertData[] = [
  { type: 'down', icon: 'AlertOctagon', title: 'cache-02 antwortet nicht', desc: 'HTTP 503 · 3 Versuche fehlgeschlagen · fra-1', time: 'vor 2 min' },
  { type: 'warn', icon: 'AlertTriangle', title: 'web-01 CPU über Schwellwert', desc: 'CPU > 85 % seit 4 min · ams-1', time: 'vor 6 min' },
  { type: 'warn', icon: 'AlertTriangle', title: 'db-primary Disk-Auslastung 78 %', desc: 'Warnschwelle erreicht · fra-1', time: 'vor 22 min' },
  { type: 'ok', icon: 'Check', title: 'worker-eu-1 wiederhergestellt', desc: 'Latenz wieder im Normalbereich · ams-1', time: 'vor 38 min' },
  { type: 'ok', icon: 'Check', title: 'cdn-edge-3 wieder erreichbar', desc: 'Health-Check erfolgreich · sfo-1', time: 'vor 2 Std' },
];

export type ViewName = 'overview' | 'nodes' | 'containers' | 'alerts' | 'status' | 'metrics' | 'team' | 'settings';

export interface ViewConfig {
  label: string;
  title: string;
  subtitle: string;
}

export const VIEW_CONFIG: Record<ViewName, ViewConfig> = {
  overview: { label: 'Übersicht', title: 'Übersicht', subtitle: 'prod · alle Regionen' },
  nodes: { label: 'Nodes', title: 'Alle Nodes', subtitle: '12 Nodes · 4 Regionen' },
  containers: { label: 'Container', title: 'Container', subtitle: '14 laufend · Auto-Discovery aktiv' },
  alerts: { label: 'Alerts', title: 'Alerts', subtitle: '3 aktiv · 2 heute gelöst' },
  status: { label: 'Status-Page', title: 'Status-Page', subtitle: 'öffentlich · status.helio.sh' },
  metrics: { label: 'Metriken', title: 'Metriken', subtitle: '2,4 M Datenpunkte / min' },
  team: { label: 'Team', title: 'Team', subtitle: '4 Mitglieder' },
  settings: { label: 'Einstellungen', title: 'Einstellungen', subtitle: 'Instanz-Konfiguration' },
};

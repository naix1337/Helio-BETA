export interface AgentMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    cores: number;
    model: string;
    speed: number;
    temp?: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usedPercent: number;
  };
  disk: Array<{
    fs: string;
    mount: string;
    total: number;
    used: number;
    usedPercent: number;
  }>;
  network: Array<{
    iface: string;
    rxBytesPerSec: number;
    txBytesPerSec: number;
  }>;
  uptime: number;
  os: {
    platform: string;
    distro: string;
    release: string;
    hostname: string;
    arch: string;
  };
}

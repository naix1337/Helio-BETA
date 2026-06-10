import si from 'systeminformation';
import type { AgentMetrics } from './types';

// Cached OS info (fetched once)
let cachedOsInfo: si.Systeminformation.OsData | null = null;
let cachedCpuInfo: si.Systeminformation.CpuData | null = null;

// Network state for per-second rate calculation
interface NetworkState {
  rx_bytes: number;
  tx_bytes: number;
  timestamp: number;
}
const prevNetworkStats = new Map<string, NetworkState>();

// Skipped filesystem types
const SKIP_FS_TYPES = new Set([
  'squashfs', 'tmpfs', 'devtmpfs', 'overlay', 'proc', 'sysfs',
  'cgroup', 'cgroup2', 'debugfs', 'securityfs', 'pstore',
  'efivarfs', 'bpf', 'tracefs', 'fuse', 'fusectl',
]);

async function getOsInfo(): Promise<si.Systeminformation.OsData> {
  if (!cachedOsInfo) {
    cachedOsInfo = await si.osInfo();
  }
  return cachedOsInfo;
}

async function getCpuInfo(): Promise<si.Systeminformation.CpuData> {
  if (!cachedCpuInfo) {
    cachedCpuInfo = await si.cpu();
  }
  return cachedCpuInfo;
}

async function collectCpu(): Promise<AgentMetrics['cpu']> {
  const [load, cpuInfo] = await Promise.all([
    si.currentLoad(),
    getCpuInfo(),
  ]);

  let temp: number | undefined;
  try {
    const tempData = await si.cpuTemperature();
    if (tempData.main !== null && tempData.main > 0) {
      temp = tempData.main;
    }
  } catch {
    // Temperature not available on this platform — skip
  }

  return {
    usage: Math.round(load.currentLoad * 100) / 100,
    cores: cpuInfo.cores,
    model: cpuInfo.brand,
    speed: cpuInfo.speed,
    ...(temp !== undefined ? { temp } : {}),
  };
}

async function collectMemory(): Promise<AgentMetrics['memory']> {
  const mem = await si.mem();
  const usedPercent = mem.total > 0
    ? Math.round((mem.active / mem.total) * 10000) / 100
    : 0;
  return {
    total: mem.total,
    used: mem.active,
    free: mem.available,
    usedPercent,
  };
}

async function collectDisk(): Promise<AgentMetrics['disk']> {
  const drives = await si.fsSize();
  return drives
    .filter(d => {
      if (!d.mount) return false;
      if (SKIP_FS_TYPES.has(d.type)) return false;
      if (d.size === 0) return false;
      return true;
    })
    .map(d => ({
      fs: d.fs,
      mount: d.mount,
      total: d.size,
      used: d.used,
      usedPercent: Math.round(d.use * 100) / 100,
    }));
}

async function collectNetwork(): Promise<AgentMetrics['network']> {
  const stats = await si.networkStats();
  const now = Date.now();
  const result: AgentMetrics['network'] = [];

  for (const stat of stats) {
    const iface = stat.iface;
    const prev = prevNetworkStats.get(iface);
    let rxBytesPerSec = 0;
    let txBytesPerSec = 0;

    if (prev) {
      const elapsedSec = (now - prev.timestamp) / 1000;
      if (elapsedSec > 0) {
        rxBytesPerSec = Math.max(0, Math.round((stat.rx_bytes - prev.rx_bytes) / elapsedSec));
        txBytesPerSec = Math.max(0, Math.round((stat.tx_bytes - prev.tx_bytes) / elapsedSec));
      }
    }

    prevNetworkStats.set(iface, {
      rx_bytes: stat.rx_bytes,
      tx_bytes: stat.tx_bytes,
      timestamp: now,
    });

    result.push({ iface, rxBytesPerSec, txBytesPerSec });
  }

  return result;
}

export async function collectMetrics(): Promise<AgentMetrics> {
  const [cpu, memory, disk, network, osInfo] = await Promise.all([
    collectCpu(),
    collectMemory(),
    collectDisk(),
    collectNetwork(),
    getOsInfo(),
  ]);

  return {
    timestamp: Date.now(),
    cpu,
    memory,
    disk,
    network,
    uptime: si.time().uptime,
    os: {
      platform: osInfo.platform,
      distro: osInfo.distro,
      release: osInfo.release,
      hostname: osInfo.hostname,
      arch: osInfo.arch,
    },
  };
}

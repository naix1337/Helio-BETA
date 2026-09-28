import { ProxmoxClient } from '../collectors/proxmox.js';
import * as containerQueries from '../db/containerQueries.js';
import { broadcast } from '../ws/handler.js';
import { logger } from '../utils/logger.js';

let intervalTimer: ReturnType<typeof setInterval> | null = null;
let proxmoxClient: ProxmoxClient | null = null;
let polling = false;

/** Start polling Proxmox for container metrics */
export function startContainerPolling(): void {
  const config = containerQueries.getProxmoxConfig();
  if (!config) {
    logger.info('No Proxmox config — container polling not started');
    return;
  }

  stopContainerPolling();
  try {
    proxmoxClient = new ProxmoxClient(config.host, config.user, config.password);
  } catch (err) {
    logger.error({ err }, 'Invalid Proxmox config');
    return;
  }
  const client = proxmoxClient;

  const poll = async () => {
    if (polling) return;
    polling = true;
    try {
      const [containers, vms] = await Promise.all([client.listContainers(), client.listVMs()]);
      const all = [...containers, ...vms];

      // API latency per running guest (status call round-trip)
      const pingResults = new Map<number, number>();
      await Promise.all(all.filter((c) => c.status === 'running').map(async (c) => {
        const start = Date.now();
        const status = await client.getContainerStatus(c.node, c.type, c.vmid);
        pingResults.set(c.vmid, status ? Date.now() - start : -1);
      }));

      containerQueries.saveContainerMetrics(all, pingResults);
      broadcast({ type: 'containers:updated', payload: { count: all.length }, timestamp: new Date().toISOString() });
      logger.debug({ count: all.length }, 'Collected Proxmox containers/VMs');
    } catch (err) {
      logger.warn({ err: err instanceof Error ? err.message : err }, 'Proxmox poll error');
    } finally {
      polling = false;
    }
  };

  void poll();
  intervalTimer = setInterval(poll, Math.max(10, config.intervalSeconds) * 1000);
  logger.info({ intervalSeconds: config.intervalSeconds }, 'Proxmox container polling started');
}

/** Stop container polling */
export function stopContainerPolling(): void {
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
  proxmoxClient = null;
}

/** Restart with new config */
export function restartContainerPolling(): void {
  stopContainerPolling();
  startContainerPolling();
}

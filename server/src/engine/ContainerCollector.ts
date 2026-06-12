import { ProxmoxClient } from '../collectors/proxmox.js';
import * as containerQueries from '../db/containerQueries.js';

let intervalTimer: ReturnType<typeof setInterval> | null = null;
let proxmoxClient: ProxmoxClient | null = null;

/** Start polling Proxmox for container metrics */
export function startContainerPolling(): void {
  const config = containerQueries.getProxmoxConfig();
  if (!config) {
    console.log('[containers] No Proxmox config — polling not started');
    return;
  }

  stopContainerPolling();
  proxmoxClient = new ProxmoxClient(config.host, config.user, config.password);

  const poll = async () => {
    try {
      const containers = await proxmoxClient!.listContainers();
      const vms = await proxmoxClient!.listVMs();
      const all = [...containers, ...vms];

      // Ping each running container
      const pingResults = new Map<number, number>();
      for (const c of all.filter((c2) => c2.status === 'running')) {
        // Simple health check via status API call (latency check)
        const start = Date.now();
        try {
          await proxmoxClient!.getContainerStatus(c.node, c.type, c.vmid);
          pingResults.set(c.vmid, Date.now() - start);
        } catch {
          pingResults.set(c.vmid, -1);
        }
      }

      // Save to DB
      containerQueries.saveContainerMetrics(all, pingResults);
      console.log(`[containers] Collected ${all.length} containers/VMs`);
    } catch (err) {
      console.error('[containers] Poll error:', err instanceof Error ? err.message : err);
    }
  };

  // Poll immediately, then every N seconds
  poll();
  intervalTimer = setInterval(poll, config.intervalSeconds * 1000);
  console.log(`[containers] Polling every ${config.intervalSeconds}s`);
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

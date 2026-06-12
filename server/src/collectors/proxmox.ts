import { request as httpsRequest } from 'node:https';

/**
 * Proxmox VE API Client
 *
 * Connects to Proxmox API (port 8006) via ticket-based auth,
 * fetches container/VM resources and live metrics (CPU, RAM, disk).
 */

interface ProxmoxAuth {
  ticket: string;
  csrfToken: string;
  clusterName: string;
}

interface ProxmoxNode {
  node: string;
  status: string;
  cpu: number;
  maxcpu: number;
  mem: number;
  maxmem: number;
  disk: number;
  maxdisk: number;
  uptime?: number;
}

export interface ProxmoxContainer {
  vmid: number;
  name: string;
  status: string;
  node: string;
  type: 'lxc' | 'qemu';
  cpu: number;
  mem: number;
  maxmem: number;
  disk: number;
  maxdisk: number;
  uptime?: number;
  netout?: number;
  netin?: number;
}

/** Custom fetch with self-signed TLS support for Proxmox */
function proxmoxFetch(url: string, options: { method: string; body?: any; headers?: Record<string, string> }): Promise<Response> {
  const parsedUrl = new URL(url);
  const isHttps = parsedUrl.protocol === 'https:';

  // Calculate body and content-length
  let bodyStr = '';
  if (options.body) {
    bodyStr = options.body instanceof URLSearchParams ? options.body.toString() : String(options.body);
  }

  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || 'GET',
        rejectUnauthorized: false,
        headers: {
          ...(bodyStr ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(bodyStr).toString() } : {}),
          ...(options.headers || {}),
        },
        timeout: 15000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString();
          resolve({
            ok: res.statusCode ? res.statusCode >= 200 && res.statusCode < 300 : false,
            status: res.statusCode || 0,
            statusText: res.statusMessage || '',
            json: () => Promise.resolve(JSON.parse(body)),
            text: () => Promise.resolve(body),
          } as Response);
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Proxmox connection timeout')); });

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

export class ProxmoxClient {
  private host: string;
  private user: string;
  private password: string;
  private auth: ProxmoxAuth | null = null;
  private authExpiry = 0;

  constructor(host: string, user: string, password: string) {
    if (!host.startsWith('https://') && !host.startsWith('http://')) {
      throw new Error('Host must start with http:// or https://');
    }
    this.host = host.replace(/\/+$/, '');
    this.user = user;
    this.password = password;
  }

  private get baseUrl(): string {
    return `${this.host}/api2/json`;
  }

  private async ensureAuth(): Promise<void> {
    if (this.auth && Date.now() < this.authExpiry) return;

    const url = `${this.baseUrl}/access/ticket`;
    const body = new URLSearchParams({ username: this.user, password: this.password });

    const res = await proxmoxFetch(url, { method: 'POST', body });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Proxmox auth failed: HTTP ${res.status}`);
    }

    const data = (await res.json()) as {
      data: { ticket: string; CSRFPreventionToken: string; cluster: { name: string } };
    };

    this.auth = {
      ticket: data.data.ticket,
      csrfToken: data.data.CSRFPreventionToken,
      clusterName: data.data.cluster?.name || 'unknown',
    };
    // Ticket expires after 2h, re-auth after 90min
    this.authExpiry = Date.now() + 90 * 60 * 1000;
  }

  private async apiGet<T>(path: string): Promise<T> {
    await this.ensureAuth();
    const res = await proxmoxFetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: {
        Cookie: `PVEAuthCookie=${this.auth!.ticket}`,
      },
    });
    if (!res.ok) { const body = await res.text().catch(() => ''); throw new Error(`Proxmox API error: ${res.status} ${path} - ${body.slice(0, 200)}`); }
    const json = (await res.json()) as { data: T };
    return json.data;
  }

  /** Get all cluster resources (nodes, containers, VMs) */
  async getResources(): Promise<ProxmoxNode[]> {
    const resources = await this.apiGet<any[]>('/cluster/resources');
    return resources.map((r: any) => ({
      node: r.node || '', status: r.status || 'unknown',
      cpu: r.cpu || 0, maxcpu: r.maxcpu || 1,
      mem: r.mem || 0, maxmem: r.maxmem || 1,
      disk: r.disk || 0, maxdisk: r.maxdisk || 1,
      uptime: r.uptime,
    }));
  }

  /** Get detailed status of a specific container/VM */
  async getContainerStatus(node: string, type: 'lxc' | 'qemu', vmid: number): Promise<ProxmoxContainer | null> {
    try {
      const data = await this.apiGet<any>(`/nodes/${node}/${type}/${vmid}/status/current`);
      return {
        vmid: data.vmid, name: data.name || `CT ${vmid}`, status: data.status,
        node, type, cpu: data.cpu || 0, mem: data.mem || 0, maxmem: data.maxmem || 1,
        disk: data.disk || 0, maxdisk: data.maxdisk || 1, uptime: data.uptime,
        netout: data.netout, netin: data.netin,
      };
    } catch { return null; }
  }

  /** List all LXC containers via node API */
  async listContainers(): Promise<ProxmoxContainer[]> {
    const containers: ProxmoxContainer[] = [];
    try {
      const nodes = await this.apiGet<any[]>('/nodes');
      for (const node of nodes) {
        try {
          const ctList = await this.apiGet<any[]>(`/nodes/${node.node}/lxc`);
          for (const ct of ctList) {
            containers.push({
              vmid: ct.vmid, name: ct.name || `CT ${ct.vmid}`, status: ct.status,
              node: node.node, type: 'lxc' as const,
              cpu: ct.cpu || 0, mem: ct.mem || 0, maxmem: ct.maxmem || 1,
              disk: ct.disk || 0, maxdisk: ct.maxdisk || 1, uptime: ct.uptime,
            });
          }
        } catch {} // node may not have LXC
      }
    } catch {}
    return containers;
  }

  /** List all QEMU VMs via node API */
  async listVMs(): Promise<ProxmoxContainer[]> {
    const vms: ProxmoxContainer[] = [];
    try {
      const nodes = await this.apiGet<any[]>('/nodes');
      for (const node of nodes) {
        try {
          const vmList = await this.apiGet<any[]>(`/nodes/${node.node}/qemu`);
          for (const vm of vmList) {
            vms.push({
              vmid: vm.vmid, name: vm.name || `VM ${vm.vmid}`, status: vm.status,
              node: node.node, type: 'qemu' as const,
              cpu: vm.cpu || 0, mem: vm.mem || 0, maxmem: vm.maxmem || 1,
              disk: vm.disk || 0, maxdisk: vm.maxdisk || 1, uptime: vm.uptime,
            });
          }
        } catch {}
      }
    } catch {}
    return vms;
  }

  /** Ping a container via API latency check */
  async pingContainer(node: string, vmid: number): Promise<number | null> {
    try {
      const start = Date.now();
      await this.apiGet(`/nodes/${node}/lxc/${vmid}/status/current`);
      return Date.now() - start;
    } catch { return null; }
  }

  /** Test connection to Proxmox */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const nodes = await this.apiGet<any[]>('/nodes');
      return {
        success: true,
        message: `Verbunden mit ${nodes.length} Nodes: ${nodes.map((n) => n.node).join(', ')}`,
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Connection failed',
      };
    }
  }
}

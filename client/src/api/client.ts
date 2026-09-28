/**
 * API client — same-origin by default (/api/v1). In dev, Vite proxies /api and /ws
 * to the backend (see vite.config.ts). Override with VITE_API_URL if needed.
 */
export const API_BASE: string = import.meta.env.VITE_API_URL || '/api/v1';

const ACCESS_KEY = 'helio-access-token';
const REFRESH_KEY = 'helio-refresh-token';

function readStorage(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

let accessToken: string | null = readStorage(ACCESS_KEY);
let refreshToken: string | null = readStorage(REFRESH_KEY);
let refreshPromise: Promise<boolean> | null = null;

type AuthListener = () => void;
const logoutListeners = new Set<AuthListener>();

/** Called when the session expired and could not be refreshed */
export function onSessionExpired(fn: AuthListener): () => void {
  logoutListeners.add(fn);
  return () => logoutListeners.delete(fn);
}

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  refreshToken = refresh;
  try {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  } catch { /* storage unavailable */ }
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
  try {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  } catch { /* storage unavailable */ }
}

export function getAccessToken(): string | null {
  return accessToken;
}

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.success && data.data) {
      setTokens(data.data.accessToken, data.data.refreshToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Refresh the access token if possible (used e.g. before WS reconnects) */
export async function ensureFreshToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
}

export async function apiRequest<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  opts?: { noAuth?: boolean },
): Promise<ApiResult<T>> {
  const doFetch = () => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (!opts?.noAuth && accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    return fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res: Response;
  try {
    res = await doFetch();
  } catch {
    return { success: false, error: 'Server nicht erreichbar', status: 0 };
  }

  // Try refresh on 401
  if (res.status === 401 && refreshToken && !opts?.noAuth) {
    const refreshed = await ensureFreshToken();
    if (refreshed) {
      try { res = await doFetch(); } catch { return { success: false, error: 'Server nicht erreichbar', status: 0 }; }
    } else {
      clearTokens();
      logoutListeners.forEach((fn) => fn());
      return { success: false, error: 'Sitzung abgelaufen', status: 401 };
    }
  }

  try {
    const json = (await res.json()) as ApiResult<T>;
    return { ...json, status: res.status };
  } catch {
    return { success: false, error: `HTTP ${res.status}`, status: res.status };
  }
}

/** Like apiRequest, but throws on failure and returns data directly */
export async function apiCall<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await apiRequest<T>(method, path, body);
  if (!res.success) throw new Error(res.error || `Request failed (${res.status})`);
  return res.data as T;
}

/** WebSocket URL derived from the page origin (or VITE_WS_URL) */
export function wsUrl(): string {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  if (API_BASE.startsWith('http')) {
    const u = new URL(API_BASE);
    return `${u.protocol === 'https:' ? 'wss:' : 'ws:'}//${u.host}/ws`;
  }
  return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
}

/** Absolute base URL of the server (for push URLs / status page links) */
export function serverOrigin(): string {
  if (API_BASE.startsWith('http')) return new URL(API_BASE).origin;
  return window.location.origin;
}

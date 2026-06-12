const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

let accessToken: string | null = localStorage.getItem('pulse-access-token');
let refreshToken: string | null = localStorage.getItem('pulse-refresh-token');
let refreshPromise: Promise<boolean> | null = null;

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('pulse-access-token', access);
  localStorage.setItem('pulse-refresh-token', refresh);
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('pulse-access-token');
  localStorage.removeItem('pulse-refresh-token');
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

export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function apiRequest<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  opts?: { noAuth?: boolean },
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {};
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (!opts?.noAuth && accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body && !(body instanceof FormData) ? JSON.stringify(body) : (body as BodyInit | undefined),
  });

  // Try refresh on 401
  if (res.status === 401 && refreshToken && !opts?.noAuth) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }

    const refreshed = await refreshPromise;
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      res = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body && !(body instanceof FormData) ? JSON.stringify(body) : (body as BodyInit | undefined),
      });
    } else {
      clearTokens();
      return { success: false, error: 'Session expired' };
    }
  }

  try {
    const json = await res.json() as ApiResult<T>;
    return json;
  } catch {
    return { success: false, error: `HTTP ${res.status}` };
  }
}

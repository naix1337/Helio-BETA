import { apiRequest, setTokens, clearTokens } from './client';

export interface UserPublic {
  id: string;
  email: string;
  totpEnabled: boolean;
  role: 'admin' | 'user';
  createdAt: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: UserPublic;
}

export class TwoFactorRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TwoFactorRequiredError';
  }
}

export async function login(email: string, password: string, totpToken?: string): Promise<LoginResult> {
  const res = await apiRequest<LoginResult & { requires2fa?: boolean }>(
    'POST', '/auth/login', { email, password, ...(totpToken ? { totpToken } : {}) }, { noAuth: true },
  );
  if (res.success && res.data) {
    setTokens(res.data.accessToken, res.data.refreshToken);
    return res.data;
  }
  if (res.data?.requires2fa) throw new TwoFactorRequiredError(res.error || '2FA-Code erforderlich');
  throw new Error(res.error || 'Login fehlgeschlagen');
}

export async function needsSetup(): Promise<boolean> {
  const res = await apiRequest<{ needsSetup: boolean }>('GET', '/auth/setup', undefined, { noAuth: true });
  return res.data?.needsSetup ?? false;
}

export async function setup(email: string, password: string): Promise<LoginResult> {
  const res = await apiRequest<LoginResult>('POST', '/auth/setup', { email, password }, { noAuth: true });
  if (res.success && res.data) {
    setTokens(res.data.accessToken, res.data.refreshToken);
    return res.data;
  }
  throw new Error(res.error || 'Einrichtung fehlgeschlagen');
}

export async function getProfile(): Promise<UserPublic | null> {
  const res = await apiRequest<UserPublic>('GET', '/auth/me');
  return res.data ?? null;
}

export function logout(): void {
  clearTokens();
}

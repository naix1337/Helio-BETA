import { apiRequest, setTokens, clearTokens } from './client';

export interface UserPublic {
  id: string;
  email: string;
  totpEnabled: boolean;
  role: string;
  createdAt: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: UserPublic;
}

export async function login(email: string, password: string): Promise<LoginResult | null> {
  const res = await apiRequest<LoginResult>('POST', '/auth/login', { email, password }, { noAuth: true });
  if (res.success && res.data) {
    setTokens(res.data.accessToken, res.data.refreshToken);
    return res.data;
  }
  throw new Error(res.error || 'Login failed');
}

export async function register(email: string, password: string): Promise<LoginResult | null> {
  const res = await apiRequest<LoginResult>('POST', '/auth/register', { email, password }, { noAuth: true });
  if (res.success && res.data) {
    setTokens(res.data.accessToken, res.data.refreshToken);
    return res.data;
  }
  throw new Error(res.error || 'Registration failed');
}

export async function getProfile(): Promise<UserPublic | null> {
  const res = await apiRequest<UserPublic>('GET', '/auth/me');
  return res.data ?? null;
}

export function logout(): void {
  clearTokens();
}

import { logtoClient, API_RESOURCE } from './logto';

const TENANT_KEY = 'peopleclaw-current-tenant';

export function getCurrentTenantSlug(): string | null {
  try { return localStorage.getItem(TENANT_KEY); } catch { return null; }
}
export function setCurrentTenantSlug(slug: string | null): void {
  try {
    if (slug) localStorage.setItem(TENANT_KEY, slug);
    else localStorage.removeItem(TENANT_KEY);
  } catch {/* */}
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await logtoClient.getAccessToken(API_RESOURCE);
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const slug = getCurrentTenantSlug();
  if (slug) headers.set('x-tenant-slug', slug);
  return fetch(path, { ...init, headers });
}

export async function apiJSON<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

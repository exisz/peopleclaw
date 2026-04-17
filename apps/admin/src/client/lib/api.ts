import { logtoClient, API_RESOURCE } from './logto';

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await logtoClient.getAccessToken(API_RESOURCE);
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
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

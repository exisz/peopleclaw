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

export class ApiError extends Error {
  status: number;
  code?: string;
  data?: Record<string, unknown>;
  constructor(status: number, message: string, data?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    if (data && typeof data.code === 'string') this.code = data.code;
  }
}

export async function apiJSON<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const text = await res.text();
    let parsed: Record<string, unknown> | undefined;
    try { parsed = JSON.parse(text) as Record<string, unknown>; } catch { /* not JSON */ }
    const message =
      (parsed && typeof parsed.error === 'string' && parsed.error) ||
      `API ${res.status}: ${text}`;
    throw new ApiError(res.status, message, parsed);
  }
  return res.json() as Promise<T>;
}

/**
 * Convenience wrapper around `apiJSON` with verb helpers.
 * Always sends JSON content-type and credentials.
 */
export const apiClient = {
  get: <T>(path: string) => apiJSON<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiJSON<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  put: <T>(path: string, body?: unknown) =>
    apiJSON<T>(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  delete: <T>(path: string) =>
    apiJSON<T>(path, { method: 'DELETE' }),
  /** Returns raw Response for streaming (SSE). Does NOT throw on non-2xx — caller handles. */
  postRaw: (path: string, body?: unknown) =>
    apiFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  /** Upload multipart/form-data (e.g. file upload). Let browser set Content-Type + boundary. */
  postForm: <T>(path: string, form: FormData) =>
    apiJSON<T>(path, { method: 'POST', body: form }),
};

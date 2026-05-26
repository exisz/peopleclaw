export interface ScopedNotFoundBody {
  error: 'not_found';
  message: string;
}

/**
 * Tenant/app-scoped 404 body. It intentionally omits appId, tenantId,
 * deployment ids, route candidates, and other existence hints so unknown or
 * cross-tenant App lookups do not leak data.
 */
export function createScopedAppNotFoundBody(): ScopedNotFoundBody {
  return {
    error: 'not_found',
    message: 'App not found',
  };
}

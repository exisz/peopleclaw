import type { RuntimeFunctionRouteResolution } from './runtimeGatewayResolution';

export interface RuntimeAuthUserContext {
  userId: string;
  email?: string;
  roles: readonly string[];
}

export interface RuntimeAppContext {
  tenantId: string;
  appId: string;
  deploymentId: string;
  functionId: string;
}

export interface RuntimeFunctionContext {
  auth: {
    user: RuntimeAuthUserContext;
  };
  app: RuntimeAppContext;
}

function requireToken(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Runtime function context requires ${field}`);
  return normalized;
}

/**
 * Build the scoped context injected into a sandboxed user App function. Identity
 * comes from the authenticated PeopleClaw request plus the already-resolved
 * deployment route, never from untrusted function input.
 */
export function buildRuntimeFunctionContext(input: {
  tenantId: string;
  authUser: RuntimeAuthUserContext;
  route: RuntimeFunctionRouteResolution;
}): Readonly<RuntimeFunctionContext> {
  return Object.freeze({
    auth: Object.freeze({
      user: Object.freeze({
        userId: requireToken(input.authUser.userId, 'auth.user.userId'),
        email: input.authUser.email,
        roles: Object.freeze([...input.authUser.roles]),
      }),
    }),
    app: Object.freeze({
      tenantId: requireToken(input.tenantId, 'app.tenantId'),
      appId: input.route.appId,
      deploymentId: input.route.deploymentId,
      functionId: input.route.functionId,
    }),
  });
}

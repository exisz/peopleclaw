export interface RuntimeFunctionManifestEntry {
  functionId: string;
  artifactHash: string;
  handler: string;
}

export interface RuntimeDeploymentManifest {
  appId: string;
  deploymentId: string;
  functions: Record<string, RuntimeFunctionManifestEntry>;
}

export interface RuntimeFunctionRouteInput {
  appId: string;
  deploymentId: string;
  functionId: string;
}

export interface RuntimeFunctionRouteResolution {
  appId: string;
  deploymentId: string;
  functionId: string;
  artifactHash: string;
  handler: string;
}

function routeKey(appId: string, deploymentId: string): string {
  return `${appId}:${deploymentId}`;
}

function requireToken(value: string, field: keyof RuntimeFunctionRouteInput): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Runtime gateway requires ${field}`);
  return normalized;
}

/**
 * Resolve a soft runtime gateway function invocation from URL identity to the
 * immutable deployment/function artifact. The gateway must route by appId +
 * deploymentId + functionId rather than by hardcoded server routes.
 */
export function resolveRuntimeFunctionRoute(
  input: RuntimeFunctionRouteInput,
  deployments: RuntimeDeploymentManifest[],
): RuntimeFunctionRouteResolution | null {
  const appId = requireToken(input.appId, 'appId');
  const deploymentId = requireToken(input.deploymentId, 'deploymentId');
  const functionId = requireToken(input.functionId, 'functionId');
  const byRoute = new Map(deployments.map(deployment => [routeKey(deployment.appId, deployment.deploymentId), deployment]));
  const deployment = byRoute.get(routeKey(appId, deploymentId));
  if (!deployment) return null;
  const fn = deployment.functions[functionId];
  if (!fn) return null;
  return {
    appId,
    deploymentId,
    functionId,
    artifactHash: fn.artifactHash,
    handler: fn.handler,
  };
}

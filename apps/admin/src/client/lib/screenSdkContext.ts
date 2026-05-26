export type ScreenDeploymentChannel = 'production' | 'preview';

export interface ScreenSdkContextInput {
  tenantId: string;
  appId: string;
  deploymentId: string;
  channel: ScreenDeploymentChannel;
  screenId: string;
  appPath: string;
}

export interface ScreenSdkContext {
  tenantId: string;
  appId: string;
  deploymentId: string;
  channel: ScreenDeploymentChannel;
  screenId: string;
  appPath: string;
}

function requireNonEmpty(value: string, field: keyof ScreenSdkContextInput): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Screen SDK context requires ${field}`);
  return normalized;
}

/**
 * Build the immutable screen SDK context passed from the PeopleClaw shell into a
 * user App screen. Screens must never infer tenant/app/deployment identity from
 * route params or untrusted component props; the shell injects this scoped
 * context after resolving the deployment manifest.
 */
export function createScreenSdkContext(input: ScreenSdkContextInput): Readonly<ScreenSdkContext> {
  return Object.freeze({
    tenantId: requireNonEmpty(input.tenantId, 'tenantId'),
    appId: requireNonEmpty(input.appId, 'appId'),
    deploymentId: requireNonEmpty(input.deploymentId, 'deploymentId'),
    channel: input.channel,
    screenId: requireNonEmpty(input.screenId, 'screenId'),
    appPath: input.appPath.startsWith('/') ? input.appPath : `/${input.appPath}`,
  });
}

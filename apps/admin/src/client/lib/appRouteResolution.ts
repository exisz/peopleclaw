export type DeploymentChannel = 'preview' | 'production';

export interface CoreAppShellRoute {
  appId: string;
  appPath: string;
}

export interface DeploymentManifestRequest extends CoreAppShellRoute {
  channel: DeploymentChannel;
}

const APPS_PREFIX = '/apps/';

/**
 * Resolve the MVP soft-route namespace for user Apps.
 *
 * `/apps/:appId/*` enters the PeopleClaw core shell, then the shell resolves
 * the app/deployment manifest and loads screen artifacts. The bare `/apps`
 * remains the top-level Apps list and is intentionally not a user-App route.
 */
export function resolveCoreAppShellRoute(pathname: string): CoreAppShellRoute | null {
  if (!pathname.startsWith(APPS_PREFIX)) return null;

  const rest = pathname.slice(APPS_PREFIX.length);
  const [rawAppId, ...pathParts] = rest.split('/');
  const appId = decodeURIComponent(rawAppId ?? '').trim();
  if (!appId) return null;

  const appPath = `/${pathParts.join('/')}`;
  return { appId, appPath };
}

export function resolveDeploymentManifestRequest(pathname: string, search = ''): DeploymentManifestRequest | null {
  const route = resolveCoreAppShellRoute(pathname);
  if (!route) return null;

  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const channel: DeploymentChannel = params.get('preview') ? 'preview' : 'production';
  return { ...route, channel };
}

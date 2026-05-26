export interface ScreenIframeUrlInput {
  coreOrigin: string;
  screenOrigin: string;
  appId: string;
  deploymentId: string;
  screenId: string;
}

export interface ScreenIframeUrlResult {
  src: string;
  origin: string;
  sandbox: string;
}

function parseOrigin(value: string, field: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new Error(`Invalid ${field} origin`);
  }
}

function requireToken(value: string, field: keyof ScreenIframeUrlInput): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Screen iframe requires ${field}`);
  return normalized;
}

/**
 * Resolve the iframe URL for an untrusted user App screen. MVP screens run in a
 * separate-origin frame and talk to the shell through the typed bridge; same
 * origin rendering is intentionally rejected so screen code cannot share the
 * core shell's DOM/cookies/storage boundary.
 */
export function createScreenIframeUrl(input: ScreenIframeUrlInput): Readonly<ScreenIframeUrlResult> {
  const core = parseOrigin(input.coreOrigin, 'coreOrigin');
  const screen = parseOrigin(input.screenOrigin, 'screenOrigin');
  if (core.origin === screen.origin) {
    throw new Error('Screen iframe origin must be separate from the PeopleClaw core origin');
  }

  const url = new URL('/screen-frame', screen.origin);
  url.searchParams.set('appId', requireToken(input.appId, 'appId'));
  url.searchParams.set('deploymentId', requireToken(input.deploymentId, 'deploymentId'));
  url.searchParams.set('screenId', requireToken(input.screenId, 'screenId'));

  return Object.freeze({
    src: url.toString(),
    origin: screen.origin,
    sandbox: 'allow-scripts allow-forms allow-popups',
  });
}

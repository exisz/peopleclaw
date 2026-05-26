export interface ScreenRenderSuccess<T> {
  ok: true;
  shellAlive: true;
  screen: T;
  fallback: null;
  error: null;
}

export interface ScreenRenderFailure {
  ok: false;
  shellAlive: true;
  screen: null;
  fallback: {
    title: string;
    message: string;
  };
  error: Error;
}

export type ScreenRenderResult<T> = ScreenRenderSuccess<T> | ScreenRenderFailure;

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

/**
 * Minimal shell-side render guard for user App screens. A screen failure must be
 * converted into a local fallback state instead of escaping into the PeopleClaw
 * core shell tree.
 */
export function renderScreenWithShellBoundary<T>(renderScreen: () => T): ScreenRenderResult<T> {
  try {
    return {
      ok: true,
      shellAlive: true,
      screen: renderScreen(),
      fallback: null,
      error: null,
    };
  } catch (cause) {
    const error = toError(cause);
    return {
      ok: false,
      shellAlive: true,
      screen: null,
      fallback: {
        title: 'Screen unavailable',
        message: 'This App screen failed to render. The PeopleClaw shell is still running.',
      },
      error,
    };
  }
}

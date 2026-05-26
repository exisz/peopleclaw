export interface RuntimeWorkerMount {
  source: string;
  target: string;
  readonly?: boolean;
}

export interface RuntimeWorkerSandboxSpec {
  mounts?: RuntimeWorkerMount[];
  env?: Record<string, string | undefined>;
}

export interface RuntimeWorkerSandboxValidationResult {
  ok: boolean;
  errors: string[];
}

const DOCKER_SOCKET_PATHS = new Set(['/var/run/docker.sock', '/run/docker.sock']);

function normalizeMountPath(path: string): string {
  return path.trim().replace(/\/+$/, '') || '/';
}

/**
 * Validates the user function worker container/process isolation contract.
 * The MVP sandbox may use containers, but user workers must never receive the
 * host Docker daemon socket because that would grant host/container control.
 */
export function validateRuntimeWorkerSandboxSpec(spec: RuntimeWorkerSandboxSpec): RuntimeWorkerSandboxValidationResult {
  const errors: string[] = [];

  for (const mount of spec.mounts ?? []) {
    const source = normalizeMountPath(mount.source);
    const target = normalizeMountPath(mount.target);
    if (DOCKER_SOCKET_PATHS.has(source) || DOCKER_SOCKET_PATHS.has(target)) {
      errors.push('runtime worker must not mount the Docker socket');
    }
  }

  return { ok: errors.length === 0, errors };
}

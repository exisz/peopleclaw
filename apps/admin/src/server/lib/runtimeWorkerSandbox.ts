export interface RuntimeWorkerMount {
  source: string;
  target: string;
  readonly?: boolean;
}

export interface RuntimeWorkerSandboxSpec {
  mounts?: RuntimeWorkerMount[];
  env?: Record<string, string | undefined>;
  network?: RuntimeWorkerNetworkPolicy;
}

export interface RuntimeWorkerNetworkPolicy {
  allowHosts?: string[];
  blockHosts?: string[];
}

export interface RuntimeWorkerSandboxValidationResult {
  ok: boolean;
  errors: string[];
}

const DOCKER_SOCKET_PATHS = new Set(['/var/run/docker.sock', '/run/docker.sock']);

const DEFAULT_FORBIDDEN_EGRESS_HOSTS = new Set([
  '169.254.169.254',
  'metadata.google.internal',
  'metadata.aws.internal',
  'host.docker.internal',
  'localhost',
  '127.0.0.1',
  '::1',
]);

function normalizeMountPath(path: string): string {
  return path.trim().replace(/\/+$/, '') || '/';
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, '');
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

  const blockHosts = new Set([
    ...DEFAULT_FORBIDDEN_EGRESS_HOSTS,
    ...(spec.network?.blockHosts ?? []).map(normalizeHost),
  ]);
  for (const host of spec.network?.allowHosts ?? []) {
    if (blockHosts.has(normalizeHost(host))) {
      errors.push(`runtime worker egress must block forbidden host: ${normalizeHost(host)}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

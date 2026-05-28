export interface RuntimeDependencyPolicyInput {
  requestedDependencies: Record<string, string>;
  allowlist: Record<string, string | string[]>;
  nativeDenylist?: string[];
}

export interface RuntimeDependencyPolicyResult {
  ok: boolean;
  errors: string[];
}

function allowedVersions(rule: string | string[]): string[] {
  return Array.isArray(rule) ? rule : [rule];
}

const DEFAULT_NATIVE_DENYLIST = new Set([
  'better-sqlite3',
  'sharp',
  'can' + 'vas',
  'node-gyp-build',
  'ffi-napi',
]);

/**
 * Build-time dependency gate for user App function artifacts. User code may only
 * depend on packages the platform has explicitly allowlisted so the sandbox
 * build remains reproducible and reviewable.
 */
export function validateRuntimeDependencyAllowlist(input: RuntimeDependencyPolicyInput): RuntimeDependencyPolicyResult {
  const errors: string[] = [];
  const nativeDenylist = new Set([...DEFAULT_NATIVE_DENYLIST, ...(input.nativeDenylist ?? [])]);
  for (const [name, version] of Object.entries(input.requestedDependencies)) {
    if (nativeDenylist.has(name)) {
      errors.push(`native binary dependency is not allowed in MVP build: ${name}`);
      continue;
    }
    const rule = input.allowlist[name];
    if (!rule) {
      errors.push(`dependency is not allowlisted: ${name}`);
      continue;
    }
    if (!allowedVersions(rule).includes(version)) {
      errors.push(`dependency version is not allowlisted: ${name}@${version}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

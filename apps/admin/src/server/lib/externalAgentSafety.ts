export const EXTERNAL_AGENT_SCOPES = [
  'agent:read',
  'app:read',
  'app:write',
  'component:read',
  'component:write',
  'component:run',
] as const;

export type ExternalAgentScope = (typeof EXTERNAL_AGENT_SCOPES)[number];

export const DEFAULT_EXTERNAL_AGENT_SCOPES: ExternalAgentScope[] = ['agent:read', 'app:read', 'component:read'];

const SCOPE_SET = new Set<string>(EXTERNAL_AGENT_SCOPES);

/**
 * Hard safety boundary for user-owned external coding agents.
 * These operations are not allowed through external agent APIs even when a token
 * has broad scopes, dry-run is requested, or a caller supplies confirmation.
 */
export const EXTERNAL_AGENT_DENYLISTED_OPERATIONS = [
  'raw_sql',
  'execute_sql',
  'raw_db_migration',
  'schema_migration',
  'drop_table',
  'truncate_table',
  'alter_schema',
  'read_secret',
  'list_secrets',
  'export_secrets',
  'exfiltrate_secret',
  'rotate_platform_secret',
] as const;

export type SafetyDecision =
  | { allowed: true; operation: string; requiredScopes: ExternalAgentScope[]; dryRun: boolean; confirmRequired: boolean }
  | { allowed: false; operation: string; reason: 'denylisted_operation' | 'missing_scope' | 'confirmation_required' | 'unknown_operation'; message: string; requiredScopes?: ExternalAgentScope[] };

type OperationPolicy = {
  scopes: ExternalAgentScope[];
  confirmRequired?: boolean;
  dryRunAllowed?: boolean;
};

export const EXTERNAL_AGENT_OPERATION_POLICIES: Record<string, OperationPolicy> = {
  whoami: { scopes: ['agent:read'] },
  list_apps: { scopes: ['app:read'] },
  inspect_app: { scopes: ['app:read'] },
  external_agent_chat: { scopes: ['agent:read', 'app:read'], confirmRequired: true, dryRunAllowed: true },
  inspect_current_app: { scopes: ['app:read'] },
  list_app_modules: { scopes: ['component:read'] },
  create_app_component: { scopes: ['component:write'], confirmRequired: true, dryRunAllowed: true },
  update_app_component: { scopes: ['component:write'], confirmRequired: true, dryRunAllowed: true },
  run_component: { scopes: ['component:run'], confirmRequired: true, dryRunAllowed: true },
};

export function normalizeExternalAgentScopes(input: unknown, fallback = DEFAULT_EXTERNAL_AGENT_SCOPES): ExternalAgentScope[] {
  if (input === undefined || input === null) return [...fallback];
  if (!Array.isArray(input)) throw new Error('scopes must be an array');
  const out: ExternalAgentScope[] = [];
  for (const item of input) {
    if (typeof item !== 'string' || !SCOPE_SET.has(item)) {
      throw new Error(`invalid external agent scope: ${String(item)}`);
    }
    if (!out.includes(item as ExternalAgentScope)) out.push(item as ExternalAgentScope);
  }
  return out;
}

export function parseStoredExternalAgentScopes(stored: string | null | undefined): ExternalAgentScope[] {
  if (!stored) return [];
  try {
    return normalizeExternalAgentScopes(JSON.parse(stored), []);
  } catch {
    return [];
  }
}

export function evaluateExternalAgentOperation(params: {
  operation: string;
  scopes: readonly string[];
  dryRun?: boolean;
  confirmed?: boolean;
}): SafetyDecision {
  const operation = params.operation.trim();
  const normalizedOperation = operation.toLowerCase();
  if ((EXTERNAL_AGENT_DENYLISTED_OPERATIONS as readonly string[]).includes(normalizedOperation)) {
    return {
      allowed: false,
      operation,
      reason: 'denylisted_operation',
      message: `External agents cannot perform platform-admin operation '${operation}'. Use platform-owned deploy/migration flows instead.`,
    };
  }

  const policy = EXTERNAL_AGENT_OPERATION_POLICIES[operation];
  if (!policy) {
    return {
      allowed: false,
      operation,
      reason: 'unknown_operation',
      message: `External agent operation '${operation}' is not on the allowlist.`,
    };
  }

  const granted = new Set(params.scopes);
  const missing = policy.scopes.filter((scope) => !granted.has(scope));
  if (missing.length) {
    return {
      allowed: false,
      operation,
      reason: 'missing_scope',
      message: `External agent token is missing required scope(s): ${missing.join(', ')}`,
      requiredScopes: policy.scopes,
    };
  }

  const dryRun = Boolean(params.dryRun);
  const confirmRequired = Boolean(policy.confirmRequired && !dryRun);
  if (confirmRequired && !params.confirmed) {
    return {
      allowed: false,
      operation,
      reason: 'confirmation_required',
      message: `External agent operation '${operation}' requires explicit confirmation unless dryRun=true.`,
      requiredScopes: policy.scopes,
    };
  }

  return { allowed: true, operation, requiredScopes: policy.scopes, dryRun, confirmRequired: Boolean(policy.confirmRequired) };
}

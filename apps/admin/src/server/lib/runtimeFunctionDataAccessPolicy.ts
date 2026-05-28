export interface RuntimeFunctionDataAccessPolicyResult {
  ok: boolean;
  errors: string[];
}

export interface RuntimeFunctionDataQueryScope {
  tenantId: string;
  appId: string;
  collection: string;
}

export interface RuntimeFunctionDataQueryAuthorizationResult {
  ok: boolean;
  errors: string[];
}

const RAW_DATA_ACCESS_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /from\s+['"]@prisma\/client['"]|new\s+PrismaClient\s*\(/,
    reason: 'runtime function must not use Prisma or raw database clients',
  },
  {
    pattern: /from\s+['"]@libsql\/client['"]|createClient\s*\(\s*\{[^}]*url\s*:/s,
    reason: 'runtime function must not open direct database handles',
  },
  {
    pattern: /\$queryRaw|\$executeRaw|\braw\s*SQL\b|\bsql\s*`/i,
    reason: 'runtime function must not issue raw SQL',
  },
  {
    pattern: /fetch\s*\(\s*['"][^'"]*\/api\/(?:data|internal|admin|tenants)/,
    reason: 'runtime function must not bypass the PeopleClaw Data API SDK with raw platform API calls',
  },
];

const DATA_SDK_PATTERNS = [
  /\bctx\.data\b/,
  /from\s+['"]@peopleclaw\/sdk['"]/,
];

/**
 * Enforce the MVP function data boundary: user App functions access documents
 * through the injected PeopleClaw Data API SDK surface (`ctx.data` or approved
 * SDK helpers), never through platform internals, raw SQL, or direct DB clients.
 */
export function validateRuntimeFunctionDataAccess(source: string): RuntimeFunctionDataAccessPolicyResult {
  const errors: string[] = [];
  for (const { pattern, reason } of RAW_DATA_ACCESS_PATTERNS) {
    if (pattern.test(source)) errors.push(reason);
  }

  const appearsToAccessData = /\b(?:create|insert|update|delete|find|query|collection|document|PrismaClient|\$queryRaw|fetch)\b/.test(source);
  const usesDataSdk = DATA_SDK_PATTERNS.some(pattern => pattern.test(source));
  if (appearsToAccessData && !usesDataSdk) {
    errors.push('runtime function data access must go through the PeopleClaw Data API SDK');
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Authorize a Data API query using the runtime-injected tenant/app identity.
 * Functions may only query collections inside their own tenant/app scope; any
 * requested tenant/app override is treated as a confused-deputy attempt.
 */
export function authorizeRuntimeFunctionDataQuery(input: {
  runtimeScope: RuntimeFunctionDataQueryScope;
  requestedScope: RuntimeFunctionDataQueryScope;
}): RuntimeFunctionDataQueryAuthorizationResult {
  const errors: string[] = [];
  if (input.requestedScope.tenantId !== input.runtimeScope.tenantId) {
    errors.push('runtime function data query tenant scope mismatch');
  }
  if (input.requestedScope.appId !== input.runtimeScope.appId) {
    errors.push('runtime function data query app scope mismatch');
  }
  return { ok: errors.length === 0, errors };
}

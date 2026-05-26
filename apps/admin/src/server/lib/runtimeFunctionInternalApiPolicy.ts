export interface RuntimeFunctionInternalApiPolicyResult {
  ok: boolean;
  errors: string[];
}

const INTERNAL_API_PATTERNS: RegExp[] = [
  /fetch\s*\(\s*['"][^'"]*\/api\/(?:internal|admin|tenants|e2e-mint)/,
  /from\s+['"]@peopleclaw\/admin(?:\/|['"])/,
  /from\s+['"]\.\.\/(?:routes|middleware|generated|lib\/prisma)(?:\/|['"])/,
  /from\s+['"]\.\.\/\.\.\/(?:routes|middleware|generated|lib\/prisma)(?:\/|['"])/,
  /process\.env\.(?:DATABASE_URL|LOGTO_|STRIPE_|OPENAI_|UPLOADTHING_|BLOB_)/,
];

/**
 * User App functions run behind the runtime gateway. They may use the injected
 * SDK/context, but must not call PeopleClaw platform-internal HTTP routes,
 * import server internals, or read core control-plane environment variables.
 */
export function validateRuntimeFunctionInternalApiAccess(source: string): RuntimeFunctionInternalApiPolicyResult {
  const errors: string[] = [];
  if (INTERNAL_API_PATTERNS.some(pattern => pattern.test(source))) {
    errors.push('runtime function must not call or import PeopleClaw platform internal APIs');
  }
  return { ok: errors.length === 0, errors };
}

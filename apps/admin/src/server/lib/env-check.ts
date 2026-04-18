// PLANET-912 item 8: Validate critical env at startup.
// Warn (don't crash) so dev can run partial; production should fail loudly via logs.

const REQUIRED_ALWAYS = ['DATABASE_URL'] as const;
const REQUIRED_PROD = [
  'LOGTO_ENDPOINT',
  'LOGTO_APP_ID',
  'LOGTO_APP_SECRET',
  'LOGTO_API_RESOURCE',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
] as const;
const RECOMMENDED = ['SHOPIFY_API_KEY', 'SHOPIFY_API_SECRET', 'OPENAI_API_KEY'] as const;

export function checkEnv(): { missing: string[]; warnings: string[] } {
  const missing: string[] = [];
  const warnings: string[] = [];
  for (const k of REQUIRED_ALWAYS) {
    if (!process.env[k]) missing.push(k);
  }
  if (process.env.NODE_ENV === 'production') {
    for (const k of REQUIRED_PROD) {
      if (!process.env[k]) missing.push(k);
    }
  }
  for (const k of RECOMMENDED) {
    if (!process.env[k]) warnings.push(k);
  }
  if (missing.length) {
    console.error(`[env-check] MISSING required env: ${missing.join(', ')}`);
  }
  if (warnings.length) {
    console.warn(`[env-check] (recommended) missing: ${warnings.join(', ')}`);
  }
  if (!missing.length && !warnings.length) {
    console.log('[env-check] all required + recommended env present');
  }
  return { missing, warnings };
}

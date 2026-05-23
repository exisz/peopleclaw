export const EXTERNAL_AGENT_ONBOARDING_SCOPES = [
  'agent:read',
  'app:read',
  'app:write',
  'component:read',
  'component:write',
  'component:run',
] as const;

export interface ExternalAgentSetupInput {
  baseUrl: string;
  appId: string;
  appName?: string | null;
  token?: string | null;
}

export function normalizeBaseUrl(input: string): string {
  return (input || 'https://app.peopleclaw.rollersoft.com.au').replace(/\/+$/, '');
}

export function buildPeopleClawCliConfig(input: ExternalAgentSetupInput): string {
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const token = input.token || '<CREATE_A_KEY_ON_THIS_PAGE_FIRST>';
  return [
    'export PEOPLECLAW_BASE_URL=' + shellQuote(baseUrl),
    'export PEOPLECLAW_API_KEY=' + shellQuote(token),
    'export PEOPLECLAW_APP_ID=' + shellQuote(input.appId),
    '',
    'npx -y @peopleclaw/cli whoami',
    'npx -y @peopleclaw/cli apps list',
    'npx -y @peopleclaw/cli app inspect "$PEOPLECLAW_APP_ID"',
  ].join('\n');
}

export function buildCodexOnboardingPrompt(input: ExternalAgentSetupInput): string {
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const token = input.token || '<CREATE_A_KEY_ON_THIS_PAGE_FIRST>';
  const appName = input.appName?.trim() || 'this PeopleClaw app';
  return `You are connecting to PeopleClaw app "${appName}" through the official scoped external-agent API.\n\nUse only the PeopleClaw CLI/API. Do not script the admin UI, read secrets, run SQL, write migrations, or attempt cross-tenant access.\n\nConfiguration:\n- PEOPLECLAW_BASE_URL=${baseUrl}\n- PEOPLECLAW_APP_ID=${input.appId}\n- PEOPLECLAW_API_KEY=${token}\n\nSetup commands:\n\`\`\`bash\nnpm install -g @peopleclaw/cli\nexport PEOPLECLAW_BASE_URL=${shellQuote(baseUrl)}\nexport PEOPLECLAW_API_KEY=${shellQuote(token)}\nexport PEOPLECLAW_APP_ID=${shellQuote(input.appId)}\n\npeopleclaw whoami\npeopleclaw apps list\npeopleclaw app inspect "$PEOPLECLAW_APP_ID"\n\`\`\`\n\nSafe workflow for every change:\n1. Run whoami and confirm this token is scoped to app ${input.appId}.\n2. Inspect the app before editing.\n3. Use dry-run first for chat/actions.\n4. Only pass --confirm after the operator explicitly approves the exact intended change.\n5. If you hit 401/403/404, stop and report the exact error instead of trying another channel.`;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

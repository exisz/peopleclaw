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

export interface ExternalAgentSeedPromptInput extends ExternalAgentSetupInput {
  repositoryUrl?: string | null;
}

const DEFAULT_REPOSITORY_URL = '<REPO_URL>';
const DEFAULT_TOKEN_PLACEHOLDER = '<CREATE_A_KEY_ON_THIS_PAGE_FIRST>';

export function normalizeBaseUrl(input: string): string {
  return (input || 'https://app.peopleclaw.rollersoft.com.au').replace(/\/+$/, '');
}

export function buildPeopleClawCliConfig(input: ExternalAgentSetupInput): string {
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const token = input.token || DEFAULT_TOKEN_PLACEHOLDER;
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

export function buildExternalAgentSeedPrompt(input: ExternalAgentSeedPromptInput): string {
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const token = input.token || DEFAULT_TOKEN_PLACEHOLDER;
  const appName = input.appName?.trim() || 'this PeopleClaw app';
  const repositoryUrl = input.repositoryUrl?.trim() || DEFAULT_REPOSITORY_URL;
  return `You are starting a generic agent workspace for ${appName}.

Repository:
- REPO_URL=${repositoryUrl}

Workspace setup:
1. Clone this repo and treat it as your agent workspace.
2. Read the repo's own instructions first (AGENTS.md, README, package scripts, tests, and deployment notes if present).
3. Keep this prompt structure repo-agnostic: for another project, only REPO_URL and PeopleClaw app credentials should change.

GitHub authentication note:
- Plain git clone does not require any PeopleClaw environment variables when the repo is public or this runner already has GitHub authentication.
- PEOPLECLAW_* variables are for PeopleClaw API actions only; they are not required for plain git clone.
- If the repo is private and clone fails, stop and ask the operator to connect or authenticate GitHub separately. Do not try to recover credentials from logs, shell history, or committed files.

PeopleClaw configuration for API actions:
\`\`\`bash
export PEOPLECLAW_BASE_URL=${shellQuote(baseUrl)}
export PEOPLECLAW_API_KEY=${shellQuote(token)}
export PEOPLECLAW_APP_ID=${shellQuote(input.appId)}
\`\`\`

Initial verification commands:
\`\`\`bash
npm install -g @peopleclaw/cli
peopleclaw whoami
peopleclaw apps list
peopleclaw app inspect "$PEOPLECLAW_APP_ID"
\`\`\`

Safe process for every change:
1. Confirm the cloned repo and PeopleClaw app scope before editing.
2. Inspect the app before any PeopleClaw mutation.
3. Use dry-run first for PeopleClaw chat/actions.
4. Only pass --confirm after the operator explicitly approves the exact intended change.
5. Use the repo's normal test/build checks before committing or reporting completion.
6. If you hit 401/403/404, clone/auth errors, or missing permissions, stop and report the exact error instead of trying another channel.

Guardrails:
- Use only the PeopleClaw CLI/API for PeopleClaw operations; do not script the admin UI.
- Do not read secrets, run raw SQL, write migrations, or attempt cross-tenant access.
- Never log, echo, or commit PEOPLECLAW_API_KEY, GitHub tokens, or private keys.`;
}

export function buildCodexOnboardingPrompt(input: ExternalAgentSeedPromptInput): string {
  return buildExternalAgentSeedPrompt(input);
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

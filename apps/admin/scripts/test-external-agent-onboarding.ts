import assert from 'node:assert/strict';
import {
  EXTERNAL_AGENT_ONBOARDING_SCOPES,
  buildCodexOnboardingPrompt,
  buildExternalAgentSeedPrompt,
  buildPeopleClawCliConfig,
  normalizeBaseUrl,
} from '../src/client/lib/externalAgentOnboarding.ts';

assert.deepEqual(EXTERNAL_AGENT_ONBOARDING_SCOPES, [
  'agent:read',
  'app:read',
  'app:write',
  'component:read',
  'component:write',
  'component:run',
]);

assert.equal(normalizeBaseUrl('https://app.peopleclaw.rollersoft.com.au///'), 'https://app.peopleclaw.rollersoft.com.au');

const withoutToken = buildPeopleClawCliConfig({
  baseUrl: 'https://app.peopleclaw.rollersoft.com.au/',
  appId: 'app_123',
});
assert.match(withoutToken, /PEOPLECLAW_API_KEY='<CREATE_A_KEY_ON_THIS_PAGE_FIRST>'/);
assert.match(withoutToken, /PEOPLECLAW_APP_ID='app_123'/);
assert.match(withoutToken, /peopleclaw|@peopleclaw\/cli/);

const token = 'pc_m2m_test_token_once';
const withToken = buildCodexOnboardingPrompt({
  baseUrl: 'https://app.peopleclaw.rollersoft.com.au',
  appId: 'app_123',
  appName: 'Customer Portal',
  repositoryUrl: 'https://github.com/acme/customer-portal.git',
  token,
});
assert.match(withToken, /Customer Portal/);
assert.match(withToken, /REPO_URL=https:\/\/github\.com\/acme\/customer-portal\.git/);
assert.match(withToken, /Clone this repo and treat it as your agent workspace/);
assert.match(withToken, /peopleclaw whoami/);
assert.match(withToken, /dry-run first/i);
assert.match(withToken, /--confirm/);
assert.match(withToken, new RegExp(token));
assert.match(withToken, /Plain git clone does not require any PeopleClaw environment variables/i);
assert.match(withToken, /private and clone fails.*authenticate GitHub separately/i);
assert.match(withToken, /PEOPLECLAW_\* variables are for PeopleClaw API actions only/i);
assert.doesNotMatch(withToken, /raw SQL.*allowed/i);
assert.doesNotMatch(withToken, /use Codex/i);

const genericPrompt = buildExternalAgentSeedPrompt({
  baseUrl: 'https://app.peopleclaw.rollersoft.com.au',
  appId: 'app_123',
});
assert.match(genericPrompt, /REPO_URL=<REPO_URL>/);
assert.doesNotMatch(genericPrompt, /PCV_BROKER_URL|PCV_TOKEN|pcv/i);
assert.match(genericPrompt, /only REPO_URL and PeopleClaw app credentials should change/);

console.log('[test-external-agent-onboarding] ok');

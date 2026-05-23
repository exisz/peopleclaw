import assert from 'node:assert/strict';
import {
  EXTERNAL_AGENT_ONBOARDING_SCOPES,
  buildCodexOnboardingPrompt,
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
  token,
});
assert.match(withToken, /Customer Portal/);
assert.match(withToken, /peopleclaw whoami/);
assert.match(withToken, /dry-run first/i);
assert.match(withToken, /--confirm/);
assert.match(withToken, new RegExp(token));
assert.doesNotMatch(withToken, /raw SQL.*allowed/i);

console.log('[test-external-agent-onboarding] ok');

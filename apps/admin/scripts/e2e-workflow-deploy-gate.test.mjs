import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../../../.github/workflows/e2e.yml', import.meta.url), 'utf8');

describe('E2E workflow deploy freshness gate', () => {
  it('TC-PC-091 proves prod E2E waits for latest Vercel deploy before testing', () => {
    const waitStep = workflow.indexOf('- name: Wait for Vercel deploy (SHA gate)');
    const runStep = workflow.indexOf('- name: Run e2e tests');

    assert.notEqual(waitStep, -1, 'workflow must include a Vercel SHA wait gate');
    assert.notEqual(runStep, -1, 'workflow must include the Playwright run step');
    assert.ok(waitStep < runStep, 'deploy freshness gate must run before Playwright tests');

    const waitBlock = workflow.slice(waitStep, runStep);
    assert.match(waitBlock, /EXPECTED_SHA="\$\{\{ github\.sha \}\}"/);
    assert.match(waitBlock, /\$PLAYWRIGHT_BASE_URL\/api\/health/);
    assert.match(waitBlock, /BODY_SHA=.*\.build\.sha/);
    assert.match(waitBlock, /HDR_SHA=.*x-build-sha/);
    assert.match(waitBlock, /exit 1/, 'stale deploy timeout must fail instead of running tests anyway');
    assert.match(waitBlock, /NOT running tests against stale prod/);
  });
});

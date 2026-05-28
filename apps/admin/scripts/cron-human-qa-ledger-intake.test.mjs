import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const ENTRYPOINT = process.env.PEOPLECLAW_CRON_ENTRYPOINT
  ?? '/Users/c/.openclaw/workspaces/planetbuild/CRON_ENTRYPOINT_PEOPLECLAW.md';

const body = readFileSync(ENTRYPOINT, 'utf8');

describe('PeopleClaw cron human QA complaint intake contract', () => {
  it('TC-PC-130 proves fresh human QA complaints become ledger tests before READY', () => {
    assert.match(body, /Check recent human QA complaints \/ active PeopleClaw bug tickets as test sources/,
      'completion audit must treat human QA complaints and active bug tickets as test sources');
    assert.match(body, /If a human just found a visible issue, create a regression test even if the ledger is green/,
      'fresh visible user-reported issues must create regression tests even when deterministic gates are green');
    assert.match(body, /lazyjira issues read PLANET-2197[\s\S]*lazyjira issues read PLANET-2200[\s\S]*lazyjira issues read PLANET-2203/,
      'audit must read recent known PeopleClaw QA tickets before claiming completion');
    assert.match(body, /TODO placeholders\/fake success/,
      'visible TODO/fake-success complaints must stay in the legacy/non-spec sweep');
    assert.match(body, /reported by human QA without a regression test/,
      'READY verdict must be blocked by human QA complaints that lack regression coverage');
    assert.match(body, /at least 10 meaningful new tests were created\/recorded/,
      'NOT_READY verdict must confirm new tests were recorded for discovered QA coverage gaps');
    assert.match(body, /Do not say there is “nothing to do”/,
      'human QA gap path must not collapse into a misleading no-work response');
  });
});

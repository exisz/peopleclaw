import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const ENTRYPOINT = process.env.PEOPLECLAW_CRON_ENTRYPOINT
  ?? '/Users/c/.openclaw/workspaces/planetbuild/CRON_ENTRYPOINT_PEOPLECLAW.md';
const LEDGER = process.env.PEOPLECLAW_TEST_LEDGER
  ?? '/Users/c/.openclaw/workspaces/planetbuild/projects/peopleclaw/test_cases.yaml';

describe('PeopleClaw QA-status tickets remain active regression sources', () => {
  it('TC-PC-140 maps PLANET-2197/2200/2203 to regression tests and contradiction follow-ups', () => {
    const cron = readFileSync(ENTRYPOINT, 'utf8');
    const ledger = readFileSync(LEDGER, 'utf8');
    const noPendingAudit = cron.slice(
      cron.indexOf('## Step 1B — Qualitative spec coverage audit'),
      cron.indexOf('## Step 2 — Prepare repos once'),
    );

    assert.match(noPendingAudit, /lazyjira issues read PLANET-2197[\s\S]*lazyjira issues read PLANET-2200[\s\S]*lazyjira issues read PLANET-2203/,
      'completion audit must read the known recent QA-status Jira tickets');
    assert.match(noPendingAudit, /map PLANET-2197, PLANET-2200, and PLANET-2203 to current regression test IDs/i,
      'audit matrix must map each QA ticket to active regression tests');
    assert.match(noPendingAudit, /add follow-up tests when source\/prod evidence contradicts prior QA claims/i,
      'audit must create new follow-up tests if evidence contradicts previous QA claims');
    assert.match(noPendingAudit, /reported by human QA without a regression test/,
      'READY must be blocked by human QA complaints that lack regression coverage');

    for (const id of ['TC-PC-130', 'TC-PC-137', 'TC-PC-138', 'TC-PC-139', 'TC-PC-140']) {
      assert.match(ledger, new RegExp(`- id: ${id}[\\s\\S]*source: 2026-05-29 qualitative completion audit; production/source forbidden residue and recent human QA sweep`),
        `${id} must stay traceable to the recent human QA/source-prod sweep`);
    }
  });
});

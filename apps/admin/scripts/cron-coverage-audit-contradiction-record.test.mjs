import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const ENTRYPOINT = process.env.PEOPLECLAW_CRON_ENTRYPOINT
  ?? '/Users/c/.openclaw/workspaces/planetbuild/CRON_ENTRYPOINT_PEOPLECLAW.md';

describe('PeopleClaw no-pending coverage audit contradiction record', () => {
  it('TC-PC-139 proves source/prod sweep contradictions are persisted before READY', () => {
    const body = readFileSync(ENTRYPOINT, 'utf8');
    const noPendingAudit = body.slice(
      body.indexOf('## Step 1B — Qualitative spec coverage audit'),
      body.indexOf('## Step 2 — Prepare repos once'),
    );

    assert.match(noPendingAudit, /Write the audit matrix to `projects\/peopleclaw\/coverage_audits\/YYYYMMDDTHHMMSSZ\.md`/,
      'no-pending audit must persist a timestamped audit matrix');
    assert.match(noPendingAudit, /source\/prod sweep contradictions must be copied into the audit matrix/i,
      'source/prod sweep contradictions must be recorded, not just read transiently');
    assert.match(noPendingAudit, /exact source file paths and production asset names/i,
      'audit matrix must include exact source file paths and production asset names');
    assert.match(noPendingAudit, /next sequential `TC-PC-\*` IDs/i,
      'audit matrix must list the next regression test IDs created for contradictions');
    assert.match(noPendingAudit, /Final `READY` is allowed only if deterministic preflight passed, source\/prod\/Jira sweep found no contradictions/,
      'READY must be blocked by any sweep contradiction');
    assert.match(noPendingAudit, /PeopleClaw completion audit NOT_READY: deterministic gates passed, but qualitative spec coverage found gaps\./,
      'contradiction path must use the NOT_READY qualitative gap verdict');
  });
});

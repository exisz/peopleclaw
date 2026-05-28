import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const ENTRYPOINT = process.env.PEOPLECLAW_CRON_ENTRYPOINT
  ?? '/Users/c/.openclaw/workspaces/planetbuild/CRON_ENTRYPOINT_PEOPLECLAW.md';

const body = readFileSync(ENTRYPOINT, 'utf8');

describe('PeopleClaw no-work cron organic gap expansion contract', () => {
  it('TC-PC-128 proves no-pending cron creates new tests for organic audit gaps instead of reporting no work', () => {
    assert.match(body, /If `pending_count 0`/,
      'cron must have an explicit no-pending branch instead of stopping at no actionable tests');
    assert.match(body, /Step 1A — Deterministic completion preflight/,
      'no-pending branch must first run deterministic preflight');
    assert.match(body, /Step 1B — Qualitative spec coverage audit/,
      'no-pending branch must continue into qualitative organic spec audit');
    assert.match(body, /do not write a final reply that says no gaps while known gaps remain/i,
      'cron must not claim completion while known audit gaps exist');
    assert.match(body, /create or record \*\*at least 10 meaningful new test cases immediately\*\*/,
      'cron must append at least ten meaningful tests when qualitative gaps are found');
    assert.match(body, /Use the next sequential IDs after the current highest `TC-PC-\*`/,
      'new gap tests must be sequentially appended to the fixed ledger');
    assert.match(body, /PeopleClaw completion audit NOT_READY: deterministic gates passed, but qualitative spec coverage found gaps\./,
      'gap path must report NOT_READY, not no actionable test cases');

    const noPendingBlock = body.slice(
      body.indexOf('If `pending_count 0`'),
      body.indexOf('## Step 2 — Prepare repos once'),
    );
    assert.doesNotMatch(noPendingBlock, /final(?:-| )?report[^\n]*no actionable test cases/i,
      'no-pending completion path must not final-report the misleading no-actionable wording');
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';

const ENTRYPOINT = process.env.PEOPLECLAW_CRON_ENTRYPOINT
  ?? '/Users/c/.openclaw/workspaces/planetbuild/CRON_ENTRYPOINT_PEOPLECLAW.md';

const body = readFileSync(ENTRYPOINT, 'utf8');

describe('PeopleClaw cron Discord progress report contract', () => {
  it('TC-PC-100 proves cron launcher reports concise progress to Discord thread', () => {
    assert.match(body, /## Step 6 — Final reply/);
    assert.match(body, /Run counter and whether Royal Delegation Salvage ran/);
    assert.match(body, /Test IDs handled in this run/);
    assert.match(body, /Files changed/);
    assert.match(body, /Validation command\/result per test/);
    assert.match(body, /Commit hash\(es\) per test/);
    assert.match(body, /Any blocker/);
    assert.match(body, /Use the message tool if you need to notify the user directly|final plain-text reply will be delivered automatically/s);
  });
});

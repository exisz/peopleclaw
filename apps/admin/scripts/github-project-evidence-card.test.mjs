import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { execFileSync } from 'node:child_process';

const TEST_ID = process.env.PEOPLECLAW_EVIDENCE_TEST_ID ?? 'TC-PC-097';
const EXPECTED_SHA = process.env.PEOPLECLAW_EXPECTED_SHA;

function fetchProjectItems() {
  const raw = execFileSync('gh', ['project', 'item-list', '24', '--owner', 'exisz', '--limit', '200', '--format', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(raw).items ?? [];
}

describe('PeopleClaw GitHub Project card implementation evidence', () => {
  it('TC-PC-097 proves pod opens/updates implementation evidence on card', () => {
    const card = fetchProjectItems().find(item => item.title?.startsWith(`${TEST_ID} `));
    assert.ok(card, `missing GitHub Project card for ${TEST_ID}`);

    const body = card.content?.body ?? '';
    assert.match(body, /Implementation evidence:/, 'card body must include an implementation evidence section');
    assert.match(body, /Validation:/, 'card body must include validation evidence');
    assert.match(body, /PeopleClaw commit:/, 'card body must include PeopleClaw commit evidence');
    if (EXPECTED_SHA) assert.match(body, new RegExp(`PeopleClaw commit:.*${EXPECTED_SHA}`));
  });
});

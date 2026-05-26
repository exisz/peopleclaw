import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const LEDGER = process.env.PEOPLECLAW_TEST_LEDGER
  ?? '/Users/c/.openclaw/workspaces/planetbuild/projects/peopleclaw/test_cases.yaml';

function parseLedgerCards(text) {
  const entries = [];
  const blocks = text.split(/\n(?=- id: TC-PC-\d{3}\n)/g).filter(block => block.startsWith('- id: '));
  for (const block of blocks) {
    const id = block.match(/^- id: (TC-PC-\d{3})/m)?.[1];
    const item = block.match(/^  github_project_item: (\S+)/m)?.[1];
    if (id) entries.push({ id, githubProjectItem: item || '' });
  }
  return entries;
}

function fetchProjectItems() {
  const raw = execFileSync('gh', ['project', 'item-list', '24', '--owner', 'exisz', '--limit', '200', '--format', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(raw).items ?? [];
}

describe('PeopleClaw GitHub Project frozen test coverage', () => {
  it('TC-PC-093 proves GitHub Project contains one card per frozen test case', () => {
    const ledger = parseLedgerCards(readFileSync(LEDGER, 'utf8'));
    assert.equal(ledger.length, 100, 'frozen ledger must contain exactly 100 test cases');

    const ledgerIds = new Set(ledger.map(test => test.id));
    assert.equal(ledgerIds.size, 100, 'frozen ledger test ids must be unique');
    assert.deepEqual(
      ledger.filter(test => !test.githubProjectItem).map(test => test.id),
      [],
      'every frozen test must record its mirrored GitHub Project item id',
    );

    const projectItems = fetchProjectItems();
    const projectCardIds = new Set(projectItems.map(item => item.id));
    assert.deepEqual(
      ledger.filter(test => !projectCardIds.has(test.githubProjectItem)).map(test => `${test.id}:${test.githubProjectItem}`),
      [],
      'each ledger github_project_item must exist in GitHub Project exisz/PeopleClaw',
    );

    const titleToIds = new Map();
    for (const item of projectItems) {
      const id = item.title?.match(/^TC-PC-\d{3}\b/)?.[0]
        ?? item.content?.title?.match(/^TC-PC-\d{3}\b/)?.[0];
      if (!id || !ledgerIds.has(id)) continue;
      titleToIds.set(id, [...(titleToIds.get(id) ?? []), item.id]);
    }

    assert.deepEqual(
      [...ledgerIds].filter(id => (titleToIds.get(id) ?? []).length !== 1),
      [],
      'GitHub Project must expose exactly one visible card for each frozen TC-PC id',
    );
  });
});

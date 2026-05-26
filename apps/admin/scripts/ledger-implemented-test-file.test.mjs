import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';

const LEDGER = process.env.PEOPLECLAW_TEST_LEDGER
  ?? '/Users/c/.openclaw/workspaces/planetbuild/projects/peopleclaw/test_cases.yaml';

function parseTests(text) {
  return text
    .split(/\n(?=- id: TC-PC-\d{3}\n)/g)
    .filter(block => block.startsWith('- id: '))
    .map(block => ({
      id: block.match(/^- id: (TC-PC-\d{3})/m)?.[1],
      status: block.match(/^  status: (\S+)/m)?.[1],
      testFile: block.match(/^  test_file: (.+)$/m)?.[1]?.trim() ?? '',
    }))
    .filter(test => test.id);
}

describe('PeopleClaw frozen ledger implementation evidence', () => {
  it('TC-PC-094 proves implemented tests mark generated test file paths', () => {
    const tests = parseTests(readFileSync(LEDGER, 'utf8'));
    assert.equal(tests.length, 100, 'frozen ledger must contain exactly 100 tests');

    const implemented = tests.filter(test => test.status === 'implemented');
    assert.ok(implemented.length > 0, 'ledger should have implemented test evidence to validate');

    const missing = implemented.filter(test => !test.testFile || test.testFile === 'null').map(test => test.id);
    assert.deepEqual(missing, [], 'implemented tests must record test_file evidence');

    const withoutTestArtifact = implemented
      .filter(test => !/(^|[;/ ]|\/)([^;/ ]+\.test\.[cm]?[jt]sx?|scripts\/[^;/ ]+\.mjs|scripts\/[^;/ ]+\.ts)/.test(test.testFile))
      .map(test => `${test.id}:${test.testFile}`);
    assert.deepEqual(withoutTestArtifact, [], 'implemented tests must include at least one generated automated test/script path');
  });
});

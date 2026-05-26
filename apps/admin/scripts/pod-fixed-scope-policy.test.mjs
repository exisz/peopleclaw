import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const FIXED_SOURCES = new Set(['spec', 'skill', 'test-ledger']);

function isFixedSourceWorkAllowed(request) {
  return request.sources.every(source => FIXED_SOURCES.has(source))
    && /^TC-PC-\d{3}$/.test(request.testId ?? '')
    && request.ledgerStatus !== 'unknown';
}

describe('PeopleClaw fixed-scope pod policy', () => {
  it('TC-PC-096 proves pod refuses work outside fixed spec/skill/test ledger', () => {
    assert.equal(isFixedSourceWorkAllowed({
      testId: 'TC-PC-096',
      ledgerStatus: 'fixed_not_implemented',
      sources: ['spec', 'skill', 'test-ledger'],
    }), true);

    assert.equal(isFixedSourceWorkAllowed({
      testId: 'PLANET-9999',
      ledgerStatus: 'unknown',
      sources: ['jira'],
    }), false, 'Jira-only work is outside the fixed PeopleClaw pod scope');

    assert.equal(isFixedSourceWorkAllowed({
      testId: 'TC-PC-096',
      ledgerStatus: 'fixed_not_implemented',
      sources: ['chat-request-without-ledger'],
    }), false, 'ad hoc requests without fixed ledger/spec/skill backing must be refused');
  });
});

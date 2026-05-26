import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

function selectNextUnimplemented(tests) {
  return tests.find(test => !['implemented', 'blocked'].includes(test.status)) ?? null;
}

describe('PeopleClaw fixed-testcase pod selection', () => {
  it('TC-PC-095 proves pod selects next unimplemented test from ledger', () => {
    const frozenLedgerOrder = [
      { id: 'TC-PC-093', status: 'implemented' },
      { id: 'TC-PC-094', status: 'implemented' },
      { id: 'TC-PC-095', status: 'fixed_not_implemented' },
      { id: 'TC-PC-096', status: 'fixed_not_implemented' },
      { id: 'TC-PC-097', status: 'blocked' },
    ];

    assert.deepEqual(selectNextUnimplemented(frozenLedgerOrder), {
      id: 'TC-PC-095',
      status: 'fixed_not_implemented',
    });

    assert.deepEqual(selectNextUnimplemented([
      { id: 'TC-PC-001', status: 'implemented' },
      { id: 'TC-PC-002', status: 'blocked' },
      { id: 'TC-PC-003', status: 'implemented' },
    ]), null, 'pod must stop when no actionable ledger case remains');
  });
});

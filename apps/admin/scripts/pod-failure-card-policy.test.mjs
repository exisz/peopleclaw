import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

function planFailureEvidence({ testId, hasExistingCard, failureKind }) {
  if (!/^TC-PC-\d{3}$/.test(testId)) throw new Error('fixed test id required');
  if (hasExistingCard) {
    return { action: 'mark-card-blocked', testId, reason: failureKind };
  }
  return { action: 'create-regression-card', testId, reason: failureKind };
}

describe('PeopleClaw pod failed-test evidence policy', () => {
  it('TC-PC-098 proves failed test creates regression card or marks card blocked', () => {
    assert.deepEqual(planFailureEvidence({
      testId: 'TC-PC-098',
      hasExistingCard: true,
      failureKind: 'validation-failed',
    }), {
      action: 'mark-card-blocked',
      testId: 'TC-PC-098',
      reason: 'validation-failed',
    });

    assert.deepEqual(planFailureEvidence({
      testId: 'TC-PC-098',
      hasExistingCard: false,
      failureKind: 'regression-discovered',
    }), {
      action: 'create-regression-card',
      testId: 'TC-PC-098',
      reason: 'regression-discovered',
    });
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderScreenWithShellBoundary } from './screenErrorBoundary';

describe('PeopleClaw screen render boundary', () => {
  it('TC-PC-020 keeps the shell alive when a screen render throws', () => {
    const result = renderScreenWithShellBoundary(() => {
      throw new Error('dashboard widget exploded');
    });

    assert.equal(result.ok, false);
    assert.equal(result.shellAlive, true);
    assert.equal(result.screen, null);
    assert.equal(result.fallback?.title, 'Screen unavailable');
    assert.match(result.fallback?.message ?? '', /shell is still running/);
    assert.match(result.error.message, /dashboard widget exploded/);
  });

  it('returns the rendered screen when no error occurs', () => {
    const result = renderScreenWithShellBoundary(() => ({ screenId: 'screens/Dashboard.tsx' }));

    assert.equal(result.ok, true);
    assert.equal(result.shellAlive, true);
    assert.deepEqual(result.screen, { screenId: 'screens/Dashboard.tsx' });
  });
});

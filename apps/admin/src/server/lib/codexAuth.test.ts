import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CodexAuthUnavailableError, toCodexUserError } from './codexAuth';

describe('Codex chat auth errors', () => {
  it('TC-PC-2200 maps OpenAI Codex refresh failures to a safe user-facing message', () => {
    const raw = new Error('Failed to refresh OpenAI Codex token');
    const msg = toCodexUserError(raw);

    assert.match(msg, /PeopleClaw Chat is temporarily unavailable/);
    assert.match(msg, /server-side Codex login needs to be reconnected/);
    assert.doesNotMatch(msg, /Failed to refresh OpenAI Codex token/);
  });

  it('TC-PC-2200 preserves the friendly message from CodexAuthUnavailableError', () => {
    const err = new CodexAuthUnavailableError('friendly reconnect message', new Error('low-level refresh failed'));
    assert.equal(toCodexUserError(err), 'friendly reconnect message');
    assert.match(err.message, /low-level refresh failed/);
  });
});

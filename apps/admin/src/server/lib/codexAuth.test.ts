import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { CodexAuthUnavailableError, __setCodexAuthTestOverrides, getCodexAccessToken, toCodexUserError } from './codexAuth';

const savedEnv = { ...process.env };

type TestProfile = {
  type: 'oauth';
  provider: 'openai-codex';
  access: string;
  refresh: string;
  expires: number;
  email?: string;
};

function restoreEnv() {
  process.env = { ...savedEnv };
  __setCodexAuthTestOverrides({ durableStore: null });
}

function setProductionEnv(profile: TestProfile) {
  process.env.NODE_ENV = 'production';
  process.env.VERCEL = '1';
  process.env.PEOPLECLAW_CODEX_ACCESS_TOKEN = profile.access;
  process.env.PEOPLECLAW_CODEX_REFRESH_TOKEN = profile.refresh;
  process.env.PEOPLECLAW_CODEX_EXPIRES = String(profile.expires);
  process.env.PEOPLECLAW_CODEX_EMAIL = profile.email ?? 'codex@example.test';
}

function memoryDurableStore(initial: TestProfile | null = null) {
  let profile: TestProfile | null = initial;
  const writes: Array<{ profile: TestProfile; source: string }> = [];
  return {
    get profile() { return profile; },
    get writes() { return writes; },
    store: {
      async read() { return profile; },
      async write(next: TestProfile, source: string) {
        profile = next;
        writes.push({ profile: next, source });
      },
    },
  };
}

afterEach(restoreEnv);

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

  it('TC-PC-2200 redacts low-level token-like strings before showing unexpected auth errors', () => {
    const msg = toCodexUserError(new Error('upstream returned refresh_token=shpca_super_secret_token_value and bearer eyJabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN.abcdefghijklmnop'));

    assert.doesNotMatch(msg, /shpca_super_secret_token_value/);
    assert.doesNotMatch(msg, /eyJabcdefghijklmnopqrstuvwxyz/);
    assert.match(msg, /\[redacted\]/);
  });
});

describe('durable production Codex auth state', () => {
  it('TC-PC-2200 seeds encrypted durable production credential state from env credentials', async () => {
    const envProfile: TestProfile = {
      type: 'oauth',
      provider: 'openai-codex',
      access: 'env-access-token-value',
      refresh: 'env-refresh-token-value',
      expires: Date.now() + 60 * 60 * 1000,
      email: 'codex@example.test',
    };
    setProductionEnv(envProfile);
    const durable = memoryDurableStore();
    __setCodexAuthTestOverrides({ durableStore: durable.store });

    const auth = await getCodexAccessToken();

    assert.equal(auth.accessToken, envProfile.access);
    assert.equal(auth.profileId, 'durable-db');
    assert.equal(durable.writes.length, 1);
    assert.equal(durable.writes[0].source, 'env-bootstrap');
    assert.equal(durable.profile?.refresh, envProfile.refresh);
  });

  it('TC-PC-2200 reuses persisted refreshed credentials instead of stale env refresh tokens on later calls', async () => {
    const staleEnv: TestProfile = {
      type: 'oauth',
      provider: 'openai-codex',
      access: 'stale-env-access-token-value',
      refresh: 'stale-env-refresh-token-value',
      expires: Date.now() - 60_000,
      email: 'codex@example.test',
    };
    const expiredPersisted: TestProfile = {
      type: 'oauth',
      provider: 'openai-codex',
      access: 'old-db-access-token-value',
      refresh: 'old-db-refresh-token-value',
      expires: Date.now() - 60_000,
      email: 'codex@example.test',
    };
    const refreshed: TestProfile = {
      ...expiredPersisted,
      access: 'new-db-access-token-value',
      refresh: 'new-db-refresh-token-value',
      expires: Date.now() + 60 * 60 * 1000,
    };
    setProductionEnv(staleEnv);
    const durable = memoryDurableStore(expiredPersisted);
    const refreshInputs: string[] = [];
    __setCodexAuthTestOverrides({
      durableStore: durable.store,
      refreshTokenFn: async (refreshToken) => {
        refreshInputs.push(refreshToken);
        return refreshed;
      },
    });

    const first = await getCodexAccessToken();
    const second = await getCodexAccessToken();

    assert.equal(first.accessToken, refreshed.access);
    assert.equal(second.accessToken, refreshed.access);
    assert.deepEqual(refreshInputs, [expiredPersisted.refresh]);
    assert.equal(durable.profile?.refresh, refreshed.refresh);
    assert.notEqual(durable.profile?.refresh, staleEnv.refresh);
  });
});

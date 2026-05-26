import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertCliSecretPayloadDoesNotExposePlaintext, buildCliSecretReference, formatCliSecretReferenceList } from './secret-policy';

describe('PeopleClaw CLI secret policy', () => {
  it('TC-PC-054 proves CLI can reference secret names but cannot read plaintext', () => {
    assert.deepEqual(buildCliSecretReference('SHOPIFY_API_TOKEN'), { ref: 'SHOPIFY_API_TOKEN' });
    assert.deepEqual(formatCliSecretReferenceList(['SHOPIFY_API_TOKEN', 'STRIPE_KEY']), [
      { ref: 'SHOPIFY_API_TOKEN' },
      { ref: 'STRIPE_KEY' },
    ]);

    assert.doesNotThrow(() => assertCliSecretPayloadDoesNotExposePlaintext({ keys: ['SHOPIFY_API_TOKEN'], refs: [{ ref: 'SHOPIFY_API_TOKEN' }] }));
    assert.throws(
      () => assertCliSecretPayloadDoesNotExposePlaintext({ key: 'SHOPIFY_API_TOKEN', value: 'shpat_plaintext_secret' }),
      /must not expose plaintext field: value/,
    );
  });
});

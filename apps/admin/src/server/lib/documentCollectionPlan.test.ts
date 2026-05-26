import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planDocumentCollectionDefinition } from './documentCollectionPlan';

describe('PeopleClaw managed document collection planning', () => {
  it('TC-PC-031 proves collection definition creates document collection', () => {
    const plan = planDocumentCollectionDefinition({
      name: 'leads',
      version: 1,
      fields: {
        name: { type: 'string', required: true },
        email: { type: 'string' },
        score: { type: 'number', default: 0 },
      },
    });

    assert.deepEqual(plan, {
      operation: 'create_collection',
      collection: 'leads',
      version: 1,
      fields: {
        name: { type: 'string', required: true },
        email: { type: 'string' },
        score: { type: 'number', default: 0 },
      },
    });
  });

  it('TC-PC-032 proves raw SQL field is rejected', () => {
    assert.throws(() => planDocumentCollectionDefinition({
      name: 'leads',
      version: 1,
      fields: {
        searchText: { type: 'string', rawSql: 'generated always as (...)' } as never,
      },
    }), /must not include raw SQL/);
  });
});

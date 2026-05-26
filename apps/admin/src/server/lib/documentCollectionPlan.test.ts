import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  planCompatibleCollectionSchemaChange,
  planDocumentBackfillOperation,
  planDocumentCollectionDefinition,
  planDocumentIndexDeclaration,
  planDocumentSeedOperation,
  recordDocumentBackfillProgress,
  resumeDocumentBackfillFromCheckpoint,
} from './documentCollectionPlan';

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

  it('TC-PC-034 proves index declaration creates planned index record', () => {
    const plan = planDocumentIndexDeclaration({
      collection: 'leads',
      name: 'leads_email_unique',
      fields: ['email'],
      unique: true,
    });

    assert.deepEqual(plan, {
      operation: 'create_index',
      collection: 'leads',
      name: 'leads_email_unique',
      fields: ['email'],
      unique: true,
    });
  });

  it('TC-PC-035 proves seed op is idempotent by key', () => {
    const firstPlan = planDocumentSeedOperation({
      collection: 'crm_statuses',
      key: 'status:new',
      document: { label: 'New', color: 'blue' },
    });
    const secondPlan = planDocumentSeedOperation({
      collection: 'crm_statuses',
      key: 'status:new',
      document: { label: 'New', color: 'blue' },
    });

    assert.deepEqual(firstPlan, secondPlan);
    assert.deepEqual(firstPlan, {
      operation: 'seed_document',
      collection: 'crm_statuses',
      key: 'status:new',
      mode: 'upsert_by_key',
      document: { label: 'New', color: 'blue' },
    });
  });

  it('TC-PC-036 proves schema version increments on compatible change', () => {
    const plan = planCompatibleCollectionSchemaChange(
      {
        name: 'leads',
        version: 1,
        fields: { email: { type: 'string', required: true } },
      },
      {
        name: 'leads',
        version: 2,
        fields: {
          email: { type: 'string', required: true },
          score: { type: 'number', default: 0 },
        },
      },
    );

    assert.deepEqual(plan, {
      operation: 'update_collection_schema',
      collection: 'leads',
      fromVersion: 1,
      toVersion: 2,
      compatibility: 'compatible',
      addedFields: { score: { type: 'number', default: 0 } },
    });

    assert.throws(() => planCompatibleCollectionSchemaChange(
      { name: 'leads', version: 1, fields: { email: { type: 'string', required: true } } },
      { name: 'leads', version: 3, fields: { email: { type: 'string', required: true }, score: { type: 'number', default: 0 } } },
    ), /increment version by exactly one/);
  });

  it('TC-PC-037 proves required field without default is dangerous change', () => {
    assert.throws(() => planCompatibleCollectionSchemaChange(
      { name: 'leads', version: 1, fields: { email: { type: 'string', required: true } } },
      {
        name: 'leads',
        version: 2,
        fields: {
          email: { type: 'string', required: true },
          ownerId: { type: 'string', required: true },
        },
      },
    ), /ownerId requires a default for compatible schema change/);
  });

  it('TC-PC-038 proves backfill is chunked not run inline in deploy', () => {
    const plan = planDocumentBackfillOperation({
      collection: 'leads',
      field: 'normalizedEmail',
      batchSize: 250,
    });

    assert.deepEqual(plan, {
      operation: 'schedule_backfill',
      collection: 'leads',
      field: 'normalizedEmail',
      execution: 'deferred_worker',
      batchSize: 250,
      runInlineDuringDeploy: false,
    });
  });

  it('TC-PC-039 proves backfill can resume after worker restart', () => {
    const checkpoint = recordDocumentBackfillProgress(
      { collection: 'leads', field: 'normalizedEmail' },
      'lead_250',
      250,
    );

    assert.deepEqual(resumeDocumentBackfillFromCheckpoint(checkpoint), {
      collection: 'leads',
      field: 'normalizedEmail',
      lastDocumentKey: 'lead_250',
      processedCount: 250,
    });
  });
});

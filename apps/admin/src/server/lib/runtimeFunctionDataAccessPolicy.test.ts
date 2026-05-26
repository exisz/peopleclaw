import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { authorizeRuntimeFunctionDataQuery, validateRuntimeFunctionDataAccess } from './runtimeFunctionDataAccessPolicy';

describe('PeopleClaw runtime function data access policy', () => {
  it('TC-PC-028 proves function calls Data API through SDK only', () => {
    const accepted = validateRuntimeFunctionDataAccess(`
      export async function createLead(input, ctx) {
        return ctx.data.collection('leads').create({
          name: input.name,
          email: input.email,
        });
      }
    `);

    assert.deepEqual(accepted, { ok: true, errors: [] });

    const rejected = validateRuntimeFunctionDataAccess(`
      import { PrismaClient } from '@prisma/client';
      const prisma = new PrismaClient();
      export async function createLead(input) {
        return prisma.lead.create({ data: input });
      }
    `);

    assert.equal(rejected.ok, false);
    assert.match(rejected.errors.join('\n'), /must not use Prisma/);
    assert.match(rejected.errors.join('\n'), /Data API SDK/);
  });

  it('TC-PC-052 proves tenant A function cannot query tenant B data', () => {
    const runtimeScope = { tenantId: 'tenant-a', appId: 'crm-a', collection: 'contacts' };

    const sameTenant = authorizeRuntimeFunctionDataQuery({
      runtimeScope,
      requestedScope: { tenantId: 'tenant-a', appId: 'crm-a', collection: 'contacts' },
    });
    const crossTenant = authorizeRuntimeFunctionDataQuery({
      runtimeScope,
      requestedScope: { tenantId: 'tenant-b', appId: 'crm-b', collection: 'contacts' },
    });

    assert.deepEqual(sameTenant, { ok: true, errors: [] });
    assert.equal(crossTenant.ok, false);
    assert.match(crossTenant.errors.join('\n'), /tenant scope mismatch/);
    assert.match(crossTenant.errors.join('\n'), /app scope mismatch/);
  });
});

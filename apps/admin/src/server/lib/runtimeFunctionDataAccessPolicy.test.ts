import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateRuntimeFunctionDataAccess } from './runtimeFunctionDataAccessPolicy';

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
});

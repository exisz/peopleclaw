import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateScreenImports } from './screenImportPolicy';

describe('PeopleClaw screen import policy', () => {
  it('TC-PC-017 rejects screen source that imports platform internals', () => {
    const result = validateScreenImports(`
      import { getPrisma } from '../../server/lib/prisma';
      export default function Dashboard() { return <main />; }
    `);

    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /must not import PeopleClaw platform internals/);
  });
});

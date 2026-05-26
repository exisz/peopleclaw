import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateDataPlaybookCommand } from './dataPlaybookPolicy';

describe('PeopleClaw data playbook command policy', () => {
  it('TC-PC-033 proves raw migration command is rejected', () => {
    assert.deepEqual(validateDataPlaybookCommand('collection leads addField score number default 0'), {
      ok: true,
      errors: [],
    });

    const prismaMigration = validateDataPlaybookCommand('prisma migrate deploy');
    assert.equal(prismaMigration.ok, false);
    assert.match(prismaMigration.errors.join('\n'), /raw migration commands/);

    const ddlMigration = validateDataPlaybookCommand('ALTER TABLE leads ADD COLUMN score INTEGER');
    assert.equal(ddlMigration.ok, false);
    assert.match(ddlMigration.errors.join('\n'), /raw migration commands/);
  });
});

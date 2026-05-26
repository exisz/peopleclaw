import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const packageRoot = new URL('..', import.meta.url);
const templatesDir = new URL('templates/', packageRoot);

describe('PeopleClaw external-agent skill package', () => {
  it('TC-PC-080 proves skill instructions fit in one lightweight file', async () => {
    const templateNames = await readdir(templatesDir);
    const skillFiles = templateNames.filter(name => name.toLowerCase() === 'skill.md');
    assert.deepEqual(skillFiles, ['SKILL.md']);

    const skillText = await readFile(join(templatesDir.pathname, 'SKILL.md'), 'utf8');
    assert.ok(skillText.length <= 4_000, `SKILL.md should stay lightweight; got ${skillText.length} chars`);
    assert.match(skillText, /Open `AGENTS\.md` in this repo\. It is the contract/);
    assert.doesNotMatch(skillText, /## Full platform manual|## API reference|## Database schema/i);
  });
});

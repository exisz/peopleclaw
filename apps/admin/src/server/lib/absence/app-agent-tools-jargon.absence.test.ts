import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { appAgentTools } from '../appAgentTools';

const forbiddenStorageTypeWords = /\b(?:FRONTEND|BACKEND|FULLSTACK)\b/;

describe('TC-PC-153 appAgentTools public schema wording', () => {
  it('keeps internal component storage types out of public schemas, descriptions, and qualitative source sweep findings', () => {
    const source = readFileSync(new URL('../appAgentTools.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(source, forbiddenStorageTypeWords);

    const publicSchemaText = JSON.stringify(appAgentTools, null, 2);
    assert.doesNotMatch(publicSchemaText, forbiddenStorageTypeWords);
    assert.match(publicSchemaText, /page|module|app part/);
  });
});

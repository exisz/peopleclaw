import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('Component detail runtime contract', () => {
  it('TC-PC-2201 does not send BACKEND connector components through the frontend/fullstack compile preview path', () => {
    const source = readFileSync(new URL('./ComponentDetail.tsx', import.meta.url), 'utf8');
    assert.match(source, /component\.type === 'BACKEND'/);
    assert.match(source, /BackendRunPanel/);
    assert.match(source, /Backend\/connector components run server-side/);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { userFacingAppName } from './userFacingLanguage';

const forbidden = [
  /\bComponent\b/i,
  /\bModule\b/i,
  /\bFULLSTACK\b/,
  /\bFRONTEND\b/,
  /\bBACKEND\b/,
  /exported component/i,
  /\bprobe\b/i,
  /\bgraph\b/i,
  /\bcanvas\b/i,
  /\bworkflow\b/i,
];

describe('TC-PC-124 user-facing app language', () => {
  it('hides internal app-building terms from non-technical app names', () => {
    const visible = userFacingAppName('AI Canvas Test App Component Module FULLSTACK FRONTEND BACKEND exported component probe graph workflow');
    const violations = forbidden.filter(pattern => pattern.test(visible)).map(String);

    assert.deepEqual(violations, []);
    assert.equal(visible.includes('App'), true);
  });
});

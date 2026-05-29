import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { UNSUPPORTED_COMPILE_COMPONENT_ERROR } from '../compile';

describe('TC-PC-136 component compile public API errors', () => {
  it('uses user-safe wording instead of raw component runtime type jargon', () => {
    const forbidden = [/Component is not FULLSTACK or FRONTEND type/, /FULLSTACK/, /FRONTEND/];

    for (const pattern of forbidden) {
      assert.doesNotMatch(UNSUPPORTED_COMPILE_COMPONENT_ERROR, pattern);
    }
    assert.match(UNSUPPORTED_COMPILE_COMPONENT_ERROR, /app part|browser preview/i);

    const routeSource = readFileSync(new URL('../compile.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(routeSource, /error:\s*['"]Component is not FULLSTACK or FRONTEND type['"]/);
  });
});

describe('TC-PC-145 component route/public wording guardrails', () => {
  it('keeps legacy component type jargon out of route comments, public errors, and docs', () => {
    const forbiddenPublicWording = [
      /Component is not FULLSTACK or FRONTEND type/,
      /\bFULLSTACK\b/,
      /\bFRONTEND\b/,
      /\bBACKEND\b/,
    ];

    const routeFiles = [
      'compile.ts',
      'client.ts',
      'server.ts',
      'detail.ts',
      'run.ts',
    ];
    const publicText = [UNSUPPORTED_COMPILE_COMPONENT_ERROR];

    for (const file of routeFiles) {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      const commentAndResponseLines = source
        .split('\n')
        .filter((line) => /\/\/|res\.(?:status\([^)]*\)\.)?(?:json|send)\(/.test(line))
        .filter((line) => !line.includes('component.type')); // enum guards are internal, not public wording
      publicText.push(commentAndResponseLines.join('\n'));
    }

    publicText.push(readFileSync(new URL('../../../../../README.md', import.meta.url), 'utf8'));

    for (const text of publicText) {
      for (const pattern of forbiddenPublicWording) {
        assert.doesNotMatch(text, pattern);
      }
    }
  });
});


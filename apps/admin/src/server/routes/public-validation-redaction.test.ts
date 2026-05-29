import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { INVALID_APP_AGENT_COMPONENT_TYPE_ERROR } from '../lib/appAgentTools';
import { INVALID_COMPONENT_TYPE_ERROR } from './apps';
import { UNSUPPORTED_COMPILE_COMPONENT_ERROR } from './components/compile';

const FORBIDDEN_PUBLIC_TYPE_VALUES = /\b(?:FRONTEND|BACKEND|FULLSTACK)\b/;

describe('TC-PC-143 public component API validation redaction', () => {
  it('redacts internal component type values from client-visible validation errors', () => {
    const publicErrors = [
      INVALID_COMPONENT_TYPE_ERROR,
      INVALID_APP_AGENT_COMPONENT_TYPE_ERROR,
      UNSUPPORTED_COMPILE_COMPONENT_ERROR,
    ];

    for (const error of publicErrors) {
      assert.doesNotMatch(error, FORBIDDEN_PUBLIC_TYPE_VALUES, `${error} must not expose internal component type values`);
      assert.match(error, /app part|page|module|component|browser preview/i);
    }

    const appsRouteSource = readFileSync(new URL('./apps.ts', import.meta.url), 'utf8');
    const agentToolSource = readFileSync(new URL('../lib/appAgentTools.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(appsRouteSource, /error:\s*['"][^'"]*(?:FRONTEND|BACKEND|FULLSTACK)[^'"]*['"]/);
    assert.doesNotMatch(agentToolSource, /throw new Error\(['"][^'"]*(?:FRONTEND|BACKEND|FULLSTACK)[^'"]*['"]\)/);
  });
});

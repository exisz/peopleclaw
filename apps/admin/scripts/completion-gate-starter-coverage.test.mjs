import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const gatePath = '/Users/c/.openclaw/workspaces/planetbuild/projects/peopleclaw/completion_gate.py';

describe('PeopleClaw completion gate starter coverage', () => {
  it('TC-PC-111 reports a meaningful Shopify starter deployment regression gate', () => {
    const gate = readFileSync(gatePath, 'utf8');
    assert.match(gate, /starter-app\.test\.ts/, 'completion gate must run starter-app deployment/template coverage');
    assert.match(gate, /pnpm', '--filter', '@peopleclaw\/admin', 'exec', 'tsx', '--test'/, 'coverage must be a real admin test command');
    assert.match(gate, /starter code coverage gates/, 'completion coverage matrix must keep the starter coverage obligation visible');
    assert.doesNotMatch(gate, /starter deploy.*TODO|fake success/i, 'coverage gate must not be placeholder-only');
  });
});

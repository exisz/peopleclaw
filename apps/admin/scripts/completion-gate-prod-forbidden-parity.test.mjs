import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const ENTRYPOINT = process.env.PEOPLECLAW_CRON_ENTRYPOINT
  ?? '/Users/c/.openclaw/workspaces/planetbuild/CRON_ENTRYPOINT_PEOPLECLAW.md';
const COMPLETION_GATE = process.env.PEOPLECLAW_COMPLETION_GATE
  ?? '/Users/c/.openclaw/workspaces/planetbuild/projects/peopleclaw/completion_gate.py';

function parseSingleQuotedPythonList(source, prefixPattern) {
  const match = source.match(prefixPattern);
  assert.ok(match, `missing Python list for ${prefixPattern}`);
  return [...match[1].matchAll(/'([^']*)'/g)].map((item) => item[1]);
}

describe('PeopleClaw completion gate prod forbidden sweep parity', () => {
  it('TC-PC-138 keeps completion_gate.py prod bundle scan in sync with the cron qualitative sweep', () => {
    const cron = readFileSync(ENTRYPOINT, 'utf8');
    const gate = readFileSync(COMPLETION_GATE, 'utf8');

    const cronForbidden = parseSingleQuotedPythonList(cron, /forbidden=\[([\s\S]*?)\]/);
    const gateForbidden = parseSingleQuotedPythonList(gate, /PROD_FORBIDDEN_BUNDLE_PATTERNS = \[([\s\S]*?)\]/);

    for (const required of ['canvas', 'Canvas', 'FULLSTACK', 'FRONTEND', 'BACKEND']) {
      assert.ok(gateForbidden.includes(required), `completion_gate.py must scan for ${required}`);
    }

    assert.deepEqual(
      gateForbidden,
      cronForbidden,
      'completion_gate.py prod bundle forbidden patterns must match the cron qualitative prod sweep exactly',
    );
    assert.match(gate, /prod bundle forbidden-string scan/, 'completion gate must expose the prod bundle scan as a named deterministic gate');
  });
});

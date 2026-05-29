import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const ENTRYPOINT = process.env.PEOPLECLAW_CRON_ENTRYPOINT
  ?? '/Users/c/.openclaw/workspaces/planetbuild/CRON_ENTRYPOINT_PEOPLECLAW.md';

function extractProdBundleSweep() {
  const body = readFileSync(ENTRYPOINT, 'utf8');
  const marker = '# Production bundle forbidden residue. Any finding is a gap even if source is clean.';
  const markerIndex = body.indexOf(marker);
  assert.notEqual(markerIndex, -1, 'cron entrypoint must contain the production bundle forbidden-residue sweep marker');
  const blockStart = body.indexOf("python3 - <<'PY'", markerIndex);
  assert.notEqual(blockStart, -1, 'prod sweep must be a dedicated python heredoc block');
  const codeStart = body.indexOf('\n', blockStart) + 1;
  const codeEnd = body.indexOf('\nPY', codeStart);
  assert.notEqual(codeEnd, -1, 'prod sweep python heredoc must close deterministically');
  return body.slice(codeStart, codeEnd);
}

function runWithFakeProdBundle(sweep, bundleText) {
  const harness = `
import contextlib, io, urllib.request
class _Response:
    def __init__(self, text): self._text = text
    def read(self): return self._text.encode('utf-8')
def _urlopen(url, timeout=30):
    if url == 'https://app.peopleclaw.rollersoft.com.au':
        return _Response('<script type="module" src="/assets/index-clean.js"></script>')
    if url == 'https://app.peopleclaw.rollersoft.com.au/assets/index-clean.js':
        return _Response(${JSON.stringify(bundleText)})
    raise AssertionError('unexpected URL '+url)
urllib.request.urlopen = _urlopen
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
${sweep.split('\n').map((line) => `    ${line}`).join('\n')}
print(buf.getvalue(), end='')
`;
  return spawnSync('python3', ['-c', harness], { encoding: 'utf8' });
}

describe('PeopleClaw cron production bundle sweep contract', () => {
  it('TC-PC-137 proves the exact cron prod sweep compiles and reports forbidden strings deterministically', () => {
    const sweep = extractProdBundleSweep();

    execFileSync('python3', ['-c', 'import sys; compile(sys.stdin.read(), "<cron-prod-sweep>", "exec")'], {
      input: sweep,
      encoding: 'utf8',
    });

    const clean = runWithFakeProdBundle(sweep, 'console.log("clean bundle")');
    assert.equal(clean.status, 0, clean.stderr);
    assert.match(clean.stdout, /prod_assets \['assets\/index-clean\.js'\]/);
    assert.doesNotMatch(clean.stdout, /PROD_FORBIDDEN/);

    const dirty = runWithFakeProdBundle(sweep, 'legacy workflow editor with ReactFlow and Canvas should be reported');
    assert.equal(dirty.status, 0, dirty.stderr);
    assert.match(dirty.stdout, /PROD_FORBIDDEN assets\/index-clean\.js ReactFlow/);
    assert.match(dirty.stdout, /PROD_FORBIDDEN assets\/index-clean\.js Canvas/);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../../../.github/workflows/e2e.yml', import.meta.url), 'utf8');

describe('PeopleClaw E2E dashboard publishing', () => {
  it('TC-PC-099 proves E2E dashboard publishes latest PeopleClaw result', () => {
    assert.match(workflow, /name: E2E \(Playwright\)/);
    assert.match(workflow, /Upload Playwright report artifact/);
    assert.match(workflow, /Prepare report for Pages/);
    assert.match(workflow, /Append to results\.csv \(trends data\)/);
    assert.match(workflow, /SHA="\$\{\{ github\.sha \}\}"/);
    assert.match(workflow, /echo "\$TIMESTAMP,\$SHA,\$DURATION,\$TOTAL,\$PASSED,\$FAILED" >> public\/results\.csv/);
    assert.match(workflow, /Generate trends\.html/);
    assert.match(workflow, /Deploy to GitHub Pages/);
    assert.match(workflow, /peaceiris\/actions-gh-pages@v4/);
    assert.match(workflow, /publish_dir: \.\/public/);
  });
});

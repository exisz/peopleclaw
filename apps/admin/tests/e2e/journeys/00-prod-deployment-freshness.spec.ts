import { execFileSync } from 'node:child_process';
import { test, expect } from '@playwright/test';

function latestMainSha() {
  if (process.env.EXPECTED_GIT_SHA) {
    return process.env.EXPECTED_GIT_SHA.trim();
  }

  const out = execFileSync('git', ['ls-remote', 'origin', 'refs/heads/main'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  const [sha] = out.split(/\s+/);
  if (!/^[0-9a-f]{40}$/i.test(sha ?? '')) {
    throw new Error(`Could not resolve origin/main SHA from git ls-remote output: ${out}`);
  }
  return sha;
}

test('prod-health: Ready deployment serves the latest pushed main commit', async ({ request, baseURL }) => {
  expect(baseURL, 'freshness gate must target the production app host').toContain(
    'app.peopleclaw.rollersoft.com.au',
  );

  const expectedSha = latestMainSha();
  const response = await request.get('/api/health/ready');
  expect(response.ok(), `/api/health/ready returned HTTP ${response.status()}`).toBeTruthy();

  const buildHeader = response.headers()['x-build-sha'];
  const body = await response.json() as {
    ok?: boolean;
    build?: { sha?: string; shortSha?: string; branch?: string };
  };

  expect(body.ok, 'production readiness must be Ready before freshness can pass').toBe(true);
  expect(body.build?.branch, 'production build must come from main').toBe('main');
  expect(body.build?.sha, 'ready JSON build.sha must match latest pushed origin/main').toBe(expectedSha);
  expect(buildHeader, 'X-Build-SHA must match latest pushed origin/main').toBe(expectedSha);
  expect(body.build?.shortSha, 'shortSha must identify the same deployment commit').toBe(expectedSha.slice(0, 8));
});

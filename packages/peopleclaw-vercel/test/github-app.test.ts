import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_GITHUB_APP_PERMISSIONS,
  buildAuthenticatedRemoteUrl,
  buildInstallationTokenBody,
  parsePermissions,
  parseRepoList,
  repoLocalPath,
} from '../src/core/github-app.js';

test('parseRepoList parses comma allowlist and de-duplicates repos', () => {
  const repos = parseRepoList('exisz/roller-beauty, exisz/beauty-consult-pwa,exisz/roller-beauty');
  assert.deepEqual(repos.map((repo) => repo.fullName), ['exisz/roller-beauty', 'exisz/beauty-consult-pwa']);
  assert.deepEqual(repos[0], { owner: 'exisz', name: 'roller-beauty', fullName: 'exisz/roller-beauty' });
});

test('parseRepoList rejects non owner/repo entries', () => {
  assert.throws(() => parseRepoList('exisz/ok,bad-repo'), /Expected owner\/repo/);
});

test('buildInstallationTokenBody uses repo names and default write permissions', () => {
  const repos = parseRepoList('exisz/roller-beauty,exisz/beauty-consult-pwa');
  assert.deepEqual(buildInstallationTokenBody(repos, DEFAULT_GITHUB_APP_PERMISSIONS), {
    repositories: ['roller-beauty', 'beauty-consult-pwa'],
    permissions: DEFAULT_GITHUB_APP_PERMISSIONS,
  });
});

test('parsePermissions accepts JSON overrides', () => {
  assert.deepEqual(parsePermissions('{"contents":"read","metadata":"read"}'), { contents: 'read', metadata: 'read' });
});

test('remote URL embeds encoded token and maps repo name to repos/name', () => {
  const [repo] = parseRepoList('exisz/roller-beauty');
  assert.equal(buildAuthenticatedRemoteUrl(repo, 'ghs_token/with+chars'), 'https://x-access-token:ghs_token%2Fwith%2Bchars@github.com/exisz/roller-beauty.git');
  assert.equal(repoLocalPath('/workspace', repo), '/workspace/repos/roller-beauty');
});

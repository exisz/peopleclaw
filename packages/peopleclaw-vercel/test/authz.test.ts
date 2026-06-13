import test from 'node:test';
import assert from 'node:assert/strict';
import type { CustomerToken } from '../src/core/index.js';
import { decideCustomerAccess, filterVercelResponse } from '../src/server/authz.js';

const baseToken: CustomerToken = {
  id: 'abc',
  label: 'skin-spirit',
  secretHash: 'x',
  allowedRepos: ['exisz/skin-spirit'],
  allowedProjects: ['skin-spirit'],
  allowedTeams: [],
  expiresAt: null,
  createdAt: new Date().toISOString(),
  lastUsedAt: null,
  revoked: false,
};

test('customer access is deny-by-default for non-allowlisted projects', () => {
  assert.equal(decideCustomerAccess(baseToken, 'GET', '/v9/projects/skin-spirit').allowed, true);
  const denied = decideCustomerAccess(baseToken, 'GET', '/v9/projects/other-project');
  assert.equal(denied.allowed, false);
});

test('empty token allowlist cannot list projects', () => {
  const denied = decideCustomerAccess({ ...baseToken, allowedRepos: [], allowedProjects: [] }, 'GET', '/v9/projects');
  assert.equal(denied.allowed, false);
});

test('list responses are filtered to project/repo allowlist', () => {
  const filtered = filterVercelResponse(baseToken, '/v9/projects', {
    projects: [
      { id: '1', name: 'skin-spirit' },
      { id: '2', name: 'other-project' },
      { id: '3', name: 'by-repo', link: { owner: 'exisz', repo: 'skin-spirit' } },
    ],
  }) as { projects: unknown[] };
  assert.equal(filtered.projects.length, 2);
});

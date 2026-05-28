import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const gatePath = process.env.PEOPLECLAW_COMPLETION_GATE
  ?? '/Users/c/.openclaw/workspaces/planetbuild/projects/peopleclaw/completion_gate.py';

const gate = readFileSync(gatePath, 'utf8');

describe('PeopleClaw completion gate production deployment failure awareness', () => {
  it('TC-PC-129 proves newer failed/canceled production deployments make completion NOT_READY', () => {
    assert.match(gate, /def production_deployment_failure_scan\(\) -> dict:/,
      'completion gate must include a production deployment failure scan');
    assert.match(gate, /FAILED_VERCEL_STATES = \{[^}]*['"]failed['"][^}]*['"]canceled['"]/s,
      'completion gate must treat failed and canceled Vercel/GitHub deployment states as blocking states');
    assert.match(gate, /api\/health\/ready/,
      'scan must compare against the currently served Ready deployment, not just HTTP 200');
    assert.match(gate, /repos\/exisz\/peopleclaw\/deployments\?environment=Production&per_page=30/,
      'scan must inspect recent production deployments');
    assert.ok(gate.includes("relevant_admin_changes(served_sha or latest_main, row.get('sha'))"),
      'scan must restrict blocking failures to relevant admin/package changes');
    assert.match(gate, /newer failed\/canceled production deployments exist after served Ready deployment/,
      'completion gate must append an explicit NOT_READY error for newer failed/canceled production deployments');
    assert.match(gate, /'cmd': 'production deployment failure\/freshness scan'/,
      'run-gates output must expose the deployment failure scan as a named gate');
  });
});

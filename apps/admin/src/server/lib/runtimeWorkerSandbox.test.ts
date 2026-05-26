import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateRuntimeWorkerSandboxSpec } from './runtimeWorkerSandbox';

describe('PeopleClaw runtime worker sandbox policy', () => {
  it('TC-PC-059 proves Docker socket is never mounted into user worker', () => {
    const accepted = validateRuntimeWorkerSandboxSpec({
      mounts: [
        { source: '/srv/peopleclaw/artifacts/app_123', target: '/workspace/app', readonly: true },
        { source: '/tmp/peopleclaw-worker-cache', target: '/tmp/cache' },
      ],
    });

    assert.deepEqual(accepted, { ok: true, errors: [] });

    const rejectedSource = validateRuntimeWorkerSandboxSpec({
      mounts: [{ source: '/var/run/docker.sock', target: '/var/run/docker.sock' }],
    });
    assert.equal(rejectedSource.ok, false);
    assert.match(rejectedSource.errors.join('\n'), /must not mount the Docker socket/);

    const rejectedTarget = validateRuntimeWorkerSandboxSpec({
      mounts: [{ source: '/safe/fake.sock', target: '/run/docker.sock/' }],
    });
    assert.equal(rejectedTarget.ok, false);
    assert.match(rejectedTarget.errors.join('\n'), /must not mount the Docker socket/);
  });

  it('TC-PC-060 proves sandbox egress blocks forbidden network host', () => {
    const accepted = validateRuntimeWorkerSandboxSpec({
      network: {
        allowHosts: ['api.stripe.com', 'storage.peopleclaw.example'],
      },
    });

    assert.deepEqual(accepted, { ok: true, errors: [] });

    const rejectedMetadata = validateRuntimeWorkerSandboxSpec({
      network: {
        allowHosts: ['169.254.169.254'],
      },
    });
    assert.equal(rejectedMetadata.ok, false);
    assert.match(rejectedMetadata.errors.join('\n'), /egress must block forbidden host: 169\.254\.169\.254/);

    const rejectedLocalhost = validateRuntimeWorkerSandboxSpec({
      network: {
        allowHosts: ['LOCALHOST.'],
      },
    });
    assert.equal(rejectedLocalhost.ok, false);
    assert.match(rejectedLocalhost.errors.join('\n'), /egress must block forbidden host: localhost/);
  });
});

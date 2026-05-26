import { Worker } from 'node:worker_threads';

export type RuntimeFunctionWorkerResult =
  | { ok: true; result: unknown }
  | { ok: false; stage: 'timeout' | 'memory' | 'runtime'; errors: string[] };

export interface RuntimeFunctionWorkerInput {
  source: string;
  payload?: unknown;
  timeoutMs: number;
  memoryLimitMb?: number;
}

/**
 * Minimal worker-thread harness for runtime safety tests. Production can swap in
 * a container/process sandbox behind the same timeout contract; the important
 * API invariant is that runaway user functions resolve as failed invocations.
 */
export function invokeRuntimeFunctionWorkerSource(input: RuntimeFunctionWorkerInput): Promise<RuntimeFunctionWorkerResult> {
  const worker = new Worker(
    `
      const { parentPort, workerData } = require('node:worker_threads');
      async function run() {
        const handler = eval('(' + workerData.source + ')');
        return await handler(workerData.payload);
      }
      run().then(
        result => parentPort.postMessage({ ok: true, result }),
        error => parentPort.postMessage({ ok: false, error: error && error.message ? error.message : String(error) })
      );
    `,
    {
      eval: true,
      workerData: { source: input.source, payload: input.payload },
      resourceLimits: input.memoryLimitMb ? { maxOldGenerationSizeMb: input.memoryLimitMb } : undefined,
    },
  );

  return new Promise(resolve => {
    let settled = false;
    let timingOut = false;
    const finish = (result: RuntimeFunctionWorkerResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.removeAllListeners();
      resolve(result);
    };

    const timer = setTimeout(() => {
      timingOut = true;
      void worker.terminate().finally(() => {
        finish({ ok: false, stage: 'timeout', errors: ['runtime function exceeded timeout and was terminated'] });
      });
    }, input.timeoutMs);

    worker.on('message', message => {
      if (message?.ok === true) finish({ ok: true, result: message.result });
      else finish({ ok: false, stage: 'runtime', errors: [message?.error ?? 'runtime function failed'] });
    });
    worker.on('error', error => {
      const message = error.message || String(error);
      if (input.memoryLimitMb && /memory limit|heap out of memory|allocation failed/i.test(message)) {
        finish({ ok: false, stage: 'memory', errors: ['runtime function exceeded memory limit and was terminated'] });
        return;
      }
      finish({ ok: false, stage: 'runtime', errors: [message] });
    });
    worker.on('exit', code => {
      if (timingOut) return;
      if (!settled && code !== 0 && input.memoryLimitMb) {
        finish({ ok: false, stage: 'memory', errors: ['runtime function exceeded memory limit and was terminated'] });
        return;
      }
      if (!settled && code !== 0) finish({ ok: false, stage: 'runtime', errors: [`runtime worker exited with code ${code}`] });
    });
  });
}

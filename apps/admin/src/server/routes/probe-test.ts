import { Router } from 'express';
import { createSSEStream } from '@peopleclaw/sdk/sse';

export const probeTestRouter = Router();

// Dev-only SSE probe test endpoint — no auth required
probeTestRouter.get('/_probe-test', async (_req, res) => {
  const sseResponse = createSSEStream(async (probe) => {
    await probe.nodeEntry('step1');
    await new Promise((r) => setTimeout(r, 100));
    await probe.nodeEntry('step2');
    await new Promise((r) => setTimeout(r, 100));
    await probe.nodeEntry('step3');
    await new Promise((r) => setTimeout(r, 100));
    return { ok: true, message: 'probe test complete' };
  });

  // Pipe the Web Response stream to Express response
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const reader = sseResponse.body?.getReader();
  if (!reader) {
    res.end();
    return;
  }

  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
  } catch {
    // client disconnected
  } finally {
    res.end();
  }
});

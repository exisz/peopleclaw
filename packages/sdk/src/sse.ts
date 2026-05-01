export interface SSEProbe {
  nodeEntry(node: string): Promise<void>;
}

type StreamHandler<T> = (probe: SSEProbe) => Promise<T>;

export function createSSEStream<T = unknown>(handler: StreamHandler<T>): Response {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array>;
  let lastNode: string | null = null;
  let lastEnterTs: number = 0;

  function send(event: string, data: unknown) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    try {
      controller.enqueue(encoder.encode(payload));
    } catch {
      // stream closed
    }
  }

  function exitPrevious() {
    if (lastNode) {
      const now = Date.now();
      send('probe', {
        node: lastNode,
        ts: now,
        phase: 'exit',
        duration_ms: now - lastEnterTs,
      });
      lastNode = null;
    }
  }

  const probe: SSEProbe = {
    async nodeEntry(node: string) {
      exitPrevious();
      const ts = Date.now();
      lastNode = node;
      lastEnterTs = ts;
      send('probe', { node, ts, phase: 'enter' });
    },
  };

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl;
      (async () => {
        try {
          const result = await handler(probe);
          exitPrevious();
          send('result', result);
        } catch (err: any) {
          exitPrevious();
          send('error', {
            message: err?.message ?? 'Unknown error',
            stack: err?.stack,
          });
        } finally {
          controller.close();
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

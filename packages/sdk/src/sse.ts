export interface SSEProgress {
  step(name: string): Promise<void>;
}

type StreamHandler<T> = (progress: SSEProgress) => Promise<T>;

export function createSSEStream<T = unknown>(handler: StreamHandler<T>): Response {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array>;

  function send(event: string, data: unknown) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    try {
      controller.enqueue(encoder.encode(payload));
    } catch {
      // stream closed
    }
  }

  const progress: SSEProgress = {
    async step(name: string) {
      send('progress', { name, ts: Date.now() });
    },
  };

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl;
      (async () => {
        try {
          const result = await handler(progress);
          send('result', result);
        } catch (err: any) {
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

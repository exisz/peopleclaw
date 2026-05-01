import type { SSEEvent } from './types';

export interface ConsumeOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export async function* consumeSSE(
  url: string,
  options: ConsumeOptions = {}
): AsyncGenerator<SSEEvent, void, unknown> {
  const { method = 'GET', body, headers = {} } = options;

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    throw new Error(`SSE request failed: ${res.status} ${res.statusText}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No readable stream');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    let currentEvent = '';
    let currentData = '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        currentData = line.slice(6);
      } else if (line === '' && currentEvent && currentData) {
        try {
          const parsed = JSON.parse(currentData);
          yield { type: currentEvent, ...parsed } as SSEEvent;
        } catch {
          // skip malformed
        }
        currentEvent = '';
        currentData = '';
      }
    }
  }
}

import type { AgentStreamEvent } from './types';

export async function parseAgentSseStream(
  response: Response,
  onEvent: (event: AgentStreamEvent) => void,
): Promise<void> {
  if (!response.ok) {
    throw new Error(await response.text().catch(() => `HTTP ${response.status}`));
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Response body is not readable');

  const decoder = new TextDecoder();
  let buffer = '';
  let eventName = 'message';
  let dataLines: string[] = [];

  const flush = () => {
    if (dataLines.length === 0) return;
    const raw = dataLines.join('\n');
    try {
      const data = JSON.parse(raw);
      onEvent({ type: eventName, ...(data && typeof data === 'object' ? data : { data }) });
    } catch {
      onEvent({ type: eventName, text: raw });
    }
    eventName = 'message';
    dataLines = [];
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line === '') {
        flush();
      } else if (line.startsWith('event:')) {
        eventName = line.slice(6).trim() || 'message';
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart());
      }
    }
  }
  if (buffer.trim()) {
    for (const line of buffer.split(/\r?\n/)) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim() || 'message';
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
  }
  flush();
}

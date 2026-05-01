export interface ProbeEvent {
  type: 'probe';
  node: string;
  ts: number;
  phase: 'enter' | 'exit';
  duration_ms?: number;
}

export interface ResultEvent {
  type: 'result';
  data: unknown;
}

export interface ErrorEvent {
  type: 'error';
  message: string;
  stack?: string;
}

export type SSEEvent = ProbeEvent | ResultEvent | ErrorEvent;

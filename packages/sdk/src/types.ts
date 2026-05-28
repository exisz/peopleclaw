export interface ProgressEvent {
  type: 'progress';
  name: string;
  ts: number;
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

export type SSEEvent = ProgressEvent | ResultEvent | ErrorEvent;

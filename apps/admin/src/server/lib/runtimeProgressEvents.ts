export interface RuntimeProgressEvent {
  invocationId: string;
  type: 'progress';
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

export interface RuntimeProgressEmitter {
  emitted: RuntimeProgressEvent[];
  emit(message: string, data?: Record<string, unknown>): RuntimeProgressEvent | null;
}

export interface CancellableRuntimeProgressEmitter extends RuntimeProgressEmitter {
  cancel(): void;
  isCancelled(): boolean;
}

function requireToken(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Runtime progress emitter requires ${field}`);
  return normalized;
}

/** Build ctx.progress.emit for a sandboxed function invocation. */
export function createRuntimeProgressEmitter(invocationId: string, now: () => Date = () => new Date()): RuntimeProgressEmitter {
  return createCancellableRuntimeProgressEmitter(invocationId, now);
}

export function createCancellableRuntimeProgressEmitter(invocationId: string, now: () => Date = () => new Date()): CancellableRuntimeProgressEmitter {
  const scopedInvocationId = requireToken(invocationId, 'invocationId');
  const emitted: RuntimeProgressEvent[] = [];
  let cancelled = false;
  return {
    emitted,
    cancel() {
      cancelled = true;
    },
    isCancelled() {
      return cancelled;
    },
    emit(message, data) {
      if (cancelled) return null;
      const event: RuntimeProgressEvent = {
        invocationId: scopedInvocationId,
        type: 'progress',
        message: requireToken(message, 'message'),
        data,
        timestamp: now().toISOString(),
      };
      emitted.push(event);
      return event;
    },
  };
}


export function serializeScopedProgressSse(invocationId: string, events: RuntimeProgressEvent[]): string {
  const scopedInvocationId = requireToken(invocationId, 'invocationId');
  return events
    .filter(event => event.invocationId === scopedInvocationId)
    .map(event => `event: progress\ndata: ${JSON.stringify(event)}\n\n`)
    .join('');
}

export type RuntimeFunctionLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface RuntimeFunctionLogEntry {
  level: RuntimeFunctionLogLevel;
  message: string;
  invocationId: string;
  deploymentId: string;
  functionId?: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface RuntimeFunctionLogger {
  entries: RuntimeFunctionLogEntry[];
  log(level: RuntimeFunctionLogLevel, message: string, data?: Record<string, unknown>): RuntimeFunctionLogEntry;
  info(message: string, data?: Record<string, unknown>): RuntimeFunctionLogEntry;
  error(message: string, data?: Record<string, unknown>): RuntimeFunctionLogEntry;
}

function requireToken(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Runtime function logger requires ${field}`);
  return normalized;
}

/**
 * Build ctx.log for a sandboxed function invocation. Every entry carries the
 * immutable deployment identity and invocation identity so logs can be audited,
 * streamed, and correlated without guessing from route state.
 */
export function createRuntimeFunctionLogger(input: {
  invocationId: string;
  deploymentId: string;
  functionId?: string;
  now?: () => Date;
}): RuntimeFunctionLogger {
  const invocationId = requireToken(input.invocationId, 'invocationId');
  const deploymentId = requireToken(input.deploymentId, 'deploymentId');
  const functionId = input.functionId ? requireToken(input.functionId, 'functionId') : undefined;
  const now = input.now ?? (() => new Date());
  const entries: RuntimeFunctionLogEntry[] = [];

  return {
    entries,
    log(level, message, data) {
      const entry: RuntimeFunctionLogEntry = {
        level,
        message: requireToken(message, 'message'),
        invocationId,
        deploymentId,
        functionId,
        timestamp: now().toISOString(),
        data,
      };
      entries.push(entry);
      return entry;
    },
    info(message, data) {
      return this.log('info', message, data);
    },
    error(message, data) {
      return this.log('error', message, data);
    },
  };
}

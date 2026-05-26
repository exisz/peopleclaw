export interface RuntimeJobDispatchInput {
  invocationId: string;
  deploymentId: string;
  estimatedDurationMs: number;
  inlineBudgetMs: number;
}

export type RuntimeJobDispatchPlan =
  | {
      mode: 'inline';
      invocationId: string;
      deploymentId: string;
    }
  | {
      mode: 'queued';
      invocationId: string;
      deploymentId: string;
      queueName: 'runtime-long-running';
      reason: 'estimated_duration_exceeds_inline_budget';
    };

function requireToken(value: string, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${field} must be a non-empty string`);
  return value;
}

export function planRuntimeJobDispatch(input: RuntimeJobDispatchInput): RuntimeJobDispatchPlan {
  const invocationId = requireToken(input.invocationId, 'invocationId');
  const deploymentId = requireToken(input.deploymentId, 'deploymentId');
  if (!Number.isFinite(input.estimatedDurationMs) || input.estimatedDurationMs < 0) {
    throw new Error('estimatedDurationMs must be a non-negative finite number');
  }
  if (!Number.isFinite(input.inlineBudgetMs) || input.inlineBudgetMs < 0) {
    throw new Error('inlineBudgetMs must be a non-negative finite number');
  }

  if (input.estimatedDurationMs > input.inlineBudgetMs) {
    return {
      mode: 'queued',
      invocationId,
      deploymentId,
      queueName: 'runtime-long-running',
      reason: 'estimated_duration_exceeds_inline_budget',
    };
  }

  return { mode: 'inline', invocationId, deploymentId };
}

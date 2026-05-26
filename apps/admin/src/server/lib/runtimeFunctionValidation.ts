export type RuntimeFieldType = 'string' | 'number' | 'boolean' | 'object' | 'array';

export interface RuntimeObjectSchema {
  type: 'object';
  required?: string[];
  properties: Record<string, RuntimeFieldType>;
}

export interface RuntimeValidationResult {
  ok: boolean;
  errors: string[];
}

function actualType(value: unknown): RuntimeFieldType | 'null' | 'undefined' {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return typeof value as RuntimeFieldType;
}

/**
 * Tiny manifest-schema validator used by runtime gateway tests. It validates
 * payload shape before sandbox handler execution; richer schema engines can sit
 * behind the same pre-handler gate later.
 */
export function validateRuntimeFunctionPayload(payload: unknown, schema: RuntimeObjectSchema): RuntimeValidationResult {
  const errors: string[] = [];
  if (schema.type !== 'object') return { ok: false, errors: ['schema root must be object'] };
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, errors: ['payload must be object'] };
  }
  const record = payload as Record<string, unknown>;
  for (const field of schema.required ?? []) {
    if (record[field] === undefined) errors.push(`${field} is required`);
  }
  for (const [field, type] of Object.entries(schema.properties)) {
    if (record[field] === undefined) continue;
    const got = actualType(record[field]);
    if (got !== type) errors.push(`${field} must be ${type}`);
  }
  return { ok: errors.length === 0, errors };
}

export async function invokeRuntimeFunctionWithInputValidation<T>(input: {
  payload: unknown;
  inputSchema: RuntimeObjectSchema;
  handler: (payload: unknown) => Promise<T> | T;
  outputSchema?: RuntimeObjectSchema;
}): Promise<{ ok: true; result: T } | { ok: false; errors: string[]; stage: 'input' | 'output' }> {
  const validation = validateRuntimeFunctionPayload(input.payload, input.inputSchema);
  if (!validation.ok) return { ok: false, stage: 'input', errors: validation.errors };
  const result = await input.handler(input.payload);
  if (input.outputSchema) {
    const outputValidation = validateRuntimeFunctionPayload(result, input.outputSchema);
    if (!outputValidation.ok) return { ok: false, stage: 'output', errors: outputValidation.errors };
  }
  return { ok: true, result };
}

export type DocumentFieldType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'date';

export interface DocumentCollectionFieldDefinition {
  type: DocumentFieldType;
  required?: boolean;
  default?: unknown;
}

const FORBIDDEN_FIELD_KEYS = new Set(['rawSql', 'rawSQL', 'sql', 'query', 'migration']);

export interface DocumentCollectionDefinition {
  name: string;
  version: number;
  fields: Record<string, DocumentCollectionFieldDefinition>;
}

export interface DocumentCollectionPlanRecord {
  operation: 'create_collection';
  collection: string;
  version: number;
  fields: Record<string, DocumentCollectionFieldDefinition>;
}

function requireToken(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Document collection definition requires ${field}`);
  return normalized;
}

/**
 * Convert a PeopleClaw managed document collection definition into the explicit
 * data-plane plan record applied by deployment playbooks. This is not raw DDL:
 * it creates a managed collection artifact for the runtime Data API.
 */
export function planDocumentCollectionDefinition(definition: DocumentCollectionDefinition): DocumentCollectionPlanRecord {
  const collection = requireToken(definition.name, 'name');
  if (!Number.isInteger(definition.version) || definition.version < 1) {
    throw new Error('Document collection definition requires positive integer version');
  }
  if (!definition.fields || Object.keys(definition.fields).length === 0) {
    throw new Error('Document collection definition requires at least one field');
  }
  for (const [fieldName, field] of Object.entries(definition.fields)) {
    for (const key of Object.keys(field as unknown as Record<string, unknown>)) {
      if (FORBIDDEN_FIELD_KEYS.has(key)) {
        throw new Error(`Document collection field ${fieldName} must not include raw SQL or migration directives`);
      }
    }
  }

  return {
    operation: 'create_collection',
    collection,
    version: definition.version,
    fields: Object.freeze({ ...definition.fields }),
  };
}

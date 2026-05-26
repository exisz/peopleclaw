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

export interface DocumentIndexDeclaration {
  collection: string;
  name: string;
  fields: string[];
  unique?: boolean;
}

export interface DocumentIndexPlanRecord {
  operation: 'create_index';
  collection: string;
  name: string;
  fields: string[];
  unique: boolean;
}

export interface DocumentSeedDeclaration {
  collection: string;
  key: string;
  document: Record<string, unknown>;
}

export interface DocumentSeedPlanRecord {
  operation: 'seed_document';
  collection: string;
  key: string;
  mode: 'upsert_by_key';
  document: Readonly<Record<string, unknown>>;
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
export function planDocumentIndexDeclaration(declaration: DocumentIndexDeclaration): DocumentIndexPlanRecord {
  const collection = requireToken(declaration.collection, 'collection');
  const name = requireToken(declaration.name, 'index.name');
  const fields = declaration.fields.map((field, index) => requireToken(field, `index.fields[${index}]`));
  if (fields.length === 0) throw new Error('Document index declaration requires at least one field');
  return {
    operation: 'create_index',
    collection,
    name,
    fields,
    unique: Boolean(declaration.unique),
  };
}

export function planDocumentSeedOperation(declaration: DocumentSeedDeclaration): DocumentSeedPlanRecord {
  const collection = requireToken(declaration.collection, 'collection');
  const key = requireToken(declaration.key, 'seed.key');
  if (!declaration.document || Array.isArray(declaration.document) || typeof declaration.document !== 'object') {
    throw new Error('Document seed operation requires a document object');
  }

  return {
    operation: 'seed_document',
    collection,
    key,
    mode: 'upsert_by_key',
    document: Object.freeze({ ...declaration.document }),
  };
}

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

export interface AppArtifactTree {
  manifest: AppManifest;
  sidebar: AppSidebar;
  screens?: Record<string, AppScreenArtifact>;
  functions?: Record<string, AppFunctionArtifact>;
  data?: {
    collections?: unknown[];
    indexes?: unknown[];
    playbooks?: Record<string, unknown>;
  };
  secrets?: Record<string, { ref: string }>;
  tests?: Record<string, string>;
}

export interface AppManifest {
  appId: string;
  name: string;
  version: string;
  routes: AppManifestRoute[];
}

export interface AppManifestRoute {
  id: string;
  path: `/apps/${string}`;
  screen: string;
}

export interface AppScreenArtifact {
  source: string;
  artifactHash: string;
}

export interface AppFunctionArtifact {
  source: string;
  inputSchema: unknown;
  outputSchema: unknown;
}

export interface AppSidebar {
  sections: AppSidebarSection[];
}

export interface AppSidebarSection {
  id: string;
  title: string;
  kind: 'app' | 'system';
  items: AppSidebarItem[];
}

export interface AppSidebarItem {
  id: string;
  label: string;
  routeId: string;
}

export interface AppDeploymentRecord {
  id: string;
  appId: string;
  deploymentId: string;
  channel: 'preview' | 'production';
  artifactHash: string;
  sdkCompatibilityVersion: string;
  runtimeCompatibilityVersion: string;
  createdAt: string;
}

export interface ArtifactValidationResult {
  ok: boolean;
  errors: string[];
}

export interface AppArtifactPlanRecord {
  operation: 'store_immutable_artifact';
  artifactHash: `sha256:${string}`;
  artifact: AppArtifactTree;
}

export interface AppArtifactStoreResult {
  artifactHash: `sha256:${string}`;
  created: boolean;
  storedCount: number;
}

export interface AppArtifactStore {
  put(value: unknown): Promise<AppArtifactStoreResult>;
}

export interface PreviewAppDeploymentOptions {
  appId: string;
  sdkCompatibilityVersion: string;
  runtimeCompatibilityVersion: string;
  now?: Date;
}

export interface PreviewAppDeploymentResult {
  artifactHash: `sha256:${string}`;
  deploymentRecord: AppDeploymentRecord;
  deploymentRecordCount: number;
}

export interface InMemoryAppDeploymentRegistryOptions {
  productionDeploymentId?: string | null;
}

export interface PromoteAppDeploymentResult {
  previousProductionDeploymentId: string | null;
  productionDeploymentId: string;
}

export interface RollbackAppDeploymentResult {
  operation: 'restore_production_pointer';
  dataPlaneRollback: 'not_performed';
  rolledBackFromDeploymentId: string | null;
  productionDeploymentId: string | null;
}

export interface AppDeploymentRegistry {
  deployPreview(value: unknown, options: PreviewAppDeploymentOptions): Promise<PreviewAppDeploymentResult>;
  promote(deploymentId: string): PromoteAppDeploymentResult;
  rollbackProductionPointer(): RollbackAppDeploymentResult;
  listDeploymentRecords(): AppDeploymentRecord[];
  getProductionDeploymentId(): string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateManifest(value: unknown, errors: string[]): value is AppManifest {
  if (!isRecord(value)) {
    errors.push('manifest must be an object');
    return false;
  }

  for (const field of ['appId', 'name', 'version'] as const) {
    if (!isNonEmptyString(value[field])) errors.push(`manifest.${field} must be a non-empty string`);
  }

  if (!Array.isArray(value.routes) || value.routes.length === 0) {
    errors.push('manifest.routes must contain at least one route');
    return false;
  }

  const routeIds = new Set<string>();
  for (const [index, route] of value.routes.entries()) {
    if (!isRecord(route)) {
      errors.push(`manifest.routes[${index}] must be an object`);
      continue;
    }
    if (!isNonEmptyString(route.id)) {
      errors.push(`manifest.routes[${index}].id must be a non-empty string`);
    } else if (routeIds.has(route.id)) {
      errors.push(`manifest.routes[${index}].id must be unique`);
    } else {
      routeIds.add(route.id);
    }
    if (!isNonEmptyString(route.path) || !isNonEmptyString(value.appId) || !route.path.startsWith(`/apps/${value.appId}`)) {
      errors.push(`manifest.routes[${index}].path must be inside /apps/${String(value.appId)}`);
    }
    if (!isNonEmptyString(route.screen)) errors.push(`manifest.routes[${index}].screen must be a non-empty string`);
  }

  return true;
}

function validateScreens(value: unknown, errors: string[]): value is Record<string, AppScreenArtifact> | undefined {
  if (value === undefined) return true;
  if (!isRecord(value)) {
    errors.push('screens must be an object');
    return false;
  }

  for (const [path, screen] of Object.entries(value)) {
    if (!isRecord(screen)) {
      errors.push(`screens.${path} must be an object`);
      continue;
    }
    if (!isNonEmptyString(screen.source)) errors.push(`screens.${path}.source must be a non-empty string`);
    if (!isNonEmptyString(screen.artifactHash)) errors.push(`screens.${path}.artifactHash must be a non-empty string`);
  }

  return true;
}

function validateFunctions(value: unknown, errors: string[]): value is Record<string, AppFunctionArtifact> | undefined {
  if (value === undefined) return true;
  if (!isRecord(value)) {
    errors.push('functions must be an object');
    return false;
  }

  for (const [path, fn] of Object.entries(value)) {
    if (!isRecord(fn)) {
      errors.push(`functions.${path} must be an object`);
      continue;
    }
    if (!isNonEmptyString(fn.source)) errors.push(`functions.${path}.source must be a non-empty string`);
    if (fn.inputSchema === undefined) errors.push(`functions.${path}.inputSchema is required`);
    if (fn.outputSchema === undefined) errors.push(`functions.${path}.outputSchema is required`);
  }

  return true;
}

function validateSidebar(value: unknown, errors: string[]): value is AppSidebar {
  if (!isRecord(value)) {
    errors.push('sidebar must be an object');
    return false;
  }

  if (!Array.isArray(value.sections) || value.sections.length === 0) {
    errors.push('sidebar.sections must contain at least one section');
    return false;
  }

  const sectionIds = new Set<string>();
  const itemIds = new Set<string>();
  for (const [sectionIndex, section] of value.sections.entries()) {
    if (!isRecord(section)) {
      errors.push(`sidebar.sections[${sectionIndex}] must be an object`);
      continue;
    }
    if (!isNonEmptyString(section.id)) {
      errors.push(`sidebar.sections[${sectionIndex}].id must be a non-empty string`);
    } else if (sectionIds.has(section.id)) {
      errors.push(`sidebar.sections[${sectionIndex}].id must be unique`);
    } else {
      sectionIds.add(section.id);
    }
    if (!isNonEmptyString(section.title)) errors.push(`sidebar.sections[${sectionIndex}].title must be a non-empty string`);
    if (section.kind !== 'app' && section.kind !== 'system') {
      errors.push(`sidebar.sections[${sectionIndex}].kind must be app or system`);
    }
    if (!Array.isArray(section.items)) {
      errors.push(`sidebar.sections[${sectionIndex}].items must be an array`);
      continue;
    }
    for (const [itemIndex, item] of section.items.entries()) {
      if (!isRecord(item)) {
        errors.push(`sidebar.sections[${sectionIndex}].items[${itemIndex}] must be an object`);
        continue;
      }
      if (!isNonEmptyString(item.id)) {
        errors.push(`sidebar.sections[${sectionIndex}].items[${itemIndex}].id must be a non-empty string`);
      } else if (itemIds.has(item.id)) {
        errors.push(`sidebar.sections[${sectionIndex}].items[${itemIndex}].id must be unique`);
      } else {
        itemIds.add(item.id);
      }
      if (!isNonEmptyString(item.label)) errors.push(`sidebar.sections[${sectionIndex}].items[${itemIndex}].label must be a non-empty string`);
      if (!isNonEmptyString(item.routeId)) errors.push(`sidebar.sections[${sectionIndex}].items[${itemIndex}].routeId must be a non-empty string`);
    }
  }

  return true;
}

export function validateAppArtifactTree(value: unknown): ArtifactValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { ok: false, errors: ['artifact tree must be an object'] };
  }

  validateManifest(value.manifest, errors);
  validateSidebar(value.sidebar, errors);
  validateScreens(value.screens, errors);
  validateFunctions(value.functions, errors);

  return { ok: errors.length === 0, errors };
}

export function validateAppDeploymentRecord(value: unknown): ArtifactValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { ok: false, errors: ['deployment record must be an object'] };
  }

  for (const field of ['id', 'appId', 'deploymentId', 'artifactHash', 'sdkCompatibilityVersion', 'runtimeCompatibilityVersion', 'createdAt'] as const) {
    if (!isNonEmptyString(value[field])) errors.push(`deploymentRecord.${field} must be a non-empty string`);
  }

  if (value.channel !== 'preview' && value.channel !== 'production') {
    errors.push('deploymentRecord.channel must be preview or production');
  }

  return { ok: errors.length === 0, errors };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function sha256Hex(input: string): Promise<string> {
  const cryptoApi = globalThis.crypto?.subtle;
  if (cryptoApi) {
    const bytes = new TextEncoder().encode(input);
    const digest = await cryptoApi.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(input).digest('hex');
}

export async function planImmutableAppArtifactStorage(value: unknown): Promise<AppArtifactPlanRecord> {
  assertValidAppArtifactTree(value);
  const artifact = value;
  const artifactHash = `sha256:${await sha256Hex(stableStringify(artifact))}` as const;
  return {
    operation: 'store_immutable_artifact',
    artifactHash,
    artifact,
  };
}

export function createInMemoryAppArtifactStore(): AppArtifactStore {
  const artifacts = new Map<string, AppArtifactTree>();
  return {
    async put(value: unknown): Promise<AppArtifactStoreResult> {
      const plan = await planImmutableAppArtifactStorage(value);
      const created = !artifacts.has(plan.artifactHash);
      if (created) artifacts.set(plan.artifactHash, plan.artifact);
      return { artifactHash: plan.artifactHash, created, storedCount: artifacts.size };
    },
  };
}

export function createInMemoryAppDeploymentRegistry(options: InMemoryAppDeploymentRegistryOptions = {}): AppDeploymentRegistry {
  const artifactStore = createInMemoryAppArtifactStore();
  const deploymentRecords: AppDeploymentRecord[] = [];
  let productionDeploymentId = options.productionDeploymentId ?? null;
  const productionPointerHistory: Array<string | null> = [];

  return {
    async deployPreview(value: unknown, options: PreviewAppDeploymentOptions): Promise<PreviewAppDeploymentResult> {
      if (!isNonEmptyString(options.appId)) throw new Error('appId must be a non-empty string');
      if (!isNonEmptyString(options.sdkCompatibilityVersion)) throw new Error('sdkCompatibilityVersion must be a non-empty string');
      if (!isNonEmptyString(options.runtimeCompatibilityVersion)) throw new Error('runtimeCompatibilityVersion must be a non-empty string');

      const stored = await artifactStore.put(value);
      const createdAt = (options.now ?? new Date()).toISOString();
      const deploymentId = `dep_${options.appId}_preview_${deploymentRecords.length + 1}`;
      const deploymentRecord: AppDeploymentRecord = {
        id: `record_${deploymentId}`,
        appId: options.appId,
        deploymentId,
        channel: 'preview',
        artifactHash: stored.artifactHash,
        sdkCompatibilityVersion: options.sdkCompatibilityVersion,
        runtimeCompatibilityVersion: options.runtimeCompatibilityVersion,
        createdAt,
      };

      deploymentRecords.push(deploymentRecord);
      return { artifactHash: stored.artifactHash, deploymentRecord, deploymentRecordCount: deploymentRecords.length };
    },
    promote(deploymentId: string): PromoteAppDeploymentResult {
      if (!deploymentRecords.some(record => record.deploymentId === deploymentId)) {
        throw new Error(`Unknown deployment: ${deploymentId}`);
      }
      const previousProductionDeploymentId = productionDeploymentId;
      productionPointerHistory.push(previousProductionDeploymentId);
      productionDeploymentId = deploymentId;
      return { previousProductionDeploymentId, productionDeploymentId };
    },
    rollbackProductionPointer(): RollbackAppDeploymentResult {
      const rolledBackFromDeploymentId = productionDeploymentId;
      productionDeploymentId = productionPointerHistory.pop() ?? null;
      return { operation: 'restore_production_pointer', dataPlaneRollback: 'not_performed', rolledBackFromDeploymentId, productionDeploymentId };
    },
    listDeploymentRecords(): AppDeploymentRecord[] {
      return deploymentRecords.map(record => ({ ...record }));
    },
    getProductionDeploymentId(): string | null {
      return productionDeploymentId;
    },
  };
}

export function assertValidAppArtifactTree(value: unknown): asserts value is AppArtifactTree {
  const result = validateAppArtifactTree(value);
  if (!result.ok) {
    throw new Error(`Invalid PeopleClaw app artifact tree: ${result.errors.join('; ')}`);
  }
}

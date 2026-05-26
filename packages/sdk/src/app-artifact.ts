export interface AppArtifactTree {
  manifest: AppManifest;
  sidebar: AppSidebar;
  screens?: Record<string, AppScreenArtifact>;
  functions?: Record<string, string>;
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

export interface ArtifactValidationResult {
  ok: boolean;
  errors: string[];
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

  return { ok: errors.length === 0, errors };
}

export function assertValidAppArtifactTree(value: unknown): asserts value is AppArtifactTree {
  const result = validateAppArtifactTree(value);
  if (!result.ok) {
    throw new Error(`Invalid PeopleClaw app artifact tree: ${result.errors.join('; ')}`);
  }
}

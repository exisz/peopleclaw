import type { Tool, ToolCall, ToolResultMessage } from '@mariozechner/pi-ai';
import { validateToolCall } from '@mariozechner/pi-ai/dist/utils/validation.js';
import { getPrisma } from './prisma.js';

export interface AppAgentToolContext {
  tenantId: string;
  appId: string;
}

export interface AppAgentExecutedTool {
  toolName: string;
  summary: string;
  result: unknown;
  message: ToolResultMessage;
}

type ComponentTypeInput = 'FRONTEND' | 'BACKEND' | 'FULLSTACK';
type ComponentRuntimeInput = 'PEOPLECLAW_CLOUD' | 'USER_BYO_NODE' | 'EDGE';

type JsonSchema = Record<string, unknown>;

const objectSchema = (properties: JsonSchema, required: string[] = []): JsonSchema => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

export const appAgentTools: Tool[] = [
  {
    name: 'inspect_current_app',
    description: 'Inspect the current PeopleClaw App, including safe metadata and component counts. Tenant/app scoped; never returns secrets.',
    parameters: objectSchema({}),
  },
  {
    name: 'list_app_modules',
    description: 'List modules/pages/components available in the current App. PeopleClaw currently stores these as App components; page/module kind is inferred safely.',
    parameters: objectSchema({
      includeSourcePreview: { type: 'boolean', description: 'If true, include a short source preview only. Full source is not returned.' },
    }),
  },
  {
    name: 'create_app_component',
    description: 'Create a module, page, or component in the current App using the existing Component schema/API conventions.',
    parameters: objectSchema({
      kind: { type: 'string', enum: ['component', 'module', 'page'], description: 'Conceptual item to create. Stored as a Component in PeopleClaw.' },
      name: { type: 'string', minLength: 1, maxLength: 120 },
      type: { type: 'string', enum: ['FRONTEND', 'BACKEND', 'FULLSTACK'], description: 'Component runtime surface. Defaults to FRONTEND for page/module/component.' },
      runtime: { type: 'string', enum: ['PEOPLECLAW_CLOUD', 'USER_BYO_NODE', 'EDGE'], description: 'Execution runtime. Defaults to PEOPLECLAW_CLOUD.' },
      code: { type: 'string', description: 'Initial source code. Keep it self-contained and platform-neutral.' },
      inputSchema: { type: 'string', description: 'Optional JSON schema string for inputs.' },
      outputSchema: { type: 'string', description: 'Optional JSON schema string for outputs.' },
      icon: { type: 'string', maxLength: 40 },
      canvasX: { type: 'number' },
      canvasY: { type: 'number' },
      isExported: { type: 'boolean', description: 'Whether this component is exposed in the app shell. Defaults true for pages, false otherwise.' },
    }, ['kind', 'name']),
  },
  {
    name: 'update_app_component',
    description: 'Update safe metadata/source fields on an existing component in the current App. Tenant/app scoped; cannot touch secrets or integrations.',
    parameters: objectSchema({
      componentId: { type: 'string', minLength: 1 },
      name: { type: 'string', minLength: 1, maxLength: 120 },
      code: { type: 'string', description: 'Replacement source code, if updating source.' },
      inputSchema: { type: 'string' },
      outputSchema: { type: 'string' },
      icon: { type: 'string', maxLength: 40 },
      canvasX: { type: 'number' },
      canvasY: { type: 'number' },
      isExported: { type: 'boolean' },
    }, ['componentId']),
  },
] as Tool[];

function truncate(value: string | null | undefined, max = 240): string | undefined {
  if (!value) return undefined;
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function inferKind(component: { type: string; isExported?: boolean; name: string }): 'page' | 'module' | 'component' {
  if (component.isExported && component.type !== 'BACKEND') return 'page';
  if (component.type === 'BACKEND') return 'module';
  return 'component';
}

function sanitizeComponent(component: any, includeSourcePreview = false): Record<string, unknown> {
  return {
    id: component.id,
    kind: inferKind(component),
    name: component.name,
    type: component.type,
    runtime: component.runtime,
    isExported: component.isExported,
    icon: component.icon ?? undefined,
    canvasX: component.canvasX,
    canvasY: component.canvasY,
    hasInputSchema: Boolean(component.inputSchema),
    hasOutputSchema: Boolean(component.outputSchema),
    sourceLength: typeof component.code === 'string' ? component.code.length : 0,
    ...(includeSourcePreview ? { sourcePreview: truncate(component.code, 500) ?? '' } : {}),
    createdAt: component.createdAt?.toISOString?.() ?? component.createdAt,
    updatedAt: component.updatedAt?.toISOString?.() ?? component.updatedAt,
  };
}

async function requireScopedApp(ctx: AppAgentToolContext) {
  const app = await getPrisma().app.findFirst({
    where: { id: ctx.appId, tenantId: ctx.tenantId },
    select: { id: true, tenantId: true, name: true, description: true, createdAt: true, updatedAt: true },
  });
  if (!app) throw new Error('app not found');
  return app;
}

function safeJsonSchemaText(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error(`${field} must be a JSON schema string`);
  if (!value.trim()) return null as any;
  try {
    JSON.parse(value);
  } catch {
    throw new Error(`${field} must be valid JSON when provided`);
  }
  return value;
}

function validateComponentType(value: unknown, fallback: ComponentTypeInput): ComponentTypeInput {
  if (value === undefined) return fallback;
  if (value === 'FRONTEND' || value === 'BACKEND' || value === 'FULLSTACK') return value;
  throw new Error('type must be FRONTEND, BACKEND, or FULLSTACK');
}

function validateRuntime(value: unknown): ComponentRuntimeInput {
  if (value === undefined) return 'PEOPLECLAW_CLOUD';
  if (value === 'PEOPLECLAW_CLOUD' || value === 'USER_BYO_NODE' || value === 'EDGE') return value;
  throw new Error('runtime must be PEOPLECLAW_CLOUD, USER_BYO_NODE, or EDGE');
}

async function runTool(ctx: AppAgentToolContext, name: string, args: Record<string, any>): Promise<{ summary: string; result: unknown }> {
  const prisma = getPrisma();
  const app = await requireScopedApp(ctx);

  if (name === 'inspect_current_app') {
    const [componentCount, connectionCount, scheduledTaskCount, storeRecordCount] = await Promise.all([
      prisma.component.count({ where: { appId: app.id } }),
      prisma.componentConnection.count({ where: { appId: app.id } }),
      prisma.scheduledTask.count({ where: { appId: app.id } }),
      prisma.appStoreRecord.count({ where: { tenantId: ctx.tenantId, appId: app.id } }),
    ]);
    const result = {
      app: {
        id: app.id,
        name: app.name,
        description: app.description,
        createdAt: app.createdAt.toISOString(),
        updatedAt: app.updatedAt.toISOString(),
      },
      counts: { components: componentCount, connections: connectionCount, scheduledTasks: scheduledTaskCount, appStoreRecords: storeRecordCount },
    };
    return { summary: `Inspected app “${app.name}”: ${componentCount} components, ${connectionCount} connections.`, result };
  }

  if (name === 'list_app_modules') {
    const includeSourcePreview = Boolean(args.includeSourcePreview);
    const components = await prisma.component.findMany({ where: { appId: app.id }, orderBy: { createdAt: 'asc' } });
    const items = components.map(c => sanitizeComponent(c, includeSourcePreview));
    const result = {
      app: { id: app.id, name: app.name },
      modules: items.filter(i => i.kind === 'module'),
      pages: items.filter(i => i.kind === 'page'),
      components: items.filter(i => i.kind === 'component'),
      all: items,
    };
    return { summary: `Listed ${items.length} app items: ${result.pages.length} pages, ${result.modules.length} modules, ${result.components.length} components.`, result };
  }

  if (name === 'create_app_component') {
    const kind = args.kind;
    if (!['component', 'module', 'page'].includes(kind)) throw new Error('kind must be component, module, or page');
    const itemName = typeof args.name === 'string' ? args.name.trim() : '';
    if (!itemName) throw new Error('name is required');
    const fallbackType: ComponentTypeInput = kind === 'module' ? 'BACKEND' : 'FRONTEND';
    const type = validateComponentType(args.type, fallbackType);
    const runtime = validateRuntime(args.runtime);
    const component = await prisma.component.create({
      data: {
        appId: app.id,
        name: itemName,
        type: type as any,
        runtime: runtime as any,
        code: typeof args.code === 'string' ? args.code : '',
        inputSchema: safeJsonSchemaText(args.inputSchema, 'inputSchema'),
        outputSchema: safeJsonSchemaText(args.outputSchema, 'outputSchema'),
        icon: typeof args.icon === 'string' ? args.icon.slice(0, 40) : undefined,
        canvasX: typeof args.canvasX === 'number' ? Math.trunc(args.canvasX) : 0,
        canvasY: typeof args.canvasY === 'number' ? Math.trunc(args.canvasY) : 0,
        isExported: typeof args.isExported === 'boolean' ? args.isExported : kind === 'page',
      },
    });
    const result = { component: sanitizeComponent(component, true) };
    return { summary: `Created ${kind} “${component.name}” (${component.id}).`, result };
  }

  if (name === 'update_app_component') {
    const componentId = typeof args.componentId === 'string' ? args.componentId : '';
    if (!componentId) throw new Error('componentId is required');
    const existing = await prisma.component.findFirst({ where: { id: componentId, appId: app.id, app: { tenantId: ctx.tenantId } } });
    if (!existing) throw new Error('component not found');
    const data: Record<string, unknown> = {};
    if (args.name !== undefined) {
      const nextName = typeof args.name === 'string' ? args.name.trim() : '';
      if (!nextName) throw new Error('name must be a non-empty string');
      data.name = nextName;
    }
    if (args.code !== undefined) {
      if (typeof args.code !== 'string') throw new Error('code must be a string');
      data.code = args.code;
      data.compiledArtifacts = null;
    }
    if (args.inputSchema !== undefined) data.inputSchema = safeJsonSchemaText(args.inputSchema, 'inputSchema');
    if (args.outputSchema !== undefined) data.outputSchema = safeJsonSchemaText(args.outputSchema, 'outputSchema');
    if (args.icon !== undefined) data.icon = typeof args.icon === 'string' && args.icon.trim() ? args.icon.slice(0, 40) : null;
    if (args.canvasX !== undefined) {
      if (typeof args.canvasX !== 'number') throw new Error('canvasX must be a number');
      data.canvasX = Math.trunc(args.canvasX);
    }
    if (args.canvasY !== undefined) {
      if (typeof args.canvasY !== 'number') throw new Error('canvasY must be a number');
      data.canvasY = Math.trunc(args.canvasY);
    }
    if (args.isExported !== undefined) {
      if (typeof args.isExported !== 'boolean') throw new Error('isExported must be a boolean');
      data.isExported = args.isExported;
    }
    if (!Object.keys(data).length) throw new Error('No safe update fields were provided');
    const component = await prisma.component.update({ where: { id: existing.id }, data });
    const result = { component: sanitizeComponent(component, true), updatedFields: Object.keys(data) };
    return { summary: `Updated component “${component.name}” (${component.id}): ${Object.keys(data).join(', ')}.`, result };
  }

  throw new Error(`Unsupported tool: ${name}`);
}

export async function executeAppAgentTool(ctx: AppAgentToolContext, toolCall: ToolCall): Promise<AppAgentExecutedTool> {
  try {
    const args = validateToolCall(appAgentTools, toolCall) as Record<string, any>;
    const { summary, result } = await runTool(ctx, toolCall.name, args);
    return {
      toolName: toolCall.name,
      summary,
      result,
      message: {
        role: 'toolResult',
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: 'text', text: JSON.stringify({ ok: true, summary, result }) }],
        details: result,
        isError: false,
        timestamp: Date.now(),
      },
    };
  } catch (error) {
    const summary = error instanceof Error ? error.message : String(error);
    return {
      toolName: toolCall.name,
      summary,
      result: { ok: false, error: summary },
      message: {
        role: 'toolResult',
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: 'text', text: JSON.stringify({ ok: false, error: summary }) }],
        details: { error: summary },
        isError: true,
        timestamp: Date.now(),
      },
    };
  }
}

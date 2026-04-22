/**
 * Starter workflow provisioned into every newly created tenant.
 *
 * PLANET-922 P3.14: Replaces the old facade-workflow seeding. New tenants
 * now get exactly ONE real, runnable workflow (the Shopify Product Listing
 * demo) and an otherwise empty workspace with a Step Library.
 *
 * Keep this in sync with apps/admin/scripts/seed-workflows.mjs (which
 * provisions the same workflow into the default tenant for the demo DB).
 */
export const STARTER_WORKFLOW = {
  // Stable slug-style id; suffixed per-tenant when written so we don't
  // collide on the global Workflow.id PK.
  baseId: 'starter-shopify-product-listing',
  name: 'Shopify Product Listing (Starter)',
  category: 'E-commerce',
  description:
    'A ready-to-run starter workflow: capture a product, generate AI copy, get human approval, push to Shopify.',
  icon: '🛍️',
  definition: {
    description:
      'A ready-to-run starter workflow: capture a product, generate AI copy, get human approval, push to Shopify.',
    icon: '🛍️',
    steps: [],
    nodes: [
      { id: 's1', type: 'create_case', kind: 'auto', handler: 'create_case', config: { fields: ['title', 'features', 'vendor'] } },
      { id: 's2', type: 'human:review', kind: 'human', config: { prompt: 'Review the product input' } },
      { id: 's3', type: 'ai_description', kind: 'auto', handler: 'ai.product_description', config: {} },
      { id: 's4', type: 'human:approve_copy', kind: 'human', config: { prompt: 'Approve the AI-generated copy?' } },
      { id: 's5', type: 'shopify_upload', kind: 'auto', handler: 'shopify.list_product', config: {} },
    ],
    edges: [
      { source: 's1', target: 's2' },
      { source: 's2', target: 's3' },
      { source: 's3', target: 's4' },
      { source: 's4', target: 's5' },
    ],
  },
};

/**
 * PLANET-1065: Default workflow seeded for brand-new tenants.
 * Triggered by GET /api/workflows when the tenant has zero workflows.
 * Nodes laid out horizontally (200px apart).
 */
export const DEFAULT_WORKFLOW = {
  baseId: 'default-workflow',
  name: '商品工作流1',
  category: '默认流程',
  definition: {
    // steps[] is what the canvas hydrate() reads — must be populated.
    // nodes[] is retained for position-restore compatibility.
    steps: [
      { id: 'd2', name: 'AI 标题生成',          type: 'agent', assignee: 'ai.generate_title',       description: '', position: { x: 200,  y: 0 } },
      { id: 'd3', name: 'AI 图片生成',          type: 'agent', assignee: 'ai.image_generate',       description: '', position: { x: 400,  y: 0 } },
      { id: 'd4', name: 'AI 生成商品描述',      type: 'agent', assignee: 'ai.product_description',  description: '', position: { x: 600,  y: 0 } },
      { id: 'd5', name: '更新库存',             type: 'agent', assignee: 'shopify.update_inventory', description: '', position: { x: 800,  y: 0 } },
      { id: 'd6', name: '上架商品到Shopify',    type: 'agent', assignee: 'shopify.list_product',    description: '', position: { x: 1000, y: 0 } },
    ],
    nodes: [
      { id: 'd2', position: { x: 200,  y: 0 } },
      { id: 'd3', position: { x: 400,  y: 0 } },
      { id: 'd4', position: { x: 600,  y: 0 } },
      { id: 'd5', position: { x: 800,  y: 0 } },
      { id: 'd6', position: { x: 1000, y: 0 } },
    ],
    edges: [
      { source: 'd1', target: 'd2' },
      { source: 'd2', target: 'd3' },
      { source: 'd3', target: 'd4' },
      { source: 'd4', target: 'd5' },
      { source: 'd5', target: 'd6' },
    ],
  },
};

/**
 * PLANET-1068: Second default workflow — Shopify order fulfilment pipeline.
 * 3 nodes laid out horizontally (200px apart).
 */
export const DEFAULT_WORKFLOW_2 = {
  baseId: 'default-workflow-2',
  name: '商品工作流2',
  category: '默认流程',
  definition: {
    steps: [
      { id: 'e1', name: '拉取订单',   type: 'agent', assignee: 'shopify.fetch_orders',       description: '', position: { x: 0,   y: 0 } },
      { id: 'e2', name: '更新库存',   type: 'agent', assignee: 'shopify.update_inventory',   description: '', position: { x: 200, y: 0 } },
      { id: 'e3', name: '标记已发货', type: 'agent', assignee: 'shopify.update_order_status', description: '', position: { x: 400, y: 0 } },
    ],
    nodes: [
      { id: 'e1', position: { x: 0,   y: 0 } },
      { id: 'e2', position: { x: 200, y: 0 } },
      { id: 'e3', position: { x: 400, y: 0 } },
    ],
    edges: [
      { source: 'e1', target: 'e2' },
      { source: 'e2', target: 'e3' },
    ],
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function seedDefaultWorkflows(prisma: any, tenantId: string): Promise<void> {
  const id1 = `${DEFAULT_WORKFLOW.baseId}-${tenantId.slice(0, 8)}`;
  const id2 = `${DEFAULT_WORKFLOW_2.baseId}-${tenantId.slice(0, 8)}`;
  await prisma.workflow.createMany({
    data: [
      {
        id: id1,
        tenantId,
        name: DEFAULT_WORKFLOW.name,
        category: DEFAULT_WORKFLOW.category,
        definition: JSON.stringify(DEFAULT_WORKFLOW.definition),
      },
      {
        id: id2,
        tenantId,
        name: DEFAULT_WORKFLOW_2.name,
        category: DEFAULT_WORKFLOW_2.category,
        definition: JSON.stringify(DEFAULT_WORKFLOW_2.definition),
      },
    ],
  });
}

/** @deprecated Use seedDefaultWorkflows instead */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function seedDefaultWorkflow(prisma: any, tenantId: string): Promise<void> {
  return seedDefaultWorkflows(prisma, tenantId);
}

/**
 * Provision the starter workflow into a freshly-created tenant.
 * Called from POST /tenants right after the tenant row is created.
 *
 * `prisma` is typed loosely as `any` because importing the generated
 * PrismaClient type here would create a circular boundary; the route
 * handler that calls this already holds the strongly-typed instance.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function provisionStarterWorkflow(prisma: any, tenantId: string): Promise<void> {
  const id = `${STARTER_WORKFLOW.baseId}-${tenantId.slice(0, 8)}`;
  await prisma.workflow.create({
    data: {
      id,
      tenantId,
      name: STARTER_WORKFLOW.name,
      category: STARTER_WORKFLOW.category,
      definition: JSON.stringify(STARTER_WORKFLOW.definition),
    },
  });
}

// PLANET-1103: Template library — global templates visible to all tenants.
// Hardcoded on the server; no DB storage required.
export const TEMPLATES = [
  {
    id: 'template-product-workflow-1',
    ...DEFAULT_WORKFLOW,
  },
  {
    id: 'template-product-workflow-2',
    ...DEFAULT_WORKFLOW_2,
  },
] as const;

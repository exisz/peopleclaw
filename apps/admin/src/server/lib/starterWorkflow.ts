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
  name: '默认工作流',
  category: '默认流程',
  definition: {
    steps: [],
    nodes: [
      { id: 'd1', type: 'ai.generate_skus',   kind: 'auto', handler: 'ai.generate_skus',        label: 'AI SKU 及价格生成',  config: {}, position: { x: 0,    y: 0 } },
      { id: 'd2', type: 'ai.generate_title',  kind: 'auto', handler: 'ai.generate_title',       label: 'AI 标题生成',        config: {}, position: { x: 200,  y: 0 } },
      { id: 'd3', type: 'ai.image_generate',  kind: 'auto', handler: 'ai.image_generate',       label: 'AI 图片生成',        config: {}, position: { x: 400,  y: 0 } },
      { id: 'd4', type: 'ai.text_generate',   kind: 'auto', handler: 'ai.product_description',  label: 'AI 生成商品描述',    config: {}, position: { x: 600,  y: 0 } },
      { id: 'd5', type: 'shopify.update_inventory', kind: 'auto', handler: 'shopify.update_inventory', label: '更新库存', config: {}, position: { x: 800,  y: 0 } },
      { id: 'd6', type: 'shopify.list_product', kind: 'auto', handler: 'shopify.list_product',  label: '上架商品到 Shopify', config: {}, position: { x: 1000, y: 0 } },
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function seedDefaultWorkflow(prisma: any, tenantId: string): Promise<void> {
  const id = `${DEFAULT_WORKFLOW.baseId}-${tenantId.slice(0, 8)}`;
  await prisma.workflow.create({
    data: {
      id,
      tenantId,
      name: DEFAULT_WORKFLOW.name,
      category: DEFAULT_WORKFLOW.category,
      definition: JSON.stringify(DEFAULT_WORKFLOW.definition),
    },
  });
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

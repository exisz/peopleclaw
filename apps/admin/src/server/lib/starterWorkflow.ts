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
      { id: 's2', type: 'human:review', kind: 'human', config: { prompt: 'Review the product input' }, requiredFields: ['product_name', 'price', 'image_url', 'stock'] },
      { id: 's3', type: 'ai_description', kind: 'auto', handler: 'ai.product_description', config: {} },
      { id: 's4', type: 'human:approve_copy', kind: 'human', config: { prompt: 'Approve the AI-generated copy?' } },
      { id: 's5', type: 'shopify_upload', kind: 'auto', handler: 'shopify.list_product', config: {} },
    ],
    edges: [
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
 *
 * PLANET-1257: Removed create_case step (d1) — cases are created via API,
 * not as a workflow step.
 */
export const DEFAULT_WORKFLOW = {
  baseId: 'default-workflow',
  name: '商品工作流1',
  category: '默认流程',
  definition: {
    steps: [
      { id: 'd2', name: 'AI 标题生成',          type: 'agent', assignee: 'ai.generate_title',       description: '', position: { x: 0,   y: 0 }, requiredFields: ['product_name', 'price', 'image_url', 'stock'] },
      { id: 'd3', name: 'AI 图片生成',          type: 'agent', assignee: 'ai.image_generate',       description: '', position: { x: 175, y: 200 } },
      { id: 'd4', name: 'AI 生成商品描述',      type: 'agent', assignee: 'ai.product_description',  description: '', position: { x: 350, y: 0 } },
      { id: 'd_skus', name: 'AI SKU与价格生成',  type: 'agent', assignee: 'ai.generate_skus',         description: '', position: { x: 525, y: 200 } },
      { id: 'd5', name: '更新库存',             type: 'agent', assignee: 'shopify.update_inventory', description: '', position: { x: 700, y: 0 } },
      { id: 'd6', name: '上架商品到Shopify',    type: 'agent', assignee: 'shopify.list_product',    description: '', position: { x: 875, y: 200 } },
    ],
    nodes: [
      { id: 'd2', position: { x: 0,   y: 0 } },
      { id: 'd3', position: { x: 175, y: 200 } },
      { id: 'd4', position: { x: 350, y: 0 } },
      { id: 'd_skus', position: { x: 525, y: 200 } },
      { id: 'd5', position: { x: 700, y: 0 } },
      { id: 'd6', position: { x: 875, y: 200 } },
    ],
    edges: [
      { source: 'd2', target: 'd3' },
      { source: 'd3', target: 'd4' },
      { source: 'd4', target: 'd_skus' },
      { source: 'd_skus', target: 'd5' },
      { source: 'd5', target: 'd6' },
    ],
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function seedDefaultWorkflows(prisma: any, tenantId: string): Promise<void> {
  const id1 = `${DEFAULT_WORKFLOW.baseId}-${tenantId.slice(0, 8)}`;
  await prisma.workflow.createMany({
    data: [
      {
        id: id1,
        tenantId,
        name: DEFAULT_WORKFLOW.name,
        category: DEFAULT_WORKFLOW.category,
        definition: JSON.stringify(DEFAULT_WORKFLOW.definition),
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

/**
 * PLANET-1372: AI Face Swap workflow template.
 * Same as product workflow but replaces AI image generation with face swap.
 */
export const FACE_SWAP_WORKFLOW = {
  baseId: 'face-swap-workflow',
  name: 'AI换脸工作流',
  category: '电商工具',
  definition: {
    steps: [
      { id: 'fs1', name: 'AI 换脸',             type: 'agent', assignee: 'ai.face_swap',           description: '将原图人脸替换为欧美模特脸', position: { x: 0,   y: 0 }, requiredFields: ['product_name', 'price', 'image_url', 'stock'] },
      { id: 'fs2', name: 'AI 标题生成',          type: 'agent', assignee: 'ai.generate_title',     description: '', position: { x: 175, y: 200 } },
      { id: 'fs3', name: 'AI 生成商品描述',      type: 'agent', assignee: 'ai.product_description', description: '', position: { x: 350, y: 0 } },
      { id: 'fs4', name: 'AI SKU与价格生成',     type: 'agent', assignee: 'ai.generate_skus',      description: '', position: { x: 525, y: 200 } },
      { id: 'fs5', name: '上架商品到Shopify',    type: 'agent', assignee: 'shopify.list_product',   description: '', position: { x: 700, y: 0 } },
    ],
    nodes: [
      { id: 'fs1', position: { x: 0,   y: 0 } },
      { id: 'fs2', position: { x: 175, y: 200 } },
      { id: 'fs3', position: { x: 350, y: 0 } },
      { id: 'fs4', position: { x: 525, y: 200 } },
      { id: 'fs5', position: { x: 700, y: 0 } },
    ],
    edges: [
      { source: 'fs1', target: 'fs2' },
      { source: 'fs2', target: 'fs3' },
      { source: 'fs3', target: 'fs4' },
      { source: 'fs4', target: 'fs5' },
    ],
  },
};

// PLANET-1103: Template library — global templates visible to all tenants.
// PLANET-1257: Removed shopify-direct-listing and product-workflow-2 templates.
// PLANET-1372: Added face-swap workflow template.
export const TEMPLATES = [
  {
    id: 'template-product-workflow-1',
    ...DEFAULT_WORKFLOW,
  },
  {
    id: 'template-face-swap-workflow',
    ...FACE_SWAP_WORKFLOW,
  },
] as const;

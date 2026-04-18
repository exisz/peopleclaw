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

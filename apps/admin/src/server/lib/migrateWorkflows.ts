import { getPrisma } from './prisma.js';

/**
 * PLANET-1371: Ensure all default workflows have requiredFields on first step.
 * Runs once at startup. Idempotent.
 */
/**
 * PLANET-1372: Seed face-swap workflow for existing tenants that don't have it.
 */
export async function seedFaceSwapWorkflow(): Promise<void> {
  const prisma = getPrisma();
  const { FACE_SWAP_WORKFLOW } = await import('./starterWorkflow.js');

  const tenants = await prisma.tenant.findMany({ select: { id: true } });

  for (const tenant of tenants) {
    const id = `${FACE_SWAP_WORKFLOW.baseId}-${tenant.id.slice(0, 8)}`;
    const exists = await prisma.workflow.findUnique({ where: { id } });
    if (exists) continue;

    try {
      await prisma.workflow.create({
        data: {
          id,
          tenantId: tenant.id,
          name: FACE_SWAP_WORKFLOW.name,
          category: FACE_SWAP_WORKFLOW.category,
          definition: JSON.stringify(FACE_SWAP_WORKFLOW.definition),
        },
      });
      console.log(`[seed-face-swap] created workflow for tenant ${tenant.id}`);
    } catch (e) {
      console.warn(`[seed-face-swap] failed for ${tenant.id}:`, e);
    }
  }
}

export async function migrateRequiredFields(): Promise<void> {
  const prisma = getPrisma();
  // Find ALL workflows (not just default-workflow-*) and add requiredFields to first step
  // if the first step's assignee is 'ai.generate_title' (the standard first step)
  const workflows = await prisma.workflow.findMany({});

  const REQUIRED = ['product_name', 'price', 'image_url', 'stock'];

  for (const wf of workflows) {
    try {
      const def = JSON.parse(wf.definition);
      const steps = def.steps ?? [];
      if (!steps.length) continue;

      // Only add to workflows whose first step is ai.generate_title (standard product workflow)
      const firstStep = steps[0];
      if (firstStep.assignee !== 'ai.generate_title' && firstStep.id !== 'd2') continue;
      if (
        firstStep.requiredFields &&
        REQUIRED.every((f: string) => firstStep.requiredFields.includes(f))
      ) {
        continue; // Already migrated
      }

      // Add requiredFields to first step
      steps[0] = { ...firstStep, requiredFields: REQUIRED };
      def.steps = steps;

      await prisma.workflow.update({
        where: { id: wf.id },
        data: { definition: JSON.stringify(def) },
      });
      console.log(`[migrate-requiredFields] updated workflow ${wf.id}`);
    } catch (e) {
      console.warn(`[migrate-requiredFields] failed for ${wf.id}:`, e);
    }
  }
}

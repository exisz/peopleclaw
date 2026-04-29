import { getPrisma } from './prisma.js';

/**
 * PLANET-1371: Ensure all default workflows have requiredFields on first step.
 * Runs once at startup. Idempotent.
 */
export async function migrateRequiredFields(): Promise<void> {
  const prisma = getPrisma();
  // Find all workflows whose id starts with 'default-workflow-'
  const workflows = await prisma.workflow.findMany({
    where: { id: { startsWith: 'default-workflow-' } },
  });

  const REQUIRED = ['product_name', 'price', 'image_url', 'stock'];

  for (const wf of workflows) {
    try {
      const def = JSON.parse(wf.definition);
      const steps = def.steps ?? [];
      if (!steps.length) continue;

      // Check if first step already has the correct requiredFields
      const firstStep = steps[0];
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

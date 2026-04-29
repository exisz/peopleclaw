import { getPrisma } from './prisma.js';

/**
 * PLANET-1371: Ensure all default workflows have requiredFields on first step.
 * Runs once at startup. Idempotent.
 */
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

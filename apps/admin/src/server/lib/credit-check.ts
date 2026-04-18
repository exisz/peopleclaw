import { getPrisma } from './prisma.js';

export class InsufficientCreditsError extends Error {
  constructor(public required: number, public available: number) {
    super(`Insufficient credits: need ${required}, have ${available}`);
    this.name = 'InsufficientCreditsError';
  }
}

/**
 * Deduct from Tenant.credits (atomic) and write a UsageLog row carrying both tenantId+userId.
 * Free actions (cost <= 0) skip and return -1.
 */
export async function checkAndDeductCredit(
  tenantId: string,
  userId: number,
  cost: number,
  action: string,
  metadata: Record<string, unknown> = {},
): Promise<number> {
  if (cost <= 0) return -1;
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new InsufficientCreditsError(cost, 0);
    if (tenant.credits < cost) throw new InsufficientCreditsError(cost, tenant.credits);
    const updated = await tx.tenant.update({
      where: { id: tenantId },
      data: { credits: { decrement: cost } },
    });
    await tx.usageLog.create({
      data: {
        tenantId,
        userId,
        action,
        creditsUsed: cost,
        metadata: JSON.stringify(metadata),
      },
    });
    return updated.credits;
  });
}

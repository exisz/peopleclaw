import { getPrisma } from './prisma.js';

export class InsufficientCreditsError extends Error {
  constructor(public required: number, public available: number) {
    super(`Insufficient credits: need ${required}, have ${available}`);
    this.name = 'InsufficientCreditsError';
  }
}

export async function checkAndDeductCredit(
  userId: number,
  cost: number,
  action: string,
  metadata: Record<string, unknown> = {},
): Promise<number> {
  if (cost <= 0) return -1; // free action, skip
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new InsufficientCreditsError(cost, 0);
    if (user.credits < cost) throw new InsufficientCreditsError(cost, user.credits);
    const updated = await tx.user.update({
      where: { id: userId },
      data: { credits: { decrement: cost } },
    });
    await tx.usageLog.create({
      data: { userId, action, creditsUsed: cost, metadata: JSON.stringify(metadata) },
    });
    return updated.credits;
  });
}

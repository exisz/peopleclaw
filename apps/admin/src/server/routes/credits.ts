import { Router } from 'express';
import Stripe from 'stripe';
import { CREDIT_PACKS } from '../lib/credits.js';
import { getPrisma } from '../lib/prisma.js';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth.js';
import { requireTenant, type TenantedRequest } from '../middleware/tenant.js';

export const creditsRouter = Router();

// Public: list packs
creditsRouter.get('/credits/packs', (_req, res) => {
  res.json({ packs: CREDIT_PACKS });
});

// Authed + tenant: create checkout for tenant
creditsRouter.post('/credits/checkout', requireAuth, requireTenant, async (req, res) => {
  const r = req as unknown as TenantedRequest;
  const { packId } = req.body ?? {};
  const pack = CREDIT_PACKS.find((p) => p.id === packId);
  if (!pack) { res.status(400).json({ error: 'invalid packId' }); return; }
  if (!process.env.STRIPE_SECRET_KEY) { res.status(503).json({ error: 'Stripe not configured' }); return; }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const baseUrl = process.env.APP_URL || 'https://app.peopleclaw.rollersoft.com.au';

    // Lazy-create Stripe customer for tenant
    let customerId = r.tenant.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: r.tenant.name,
        email: r.user.email ?? undefined,
        metadata: { tenantId: r.tenant.id, tenantSlug: r.tenant.slug },
      });
      customerId = customer.id;
      const prisma = getPrisma();
      await prisma.tenant.update({ where: { id: r.tenant.id }, data: { stripeCustomerId: customerId } });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: 'aud',
            product_data: { name: `PeopleClaw - ${pack.name} (${pack.credits} credits)` },
            unit_amount: pack.price,
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/credits/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/credits?canceled=1`,
      metadata: {
        tenantId: r.tenant.id,
        tenantSlug: r.tenant.slug,
        userId: String(r.user.id),
        packId: pack.id,
        credits: String(pack.credits),
      },
    });
    res.json({ url: session.url, id: session.id });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// Authed + tenant: usage log scoped to tenant
creditsRouter.get('/credits/usage', requireAuth, requireTenant, async (req, res) => {
  const r = req as unknown as TenantedRequest;
  const prisma = getPrisma();
  const logs = await prisma.usageLog.findMany({
    where: { tenantId: r.tenant.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json({
    tenant: { credits: r.tenant.credits, plan: r.tenant.plan },
    logs: logs.map((l) => ({
      ...l,
      metadata: safeParse(l.metadata),
    })),
  });
});

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}

// silence unused-import lint
void (null as unknown as AuthedRequest);

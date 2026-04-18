import { Router, type Request, type Response } from 'express';
import express from 'express';
import Stripe from 'stripe';
import { getPrisma } from '../lib/prisma.js';

export const stripeWebhookRouter = Router();

// Stripe needs the raw body to verify signatures. We register raw parser only on this route.
stripeWebhookRouter.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const sig = req.header('stripe-signature');
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) { res.status(503).json({ error: 'Stripe not configured' }); return; }

    let event: Stripe.Event;
    try {
      const stripe = new Stripe(stripeKey);
      if (secret && sig) {
        event = stripe.webhooks.constructEvent(req.body as Buffer, sig, secret);
      } else if (process.env.NODE_ENV !== 'production') {
        // Dev fallback: accept event without verification (logged warning).
        // PLANET-912: Production is REQUIRED to have STRIPE_WEBHOOK_SECRET set; never skip verify in prod.
        console.warn('[stripe-webhook] STRIPE_WEBHOOK_SECRET missing — accepting event without verification (dev only)');
        event = JSON.parse((req.body as Buffer).toString('utf8')) as Stripe.Event;
      } else {
        // Production hard refusal — never silently accept unsigned webhooks.
        console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET missing in production — refusing event');
        res.status(503).json({ error: 'Stripe webhook secret not configured' });
        return;
      }
    } catch (e) {
      res.status(400).json({ error: 'Invalid signature: ' + (e instanceof Error ? e.message : String(e)) });
      return;
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.metadata?.tenantId;
      const userIdStr = session.metadata?.userId;
      const packId = session.metadata?.packId;
      const credits = parseInt(session.metadata?.credits || '0', 10);
      const userId = userIdStr ? parseInt(userIdStr, 10) : NaN;

      if (tenantId && credits > 0) {
        const prisma = getPrisma();
        await prisma.$transaction(async (tx) => {
          await tx.tenant.update({
            where: { id: tenantId },
            data: {
              credits: { increment: credits },
              stripeCustomerId: typeof session.customer === 'string' ? session.customer : undefined,
            },
          });
          await tx.usageLog.create({
            data: {
              tenantId,
              userId: Number.isFinite(userId) ? userId : 0,
              action: 'purchase',
              creditsAdded: credits,
              packId,
              amountPaid: session.amount_total ?? null,
              metadata: JSON.stringify({ stripeSessionId: session.id }),
            },
          });
        });
        console.log(`[stripe-webhook] +${credits} credits → tenantId=${tenantId} pack=${packId}`);
      } else if (Number.isFinite(userId) && credits > 0) {
        // Legacy fallback (pre-multitenant sessions)
        const prisma = getPrisma();
        await prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: userId },
            data: {
              credits: { increment: credits },
              stripeCustomerId: typeof session.customer === 'string' ? session.customer : undefined,
            },
          });
          await tx.usageLog.create({
            data: {
              userId,
              action: 'purchase',
              creditsAdded: credits,
              packId,
              amountPaid: session.amount_total ?? null,
              metadata: JSON.stringify({ stripeSessionId: session.id, legacy: true }),
            },
          });
        });
        console.log(`[stripe-webhook] (legacy) +${credits} credits → userId=${userId} pack=${packId}`);
      }
    }

    res.json({ received: true });
  },
);

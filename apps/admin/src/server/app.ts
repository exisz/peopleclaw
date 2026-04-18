import express, { type Express } from 'express';
import { healthRouter } from './routes/health.js';
import { meRouter } from './routes/me.js';
import { casesRouter } from './routes/cases.js';
import { workflowsRouter } from './routes/workflows.js';
import { creditsRouter } from './routes/credits.js';
import { stripeWebhookRouter } from './routes/stripeWebhook.js';
import { tenantsRouter } from './routes/tenants.js';

export function createApp(): Express {
  const app = express();

  // Stripe webhook needs raw body — mount BEFORE express.json
  app.use('/api', stripeWebhookRouter);

  app.use(express.json({ limit: '1mb' }));
  app.use('/api', healthRouter);
  app.use('/api', meRouter);
  app.use('/api', workflowsRouter);
  app.use('/api', creditsRouter);
  app.use('/api', tenantsRouter);
  app.use('/api', casesRouter);
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  return app;
}

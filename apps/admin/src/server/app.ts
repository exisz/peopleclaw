import express, { type Express } from 'express';
import { checkEnv } from './lib/env-check.js';
import { healthRouter } from './routes/health.js';
import { meRouter } from './routes/me.js';
import { casesRouter } from './routes/cases.js';
import { workflowsRouter } from './routes/workflows.js';
import { creditsRouter } from './routes/credits.js';
import { stripeWebhookRouter } from './routes/stripeWebhook.js';
import { tenantsRouter } from './routes/tenants.js';
import { stepTemplatesRouter } from './routes/step-templates.js';
import { internalRouter } from './routes/internal.js';
import { testRouter } from './routes/test.js';

export function createApp(): Express {
  // PLANET-912 item 8: validate env at startup (warn, don't crash)
  checkEnv();
  const app = express();

  // Stripe webhook needs raw body — mount BEFORE express.json
  app.use('/api', stripeWebhookRouter);

  app.use(express.json({ limit: '1mb' }));
  app.use('/api', healthRouter);
  app.use('/api', meRouter);
  app.use('/api', workflowsRouter);
  app.use('/api', creditsRouter);
  app.use('/api', tenantsRouter);
  app.use('/api', stepTemplatesRouter);
  app.use('/api', internalRouter);
  if (process.env.E2E_TEST_TOKEN) {
    app.use('/api', testRouter);
  }
  app.use('/api', casesRouter);
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  return app;
}

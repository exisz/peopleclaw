import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { checkEnv } from './lib/env-check.js';
import { healthRouter } from './routes/health.js';
import { meRouter } from './routes/me.js';
import { casesRouter } from './routes/cases.js';
import { workflowsRouter } from './routes/workflows.js';
import { workflowRunRouter } from './routes/workflowRun.js';
import { creditsRouter } from './routes/credits.js';
import { stripeWebhookRouter } from './routes/stripeWebhook.js';
import { tenantsRouter } from './routes/tenants.js';
import { stepTemplatesRouter } from './routes/step-templates.js';
import { templatesRouter } from './routes/templates.js';
import { internalRouter } from './routes/internal.js';
import { logtoEmailWebhookRouter } from './routes/logto-email-webhook.js';
import { testRouter } from './routes/test.js';

export function createApp(): Express {
  // PLANET-912 item 8: validate env at startup (warn, don't crash)
  checkEnv();
  const app = express();

  // Stripe webhook needs raw body — mount BEFORE express.json
  app.use('/api', stripeWebhookRouter);

  // PLANET-1045: Logto → Resend email bridge (no auth middleware, uses own secret check)
  app.use('/api', logtoEmailWebhookRouter);

  app.use(express.json({ limit: '1mb' }));
  app.use('/api', healthRouter);
  app.use('/api', meRouter);
  app.use('/api', workflowsRouter);
  app.use('/api', workflowRunRouter);
  app.use('/api', creditsRouter);
  app.use('/api', tenantsRouter);
  app.use('/api', stepTemplatesRouter);
  app.use('/api', templatesRouter);
  app.use('/api', internalRouter);
  if (process.env.E2E_TEST_TOKEN) {
    app.use('/api', testRouter);
  }
  app.use('/api', casesRouter);
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // 5xx error handler — attach X-Build-SHA and return JSON
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev-local';
    res.setHeader('X-Build-SHA', sha);
    const status = (err as { status?: number; statusCode?: number })?.status ?? 500;
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(status >= 400 ? status : 500).json({ error: message });
  });

  return app;
}

import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { checkEnv } from './lib/env-check.js';
import { healthRouter } from './routes/health.js';
import { meRouter } from './routes/me.js';
import { creditsRouter } from './routes/credits.js';
import { stripeWebhookRouter } from './routes/stripeWebhook.js';
import { tenantsRouter } from './routes/tenants.js';
import { internalRouter } from './routes/internal.js';
import { uploadRouter, uploadThingHandler } from './routes/upload.js';
import { logtoEmailWebhookRouter } from './routes/logto-email-webhook.js';
import { appsRouter } from './routes/apps.js';
import { chatRouter } from './routes/chat.js';
import { probeTestRouter } from './routes/probe-test.js';
import { componentRunRouter } from './routes/components/run.js';
import { componentCompileRouter } from './routes/components/compile.js';
import { componentServerRouter } from './routes/components/server.js';
import { componentClientRouter } from './routes/components/client.js';
import { componentDetailRouter } from './routes/components/detail.js';
import { templatesRouter } from './routes/templates.js';

export function createApp(): Express {
  checkEnv();
  const app = express();

  // Stripe webhook needs raw body — mount BEFORE express.json
  app.use('/api', stripeWebhookRouter);

  // PLANET-1045: Logto → Resend email bridge
  app.use('/api', logtoEmailWebhookRouter);

  // PLANET-1342: UploadThing needs raw body stream
  app.use('/api/uploadthing', uploadThingHandler);

  app.use(express.json({ limit: '5mb' }));
  app.use('/api', healthRouter);
  app.use('/api', meRouter);
  app.use('/api', creditsRouter);
  app.use('/api', tenantsRouter);
  app.use('/api', internalRouter);
  app.use('/api', uploadRouter);
  app.use('/api', templatesRouter);
  app.use('/api', appsRouter);
  app.use('/api', chatRouter);
  app.use('/api', probeTestRouter);
  app.use('/api', componentRunRouter);
  app.use('/api', componentCompileRouter);
  app.use('/api', componentServerRouter);
  app.use('/api', componentClientRouter);
  app.use('/api', componentDetailRouter);
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // 5xx error handler
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

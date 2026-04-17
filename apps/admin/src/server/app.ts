import express, { type Express } from 'express';
import { healthRouter } from './routes/health.js';
import { meRouter } from './routes/me.js';

export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api', healthRouter);
  app.use('/api', meRouter);
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  return app;
}

import { Router } from 'express';

/**
 * Internal endpoints protected elsewhere as needed. Connector-specific cron
 * work belongs in App artifacts or scheduled-task records, not core routes.
 */
export const internalRouter = Router();

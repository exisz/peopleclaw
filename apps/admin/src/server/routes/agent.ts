/**
 * PLANET-1385: CopilotKit AG-UI agent endpoint.
 * Provides an AI chat backend using the CopilotKit runtime with OpenAI adapter.
 */
import { Router } from 'express';
import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNodeExpressEndpoint,
} from '@copilotkit/runtime';

export const agentRouter = Router();

const serviceAdapter = new OpenAIAdapter({
  model: 'gpt-4o-mini',
});

const runtime = new CopilotRuntime();

const handler = copilotRuntimeNodeExpressEndpoint({
  runtime,
  serviceAdapter,
  endpoint: '/api/agent',
});

// Mount as POST (CopilotKit uses POST for chat completions)
agentRouter.all('/agent', (req, res) => {
  return handler(req, res);
});

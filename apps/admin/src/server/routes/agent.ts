/**
 * PLANET-1385: CopilotKit AG-UI agent endpoint using official runtime.
 * Uses DeepSeek (OpenAI-compatible).
 */
import { Router } from 'express';
import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNodeExpressEndpoint,
} from '@copilotkit/runtime';
import OpenAI from 'openai';

export const agentRouter = Router();

const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || '';
const baseURL = process.env.DEEPSEEK_API_KEY
  ? 'https://api.deepseek.com'
  : 'https://api.openai.com/v1';
const model = process.env.DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini';

const openai = new OpenAI({ apiKey, baseURL });

const serviceAdapter = new OpenAIAdapter({ openai: openai as any, model });
const runtime = new CopilotRuntime();

// The handler gets req.url relative to the router mount point.
// Since agentRouter is mounted at '/api', req.url will be '/agent'.
const handler = copilotRuntimeNodeExpressEndpoint({
  runtime,
  serviceAdapter,
  endpoint: '/agent',
});

// CopilotKit client may POST to various sub-paths
agentRouter.all('/agent', handler);
agentRouter.all('/agent/*', handler);

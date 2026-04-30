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

const handler = copilotRuntimeNodeExpressEndpoint({
  runtime,
  serviceAdapter,
  endpoint: '/api/copilotkit',
});

// Catch ALL paths under this router (wildcard)
agentRouter.all('*', handler);

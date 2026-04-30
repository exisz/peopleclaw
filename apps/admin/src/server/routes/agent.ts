/**
 * PLANET-1385: Lightweight AG-UI agent endpoint.
 * Proxies CopilotKit frontend requests to DeepSeek (OpenAI-compatible).
 * No @copilotkit/runtime dependency — avoids Vercel routing/bundling issues.
 */
import { Router, type Request, type Response } from 'express';
import OpenAI from 'openai';

export const agentRouter = Router();

const getClient = () => {
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || '';
  const baseURL = process.env.DEEPSEEK_API_KEY
    ? 'https://api.deepseek.com'
    : 'https://api.openai.com/v1';
  return {
    client: new OpenAI({ apiKey, baseURL }),
    model: process.env.DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini',
  };
};

agentRouter.post('/agent', async (req: Request, res: Response) => {
  try {
    const { messages, actions } = req.body || {};

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }

    const { client, model } = getClient();

    // Build tools from CopilotKit actions if provided
    const tools =
      actions?.map((action: any) => ({
        type: 'function' as const,
        function: {
          name: action.name,
          description: action.description,
          parameters: action.parameters || { type: 'object', properties: {} },
        },
      })) || undefined;

    const createParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
      model,
      messages: messages.map((m: any) => ({
        role: m.role,
        content: m.content,
        ...(m.name && { name: m.name }),
        ...(m.tool_calls && { tool_calls: m.tool_calls }),
        ...(m.tool_call_id && { tool_call_id: m.tool_call_id }),
      })),
      stream: true,
      ...(tools && tools.length > 0 && { tools }),
    };

    const response = await client.chat.completions.create(createParams);

    // Stream SSE response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    for await (const chunk of response) {
      const data = JSON.stringify(chunk);
      res.write(`data: ${data}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('[agent] Error:', error?.message || error);
    if (!res.headersSent) {
      res.status(500).json({ error: error?.message || 'Agent error' });
    }
  }
});

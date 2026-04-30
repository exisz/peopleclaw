/**
 * PLANET-1385: Simple chat endpoint — proxies to DeepSeek or OpenAI.
 * Streams SSE responses back to the client.
 */
import { Router } from 'express';
import OpenAI from 'openai';

export const chatRouter = Router();

const SYSTEM_PROMPT = `You are PeopleClaw AI — the intelligent workflow automation assistant.
You help users create automated workflows, track cases, configure connections, and understand their data.
Respond in the same language the user uses. Be concise and helpful.`;

function getClient() {
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || '';
  const baseURL = process.env.DEEPSEEK_API_KEY
    ? 'https://api.deepseek.com'
    : 'https://api.openai.com/v1';
  const model = process.env.DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini';
  return { client: new OpenAI({ apiKey, baseURL }), model };
}

chatRouter.post('/chat', async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const { client, model } = getClient();

  const fullMessages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    ...messages,
  ];

  try {
    const response = await client.chat.completions.create({
      model,
      messages: fullMessages,
      stream: true,
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    for await (const chunk of response) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: unknown) {
    console.error('[/api/chat] Error:', err);
    if (!res.headersSent) {
      const message = err instanceof Error ? err.message : 'Internal error';
      res.status(500).json({ error: message });
    } else {
      res.end();
    }
  }
});

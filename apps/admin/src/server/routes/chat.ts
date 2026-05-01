import { Router } from 'express';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTenant } from '../middleware/tenant.js';

export const chatRouter = Router();

// POST /api/chat — streaming chat (text only, no tool-calling)
chatRouter.post('/chat', requireAuth, requireTenant, async (req, res) => {
  const { messages } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages[] is required' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
    return;
  }

  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: 'You are PeopleClaw AI assistant. Help users build their apps. Respond concisely.',
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  });

  // Stream text deltas as newline-delimited text
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-cache');

  for await (const chunk of result.textStream) {
    res.write(chunk);
  }
  res.end();
});

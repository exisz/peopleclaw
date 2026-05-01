import { Router } from 'express';
import { streamText, tool, stepCountIs, zodSchema } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTenant, type TenantedRequest } from '../middleware/tenant.js';
import { getPrisma } from '../lib/prisma.js';
import { type AppTemplate } from '../seed/templates/ecommerce-starter.js';
import { starterAppTemplate } from '../seed/templates/starter-app.js';
import { distillProbes } from '../compiler/distill-probes.js';

export const chatRouter = Router();

const TEMPLATES: Record<string, AppTemplate> = {
  'starter-app': starterAppTemplate,
};

// POST /api/chat — streaming chat with tool-calling (PLANET-1434)
chatRouter.post('/chat', requireAuth, requireTenant, async (req, res) => {
  const r = req as unknown as TenantedRequest;
  const { messages, appId } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages[] is required' });
    return;
  }
  if (!appId || typeof appId !== 'string') {
    res.status(400).json({ error: 'appId is required' });
    return;
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured' });
    return;
  }

  const prisma = getPrisma();
  const tenantId = r.tenant.id;

  // Verify app belongs to tenant
  const app = await prisma.app.findFirst({ where: { id: appId, tenantId } });
  if (!app) {
    res.status(404).json({ error: 'app not found' });
    return;
  }

  const deepseek = createOpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey,
  });

  // SSE setup
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Tool definitions
  const chatTools = {
    list_components: tool({
      description: 'List all components in the current app',
      inputSchema: zodSchema(z.object({})),
      execute: async () => {
        const components = await prisma.component.findMany({
          where: { appId },
          select: { id: true, name: true, type: true, canvasX: true, canvasY: true },
        });
        return { components };
      },
    }),

    add_component: tool({
      description: 'Add a component to the app canvas',
      inputSchema: zodSchema(z.object({
        type: z.enum(['FRONTEND', 'BACKEND', 'FULLSTACK']),
        name: z.string(),
        x: z.number().default(200),
        y: z.number().default(200),
        runtime: z.enum(['PEOPLECLAW_CLOUD', 'USER_BYO_NODE', 'EDGE']).default('PEOPLECLAW_CLOUD'),
      })),
      execute: async ({ type, name, x, y, runtime }: any) => {
        const comp = await prisma.component.create({
          data: { appId, type, name, canvasX: x, canvasY: y, runtime, code: '' },
        });
        sendEvent('component_added', { id: comp.id, name: comp.name, type: comp.type, canvasX: comp.canvasX, canvasY: comp.canvasY });
        return { id: comp.id, name: comp.name };
      },
    }),

    update_component: tool({
      description: 'Update a component (name, position, type)',
      inputSchema: zodSchema(z.object({
        componentId: z.string(),
        name: z.string().optional(),
        x: z.number().optional(),
        y: z.number().optional(),
        type: z.enum(['FRONTEND', 'BACKEND', 'FULLSTACK']).optional(),
      })),
      execute: async ({ componentId, name, x, y, type }: any) => {
        const data: Record<string, unknown> = {};
        if (name !== undefined) data.name = name;
        if (x !== undefined) data.canvasX = x;
        if (y !== undefined) data.canvasY = y;
        if (type !== undefined) data.type = type;
        const comp = await prisma.component.update({ where: { id: componentId }, data });
        sendEvent('component_updated', { id: comp.id, name: comp.name, type: comp.type, canvasX: comp.canvasX, canvasY: comp.canvasY });
        return { id: comp.id, name: comp.name };
      },
    }),

    delete_component: tool({
      description: 'Delete a component from the app',
      inputSchema: zodSchema(z.object({
        componentId: z.string(),
      })),
      execute: async ({ componentId }: any) => {
        await prisma.component.delete({ where: { id: componentId } });
        sendEvent('component_deleted', { id: componentId });
        return { deleted: componentId };
      },
    }),

    add_connection: tool({
      description: 'Add a connection between two components',
      inputSchema: zodSchema(z.object({
        fromComponentId: z.string(),
        toComponentId: z.string(),
        type: z.enum(['TRIGGER', 'DATA_FLOW']),
      })),
      execute: async ({ fromComponentId, toComponentId, type }: any) => {
        const conn = await prisma.componentConnection.create({
          data: { appId, fromComponentId, toComponentId, type },
        });
        sendEvent('connection_added', { id: conn.id, fromComponentId, toComponentId, type });
        return { id: conn.id };
      },
    }),

    delete_connection: tool({
      description: 'Delete a connection',
      inputSchema: zodSchema(z.object({
        connectionId: z.string(),
      })),
      execute: async ({ connectionId }: any) => {
        await prisma.componentConnection.delete({ where: { id: connectionId } });
        sendEvent('connection_deleted', { id: connectionId });
        return { deleted: connectionId };
      },
    }),

    apply_template: tool({
      description: 'Apply a template to the current app, creating its components and connections. Available templates: starter-app',
      inputSchema: zodSchema(z.object({
        templateId: z.string(),
      })),
      execute: async ({ templateId }: any) => {
        const template = TEMPLATES[templateId];
        if (!template) return { error: `Template "${templateId}" not found` };

        const componentIds: string[] = [];
        for (const comp of template.components) {
          const probes = (comp.type === 'BACKEND' || comp.type === 'FULLSTACK')
            ? JSON.stringify(distillProbes(comp.code))
            : null;
          const created = await prisma.component.create({
            data: {
              appId,
              name: comp.name,
              type: comp.type as any,
              runtime: 'PEOPLECLAW_CLOUD',
              icon: comp.icon,
              code: comp.code,
              canvasX: comp.canvasX,
              canvasY: comp.canvasY,
              probes,
            },
          });
          componentIds.push(created.id);
          sendEvent('component_added', { id: created.id, name: created.name, type: created.type, canvasX: created.canvasX, canvasY: created.canvasY });
        }

        const connections: string[] = [];
        for (const conn of template.connections) {
          const created = await prisma.componentConnection.create({
            data: {
              appId,
              fromComponentId: componentIds[conn.fromIndex]!,
              toComponentId: componentIds[conn.toIndex]!,
              type: conn.type as any,
            },
          });
          connections.push(created.id);
          sendEvent('connection_added', { id: created.id, fromComponentId: componentIds[conn.fromIndex]!, toComponentId: componentIds[conn.toIndex]!, type: conn.type });
        }

        return { applied: templateId, components: componentIds.length, connections: connections.length };
      },
    }),
  };

  try {
    const result = streamText({
      model: deepseek('deepseek-chat'),
      system: `You are PeopleClaw AI assistant. You help users build apps by manipulating components on a canvas.
You have tools to add, update, delete components and connections, apply templates, and list components.
When the user asks to modify the canvas, use the appropriate tools. After tool calls, summarize what you did concisely in Chinese.
Current app ID: ${appId}`,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      tools: chatTools,
      stopWhen: stepCountIs(10),
    });

    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        sendEvent('text_delta', { text: (part as any).text ?? (part as any).delta ?? '' });
      } else if (part.type === 'tool-call') {
        sendEvent('tool_call', { name: (part as any).toolName, args: (part as any).input });
      } else if (part.type === 'tool-result') {
        sendEvent('tool_result', { name: (part as any).toolName, result: (part as any).output });
      }
    }

    sendEvent('done', {});
  } catch (e: any) {
    sendEvent('error', { message: e.message ?? 'Unknown error' });
  }

  res.end();
});

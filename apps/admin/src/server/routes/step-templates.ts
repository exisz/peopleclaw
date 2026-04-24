import { Router } from 'express';
import { getPrisma } from '../lib/prisma.js';

export const stepTemplatesRouter = Router();

interface StepTemplateRow {
  id: string;
  category: string;
  domain: string;
  labelI18n: string;
  descriptionI18n: string;
  icon: string;
  kind: string;
  handler: string;
  defaultConfig: string;
  inputSchema: string;
  outputSchema: string;
  enabled: boolean;
  builtIn: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function safeJson(s: string, fallback: unknown = {}): unknown {
  try { return JSON.parse(s); } catch { return fallback; }
}

function hydrate(row: StepTemplateRow) {
  return {
    id: row.id,
    category: row.category,
    domain: row.domain,
    label: safeJson(row.labelI18n, {}),
    description: safeJson(row.descriptionI18n, {}),
    icon: row.icon,
    kind: row.kind,
    handler: row.handler,
    defaultConfig: safeJson(row.defaultConfig, {}),
    inputSchema: safeJson(row.inputSchema, {}),
    outputSchema: safeJson(row.outputSchema, {}),
    enabled: row.enabled,
    builtIn: row.builtIn,
    updatedAt: row.updatedAt,
  };
}

// PLANET-1201: hidden until real Imagen re-enabled
const HIDDEN_TEMPLATES = new Set(['ai.image_generate']);

// GET /api/step-templates?domain=ecommerce&category=shopify
stepTemplatesRouter.get('/step-templates', async (req, res) => {
  const prisma = getPrisma();
  const where: Record<string, unknown> = { enabled: true };
  if (typeof req.query.domain === 'string') where.domain = req.query.domain;
  if (typeof req.query.category === 'string') where.category = req.query.category;
  const rows = await prisma.stepTemplate.findMany({
    where,
    orderBy: [{ category: 'asc' }, { id: 'asc' }],
  });
  // PLANET-1201: filter hidden templates from sidebar library
  const visible = rows.filter((r) => !HIDDEN_TEMPLATES.has(r.id));
  res.json({ templates: visible.map((r) => hydrate(r as unknown as StepTemplateRow)) });
});

// GET /api/step-templates/:id
stepTemplatesRouter.get('/step-templates/:id', async (req, res) => {
  const prisma = getPrisma();
  const row = await prisma.stepTemplate.findUnique({ where: { id: req.params.id } });
  if (!row) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.json({ template: hydrate(row as unknown as StepTemplateRow) });
});

#!/usr/bin/env node
/**
 * Seed the 12 built-in StepTemplate rows (PLANET-917).
 * Idempotent via per-id upsert: we keep `builtIn=1` rows authoritative.
 */
import { createClient } from '@libsql/client';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDotEnv() {
  if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) return;
  for (const p of [
    resolve(__dirname, '..', '.env.local'),
    resolve(__dirname, '..', '..', '..', '.env.local'),
    resolve(__dirname, '..', '.env'),
  ]) {
    try {
      const txt = readFileSync(p, 'utf8');
      for (const line of txt.split('\n')) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"\n]*)"?$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
      }
    } catch {}
  }
}
loadDotEnv();

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) {
  console.error('TURSO_DATABASE_URL missing');
  process.exit(1);
}
const db = createClient({ url, authToken });

const TEMPLATES = [
  // PLANET-1043 — Ecommerce Entry (image + price only)
  {
    id: 'ecommerce.entry',
    category: 'entry',
    domain: 'ecommerce',
    labelI18n: { en: 'Ecommerce Entry (Image + Price)', zh: '电商入口（图片 + 金额）' },
    descriptionI18n: {
      en: 'Minimal ecommerce entry node. Accept a product image and price to start a workflow — no name or description required.',
      zh: '最简电商入口节点。只需一张图片和金额即可启动工作流，无需名称或描述。',
    },
    icon: 'ImagePlus',
    kind: 'auto',
    handler: 'ecommerce.entry',
    defaultConfig: { fields: ['image', 'price'] },
    inputSchema: {
      type: 'object',
      required: ['image', 'price'],
      properties: {
        image: { type: 'string', description: 'Product image URL or base64 data URI' },
        price: { type: 'number', description: 'Selling price' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        image: { type: 'string' },
        price: { type: 'number' },
        _entry: { type: 'boolean' },
      },
    },
  },
  // Shopify (5)
  {
    id: 'shopify.list_product',
    category: 'shopify',
    domain: 'ecommerce',
    labelI18n: { en: 'List Product on Shopify', zh: '上架商品到 Shopify' },
    descriptionI18n: {
      en: 'Create a new draft product in your Shopify store.',
      zh: '在 Shopify 店铺中创建草稿商品',
    },
    icon: 'ShoppingBag',
    kind: 'auto',
    handler: 'shopify.list_product',
    defaultConfig: { status: 'draft', vendor: '', product_type: '' },
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        vendor: { type: 'string' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        productId: { type: 'number' },
        productAdminUrl: { type: 'string' },
      },
    },
  },
  {
    id: 'shopify.update_inventory',
    category: 'shopify',
    domain: 'ecommerce',
    labelI18n: { en: 'Update Inventory', zh: '更新库存' },
    descriptionI18n: {
      en: 'Set inventory quantity at a location.',
      zh: '在指定地点设置库存数量',
    },
    icon: 'Package',
    kind: 'auto',
    handler: 'shopify.update_inventory',
    defaultConfig: { location_id: null, quantity: 0 },
    inputSchema: {
      type: 'object',
      properties: { inventory_item_id: { type: 'number' } },
    },
    outputSchema: {
      type: 'object',
      properties: { available: { type: 'number' } },
    },
  },
  {
    id: 'shopify.fetch_orders',
    category: 'shopify',
    domain: 'ecommerce',
    labelI18n: { en: 'Fetch Orders', zh: '拉取订单' },
    descriptionI18n: {
      en: 'Fetch recent orders from Shopify with optional status filter.',
      zh: '从 Shopify 拉取最近订单，可按状态过滤',
    },
    icon: 'ShoppingCart',
    kind: 'auto',
    handler: 'shopify.fetch_orders',
    defaultConfig: { status: 'any', limit: 50 },
    inputSchema: { type: 'object', properties: {} },
    outputSchema: {
      type: 'object',
      properties: { orders: { type: 'array' }, count: { type: 'number' } },
    },
  },
  {
    id: 'shopify.update_order_status',
    category: 'shopify',
    domain: 'ecommerce',
    labelI18n: { en: 'Mark Order Fulfilled', zh: '标记订单已发货' },
    descriptionI18n: {
      en: 'Create a fulfillment for an order in Shopify.',
      zh: '为订单创建履约（标记发货）',
    },
    icon: 'CheckCircle2',
    kind: 'auto',
    handler: 'shopify.update_order_status',
    defaultConfig: { notify_customer: true },
    inputSchema: {
      type: 'object',
      properties: { order_id: { type: 'number' } },
    },
    outputSchema: {
      type: 'object',
      properties: { fulfillmentId: { type: 'number' }, status: { type: 'string' } },
    },
  },
  {
    id: 'shopify.get_product',
    category: 'shopify',
    domain: 'ecommerce',
    labelI18n: { en: 'Get Product', zh: '获取商品' },
    descriptionI18n: {
      en: 'Fetch a single product by ID from Shopify.',
      zh: '通过 ID 从 Shopify 拉取单个商品',
    },
    icon: 'FileText',
    kind: 'auto',
    handler: 'shopify.get_product',
    defaultConfig: {},
    inputSchema: {
      type: 'object',
      properties: { product_id: { type: 'number' } },
    },
    outputSchema: {
      type: 'object',
      properties: { product: { type: 'object' } },
    },
  },
  // AI (3)
  {
    id: 'ai.product_description',
    category: 'ai',
    domain: 'ecommerce',
    labelI18n: { en: 'AI Product Description', zh: 'AI 生成商品描述' },
    descriptionI18n: {
      en: 'Generate a 2-3 sentence product description using GPT.',
      zh: '使用 GPT 生成 2-3 句商品描述',
    },
    icon: 'Sparkles',
    kind: 'auto',
    handler: 'ai.product_description',
    defaultConfig: { model: 'gpt-4o-mini', tone: 'persuasive' },
    inputSchema: {
      type: 'object',
      properties: { title: { type: 'string' }, features: { type: 'string' } },
    },
    outputSchema: {
      type: 'object',
      properties: { description: { type: 'string' } },
    },
  },
  {
    id: 'ai.product_image_caption',
    category: 'ai',
    domain: 'ecommerce',
    labelI18n: { en: 'AI Image Caption', zh: 'AI 图片描述' },
    descriptionI18n: {
      en: 'Generate alt text / caption for a product image.',
      zh: '为商品图片生成 alt 文本/描述',
    },
    icon: 'ImageIcon',
    kind: 'auto',
    handler: 'ai.product_image_caption',
    defaultConfig: { language: 'en' },
    inputSchema: {
      type: 'object',
      properties: { image_url: { type: 'string' } },
    },
    outputSchema: {
      type: 'object',
      properties: { caption: { type: 'string' } },
    },
  },
  {
    id: 'ai.product_translate',
    category: 'ai',
    domain: 'ecommerce',
    labelI18n: { en: 'AI Translate', zh: 'AI 翻译' },
    descriptionI18n: {
      en: 'Translate product copy between languages.',
      zh: '在多语言间翻译商品文案',
    },
    icon: 'Languages',
    kind: 'auto',
    handler: 'ai.product_translate',
    defaultConfig: { source: 'en', target: 'zh' },
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string' } },
    },
    outputSchema: {
      type: 'object',
      properties: { translated: { type: 'string' } },
    },
  },
  // AI image generation — PLANET-1048
  {
    id: 'ai.image_generate',
    category: 'ai',
    domain: 'generic',
    labelI18n: { en: 'AI Image Generation', zh: 'AI \u56fe\u7247\u751f\u6210' },
    descriptionI18n: {
      en: 'Generate an image from a text prompt using OpenAI gpt-image-1. Returns a permanent image URL.',
      zh: '\u4f7f\u7528 OpenAI gpt-image-1 \u6839\u636e\u6587\u5b57 prompt \u751f\u6210\u56fe\u7247\uff0c\u8fd4\u56de\u6c38\u4e45 URL\u3002',
    },
    icon: 'Wand2',
    kind: 'auto',
    handler: 'ai.image_generate',
    defaultConfig: { aspectRatio: '1:1' },
    inputSchema: {
      type: 'object',
      required: ['prompt'],
      properties: {
        prompt: { type: 'string', description: 'Image generation prompt' },
        aspectRatio: {
          type: 'string',
          enum: ['1:1', '4:3', '3:4', '16:9', '9:16'],
          default: '1:1',
          description: 'Output aspect ratio',
        },
        referenceImage: {
          type: 'string',
          description: 'Optional reference image URL for style/composition guidance',
        },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        imageUrl: { type: 'string', description: 'Permanent URL of the generated image' },
        prompt: { type: 'string' },
        aspectRatio: { type: 'string' },
        model: { type: 'string' },
      },
    },
  },
  // Generic (4)
  {
    id: 'generic.http_request',
    category: 'generic',
    domain: 'generic',
    labelI18n: { en: 'HTTP Request', zh: 'HTTP 请求' },
    descriptionI18n: {
      en: 'Send an HTTP request to any URL with custom method/headers/body.',
      zh: '向任意 URL 发送 HTTP 请求，可自定义 method/headers/body',
    },
    icon: 'Globe',
    kind: 'auto',
    handler: 'generic.http_request',
    defaultConfig: { url: '', method: 'GET', headers: {}, body: null },
    inputSchema: { type: 'object', properties: {} },
    outputSchema: {
      type: 'object',
      properties: {
        status: { type: 'number' },
        body: {},
        headers: { type: 'object' },
      },
    },
  },
  {
    id: 'generic.transform_json',
    category: 'generic',
    domain: 'generic',
    labelI18n: { en: 'Transform JSON', zh: '转换 JSON' },
    descriptionI18n: {
      en: 'Apply a JSONPath expression to extract / transform data.',
      zh: '使用 JSONPath 表达式提取/转换数据',
    },
    icon: 'Code2',
    kind: 'auto',
    handler: 'generic.transform_json',
    defaultConfig: { path: '$', sourceKey: null },
    inputSchema: { type: 'object', properties: {} },
    outputSchema: {
      type: 'object',
      properties: { result: {} },
    },
  },
  {
    id: 'generic.condition',
    category: 'generic',
    domain: 'generic',
    labelI18n: { en: 'Condition (Branch)', zh: '条件分支' },
    descriptionI18n: {
      en: 'Evaluate a JS-style boolean expression against payload to branch flow.',
      zh: '对 payload 求值布尔表达式，分支决定下一步',
    },
    icon: 'GitBranch',
    kind: 'auto',
    handler: 'generic.condition',
    defaultConfig: {
      condition: "input.status === 'done'",
      nextStepIfTrue: null,
      nextStepIfFalse: null,
    },
    inputSchema: { type: 'object', properties: {} },
    outputSchema: {
      type: 'object',
      properties: { result: { type: 'boolean' } },
    },
  },
  {
    id: 'generic.delay',
    category: 'generic',
    domain: 'generic',
    labelI18n: { en: 'Delay', zh: '等待' },
    descriptionI18n: {
      en: 'Pause execution for a fixed number of seconds.',
      zh: '暂停执行指定秒数',
    },
    icon: 'Clock',
    kind: 'auto',
    handler: 'generic.delay',
    defaultConfig: { seconds: 1 },
    inputSchema: { type: 'object', properties: {} },
    outputSchema: {
      type: 'object',
      properties: { waitedMs: { type: 'number' } },
    },
  },
];

async function main() {
  console.log('[seed-step-templates] target:', url);
  console.log('[seed-step-templates] templates:', TEMPLATES.length);

  let inserted = 0;
  let updated = 0;
  for (const t of TEMPLATES) {
    const existing = await db.execute({
      sql: 'SELECT id FROM StepTemplate WHERE id = ? LIMIT 1',
      args: [t.id],
    });
    const sql = existing.rows.length
      ? `UPDATE StepTemplate SET
            category = ?, domain = ?, labelI18n = ?, descriptionI18n = ?,
            icon = ?, kind = ?, handler = ?, defaultConfig = ?,
            inputSchema = ?, outputSchema = ?, enabled = 1, builtIn = 1,
            updatedAt = CURRENT_TIMESTAMP
          WHERE id = ?`
      : `INSERT INTO StepTemplate
            (id, category, domain, labelI18n, descriptionI18n, icon, kind, handler,
             defaultConfig, inputSchema, outputSchema, enabled, builtIn,
             createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
    const args = existing.rows.length
      ? [
          t.category, t.domain, JSON.stringify(t.labelI18n), JSON.stringify(t.descriptionI18n),
          t.icon, t.kind, t.handler, JSON.stringify(t.defaultConfig),
          JSON.stringify(t.inputSchema), JSON.stringify(t.outputSchema),
          t.id,
        ]
      : [
          t.id, t.category, t.domain, JSON.stringify(t.labelI18n), JSON.stringify(t.descriptionI18n),
          t.icon, t.kind, t.handler, JSON.stringify(t.defaultConfig),
          JSON.stringify(t.inputSchema), JSON.stringify(t.outputSchema),
        ];
    await db.execute({ sql, args });
    if (existing.rows.length) updated += 1; else inserted += 1;
  }

  console.log(`[seed-step-templates] inserted=${inserted} updated=${updated}`);

  const r = await db.execute(`SELECT category, COUNT(*) as n FROM StepTemplate GROUP BY category ORDER BY category`);
  for (const row of r.rows) console.log(`  - ${row.category}: ${row.n}`);
  const total = await db.execute(`SELECT COUNT(*) as n FROM StepTemplate`);
  console.log(`[seed-step-templates] total: ${total.rows[0].n}`);
}

main().catch((e) => {
  console.error('[seed-step-templates] FAILED:', e);
  process.exit(1);
});

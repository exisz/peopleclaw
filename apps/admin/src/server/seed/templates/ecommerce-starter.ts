/**
 * Ecommerce Starter — 电商起步 预制 App template (PLANET-1422)
 *
 * Creates 3 components + 2 connections that demonstrate a real
 * Shopify product listing flow using PEOPLECLAW_CLOUD runtime.
 */

import type { ComponentType, ConnectionType } from '../../generated/prisma/index.js';

export interface TemplateComponent {
  name: string;
  type: ComponentType;
  icon: string;
  code: string;
  canvasX: number;
  canvasY: number;
}

export interface TemplateConnection {
  fromIndex: number; // index into components array
  toIndex: number;
  type: ConnectionType;
}

export interface AppTemplate {
  id: string;
  name: string;
  description: string;
  components: TemplateComponent[];
  connections: TemplateConnection[];
}

const BACKEND_CODE = `import { peopleClaw } from '@peopleclaw/sdk';

export default async function run(input: any, ctx: any) {
  await peopleClaw.nodeEntry('loadConnection');
  await peopleClaw.nodeEntry('fetchProducts');

  const shop = ctx.env.SHOPIFY_DEV_SHOP;
  const token = ctx.env.SHOPIFY_DEV_ADMIN_TOKEN;
  const url = \`https://\${shop}/admin/api/2024-10/products.json?limit=50\`;

  const res = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': token },
  });
  const data = await res.json();

  await peopleClaw.nodeEntry('done');
  return {
    products: (data.products ?? []).map((p: any) => ({
      id: p.id,
      title: p.title,
      image: p.images?.[0]?.src ?? null,
      price: p.variants?.[0]?.price ?? '0.00',
    })),
  };
}
`;

const FRONTEND_CODE = `import { peopleClaw } from '@peopleclaw/sdk';

export default async function run(input: any, ctx: any) {
  await peopleClaw.nodeEntry('renderForm');
  // Frontend search form — sends query downstream
  const query = input?.query ?? '';
  await peopleClaw.nodeEntry('done');
  return { query };
}
`;

const FULLSTACK_CODE = `import { peopleClaw } from '@peopleclaw/sdk';

// --- SERVER ---
export async function server(ctx: any) {
  await peopleClaw.nodeEntry('fetchProducts');
  const shop = ctx.env.SHOPIFY_DEV_SHOP;
  const token = ctx.env.SHOPIFY_DEV_ADMIN_TOKEN;
  const url = \`https://\${shop}/admin/api/2024-10/products.json?limit=20\`;
  const res = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': token },
  });
  const data = await res.json();
  await peopleClaw.nodeEntry('done');
  return {
    products: (data.products ?? []).map((p: any) => ({
      id: p.id,
      title: p.title,
      image: p.images?.[0]?.src ?? null,
      price: p.variants?.[0]?.price ?? '0.00',
    })),
  };
}

// --- CLIENT ---
export function Client({ data }: { data: any }) {
  const products = data?.products ?? [];
  return (
    <div style={{ padding: '1rem', fontFamily: 'system-ui' }}>
      <h2>🛍️ 商品列表</h2>
      {products.length === 0 && <p>无商品数据</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {products.map((p: any) => (
          <li key={p.id} style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {p.image && <img src={p.image} alt={p.title} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} />}
            <span><strong>{p.title}</strong> — \${p.price}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
`;

export const ecommerceStarterTemplate: AppTemplate = {
  id: 'ecommerce-starter',
  name: '电商起步',
  description: 'Shopify 商品搜索 + 拉取 + 展示，3 组件联动',
  components: [
    {
      name: '商品搜索',
      type: 'FRONTEND',
      icon: '🔍',
      code: FRONTEND_CODE,
      canvasX: 100,
      canvasY: 200,
    },
    {
      name: 'Shopify 商品列表',
      type: 'BACKEND',
      icon: '🛍️',
      code: BACKEND_CODE,
      canvasX: 400,
      canvasY: 200,
    },
    {
      name: '商品列表卡片',
      type: 'FULLSTACK',
      icon: '📋',
      code: FULLSTACK_CODE,
      canvasX: 700,
      canvasY: 200,
    },
  ],
  connections: [
    { fromIndex: 0, toIndex: 1, type: 'TRIGGER' },
    { fromIndex: 1, toIndex: 2, type: 'DATA_FLOW' },
  ],
};

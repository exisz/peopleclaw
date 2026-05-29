/**
 * Ecommerce Starter — product search and listing modules.
 *
 * Code/functions/routes are the primitive; there is no graph, layout, or
 * visual workflow model in starter apps.
 */

import type { ComponentType } from '../../generated/prisma/index.js';

export interface TemplateComponent {
  name: string;
  type: ComponentType;
  icon: string;
  code: string;
  /** PLANET-1461: when true, this app module is callable via ctx.callApp from sibling functions. */
  isExported?: boolean;
}


export interface AppTemplate {
  id: string;
  name: string;
  description: string;
  components: TemplateComponent[];
}

const PRODUCT_SYNC_CODE = `export default async function run(input: any, ctx: any) {

  const shop = ctx.env.SHOPIFY_DEV_SHOP;
  const token = ctx.env.SHOPIFY_DEV_ADMIN_TOKEN;
  const url = \`https://\${shop}/admin/api/2024-10/products.json?limit=50\`;

  const res = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': token },
  });
  const data = await res.json();
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

const PRODUCT_SEARCH_CODE = `export default async function run(input: any, ctx: any) {
  // Product search form — sends query downstream
  const query = input?.query ?? '';
  return { query };
}
`;

const PRODUCT_LIST_PAGE_CODE = `// --- SERVER ---
export async function server(ctx: any) {
  const shop = ctx.env.SHOPIFY_DEV_SHOP;
  const token = ctx.env.SHOPIFY_DEV_ADMIN_TOKEN;
  const url = \`https://\${shop}/admin/api/2024-10/products.json?limit=20\`;
  const res = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': token },
  });
  const data = await res.json();
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
  description: 'Shopify product search and display starter app',
  components: [
    {
      name: '商品搜索',
      type: 'FRONTEND',
      icon: '🔍',
      code: PRODUCT_SEARCH_CODE,
    },
    {
      name: 'Shopify 商品列表',
      type: 'BACKEND',
      icon: '🛍️',
      code: PRODUCT_SYNC_CODE,
    },
    {
      name: '商品列表卡片',
      type: 'FULLSTACK',
      icon: '📋',
      code: PRODUCT_LIST_PAGE_CODE,
    },
  ],
};

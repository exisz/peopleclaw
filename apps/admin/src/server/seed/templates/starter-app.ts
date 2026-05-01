/**
 * Starter App — 起步示例 (PLANET-1428)
 *
 * 3 components on one canvas:
 * 1. FRONTEND 'AI 换脸-表单' (file + fields + submit)
 * 2. BACKEND 'AI 换脸-处理' (3-step probe stub)
 * 3. FULLSTACK 'Shopify 商品列表' (server fetch + client grid)
 *
 * Connection: 1→2 TRIGGER (submit triggers backend)
 * No connection to/from 3 — independent on same canvas.
 */
import type { AppTemplate } from './ecommerce-starter.js';

const FRONTEND_CODE = `import { useState } from 'react';

export function Client({ onSubmit }: { onSubmit?: (data: any) => void }) {
  const [file, setFile] = useState<string | null>(null);
  const [targetFace, setTargetFace] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleFile = (e: any) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setFile(reader.result as string);
    reader.readAsDataURL(f);
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();
    if (!file) return;
    if (onSubmit) onSubmit({ imageUrl: file, targetFace });
    setSubmitted(true);
  };

  if (submitted) return <p style={{ color: 'green' }}>✅ 已提交，等待后端处理...</p>;

  return (
    <form onSubmit={handleSubmit} style={{ padding: '1rem', fontFamily: 'system-ui', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 360 }}>
      <h2>🎭 AI 换脸 - 上传</h2>
      <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>原始图片</label>
      <input type="file" accept="image/*" onChange={handleFile} data-testid="face-swap-file-input" />
      {file && <img src={file} alt="preview" style={{ width: 160, borderRadius: 8 }} />}
      <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>目标脸型 (可选)</label>
      <input
        name="targetFace"
        placeholder="e.g. celebrity name"
        value={targetFace}
        onChange={e => setTargetFace(e.target.value)}
        style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4 }}
      />
      <button
        type="submit"
        disabled={!file}
        data-testid="face-swap-submit-btn"
        style={{ padding: '0.5rem 1rem', background: '#0070f3', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', opacity: file ? 1 : 0.5 }}
      >
        提交换脸
      </button>
    </form>
  );
}

export default Client;
`;

const BACKEND_CODE = `import { peopleClaw } from '@peopleclaw/sdk';

export default async function run(input: any, ctx: any) {
  await peopleClaw.nodeEntry('uploadOriginal');

  const imageUrl = input?.imageUrl ?? 'https://placekitten.com/400/400';
  const targetFace = input?.targetFace ?? 'default';

  await peopleClaw.nodeEntry('callFaceSwapAPI');

  // TODO: v2 接真 provider (Replicate / fal.ai)
  await new Promise(resolve => setTimeout(resolve, 500));

  await peopleClaw.nodeEntry('saveResult');

  return {
    swappedUrl: imageUrl,
    faceMatched: true,
    provider: 'stub-v1',
    targetFace,
  };
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
      <h2>🛍️ Shopify 商品列表</h2>
      {products.length === 0 && <p>无商品数据</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
        {products.map((p: any) => (
          <div key={p.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: '0.75rem', textAlign: 'center' }}>
            {p.image && <img src={p.image} alt={p.title} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 4 }} />}
            <p style={{ fontWeight: 600, fontSize: '0.875rem', marginTop: '0.5rem' }}>{p.title}</p>
            <p style={{ color: '#666', fontSize: '0.75rem' }}>\${p.price}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
`;

export const starterAppTemplate: AppTemplate = {
  id: 'starter-app',
  name: '起步示例 App',
  description: 'AI 换脸 (表单→后端) + Shopify 商品列表，3 组件演示',
  components: [
    {
      name: 'AI 换脸-表单',
      type: 'FRONTEND',
      icon: '🎭',
      code: FRONTEND_CODE,
      canvasX: 150,
      canvasY: 200,
    },
    {
      name: 'AI 换脸-处理',
      type: 'BACKEND',
      icon: '⚙️',
      code: BACKEND_CODE,
      canvasX: 500,
      canvasY: 200,
    },
    {
      name: 'Shopify 商品列表',
      type: 'FULLSTACK',
      icon: '🛍️',
      code: FULLSTACK_CODE,
      canvasX: 350,
      canvasY: 450,
    },
  ],
  connections: [
    { fromIndex: 0, toIndex: 1, type: 'TRIGGER' },
  ],
};

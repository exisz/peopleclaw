/**
 * Form Starter — 表单 starter (PLANET-1424)
 * FRONTEND form + BACKEND submit handler, connected via TRIGGER.
 */
import type { AppTemplate } from './ecommerce-starter.js';

const FRONTEND_CODE = `import { useState } from 'react';

export default function FormStarter({ onSubmit }: { onSubmit?: (data: any) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: any) => {
    e.preventDefault();
    if (onSubmit) onSubmit({ name, email });
    setSubmitted(true);
  };

  if (submitted) return <p style={{ color: 'green' }}>✅ 已提交</p>;

  return (
    <form onSubmit={handleSubmit} style={{ padding: '1rem', fontFamily: 'system-ui', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 320 }}>
      <h2>📝 表单</h2>
      <input name="name" placeholder="姓名" value={name} onChange={e => setName(e.target.value)} style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4 }} />
      <input name="email" type="email" placeholder="邮箱" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4 }} />
      <button type="submit" style={{ padding: '0.5rem 1rem', background: '#0070f3', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>提交</button>
    </form>
  );
}
`;

const BACKEND_CODE = `import { peopleClaw } from '@peopleclaw/sdk';

export default async function run(input: any, ctx: any) {
  await peopleClaw.nodeEntry('validate');

  const { name, email } = input ?? {};
  // Validation: log but always proceed (demo mode)
  const valid = !!(name && email);

  await peopleClaw.nodeEntry('save');

  // Stub: in real app, save to DB
  const savedId = 'saved-' + Date.now();

  return { ok: true, savedId, valid };
}
`;

export const formStarterTemplate: AppTemplate = {
  id: 'form-starter',
  name: '表单 Starter',
  description: '前端表单 + 后端提交处理，TRIGGER 连接',
  components: [
    {
      name: '表单',
      type: 'FRONTEND',
      icon: '📝',
      code: FRONTEND_CODE,
      canvasX: 150,
      canvasY: 200,
    },
    {
      name: '表单提交',
      type: 'BACKEND',
      icon: '💾',
      code: BACKEND_CODE,
      canvasX: 500,
      canvasY: 200,
    },
  ],
  connections: [
    { fromIndex: 0, toIndex: 1, type: 'TRIGGER' },
  ],
};

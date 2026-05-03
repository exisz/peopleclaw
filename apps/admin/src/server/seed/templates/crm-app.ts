/**
 * CRM App Template — 第 2 模板 (PLANET-1542)
 *
 * 4 components, connector-free, demos that PeopleClaw is a generic platform.
 * All data lives in ctx.appStore (generic per-App KV — Core-allowed primitive,
 * §1.4 compliant, no SaaS-specific schema).
 *
 * Component layout (matches DoD spec verbatim):
 *   1. FRONTEND  '联系人表单'   — name/email/phone/company/tags
 *   2. FULLSTACK '联系人列表'   — server reads, client renders table
 *   3. FRONTEND  '跟进记录表单' — pick contact + type + note
 *   4. FULLSTACK '跟进时间线'   — server reads, client renders timeline
 *
 * Each FULLSTACK exports BOTH `server` (display) AND `default` (write handler).
 * Form's onSubmit hits TRIGGER target's /run endpoint, which invokes the
 * `default` export → writes to ctx.appStore. Reopening the FULLSTACK tab
 * re-fetches /server → fresh data appears.
 *
 * Connections:
 *   [联系人表单] ──TRIGGER──▶ [联系人列表]
 *   [跟进记录表单] ──TRIGGER──▶ [跟进时间线]
 */
import type { AppTemplate } from './ecommerce-starter.js';

const CONTACT_FORM_CODE = `import { useState } from 'react';

export function Client({ onSubmit }: { onSubmit?: (data: any) => Promise<any> | void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!name) return;
    setLoading(true);
    setError(null);
    try {
      const res = onSubmit ? await onSubmit({ name, email, phone, company, tags }) : null;
      if (res) setSaved(res);
      setName(''); setEmail(''); setPhone(''); setCompany(''); setTags('');
    } catch (err: any) {
      setError(err?.message ?? '保存失败');
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} data-testid="crm-contact-form" style={{ padding: '1rem', fontFamily: 'system-ui', display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 360 }}>
      <h2>👤 新增联系人</h2>
      <input data-testid="crm-contact-name" placeholder="姓名" value={name} onChange={e => setName(e.target.value)} style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4 }} />
      <input data-testid="crm-contact-email" placeholder="邮箱" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4 }} />
      <input data-testid="crm-contact-phone" placeholder="电话" value={phone} onChange={e => setPhone(e.target.value)} style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4 }} />
      <input data-testid="crm-contact-company" placeholder="公司" value={company} onChange={e => setCompany(e.target.value)} style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4 }} />
      <input data-testid="crm-contact-tags" placeholder="标签 (逗号分隔)" value={tags} onChange={e => setTags(e.target.value)} style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4 }} />
      {error && <p style={{ color: 'red', fontSize: '0.85rem' }}>{error}</p>}
      {saved && saved.id && <p data-testid="crm-contact-saved" style={{ color: '#0a7c2a', fontSize: '0.85rem' }}>已保存：{saved.name}</p>}
      <button data-testid="crm-contact-submit" type="submit" disabled={!name || loading} style={{ padding: '0.5rem 1rem', background: '#0070f3', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', opacity: name && !loading ? 1 : 0.5 }}>
        {loading ? '保存中...' : '保存联系人'}
      </button>
    </form>
  );
}

export default Client;
`;

/**
 * FULLSTACK '联系人列表' — server reads + default writes (TRIGGER target).
 */
const CONTACT_LIST_FULLSTACK_CODE = `import { peopleClaw } from '@peopleclaw/sdk';

// --- WRITE PATH (TRIGGER target — invoked by form's onSubmit via /run) ---
export default async function writeContact(input: any, ctx: any) {
  await peopleClaw.nodeEntry('validate');
  const name = (input?.name || '').trim();
  if (!name) return { ok: false, error: 'NAME_REQUIRED' };
  await peopleClaw.nodeEntry('persist');
  const tags = (input?.tags || '').toString()
    .split(',').map((s: string) => s.trim()).filter(Boolean);
  const row = ctx?.appStore
    ? ctx.appStore.insert('contacts', {
        name,
        email: input?.email || '',
        phone: input?.phone || '',
        company: input?.company || '',
        tags,
      })
    : { id: 'noop', name };
  await peopleClaw.nodeEntry('done');
  return { ok: true, id: row.id, name: row.name };
}

// --- READ PATH (display — invoked by /server) ---
export async function server(ctx: any) {
  await peopleClaw.nodeEntry('loadContacts');
  const contacts = ctx?.appStore ? ctx.appStore.list('contacts') : [];
  const followups = ctx?.appStore ? ctx.appStore.list('followups') : [];
  const lastByContact = new Map<string, number>();
  for (const f of followups) {
    const prev = lastByContact.get(f.contactId) || 0;
    if (f.createdAt > prev) lastByContact.set(f.contactId, f.createdAt);
  }
  await peopleClaw.nodeEntry('done');
  return {
    ok: true,
    contacts: contacts.map((c: any) => ({
      id: c.id,
      name: c.name,
      company: c.company || '',
      lastFollowupAt: lastByContact.get(c.id) || null,
    })),
  };
}

// --- CLIENT (display) ---
export function Client({ data, refresh }: { data: any; refresh?: () => void }) {
  const contacts = (data && data.contacts) || [];
  return (
    <div data-testid="crm-contact-list" style={{ padding: '1rem', fontFamily: 'system-ui' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>📇 联系人列表 ({contacts.length})</h2>
        {refresh && <button data-testid="crm-contact-list-refresh" onClick={refresh} style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer' }}>刷新</button>}
      </div>
      {contacts.length === 0 && <p data-testid="crm-contact-list-empty" style={{ color: '#666' }}>还没有联系人，先去新增一个 →</p>}
      {contacts.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: '#f6f6f6' }}>
              <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>姓名</th>
              <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>公司</th>
              <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>最后跟进</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c: any) => (
              <tr key={c.id} data-testid={'crm-contact-row-' + c.id}>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{c.name}</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee', color: '#555' }}>{c.company || '—'}</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee', color: '#888', fontSize: '0.8rem' }}>
                  {c.lastFollowupAt ? new Date(c.lastFollowupAt).toLocaleString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
`;

const FOLLOWUP_FORM_CODE = `import { useState } from 'react';

export function Client({ onSubmit }: { onSubmit?: (data: any) => Promise<any> | void }) {
  const [contactId, setContactId] = useState('');
  const [type, setType] = useState('call');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<any>(null);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!contactId) {
      setError('请输入联系人 ID');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = onSubmit ? await onSubmit({ contactId, type, note }) : null;
      if (res) setSaved(res);
      setNote('');
    } catch (err: any) {
      setError(err?.message ?? '保存失败');
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} data-testid="crm-followup-form" style={{ padding: '1rem', fontFamily: 'system-ui', display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 360 }}>
      <h2>📞 记录跟进</h2>
      <input data-testid="crm-followup-contact-id" placeholder="联系人 ID (从列表复制)" value={contactId} onChange={e => setContactId(e.target.value)} style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4 }} />
      <select data-testid="crm-followup-type" value={type} onChange={e => setType(e.target.value)} style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4 }}>
        <option value="call">📞 电话</option>
        <option value="email">✉️ 邮件</option>
        <option value="meeting">🤝 会议</option>
      </select>
      <textarea data-testid="crm-followup-note" placeholder="备注" value={note} onChange={e => setNote(e.target.value)} rows={3} style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4, fontFamily: 'inherit' }} />
      {error && <p style={{ color: 'red', fontSize: '0.85rem' }}>{error}</p>}
      {saved && saved.id && <p data-testid="crm-followup-saved" style={{ color: '#0a7c2a', fontSize: '0.85rem' }}>已记录跟进 ✓</p>}
      <button data-testid="crm-followup-submit" type="submit" disabled={!contactId || loading} style={{ padding: '0.5rem 1rem', background: '#0070f3', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', opacity: contactId && !loading ? 1 : 0.5 }}>
        {loading ? '保存中...' : '保存跟进'}
      </button>
    </form>
  );
}

export default Client;
`;

/**
 * FULLSTACK '跟进时间线' — server reads + default writes (TRIGGER target).
 */
const TIMELINE_FULLSTACK_CODE = `import { peopleClaw } from '@peopleclaw/sdk';

// --- WRITE PATH ---
export default async function writeFollowup(input: any, ctx: any) {
  await peopleClaw.nodeEntry('validate');
  const contactId = (input?.contactId || '').trim();
  if (!contactId) return { ok: false, error: 'CONTACT_ID_REQUIRED' };
  const type = ['call', 'email', 'meeting'].includes(input?.type) ? input.type : 'call';
  await peopleClaw.nodeEntry('persist');
  const row = ctx?.appStore
    ? ctx.appStore.insert('followups', {
        contactId,
        type,
        note: (input?.note || '').toString(),
      })
    : { id: 'noop' };
  await peopleClaw.nodeEntry('done');
  return { ok: true, id: row.id };
}

// --- READ PATH ---
export async function server(ctx: any) {
  await peopleClaw.nodeEntry('loadFollowups');
  const followups = ctx?.appStore ? ctx.appStore.list('followups') : [];
  const contacts = ctx?.appStore ? ctx.appStore.list('contacts') : [];
  const nameById = new Map<string, string>();
  for (const c of contacts) nameById.set(c.id, c.name);
  const sorted = [...followups].sort((a: any, b: any) => b.createdAt - a.createdAt);
  await peopleClaw.nodeEntry('done');
  return {
    ok: true,
    items: sorted.map((f: any) => ({
      id: f.id,
      contactId: f.contactId,
      contactName: nameById.get(f.contactId) || '(未知联系人)',
      type: f.type,
      note: f.note || '',
      at: f.createdAt,
    })),
  };
}

// --- CLIENT ---
export function Client({ data, refresh }: { data: any; refresh?: () => void }) {
  const items = (data && data.items) || [];
  const typeIcon = (t: string) => t === 'email' ? '✉️' : t === 'meeting' ? '🤝' : '📞';
  return (
    <div data-testid="crm-followup-timeline" style={{ padding: '1rem', fontFamily: 'system-ui' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>🕒 跟进时间线 ({items.length})</h2>
        {refresh && <button data-testid="crm-followup-timeline-refresh" onClick={refresh} style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer' }}>刷新</button>}
      </div>
      {items.length === 0 && <p data-testid="crm-followup-timeline-empty" style={{ color: '#666' }}>还没有任何跟进记录</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((it: any) => (
          <li key={it.id} data-testid={'crm-followup-row-' + it.id} style={{ padding: '0.6rem 0', borderBottom: '1px solid #eee' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span><strong>{typeIcon(it.type)} {it.contactName}</strong></span>
              <span style={{ color: '#888', fontSize: '0.75rem' }}>{new Date(it.at).toLocaleString()}</span>
            </div>
            {it.note && <p style={{ color: '#444', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>{it.note}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
`;

export const CRM_APP_CONTACT_FORM_NAME = '联系人表单';
export const CRM_APP_CONTACT_LIST_NAME = '联系人列表';
export const CRM_APP_FOLLOWUP_FORM_NAME = '跟进记录表单';
export const CRM_APP_TIMELINE_NAME = '跟进时间线';

export const crmAppTemplate: AppTemplate = {
  id: 'crm-app',
  name: 'CRM 起步示例 App',
  description:
    '联系人 + 跟进记录 — connector-free 的本地 CRM，证明 PeopleClaw 不是只能做电商',
  components: [
    {
      name: CRM_APP_CONTACT_FORM_NAME,
      type: 'FRONTEND',
      icon: '👤',
      code: CONTACT_FORM_CODE,
      canvasX: 150,
      canvasY: 150,
    },
    {
      name: CRM_APP_CONTACT_LIST_NAME,
      type: 'FULLSTACK',
      icon: '📇',
      code: CONTACT_LIST_FULLSTACK_CODE,
      canvasX: 550,
      canvasY: 150,
    },
    {
      name: CRM_APP_FOLLOWUP_FORM_NAME,
      type: 'FRONTEND',
      icon: '📞',
      code: FOLLOWUP_FORM_CODE,
      canvasX: 150,
      canvasY: 450,
    },
    {
      name: CRM_APP_TIMELINE_NAME,
      type: 'FULLSTACK',
      icon: '🕒',
      code: TIMELINE_FULLSTACK_CODE,
      canvasX: 550,
      canvasY: 450,
    },
  ],
  connections: [
    { fromIndex: 0, toIndex: 1, type: 'TRIGGER' }, // 联系人表单 → 联系人列表
    { fromIndex: 2, toIndex: 3, type: 'TRIGGER' }, // 跟进记录表单 → 跟进时间线
  ],
};

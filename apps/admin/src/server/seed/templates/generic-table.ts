/**
 * Generic Table — 通用表格 (PLANET-1424)
 * FULLSTACK: server returns rows[], client auto-renders <table> from row keys.
 */
import type { AppTemplate } from './ecommerce-starter.js';

const FULLSTACK_CODE = `import { peopleClaw } from '@peopleclaw/sdk';

// --- SERVER ---
export const server = async (ctx: any) => {
  await peopleClaw.nodeEntry('loadRows');

  // Demo data — replace with real DB/API call
  const rows = [
    { id: 1, name: '张三', email: 'zhangsan@example.com', role: '管理员' },
    { id: 2, name: '李四', email: 'lisi@example.com', role: '编辑' },
    { id: 3, name: '王五', email: 'wangwu@example.com', role: '观察者' },
  ];

  return { rows };
};

// --- CLIENT ---
export const Client = ({ data }: { data: any }) => {
  const rows = data?.rows ?? [];
  if (rows.length === 0) return <p>无数据</p>;
  const columns = Object.keys(rows[0]);
  return (
    <div style={{ padding: '1rem', fontFamily: 'system-ui' }}>
      <h2>📊 通用表格</h2>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            {columns.map((col: string) => (
              <th key={col} style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left', background: '#f5f5f5' }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row: any, i: number) => (
            <tr key={i}>
              {columns.map((col: string) => (
                <td key={col} style={{ border: '1px solid #ddd', padding: '8px' }}>{String(row[col] ?? '')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
`;

export const genericTableTemplate: AppTemplate = {
  id: 'generic-table',
  name: '通用表格',
  description: '自动从数据推列的通用表格组件',
  components: [
    {
      name: '通用表格',
      type: 'FULLSTACK',
      icon: '📊',
      code: FULLSTACK_CODE,
      canvasX: 300,
      canvasY: 200,
    },
  ],
  connections: [],
};

/**
 * PLANET-1385: Canvas panel with default Master Table.
 * Shows all user assets when no agent-pushed component is active.
 */
import { useEffect, useState } from 'react';
import { useCanvas } from './CanvasContext';
import { Sparkles, RefreshCw } from 'lucide-react';

interface MasterItem {
  id: string;
  type: 'workflow' | 'case' | 'module';
  name: string;
  status: string;
  updatedAt: string;
}

export function CanvasPanel() {
  const { canvas, clearCanvas } = useCanvas();
  const [items, setItems] = useState<MasterItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMasterData();
  }, []);

  async function loadMasterData() {
    setLoading(true);
    try {
      // Fetch workflows
      const wfRes = await fetch('/api/workflows');
      const wfData = wfRes.ok ? await wfRes.json() : { workflows: [] };
      const workflows = (wfData.workflows || wfData || []).map((w: any) => ({
        id: w.id,
        type: 'workflow' as const,
        name: w.name || 'Untitled Workflow',
        status: 'active',
        updatedAt: w.updatedAt || w.createdAt || '',
      }));

      // Fetch cases (if endpoint exists)
      let cases: MasterItem[] = [];
      try {
        const caseRes = await fetch('/api/cases?limit=20');
        if (caseRes.ok) {
          const caseData = await caseRes.json();
          cases = (caseData.cases || caseData || []).map((c: any) => ({
            id: c.id,
            type: 'case' as const,
            name: c.name || `Case #${c.id?.slice(0, 8)}`,
            status: c.status || 'unknown',
            updatedAt: c.updatedAt || c.startedAt || '',
          }));
        }
      } catch {}

      setItems([...workflows, ...cases]);
    } catch (err) {
      console.error('Failed to load master data:', err);
    } finally {
      setLoading(false);
    }
  }

  // Agent pushed a component — show that
  if (canvas.component) {
    return (
      <div className="h-full flex flex-col">
        {canvas.title && (
          <div className="flex items-center justify-between px-6 py-3 border-b">
            <span className="text-sm font-medium">{canvas.title}</span>
            <button onClick={clearCanvas} className="text-xs text-muted-foreground hover:text-foreground">
              ✕ 返回总览
            </button>
          </div>
        )}
        <div className="flex-1 p-6 overflow-auto">
          {canvas.component}
        </div>
      </div>
    );
  }

  // Default: Master Table
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h2 className="text-sm font-semibold">总览</h2>
          <p className="text-[11px] text-muted-foreground">所有工作流和案例</p>
        </div>
        <button
          onClick={loadMasterData}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm text-muted-foreground">加载中...</div>
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-sm space-y-3 p-8">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6 text-primary/60" />
              </div>
              <p className="text-sm text-muted-foreground">
                还没有内容。跟左边的 AI 对话，创建你的第一个工作流。
              </p>
            </div>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left px-6 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">类型</th>
                <th className="text-left px-6 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">名称</th>
                <th className="text-left px-6 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">状态</th>
                <th className="text-left px-6 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">更新时间</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full ${
                      item.type === 'workflow' ? 'bg-blue-500/10 text-blue-400' :
                      item.type === 'case' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-purple-500/10 text-purple-400'
                    }`}>
                      {item.type === 'workflow' ? '工作流' : item.type === 'case' ? '案例' : '模块'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm">{item.name}</td>
                  <td className="px-6 py-3">
                    <span className="text-xs text-muted-foreground">{item.status}</span>
                  </td>
                  <td className="px-6 py-3 text-xs text-muted-foreground">
                    {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

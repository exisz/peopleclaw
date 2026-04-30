/**
 * PLANET-1385: Replit-style Agent Workspace — Block system with MasterOverview.
 * MasterOverview shows all blocks grouped by type. Canvas panel has "← 返回总览" button.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bot, Eye, Layers, Loader2, Workflow, FileText, Table2, Zap } from 'lucide-react';
import { ChatUI } from './ChatUI';
import { CanvasProvider, useCanvas } from '../CanvasContext';
import { ComponentsDrawer } from './ComponentsDrawer';
import TemplateLibraryDialog from '../TemplateLibraryDialog';
import { WorkflowCanvas } from './WorkflowCanvas';
import { CanvasFormView } from './CanvasFormView';
import { CanvasTableView } from './CanvasTableView';
import { CanvasFlowView } from './CanvasFlowView';
import type { Block } from './canvasElements';
import { AI_FACESWAP_BLOCKS, getStoredBlocks } from './canvasElements';

/* ---------- Master Overview (default canvas content) ---------- */

function MasterOverview() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const { setCanvas } = useCanvas();

  useEffect(() => {
    fetch('/api/workflows')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const list = Array.isArray(data) ? data : (data?.workflows || []);
        const flowBlocks: Block[] = list.map((wf: { id: string; name: string; status?: string; updatedAt?: string }) => ({
          id: `wf-${wf.id}`,
          name: wf.name,
          type: 'flow' as const,
          status: (wf.status as Block['status']) || 'active',
          createdAt: wf.updatedAt || new Date().toISOString(),
          updatedAt: wf.updatedAt || new Date().toISOString(),
          workflowId: wf.id,
          input: { schema: {} },
          output: { schema: {} },
        }));
        const stored = getStoredBlocks();
        setBlocks([...flowBlocks, ...AI_FACESWAP_BLOCKS, ...stored]);
      })
      .catch(() => setBlocks([...AI_FACESWAP_BLOCKS, ...getStoredBlocks()]))
      .finally(() => setLoading(false));
  }, []);

  const handleClick = (block: Block) => {
    switch (block.type) {
      case 'form':
        setCanvas(<CanvasFormView block={block} />, block.name);
        break;
      case 'table':
        setCanvas(<CanvasTableView block={block} />, block.name);
        break;
      case 'flow':
        setCanvas(<CanvasFlowView block={block} />, block.name);
        break;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 text-amber-500/60 animate-spin" />
      </div>
    );
  }

  if (blocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
          <Workflow className="w-7 h-7 text-amber-500/50" />
        </div>
        <p className="text-sm text-white/50">暂无块，开始对话来创建</p>
        <p className="text-xs text-white/30 mt-1">Agent 会在这里展示生成的工作流和预览</p>
      </div>
    );
  }

  const flowBlocks = blocks.filter(b => b.type === 'flow');
  const formBlocks = blocks.filter(b => b.type === 'form');
  const tableBlocks = blocks.filter(b => b.type === 'table');

  const iconMap = {
    flow: <Zap className="w-4 h-4 text-blue-400/70" />,
    form: <FileText className="w-4 h-4 text-green-400/70" />,
    table: <Table2 className="w-4 h-4 text-purple-400/70" />,
  };

  const renderGroup = (title: string, emoji: string, groupBlocks: Block[]) => {
    if (groupBlocks.length === 0) return null;
    return (
      <div className="mb-6">
        <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
          {emoji} {title} ({groupBlocks.length})
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {groupBlocks.map(block => (
            <div
              key={block.id}
              onClick={() => handleClick(block)}
              className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 hover:border-amber-500/30 hover:bg-white/[0.05] transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2 mb-2">
                {iconMap[block.type]}
                <span className="text-sm font-medium text-white/80 truncate">{block.name}</span>
              </div>
              <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400/80 border border-amber-500/20">
                {block.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-5 h-full overflow-y-auto">
      {renderGroup('Flow 块', '🔄', flowBlocks)}
      {renderGroup('Form 块', '📋', formBlocks)}
      {renderGroup('Table 块', '📊', tableBlocks)}
    </div>
  );
}

/* ---------- Main Workspace ---------- */

function WorkspaceInner() {
  const { taskId, id: workflowId } = useParams<{ taskId?: string; id?: string; caseId?: string }>();
  const navigate = useNavigate();
  const { canvas, clearCanvas } = useCanvas();
  const [activeTab, setActiveTab] = useState<'agent' | 'preview'>('agent');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [templateLibOpen, setTemplateLibOpen] = useState(false);
  const [taskName, setTaskName] = useState('新任务');

  useEffect(() => {
    if (taskId) {
      const prompt = sessionStorage.getItem(`task-prompt-${taskId}`);
      if (prompt) {
        setTaskName(prompt.slice(0, 30) + (prompt.length > 30 ? '...' : ''));
      }
    }
  }, [taskId]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0e0e0e] text-white">
      {/* Top bar — compact */}
      <div className="h-11 border-b border-white/[0.06] bg-[#141414] flex items-center px-3 gap-3 shrink-0">
        <button
          onClick={() => navigate('/app')}
          className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-white/60" />
        </button>

        <div className="w-px h-5 bg-white/[0.08]" />

        <span className="text-sm font-medium text-white/80 truncate max-w-[240px]">{taskName}</span>

        <div className="flex-1" />

        {/* Agent / Preview toggle */}
        <div className="flex items-center bg-white/[0.04] rounded-lg p-0.5">
          <button
            onClick={() => setActiveTab('agent')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
              activeTab === 'agent'
                ? 'bg-amber-500/15 text-amber-400 shadow-sm'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            Agent
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
              activeTab === 'preview'
                ? 'bg-amber-500/15 text-amber-400 shadow-sm'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Preview
          </button>
        </div>
      </div>

      {/* Main content — two panels */}
      <div className="flex flex-1 min-h-0">
        {/* Chat panel (45%) */}
        <div className="flex-[45] min-w-0 border-r border-white/[0.06] flex flex-col bg-[#111111]">
          <ChatUI taskId={taskId || 'default'} />
        </div>

        {/* Canvas panel (55%) */}
        <div className="flex-[55] min-w-0 flex flex-col relative bg-gradient-to-br from-[#0f0f0f] to-[#0a0a0a]">
          {/* Canvas top actions */}
          <div className="absolute top-3 right-3 z-10">
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:border-amber-500/30 hover:bg-white/[0.06] transition-all"
              title="所有块"
            >
              <Layers className="w-4 h-4 text-white/50" />
            </button>
          </div>

          {/* Back to overview button */}
          {canvas.component && !workflowId && (
            <div className="absolute top-3 left-3 z-10">
              <button
                onClick={clearCanvas}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:border-amber-500/30 hover:bg-white/[0.06] transition-all text-xs text-white/60 hover:text-white/90"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                返回总览
              </button>
            </div>
          )}

          {/* Canvas content */}
          <div className="flex-1 flex items-stretch min-h-0">
            {workflowId ? (
              <WorkflowCanvas />
            ) : canvas.component ? (
              <div className="w-full h-full overflow-auto p-4">
                {canvas.component}
              </div>
            ) : (
              <MasterOverview />
            )}
          </div>

          {/* Subtle watermark */}
          <div className="absolute bottom-2 right-3 text-[10px] text-white/[0.12] font-medium select-none">
            PeopleClaw
          </div>

          {/* Components Drawer */}
          <ComponentsDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            onOpenTemplateLibrary={() => setTemplateLibOpen(true)}
          />
        </div>
      </div>

      {/* Template Library Dialog */}
      <TemplateLibraryDialog open={templateLibOpen} onOpenChange={setTemplateLibOpen} />
    </div>
  );
}

export function AgentWorkspace() {
  return (
    <CanvasProvider>
      <WorkspaceInner />
    </CanvasProvider>
  );
}

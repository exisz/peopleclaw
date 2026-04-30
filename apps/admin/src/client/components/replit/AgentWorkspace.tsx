/**
 * PLANET-1385: Replit-style Agent Workspace.
 * Top bar + narrow left column + chat panel (45%) + canvas/preview (55%) + bottom bar.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bot, Eye, Plus, Wrench, Search, Filter, LayoutGrid } from 'lucide-react';
import { ChatUI } from './ChatUI';
import { CanvasProvider, useCanvas } from '../CanvasContext';

function WorkspaceInner() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { canvas } = useCanvas();
  const [activeTab, setActiveTab] = useState<'agent' | 'preview'>('agent');
  const [canvasTab, setCanvasTab] = useState<'canvas' | 'preview' | 'url'>('canvas');
  const [progress] = useState(0);
  const [taskName, setTaskName] = useState('新任务');

  // Pick up initial prompt from sessionStorage
  useEffect(() => {
    if (taskId) {
      const prompt = sessionStorage.getItem(`task-prompt-${taskId}`);
      if (prompt) {
        setTaskName(prompt.slice(0, 30) + (prompt.length > 30 ? '...' : ''));
      }
    }
  }, [taskId]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Top bar */}
      <div className="h-12 border-b border-border bg-[#1c1c1c] text-white flex items-center px-3 gap-3 shrink-0">
        <button
          onClick={() => navigate('/app')}
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium truncate max-w-[200px]">{taskName}</span>

        {progress > 0 && (
          <div className="flex items-center gap-2 ml-2">
            <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs text-white/50">{progress}%</span>
          </div>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('agent')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              activeTab === 'agent' ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            Agent
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              activeTab === 'preview' ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Preview
          </button>
          <button className="p-1.5 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors">
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button className="p-1.5 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors">
            <Wrench className="w-3.5 h-3.5" />
          </button>
          <button className="p-1.5 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors">
            <Search className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 min-h-0">
        {/* Narrow left column — version list */}
        <div className="w-[60px] border-r border-border bg-muted/30 flex flex-col items-center py-3 gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-medium text-primary">M</span>
          </div>
          <span className="text-[10px] text-muted-foreground">Main</span>
          <div className="w-6 border-t border-border my-1" />
          <button className="w-8 h-8 rounded-lg border border-dashed border-border flex items-center justify-center hover:border-primary/50 transition-colors">
            <Plus className="w-3 h-3 text-muted-foreground" />
          </button>
          <span className="text-[10px] text-muted-foreground">New</span>
        </div>

        {/* Chat panel (45%) */}
        <div className="flex-[45] min-w-0 border-r border-border flex flex-col">
          <ChatUI taskId={taskId || 'default'} />
        </div>

        {/* Canvas/Preview panel (55%) */}
        <div className="flex-[55] min-w-0 flex flex-col bg-muted/20">
          {/* Canvas tabs */}
          <div className="h-10 border-b border-border flex items-center px-3 gap-1 shrink-0">
            {(['canvas', 'preview', 'url'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setCanvasTab(tab)}
                className={`px-3 py-1.5 rounded text-xs font-medium capitalize transition-colors ${
                  canvasTab === tab
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'canvas' ? 'Canvas' : tab === 'preview' ? 'Preview' : 'URL'}
              </button>
            ))}
          </div>

          {/* Canvas content */}
          <div className="flex-1 flex items-center justify-center relative">
            {canvas.component ? (
              <div className="w-full h-full overflow-auto p-4">
                {canvas.component}
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <Eye className="w-7 h-7 text-muted-foreground/40" />
                </div>
                <p className="text-sm">Agent 生成的内容会显示在这里</p>
                <p className="text-xs mt-1 text-muted-foreground/60">开始对话来生成工作流、表格或预览</p>
              </div>
            )}

            {/* Watermark */}
            <div className="absolute bottom-3 right-3 text-[10px] text-muted-foreground/40 font-medium">
              Made with PeopleClaw
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="h-9 border-t border-border bg-muted/30 flex items-center px-4 shrink-0">
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Filter className="w-3 h-3" />
          Filters
        </button>
        <div className="flex-1" />
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <LayoutGrid className="w-3 h-3" />
          Open task board
        </button>
      </div>
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

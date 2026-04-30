/**
 * PLANET-1385: Replit-style Home page — AppHome.
 * Dark sidebar + centered main content with greeting, big input, shortcuts, recent projects.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, Workflow, Table2, FileText, Box, Code2 } from 'lucide-react';
import { Sidebar } from './Sidebar';

interface WorkflowSummary {
  id: string;
  name: string;
  updatedAt?: string;
}

const typeShortcuts = [
  { icon: Workflow, label: '工作流' },
  { icon: Table2, label: '表格' },
  { icon: FileText, label: '表单' },
  { icon: Box, label: '模块' },
  { icon: Code2, label: '代码' },
];

const examplePrompts = [
  'Shopify 批量上架产品',
  '客户跟进自动提醒',
  '生成数据分析报表',
];

export function AppHome() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [recentWorkflows, setRecentWorkflows] = useState<WorkflowSummary[]>([]);

  useEffect(() => {
    fetch('/api/workflows')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const list = Array.isArray(data) ? data : (data?.workflows || []);
        setRecentWorkflows(list.slice(0, 6));
      })
      .catch(() => {});
  }, []);

  function handleSubmit() {
    const text = input.trim();
    if (!text) return;
    const taskId = `task-${Date.now()}`;
    // Store initial prompt in sessionStorage for the workspace to pick up
    sessionStorage.setItem(`task-prompt-${taskId}`, text);
    navigate(`/app/task/${taskId}`);
  }

  function handleExampleClick(prompt: string) {
    setInput(prompt);
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      {/* Main content */}
      <div className="flex-1 bg-[#f8f8f8] dark:bg-background overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-16">
          {/* Greeting */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-black" />
              </div>
            </div>
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              你好，想自动化什么？
            </h1>
            <p className="text-sm text-muted-foreground">
              描述你想要的工作流，AI 会帮你创建
            </p>
          </div>

          {/* Big input */}
          <div className="relative mb-6">
            <div className="flex items-center bg-white dark:bg-card border border-border rounded-2xl shadow-sm px-5 py-4 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/50 transition-all">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                placeholder="描述你的自动化需求..."
                className="flex-1 bg-transparent outline-none text-base placeholder:text-muted-foreground/50"
              />
              <button
                onClick={handleSubmit}
                disabled={!input.trim()}
                className="ml-3 flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                <Sparkles className="w-3.5 h-3.5" />
                开始
              </button>
            </div>
          </div>

          {/* Type shortcuts */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {typeShortcuts.map(item => (
              <button
                key={item.label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white dark:bg-card text-xs text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
              >
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            ))}
          </div>

          {/* Example prompts */}
          <div className="mb-12">
            <p className="text-xs text-muted-foreground text-center mb-3">试试这些：</p>
            <div className="flex flex-wrap justify-center gap-2">
              {examplePrompts.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => handleExampleClick(prompt)}
                  className="px-3.5 py-2 rounded-xl border border-border bg-white dark:bg-card text-sm text-foreground hover:border-primary/30 hover:bg-primary/5 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Recent projects */}
          {recentWorkflows.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-foreground">最近项目</h2>
                <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  查看全部 <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {recentWorkflows.map(wf => (
                  <div
                    key={wf.id}
                    className="p-4 rounded-xl border border-border bg-white dark:bg-card hover:border-primary/30 hover:shadow-sm cursor-pointer transition-all"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                      <Workflow className="w-4 h-4 text-primary" />
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{wf.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">工作流</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * PLANET-1385: Canvas content — shows generative UI, page routes, or empty state.
 */
import { useCanvas } from './CanvasContext';
import { Outlet, useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

export function CanvasContent() {
  const { canvas, clearCanvas } = useCanvas();
  const location = useLocation();

  // If there's a generative component, show it with a close button
  if (canvas.component) {
    return (
      <div className="h-full flex flex-col">
        {canvas.title && (
          <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
            <span className="text-sm font-medium">{canvas.title}</span>
            <button
              onClick={clearCanvas}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ✕ Close
            </button>
          </div>
        )}
        <div className="flex-1 p-4 overflow-auto">
          {canvas.component}
        </div>
      </div>
    );
  }

  // If on a specific page route (not dashboard root), show that page
  if (location.pathname !== '/dashboard' && location.pathname !== '/') {
    return <Outlet />;
  }

  // Default: beautiful empty state
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md space-y-4 p-8">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto">
          <Sparkles className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">Canvas</h2>
        <p className="text-sm text-muted-foreground">
          跟左边的 AI 对话，它会在这里展示工作流、表格、表单等动态内容。
        </p>
        <div className="flex flex-wrap gap-2 justify-center pt-2">
          <span className="px-2.5 py-1 text-xs rounded-full bg-muted text-muted-foreground">表格</span>
          <span className="px-2.5 py-1 text-xs rounded-full bg-muted text-muted-foreground">表单</span>
          <span className="px-2.5 py-1 text-xs rounded-full bg-muted text-muted-foreground">工作流</span>
          <span className="px-2.5 py-1 text-xs rounded-full bg-muted text-muted-foreground">代码</span>
        </div>
      </div>
    </div>
  );
}

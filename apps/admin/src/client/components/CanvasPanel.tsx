/**
 * PLANET-1385: Canvas panel — agent pushes components here.
 * Empty state when nothing is rendered.
 */
import { useCanvas } from './CanvasContext';
import { Sparkles } from 'lucide-react';

export function CanvasPanel() {
  const { canvas, clearCanvas } = useCanvas();

  // Agent pushed a component
  if (canvas.component) {
    return (
      <div className="h-full flex flex-col">
        {canvas.title && (
          <div className="flex items-center justify-between px-6 py-3 border-b">
            <span className="text-sm font-medium">{canvas.title}</span>
            <button
              onClick={clearCanvas}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex-1 p-6 overflow-auto">
          {canvas.component}
        </div>
      </div>
    );
  }

  // Empty state
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-sm space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mx-auto">
          <Sparkles className="w-8 h-8 text-primary/60" />
        </div>
        <h2 className="text-lg font-medium text-foreground/80">Canvas</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          跟左边的 AI 对话。它会在这里展示你需要的内容 —— 表格、表单、工作流、代码。
        </p>
        <div className="flex flex-wrap gap-2 justify-center pt-2">
          {['案例表格', '商品表单', '工作流图', '代码块', '模块配置'].map(tag => (
            <span key={tag} className="px-2.5 py-1 text-[11px] rounded-full bg-muted text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

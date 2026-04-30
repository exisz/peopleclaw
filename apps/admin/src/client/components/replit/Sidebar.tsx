/**
 * PLANET-1385: Replit-style dark sidebar for the Home page.
 */
import { Home, FolderOpen, Link2, Settings, BookOpen, ChevronDown, Plus, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const navItems = [
  { icon: Home, label: '首页', path: '/app' },
  { icon: FolderOpen, label: '项目', path: '/app' },
  { icon: Link2, label: '连接', path: '/app' },
  { icon: Settings, label: '设置', path: '/app' },
];

export function Sidebar() {
  const navigate = useNavigate();

  return (
    <div className="w-[220px] bg-[#1c1c1c] text-white flex flex-col h-full shrink-0">
      {/* Workspace switcher */}
      <div className="px-4 py-4 border-b border-white/10">
        <button className="flex items-center gap-2 text-sm font-medium hover:bg-white/5 rounded px-2 py-1.5 w-full">
          <div className="w-6 h-6 rounded bg-amber-500 flex items-center justify-center text-xs font-bold text-black">P</div>
          <span className="flex-1 text-left truncate">PeopleClaw</span>
          <ChevronDown className="w-3.5 h-3.5 text-white/50" />
        </button>
      </div>

      {/* Actions */}
      <div className="px-3 py-3 space-y-1">
        <button
          onClick={() => {
            const id = `task-${Date.now()}`;
            navigate(`/app/task/${id}`);
          }}
          className="flex items-center gap-2 text-sm px-3 py-2 rounded hover:bg-white/10 w-full text-left"
        >
          <Plus className="w-4 h-4" />
          <span>创建新任务</span>
        </button>
        <button className="flex items-center gap-2 text-sm px-3 py-2 rounded hover:bg-white/10 w-full text-left text-white/70">
          <Upload className="w-4 h-4" />
          <span>导入工作流</span>
        </button>
      </div>

      {/* Divider */}
      <div className="mx-3 border-t border-white/10" />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className="flex items-center gap-2.5 text-sm px-3 py-2 rounded hover:bg-white/10 w-full text-left text-white/80 hover:text-white"
          >
            <item.icon className="w-4 h-4" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-4 space-y-3">
        <button className="flex items-center gap-2.5 text-sm px-3 py-2 rounded hover:bg-white/10 w-full text-left text-white/60">
          <BookOpen className="w-4 h-4" />
          <span>文档</span>
        </button>

        {/* Credits */}
        <div className="px-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-white/50">
            <span>Credits</span>
            <span>28%</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full w-[28%] bg-amber-500 rounded-full" />
          </div>
          <button className="text-xs text-amber-400 hover:text-amber-300 font-medium">
            + Upgrade
          </button>
        </div>
      </div>
    </div>
  );
}

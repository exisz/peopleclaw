import type { Workflow } from '../data/types';

const categories = ['电商运营', '营销推广', '资产管理', '销售管理', '人力资源', '技术支持', '供应链', '创意设计', '财务管理', '产品研发'];

export default function Sidebar({ workflows, selected, onSelect }: {
  workflows: Workflow[];
  selected: Workflow;
  onSelect: (w: Workflow) => void;
}) {
  const grouped = categories.map(cat => ({
    category: cat,
    items: workflows.filter(w => w.category === cat),
  })).filter(g => g.items.length > 0);

  return (
    <aside className="w-72 flex-shrink-0 flex flex-col overflow-hidden" style={{ background: '#0f0f23' }}>
      {/* Logo */}
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg font-bold" style={{ background: 'linear-gradient(135deg, #f0a500, #00d2ff)' }}>
            P
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">PeopleClaw</h1>
            <p className="text-[10px] font-mono text-gray-500 tracking-widest uppercase">Workflow Engine</p>
          </div>
        </div>
      </div>

      {/* Workflow list */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {grouped.map(g => (
          <div key={g.category} className="mb-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500 px-3 mb-1.5">{g.category}</p>
            {g.items.map(w => (
              <button
                key={w.id}
                onClick={() => onSelect(w)}
                className={`w-full text-left px-3 py-2 rounded-lg mb-0.5 flex items-center gap-2.5 transition-all text-sm ${
                  selected.id === w.id
                    ? 'bg-white/10 text-white'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
              >
                <span className="text-base">{w.icon}</span>
                <span className="truncate">{w.name}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/5">
        <p className="text-[10px] font-mono text-gray-600 text-center">POC v0.1 · {workflows.length} workflows</p>
      </div>
    </aside>
  );
}

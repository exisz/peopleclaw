import { useState } from 'react';
import type { Workflow } from '../data/types';

const categories = ['电商运营', '营销推广', '资产管理', '销售管理', '人力资源', '技术支持', '供应链', '创意设计', '财务管理', '产品研发'];

export default function Sidebar({ workflows, selected, onSelect }: {
  workflows: Workflow[];
  selected: Workflow;
  onSelect: (w: Workflow) => void;
}) {
  const [search, setSearch] = useState('');
  
  const filtered = search.trim()
    ? workflows.filter(w => w.name.toLowerCase().includes(search.toLowerCase()) || w.description.toLowerCase().includes(search.toLowerCase()))
    : workflows;

  const grouped = categories.map(cat => ({
    category: cat,
    items: filtered.filter(w => w.category === cat),
  })).filter(g => g.items.length > 0);

  return (
    <aside className="w-72 flex-shrink-0 flex flex-col overflow-hidden" style={{ background: '#0f0f23' }}>
      {/* Logo */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shadow-lg" style={{ background: 'linear-gradient(135deg, #f0a500, #00d2ff)' }}>
            P
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">PeopleClaw</h1>
            <p className="text-[10px] font-mono text-gray-500 tracking-widest uppercase">Workflow Engine</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pt-4 pb-2">
        <input
          type="text"
          placeholder="Search workflows..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-xs bg-white/5 border border-white/5 text-gray-300 placeholder-gray-600 outline-none transition-all duration-200 focus:border-[#00d2ff]/30 focus:bg-white/[0.07] focus:shadow-[0_0_0_3px_rgba(0,210,255,0.08)]"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        />
      </div>

      {/* Workflow list */}
      <nav className="flex-1 overflow-y-auto py-2 px-3">
        {grouped.map(g => (
          <div key={g.category} className="mb-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500 px-3 mb-2">{g.category}</p>
            {g.items.map(w => (
              <button
                key={w.id}
                onClick={() => onSelect(w)}
                className={`w-full text-left px-3 py-2.5 rounded-xl mb-1 flex items-center gap-3 transition-all text-sm ${
                  selected.id === w.id
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
              >
                <span className="text-lg">{w.icon}</span>
                <span className="truncate">{w.name}</span>
                <span className="ml-auto font-mono text-[9px] text-gray-600">{w.steps.length}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-5 border-t border-white/5">
        <p className="text-[10px] font-mono text-gray-600 text-center">POC v0.2 · {workflows.length} workflows</p>
      </div>
    </aside>
  );
}

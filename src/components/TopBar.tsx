import type { Workflow } from '../data/types';

export default function TopBar({ workflow, caseCount, activeTab, onTabChange }: {
  workflow: Workflow;
  caseCount: number;
  activeTab: 'workflow' | 'cases';
  onTabChange: (t: 'workflow' | 'cases') => void;
}) {
  return (
    <header className="flex items-center justify-between px-8 py-4 border-b border-white/5" style={{ background: '#16213e' }}>
      <div className="flex items-center gap-5">
        <span className="text-3xl">{workflow.icon}</span>
        <div>
          <h2 className="text-lg font-bold text-white leading-tight">{workflow.name}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{workflow.description}</p>
        </div>
        <span className="font-mono text-[10px] px-3 py-1 rounded-lg bg-white/5 text-gray-400 uppercase tracking-wider">{workflow.category}</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex bg-white/5 rounded-xl p-1">
          {(['workflow', 'cases'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`px-5 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab === 'workflow' ? '🔀 Workflow' : `📋 Cases`}
              {tab === 'cases' && <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] bg-white/10">{caseCount}</span>}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

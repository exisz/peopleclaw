import type { Case, Workflow } from '../data/types';

export default function CasesView({ cases, workflow, selectedCase, onSelectCase }: {
  cases: Case[];
  workflow: Workflow;
  selectedCase: Case | null;
  onSelectCase: (c: Case) => void;
}) {
  const statusBadge = (s: string) => {
    const m: Record<string, { bg: string; text: string }> = {
      active: { bg: 'bg-green-500/10 border-green-500/30', text: 'text-green-400' },
      completed: { bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-400' },
      paused: { bg: 'bg-yellow-500/10 border-yellow-500/30', text: 'text-yellow-400' },
    };
    return m[s] || m.active;
  };

  if (cases.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <p>No cases for this workflow yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-slide-in">
      {cases.map(c => {
        const totalSteps = workflow.steps.length;
        const doneSteps = Object.values(c.stepStatuses).filter(s => s === 'done').length;
        const progress = Math.round((doneSteps / totalSteps) * 100);
        const badge = statusBadge(c.status);
        const currentStep = workflow.steps.find(s => s.id === c.currentStepId);

        return (
          <button
            key={c.id}
            onClick={() => onSelectCase(c)}
            className={`text-left p-5 rounded-xl border transition-all hover:scale-[1.02] ${
              selectedCase?.id === c.id ? 'border-white/20 bg-white/10' : 'border-white/5 bg-white/[0.02] hover:bg-white/5'
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-sm font-semibold text-white pr-2">{c.name}</h3>
              <span className={`flex-shrink-0 font-mono text-[10px] px-2 py-0.5 rounded-full border uppercase ${badge.bg} ${badge.text}`}>
                {c.status}
              </span>
            </div>

            {/* Progress bar */}
            <div className="mb-3">
              <div className="flex justify-between text-[10px] font-mono text-gray-500 mb-1">
                <span>{doneSteps}/{totalSteps} steps</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${progress}%`,
                    background: progress === 100 ? '#22c55e' : 'linear-gradient(90deg, #f0a500, #00d2ff)',
                  }}
                />
              </div>
            </div>

            {/* Current step */}
            {currentStep && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className={`w-1.5 h-1.5 rounded-full ${c.status === 'completed' ? 'bg-green-400' : 'bg-amber-400 animate-pulse'}`} />
                <span className="truncate">Current: {currentStep.name}</span>
              </div>
            )}

            {/* Started */}
            <p className="mt-2 font-mono text-[10px] text-gray-600">Started {c.startedAt}</p>

            {/* Step status dots */}
            <div className="mt-3 flex gap-1 flex-wrap">
              {workflow.steps.map(step => {
                const st = c.stepStatuses[step.id] || 'pending';
                const col: Record<string, string> = { done: 'bg-green-400', 'in-progress': 'bg-amber-400', blocked: 'bg-red-400', pending: 'bg-gray-600' };
                return <div key={step.id} className={`w-2 h-2 rounded-full ${col[st]}`} title={`${step.name}: ${st}`} />;
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
}

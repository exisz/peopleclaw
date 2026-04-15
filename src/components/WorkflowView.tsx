import { useState } from 'react';
import type { Workflow, Case } from '../data/types';
import StepCard from './StepCard';

export default function WorkflowView({ workflow, selectedCase }: {
  workflow: Workflow;
  selectedCase: Case | null;
}) {
  const [expandedSubflow, setExpandedSubflow] = useState<string | null>(null);

  return (
    <div className="animate-slide-in">
      {selectedCase && (
        <div className="mb-4 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full ${selectedCase.status === 'active' ? 'bg-green-400' : selectedCase.status === 'completed' ? 'bg-blue-400' : 'bg-yellow-400'}`} />
          <span className="text-sm font-medium text-white">{selectedCase.name}</span>
          <span className="font-mono text-[10px] text-gray-400 uppercase">{selectedCase.status}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-start">
        {workflow.steps.map((step, i) => (
          <div key={step.id} className="flex items-start gap-0">
            <StepCard
              step={step}
              status={selectedCase?.stepStatuses[step.id]}
              isExpanded={expandedSubflow === step.id}
              onToggleSubflow={() => setExpandedSubflow(expandedSubflow === step.id ? null : step.id)}
            />
            {i < workflow.steps.length - 1 && <Connector />}
          </div>
        ))}
      </div>

      {/* Expanded subflow */}
      {expandedSubflow && (() => {
        const step = workflow.steps.find(s => s.id === expandedSubflow);
        if (!step?.subflow) return null;
        return (
          <div className="mt-6 ml-4 p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 animate-slide-in">
            <p className="text-xs font-mono text-purple-400 mb-3 uppercase tracking-wider">📂 Subflow: {step.subflow.name}</p>
            <div className="flex flex-wrap gap-3 items-start">
              {step.subflow.steps.map((ss, i) => (
                <div key={ss.id} className="flex items-start gap-0">
                  <StepCard step={ss} />
                  {i < step.subflow!.steps.length - 1 && <Connector />}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function Connector() {
  return (
    <div className="flex items-center self-center h-full pt-4">
      <div className="relative w-8 h-[2px] bg-gray-700">
        <div className="absolute top-[-2px] w-1.5 h-1.5 rounded-full bg-gray-500 animate-flow" />
      </div>
      <style>{`
        @keyframes flow { 0% { left: 0; } 100% { left: calc(100% - 6px); } }
        .animate-flow { animation: flow 1.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

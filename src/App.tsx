import { useState, useCallback } from 'react';
import { workflows as initialWorkflows } from './data/workflows';
import { cases } from './data/cases';
import type { Workflow, Case } from './data/types';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import WorkflowView from './components/WorkflowView';
import CasesView from './components/CasesView';

function loadWorkflows(): Workflow[] {
  try {
    const saved = localStorage.getItem('peopleclaw-workflows');
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return initialWorkflows;
}

function saveWorkflows(wfs: Workflow[]) {
  try {
    localStorage.setItem('peopleclaw-workflows', JSON.stringify(wfs));
  } catch { /* ignore */ }
}

export default function App() {
  const [workflows, setWorkflows] = useState<Workflow[]>(loadWorkflows);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow>(workflows[0]);
  const [activeTab, setActiveTab] = useState<'workflow' | 'cases'>('workflow');
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);

  const handleWorkflowUpdate = useCallback((updated: Workflow) => {
    setWorkflows(prev => {
      const next = prev.map(w => w.id === updated.id ? updated : w);
      saveWorkflows(next);
      return next;
    });
  }, []);

  const workflowCases = cases.filter(c => c.workflowId === selectedWorkflow.id);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        workflows={workflows}
        selected={selectedWorkflow}
        onSelect={(w) => { setSelectedWorkflow(w); setSelectedCase(null); setActiveTab('workflow'); }}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          workflow={selectedWorkflow}
          caseCount={workflowCases.length}
          activeTab={activeTab}
          onTabChange={(t) => { setActiveTab(t); if (t === 'workflow') setSelectedCase(null); }}
        />
        <main className="flex-1 overflow-hidden" style={{ background: '#1a1a2e' }}>
          {activeTab === 'workflow' ? (
            <WorkflowView workflow={selectedWorkflow} selectedCase={selectedCase} onWorkflowUpdate={handleWorkflowUpdate} />
          ) : (
            <CasesView
              cases={workflowCases}
              workflow={selectedWorkflow}
              selectedCase={selectedCase}
              onSelectCase={(c) => { setSelectedCase(c); setActiveTab('workflow'); }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

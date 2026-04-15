import { useState } from 'react';
import { workflows as initialWorkflows } from './data/workflows';
import { cases } from './data/cases';
import type { Workflow, Case } from './data/types';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import WorkflowView from './components/WorkflowView';
import CasesView from './components/CasesView';

export default function App() {
  const [workflows] = useState<Workflow[]>(initialWorkflows);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow>(workflows[0]);
  const [activeTab, setActiveTab] = useState<'workflow' | 'cases'>('workflow');
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);

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
            <WorkflowView workflow={selectedWorkflow} selectedCase={selectedCase} />
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

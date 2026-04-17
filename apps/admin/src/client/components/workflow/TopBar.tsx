import type { Workflow } from '../../data/types';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';

export default function TopBar({
  workflow,
  caseCount,
  activeTab,
  onTabChange,
}: {
  workflow: Workflow;
  caseCount: number;
  activeTab: 'workflow' | 'cases';
  onTabChange: (t: 'workflow' | 'cases') => void;
}) {
  return (
    <header className="flex items-center justify-between px-8 py-4 border-b border-border bg-card">
      <div className="flex items-center gap-4">
        <span className="text-3xl leading-none">{workflow.icon}</span>
        <div>
          <h2 className="text-lg font-bold leading-tight">{workflow.name}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{workflow.description}</p>
        </div>
        <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider ml-2">
          {workflow.category}
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={v => onTabChange(v as 'workflow' | 'cases')}>
        <TabsList>
          <TabsTrigger value="workflow" data-testid="tab-workflow">
            🔀 Workflow
          </TabsTrigger>
          <TabsTrigger value="cases" data-testid="tab-cases">
            📋 Cases
            <Badge variant="secondary" className="ml-2 h-4 px-1.5 text-[10px]">
              {caseCount}
            </Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </header>
  );
}

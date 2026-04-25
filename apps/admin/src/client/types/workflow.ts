export type StepType = 'human' | 'agent' | 'subflow' | 'trigger' | 'condition' | 'input' | 'notification';

export interface WorkflowStep {
  id: string;
  name: string;
  type: StepType;
  assignee: string;
  description: string;
  estimatedTime?: string;
  tools?: string[];
  subflow?: Workflow;
  // Editor extensions (P3.12)
  position?: { x: number; y: number };
  iconName?: string;
  templateId?: string;
  fromTemplate?: boolean;
  disabled?: boolean;
  requiredFields?: string[];
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  icon: string;
  steps: WorkflowStep[];
  category: string;
  isSystem?: boolean; // PLANET-1210: true = system template (locked)
}

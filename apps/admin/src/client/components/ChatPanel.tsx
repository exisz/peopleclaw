/**
 * PLANET-1385: Chat-First Panel — THE primary interface.
 * Full-height chat using CopilotKit's CopilotChat component.
 * Registers generative UI actions: createWorkflow, showDataTable, showForm, showCode, executeCaseStep.
 */
import { CopilotChat } from '@copilotkit/react-ui';
import { useCopilotAction, useCopilotReadable } from '@copilotkit/react-core';
import '@copilotkit/react-ui/styles.css';
import { useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useCanvas } from './CanvasContext';
import { DynamicTable } from './generative/DynamicTable';
import { DynamicForm } from './generative/DynamicForm';
import { CodeBlock } from './generative/CodeBlock';
import { WorkflowPreview } from './generative/WorkflowPreview';

const SYSTEM_INSTRUCTIONS = `You are PeopleClaw AI — the intelligent workflow automation assistant.

## Who You Are
You are the AI brain of PeopleClaw, a workflow automation platform. You help users:
- Create and manage automated workflows
- Track cases (workflow instances) and their progress
- Configure connections (Shopify, APIs, etc.)
- Understand their data through tables and visualizations

## Your Capabilities
- **Create Workflows**: Use the createWorkflow action to design complete workflow pipelines from scratch
- **Show Data**: Use showDataTable to display cases, products, or any data in beautiful tables
- **Generate Forms**: Use showForm to create dynamic forms for data collection
- **Show Code**: Use showCode to display configurations, scripts, or API responses
- **Execute Cases**: Use executeCaseStep to trigger workflow execution (with user confirmation)

## Personality
- Proactive: suggest next steps, offer to create things
- Concise: no fluff, get to the point
- Bilingual: respond in the user's language (Chinese or English)
- Expert: you deeply understand workflow automation, e-commerce, and data processing

## Context
You can see what page the user is viewing and their workflows/cases. Use this context to provide relevant suggestions.
When a user first arrives, greet them briefly and offer to help with their current context.`;

export function ChatPanel() {
  const location = useLocation();
  const { setCanvas } = useCanvas();
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);

  // Fetch workflows for readable state
  useEffect(() => {
    fetch('/api/workflows')
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setWorkflows(Array.isArray(data) ? data : data.workflows || []))
      .catch(() => {});
  }, [location.pathname]);

  // Extract workflow context from URL
  const pathParts = location.pathname.split('/');
  const workflowId = pathParts[2] && pathParts[1] === 'workflows' ? pathParts[2] : null;

  // Fetch cases when viewing a workflow
  useEffect(() => {
    if (!workflowId) { setCases([]); return; }
    fetch(`/api/cases?workflowId=${workflowId}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setCases(Array.isArray(data) ? data : data.cases || []))
      .catch(() => {});
  }, [workflowId]);

  // === READABLE STATE ===
  useCopilotReadable({
    description: "User's workflows and their status",
    value: workflows,
  });

  useCopilotReadable({
    description: 'Current cases for selected workflow',
    value: cases,
  });

  useCopilotReadable({
    description: 'Current navigation context in PeopleClaw admin',
    value: {
      currentPage: location.pathname,
      workflowId,
      isOnWorkflowPage: location.pathname.startsWith('/workflows'),
      isOnDashboard: location.pathname === '/dashboard',
    },
  });

  // === GENERATIVE UI ACTIONS ===

  // 1. Create Workflow
  useCopilotAction({
    name: 'createWorkflow',
    description: 'Create a new workflow with AI-designed steps. Use when user describes what they want automated.',
    parameters: [
      { name: 'name', type: 'string', description: 'Workflow name', required: true },
      { name: 'description', type: 'string', description: 'What this workflow does', required: true },
      {
        name: 'steps',
        type: 'object[]',
        description: 'Array of workflow steps',
        attributes: [
          { name: 'name', type: 'string', description: 'Step name', required: true },
          { name: 'type', type: 'string', description: 'human or agent', required: true },
          { name: 'description', type: 'string', description: 'What this step does', required: true },
          { name: 'tools', type: 'string[]', description: 'Tools/skills needed' },
        ],
      },
    ],
    handler: async ({ name, description, steps }) => {
      // Show preview in canvas first
      setCanvas(
        <WorkflowPreview name={name} description={description} steps={steps} />,
        `New Workflow: ${name}`
      );

      // Create via API
      try {
        const res = await fetch('/api/workflows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description, steps }),
        });
        if (res.ok) {
          const data = await res.json();
          return `✅ Workflow "${name}" created successfully (ID: ${data.id || 'created'}). It has ${steps.length} steps. You can view it in the Workflows page.`;
        }
        return `⚠️ Workflow created visually but API returned ${res.status}. The workflow design is shown in the canvas.`;
      } catch {
        return `⚠️ Could not save to backend, but workflow design is shown in the canvas panel.`;
      }
    },
    render: (props) => {
      if (props.status === 'executing' || props.status === 'complete') {
        return <WorkflowPreview {...(props.args as any)} />;
      }
      return <div className="text-sm text-muted-foreground">Designing workflow...</div>;
    },
  });

  // 2. Show Data Table
  useCopilotAction({
    name: 'showDataTable',
    description: 'Display data in a beautiful table format. Use when showing cases, products, workflows, or any tabular data.',
    parameters: [
      { name: 'title', type: 'string', description: 'Table title', required: true },
      {
        name: 'columns',
        type: 'object[]',
        description: 'Column definitions',
        attributes: [
          { name: 'key', type: 'string', required: true },
          { name: 'label', type: 'string', required: true },
        ],
      },
      { name: 'data', type: 'object[]', description: 'Row data' },
    ],
    handler: async ({ title, columns, data }) => {
      setCanvas(
        <DynamicTable title={title} columns={columns} data={data || []} />,
        title
      );
      return `Displayed table "${title}" with ${(data || []).length} rows in the canvas.`;
    },
    render: (props) => {
      if (props.args?.title) {
        return (
          <div className="text-sm p-2 rounded bg-muted/50">
            📊 Table: {props.args.title} ({(props.args.data as any[])?.length || 0} rows)
          </div>
        );
      }
      return null;
    },
  });

  // 3. Show Form
  useCopilotAction({
    name: 'showForm',
    description: 'Display a dynamic form for user input. Use when collecting structured data like product details, configuration, etc.',
    parameters: [
      { name: 'title', type: 'string', description: 'Form title', required: true },
      {
        name: 'fields',
        type: 'object[]',
        description: 'Form fields',
        attributes: [
          { name: 'name', type: 'string', required: true },
          { name: 'label', type: 'string', required: true },
          { name: 'type', type: 'string', description: 'text|number|textarea|select|file', required: true },
          { name: 'required', type: 'boolean' },
          { name: 'options', type: 'string[]', description: 'For select fields' },
        ],
      },
    ],
    handler: async ({ title, fields }) => {
      setCanvas(
        <DynamicForm title={title} fields={fields} onSubmit={(data) => {
          console.log('Form submitted:', data);
        }} />,
        title
      );
      return `Form "${title}" is displayed in the canvas. The user can fill it out there.`;
    },
    render: (props) => {
      if (props.args?.title) {
        return (
          <div className="text-sm p-2 rounded bg-muted/50">
            📝 Form: {props.args.title} ({(props.args.fields as any[])?.length || 0} fields)
          </div>
        );
      }
      return null;
    },
  });

  // 4. Show Code Block
  useCopilotAction({
    name: 'showCode',
    description: 'Display a code block with syntax highlighting in the canvas. Use for runner scripts, configurations, API responses.',
    parameters: [
      { name: 'title', type: 'string', description: 'Code block title', required: true },
      { name: 'language', type: 'string', description: 'Programming language', required: true },
      { name: 'code', type: 'string', description: 'The code content', required: true },
    ],
    handler: async ({ title, language, code }) => {
      setCanvas(
        <CodeBlock title={title} language={language} code={code} />,
        title
      );
      return `Code block "${title}" displayed in canvas.`;
    },
    render: (props) => {
      if (props.args?.title) {
        return (
          <div className="text-sm p-2 rounded bg-muted/50">
            💻 Code: {props.args.title} ({props.args.language})
          </div>
        );
      }
      return null;
    },
  });

  // 5. Execute Case Step
  useCopilotAction({
    name: 'executeCaseStep',
    description: 'Execute the next step in a case workflow. Requires user confirmation.',
    parameters: [
      { name: 'caseId', type: 'string', description: 'The case ID to execute', required: true },
      { name: 'stepId', type: 'string', description: 'Optional specific step to execute' },
    ],
    handler: async ({ caseId, stepId }) => {
      const confirmed = window.confirm(
        `Execute case ${caseId}${stepId ? ` (step: ${stepId})` : ''}?\n\nClick OK to confirm.`
      );
      if (!confirmed) return 'User cancelled execution.';

      try {
        const res = await fetch('/api/workflow-run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ caseId, stepId }),
        });
        if (res.ok) {
          return `✅ Case ${caseId} execution triggered successfully.`;
        }
        return `⚠️ Execution returned status ${res.status}. Check the cases panel for details.`;
      } catch {
        return `❌ Failed to trigger execution. Network error.`;
      }
    },
  });

  return (
    <div className="h-full flex flex-col border-r bg-background">
      <div className="px-4 py-3 border-b shrink-0">
        <h2 className="text-sm font-semibold">PeopleClaw AI</h2>
        <p className="text-[11px] text-muted-foreground">你的智能工作流助手</p>
      </div>
      <div className="flex-1 min-h-0 copilotkit-chat-container">
        <CopilotChat
          className="h-full"
          instructions={SYSTEM_INSTRUCTIONS}
          labels={{
            initial: '👋 告诉我你想自动化什么，我来帮你设计工作流。',
            placeholder: '描述你想做的事...',
          }}
        />
      </div>
    </div>
  );
}

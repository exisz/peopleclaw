/**
 * PLANET-1385: AI Chat Panel using CopilotKit.
 * Provides a floating chat popup with:
 * - useCopilotAction: confirmCaseExecution (Human-in-the-Loop)
 * - useCopilotReadable: current workflow context
 */
import { CopilotPopup } from '@copilotkit/react-ui';
import { useCopilotAction, useCopilotReadable } from '@copilotkit/react-core';
import '@copilotkit/react-ui/styles.css';
import { useLocation } from 'react-router-dom';

export function AIChatPanel() {
  const location = useLocation();

  // Extract workflow context from URL for readable state
  const pathParts = location.pathname.split('/');
  const workflowId = pathParts[2] && pathParts[1] === 'workflows' ? pathParts[2] : null;
  const caseId = pathParts[4] && pathParts[3] === 'cases' ? pathParts[4] : null;

  // PLANET-1385: Readable state — let the agent know what the user is viewing
  useCopilotReadable({
    description: 'Current navigation context in PeopleClaw admin',
    value: {
      currentPage: location.pathname,
      workflowId,
      caseId,
      isOnWorkflowPage: location.pathname.startsWith('/workflows'),
      isOnDashboard: location.pathname === '/dashboard',
    },
  });

  // PLANET-1385: Human-in-the-Loop action — confirm case execution
  useCopilotAction({
    name: 'confirmCaseExecution',
    description:
      'Ask the user to confirm execution of a workflow case. Use this when the user wants to run or re-run a case.',
    parameters: [
      {
        name: 'caseId',
        type: 'string',
        description: 'The case ID to execute',
        required: true,
      },
      {
        name: 'workflowName',
        type: 'string',
        description: 'Workflow name for context',
        required: true,
      },
    ],
    handler: async ({ caseId: targetCaseId, workflowName }) => {
      const confirmed = window.confirm(
        `Execute case ${targetCaseId} in workflow "${workflowName}"?\n\nClick OK to confirm or Cancel to abort.`
      );
      if (confirmed) {
        return `User confirmed execution of case ${targetCaseId} in workflow "${workflowName}"`;
      }
      return `User cancelled execution of case ${targetCaseId}`;
    },
  });

  return (
    <CopilotPopup
      instructions="You are PeopleClaw AI assistant. Help users manage their workflows and cases. You can see what page they are on. When they want to execute a case, use the confirmCaseExecution action to get their confirmation first."
      labels={{
        title: 'PeopleClaw AI',
        initial: 'Hi! I can help you manage workflows and cases. What would you like to do?',
      }}
      defaultOpen={false}
    />
  );
}

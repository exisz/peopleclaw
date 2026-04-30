/**
 * PLANET-1385: CopilotKit provider wrapper.
 * Wraps children with CopilotKit context connected to our AG-UI backend.
 */
import { CopilotKit } from '@copilotkit/react-core';
import type { ReactNode } from 'react';

interface CopilotProviderProps {
  children: ReactNode;
}

export function CopilotProvider({ children }: CopilotProviderProps) {
  return (
    <CopilotKit runtimeUrl="/api/agent">
      {children}
    </CopilotKit>
  );
}

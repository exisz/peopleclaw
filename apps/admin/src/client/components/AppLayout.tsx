/**
 * PLANET-1257: App layout with persistent top navigation bar.
 * Wraps all authenticated routes.
 * PLANET-1385: Added CopilotKit provider + AI chat panel.
 */
import { Outlet } from 'react-router-dom';
import AppTopBar from './AppTopBar';
import { CopilotProvider } from './CopilotProvider';
import { AIChatPanel } from './AIChatPanel';

export default function AppLayout() {
  return (
    <CopilotProvider>
      <div className="flex flex-col h-screen overflow-hidden">
        <AppTopBar />
        <div className="flex-1 min-h-0">
          <Outlet />
        </div>
        <AIChatPanel />
      </div>
    </CopilotProvider>
  );
}

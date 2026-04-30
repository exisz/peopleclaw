/**
 * PLANET-1385: Chat-First Unified Layout.
 * Single-page chat interface on /dashboard, traditional layout for other routes.
 */
import { Outlet, useLocation } from 'react-router-dom';
import AppTopBar from './AppTopBar';
import { CopilotProvider } from './CopilotProvider';
import { ChatPanel } from './ChatPanel';

export default function AppLayout() {
  const location = useLocation();
  const isChatView = location.pathname === '/dashboard';

  return (
    <CopilotProvider>
      <div className="flex flex-col h-screen overflow-hidden bg-background">
        <AppTopBar />
        {isChatView ? (
          <main className="flex-1 min-h-0 flex flex-col items-center">
            <div className="w-full max-w-3xl flex-1 min-h-0 flex flex-col px-4">
              <ChatPanel />
            </div>
          </main>
        ) : (
          <main className="flex-1 min-h-0 overflow-auto">
            <Outlet />
          </main>
        )}
      </div>
    </CopilotProvider>
  );
}

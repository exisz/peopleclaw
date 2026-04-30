/**
 * PLANET-1385: Single-page Chat-First layout.
 * Left: Chat panel (first-class citizen)
 * Right: Canvas (dynamic content from agent OR page routes)
 */
import { Outlet } from 'react-router-dom';
import AppTopBar from './AppTopBar';
import { CopilotProvider } from './CopilotProvider';
import { ChatPanel } from './ChatPanel';

export default function AppLayout() {
  return (
    <CopilotProvider>
      <div className="flex flex-col h-screen overflow-hidden bg-background">
        <AppTopBar />
        <div className="flex flex-1 min-h-0">
          {/* Left: Chat — first-class citizen */}
          <div className="w-[400px] min-w-[320px] max-w-[500px] border-r flex flex-col shrink-0">
            <ChatPanel />
          </div>
          {/* Right: Canvas — dynamic content */}
          <div className="flex-1 min-w-0 overflow-auto">
            <Outlet />
          </div>
        </div>
      </div>
    </CopilotProvider>
  );
}

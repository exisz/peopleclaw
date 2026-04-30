/**
 * PLANET-1385: Chat-First App Layout.
 * Split layout: Chat panel (left 40%) + Dynamic Canvas (right 60%).
 * Chat is THE primary interface, not a sidebar.
 */
import { Outlet } from 'react-router-dom';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './ui/resizable-panels';
import AppTopBar from './AppTopBar';
import { CopilotProvider } from './CopilotProvider';
import { ChatPanel } from './ChatPanel';
import { CanvasProvider } from './CanvasContext';

export default function AppLayout() {
  return (
    <CopilotProvider>
      <CanvasProvider>
        <div className="flex flex-col h-screen overflow-hidden">
          <AppTopBar />
          <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
            {/* Left: Chat Panel — THE primary interface */}
            <ResizablePanel defaultSize={40} minSize={25} maxSize={60}>
              <ChatPanel />
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Right: Dynamic Canvas — shows pages or generative UI */}
            <ResizablePanel defaultSize={60} minSize={30}>
              <div className="h-full overflow-auto bg-background">
                <Outlet />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </CanvasProvider>
    </CopilotProvider>
  );
}

/**
 * PLANET-1385: Single-page Chat + Canvas layout.
 * No routing on the right side. Agent pushes components to canvas.
 */
import AppTopBar from './AppTopBar';
import { CopilotProvider } from './CopilotProvider';
import { CanvasProvider } from './CanvasContext';
import { ChatPanel } from './ChatPanel';
import { CanvasPanel } from './CanvasPanel';

export default function AppLayout() {
  return (
    <CopilotProvider>
      <CanvasProvider>
        <div className="flex flex-col h-screen overflow-hidden bg-background">
          <AppTopBar />
          <div className="flex flex-1 min-h-0">
            {/* Left: Chat */}
            <div className="w-[400px] border-r flex flex-col shrink-0">
              <ChatPanel />
            </div>
            {/* Right: Canvas */}
            <div className="flex-1 min-w-0 overflow-auto">
              <CanvasPanel />
            </div>
          </div>
        </div>
      </CanvasProvider>
    </CopilotProvider>
  );
}

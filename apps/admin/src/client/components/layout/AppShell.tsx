/**
 * PLANET-1431: Unified AppShell layout — TopBar + Sidebar + content area.
 */
import AppTopBar from '../AppTopBar';
import AppsSidebar from '../AppsSidebar';

interface AppShellProps {
  title?: string;
  children: React.ReactNode;
}

export default function AppShell({ title, children }: AppShellProps) {
  return (
    <div className="flex flex-col h-screen">
      <AppTopBar title={title} />
      <div className="flex flex-1 min-h-0">
        <AppsSidebar />
        <main className="flex-1 min-w-0 min-h-0 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

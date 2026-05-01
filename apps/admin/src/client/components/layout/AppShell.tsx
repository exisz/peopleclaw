/**
 * PLANET-1431: Unified AppShell layout — TopBar + Sidebar + content area.
 * PLANET-1442: Hide sidebar when inside /app/:id (locked to single app).
 */
import { useLocation } from 'react-router-dom';
import AppTopBar from '../AppTopBar';
import AppsSidebar from '../AppsSidebar';

interface AppShellProps {
  title?: string;
  children: React.ReactNode;
}

export default function AppShell({ title, children }: AppShellProps) {
  const location = useLocation();
  // When inside /app/:id, hide the sidebar — user is locked into a single app
  const isAppDetail = /^\/app\/[^/]+/.test(location.pathname);

  return (
    <div className="flex flex-col h-screen">
      <AppTopBar title={title} showBackToApps={isAppDetail} />
      <div className="flex flex-1 min-h-0">
        {!isAppDetail && <AppsSidebar />}
        <main className="flex-1 min-w-0 min-h-0 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

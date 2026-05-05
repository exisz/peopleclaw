/**
 * PLANET-1407: Outer AppShell — used for top-level routes only
 * (Apps / Published / Security / Settings).
 *
 * The legacy `/app/:id` special-case (hide system sidebar when inside an
 * App) is gone: every `/app/:id/*` route is now wrapped by
 * `AppInnerShell` instead of `AppShell`, and there is no remaining
 * Chat/Canvas dual-pane.
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

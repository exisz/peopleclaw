/**
 * PLANET-1407: Living SaaS — System / Module Flow page (stub).
 *
 * Standalone system route. The route lives in the left App sidebar, not in a
 * second content-level tab row.
 */
import { useParams } from 'react-router-dom';

export default function AppModuleFlowPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div data-testid="page-app-system-flow" className="h-full overflow-auto">
      <header className="px-6 py-4 border-b border-border">
        <h1 className="text-lg font-semibold tracking-tight">Module Flow</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          The graph of components and the connections between them.
        </p>
      </header>
      <div className="p-6">
        <div className="rounded-lg border border-dashed border-border p-8 text-sm text-muted-foreground">
          <p>
            The dedicated Module Flow surface is queued for the next slice.
            This page is reached from the App sidebar at{' '}
            <span className="font-mono">/app/{id}/system/flow</span>.
          </p>
        </div>
      </div>
    </div>
  );
}

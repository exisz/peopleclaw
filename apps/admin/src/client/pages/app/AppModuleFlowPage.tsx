/**
 * PLANET-1407: Living SaaS — System / Module Flow page (stub).
 *
 * Will host the standalone module-flow graph (today still bundled inside the
 * Canvas IDE tabs). Stubbed so the navigation surface is real.
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
            The dedicated Module Flow surface is queued for the next slice. For
            now the live module-flow graph still lives inside the Canvas IDE
            tabs (<span className="font-mono">/app/{id}</span>).
          </p>
        </div>
      </div>
    </div>
  );
}

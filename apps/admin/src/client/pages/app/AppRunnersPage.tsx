/**
 * PLANET-1407: Living SaaS — System / Runners page (stub).
 */
export default function AppRunnersPage() {
  return (
    <div data-testid="page-app-system-runners" className="h-full overflow-auto">
      <header className="px-6 py-4 border-b border-border">
        <h1 className="text-lg font-semibold tracking-tight">Runners</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Execution backends that pick up component invocations.
        </p>
      </header>
      <div className="p-6">
        <div className="rounded-lg border border-dashed border-border p-8 text-sm text-muted-foreground">
          <p>
            Runner registration and health surface is not wired yet. Today all
            components run inside the default Vercel serverless runtime; this
            page will list real runners once a directory is introduced.
          </p>
        </div>
      </div>
    </div>
  );
}

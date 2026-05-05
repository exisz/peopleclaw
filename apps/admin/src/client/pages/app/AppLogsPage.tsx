/**
 * PLANET-1407: Living SaaS — System / Logs page (stub).
 */
export default function AppLogsPage() {
  return (
    <div data-testid="page-app-system-logs" className="h-full overflow-auto">
      <header className="px-6 py-4 border-b border-border">
        <h1 className="text-lg font-semibold tracking-tight">Logs</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Recent component runs, tool calls, and errors.
        </p>
      </header>
      <div className="p-6">
        <div className="rounded-lg border border-dashed border-border p-8 text-sm text-muted-foreground">
          <p>
            A real log stream surface lands once runner output is durable. For
            now component run output is visible inside the Canvas IDE tab for
            the relevant component.
          </p>
        </div>
      </div>
    </div>
  );
}

import { useParams } from 'react-router-dom';

export default function AppDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const cards = [
    { label: 'App status', value: 'Ready', hint: 'Open and usable' },
    { label: 'Starter app', value: 'Active', hint: 'Built from a reusable pattern' },
    { label: 'Chat', value: 'On', hint: 'Ask for product changes' },
    { label: 'Issues', value: '0', hint: 'No recent user-facing errors' },
  ];
  return (
    <div data-testid="page-app-dashboard" className="h-full overflow-auto p-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          App overview · <span className="font-mono">{id}</span>
        </p>
      </header>
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map(c => (
          <div
            key={c.label}
            className="rounded-lg border border-border bg-card p-4 flex flex-col gap-1"
          >
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className="text-2xl font-semibold">{c.value}</div>
            <div className="text-[11px] text-muted-foreground/80">{c.hint}</div>
          </div>
        ))}
      </section>
      <section className="mt-8 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        <p>
          Use Build App for product changes, or open Chat to describe what this app should do next.
        </p>
      </section>
    </div>
  );
}

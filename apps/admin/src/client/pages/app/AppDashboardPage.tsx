/**
 * PLANET-1407: Living SaaS — Dashboard page (stub).
 *
 * Will eventually summarise app health, recent runs, scheduled work, etc.
 * For now this is presentation-only with structured placeholders so the
 * shell + routing can be exercised end-to-end.
 */
import { useParams } from 'react-router-dom';

export default function AppDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const cards = [
    { label: 'Modules', value: '—', hint: 'Component count (wires up later)' },
    { label: 'Scheduled tasks', value: '—', hint: 'Cron jobs running on this app' },
    { label: 'Last run', value: '—', hint: 'Most recent component invocation' },
    { label: 'Open incidents', value: '0', hint: 'Errors in the last 24h' },
  ];
  return (
    <div data-testid="page-app-dashboard" className="h-full overflow-auto p-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
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
          The dashboard surface will aggregate real signals once the App-store,
          runner, and log streams are wired through. This page exists today so
          the Living SaaS shell has a true landing surface.
        </p>
      </section>
    </div>
  );
}

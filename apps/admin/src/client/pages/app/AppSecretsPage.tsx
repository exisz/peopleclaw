/**
 * PLANET-1407: Living SaaS — System / Secrets page.
 * Wraps the existing AppSecretsPanel.
 */
import { useParams } from 'react-router-dom';
import { AppSecretsPanel } from '../../components/AppSecretsPanel';

export default function AppSecretsPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div data-testid="page-app-system-secrets" className="h-full overflow-auto">
      <SystemHeader title="Secrets" subtitle="Per-app encrypted key/value store consumed by components." />
      <div className="p-6">
        {id ? (
          <AppSecretsPanel appId={id} />
        ) : (
          <p className="text-sm text-muted-foreground">No app selected.</p>
        )}
      </div>
    </div>
  );
}

function SystemHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="px-6 py-4 border-b border-border">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
    </header>
  );
}

import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/button';

export default function AppBuildPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  return (
    <div data-testid="page-app-build" className="h-full overflow-auto p-6">
      <header className="mb-6 max-w-3xl">
        <h1 className="text-xl font-semibold tracking-tight">Build App</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Describe what this app should do, choose starter app patterns, and iterate with chat.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 max-w-4xl">
        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <h2 className="font-medium">Start from a ready app</h2>
          <p className="text-sm text-muted-foreground">
            Use the Apps page to create a starter app, then open it here to refine copy, data, and behavior.
          </p>
          <Button variant="outline" onClick={() => navigate('/apps')}>Browse starter apps</Button>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <h2 className="font-medium">Ask for changes</h2>
          <p className="text-sm text-muted-foreground">
            Tell the app what users need. PeopleClaw keeps implementation details behind the scenes.
          </p>
          <Button onClick={() => navigate(`/app/${id}/chat`)}>Open chat</Button>
        </div>
      </section>
    </div>
  );
}

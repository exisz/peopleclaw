import AppsSidebar from '../components/AppsSidebar';

export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex h-screen bg-background">
      <AppsSidebar />
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground text-lg">TODO Stage 3 — {title}</p>
      </div>
    </div>
  );
}

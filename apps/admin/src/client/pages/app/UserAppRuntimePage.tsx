import { useLocation, useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { resolveCoreAppShellRoute } from '../../lib/appRouteResolution';

/**
 * MVP core shell entrypoint for soft-deployed user App routes.
 * The shell owns `/apps/:appId/*`; later tests wire this to deployment records,
 * manifests, immutable bundles, and iframe isolation without changing the URL
 * contract or requiring a core redeploy per user App feature.
 */
export default function UserAppRuntimePage() {
  const location = useLocation();
  const { appId } = useParams();
  const resolved = resolveCoreAppShellRoute(location.pathname);
  const resolvedAppId = resolved?.appId ?? appId ?? 'unknown';
  const appPath = resolved?.appPath ?? '/';

  return (
    <div className="p-6 md:p-10 h-full overflow-auto" data-testid="core-app-shell-route">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>PeopleClaw App Runtime</CardTitle>
            <CardDescription>
              Core shell resolved this soft App route without a per-App core route.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p data-testid="core-app-shell-app-id">App: {resolvedAppId}</p>
            <p data-testid="core-app-shell-path">Path: {appPath}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

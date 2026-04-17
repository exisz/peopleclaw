import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';

export default function CreditsSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Thanks!</CardTitle>
          <CardDescription>
            Your payment was received. Credits will appear shortly — refresh in ~30 seconds.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessionId && (
            <p className="text-xs font-mono text-muted-foreground break-all">
              session_id: {sessionId}
            </p>
          )}
          <Button asChild className="w-full">
            <Link to="/credits">Back to Credits</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

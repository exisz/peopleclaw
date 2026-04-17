import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { logtoClient, redirectUri } from '../lib/logto';

export default function SignIn() {
  useEffect(() => {
    logtoClient.signIn(redirectUri).catch(console.error);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">跳转到 Logto…</p>
      </div>
    </div>
  );
}

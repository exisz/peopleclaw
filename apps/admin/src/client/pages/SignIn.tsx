import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { logtoClient, redirectUri } from '../lib/logto';

export default function SignIn() {
  const { t } = useTranslation('auth');

  useEffect(() => {
    // PLANET-934: avoid /signin polluting history. Replace current history entry
    // with '/' before Logto redirects, so browser-back returns to landing
    // (not the Logto sign-in page).
    try {
      window.history.replaceState(null, '', '/');
    } catch {
      // ignore
    }
    logtoClient.signIn(redirectUri).catch(console.error);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">{t('redirecting')}</p>
      </div>
    </div>
  );
}

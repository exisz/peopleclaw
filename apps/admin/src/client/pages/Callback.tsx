import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { logtoClient } from '../lib/logto';

export default function Callback() {
  const navigate = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  const { t } = useTranslation('auth');

  useEffect(() => {
    (async () => {
      try {
        await logtoClient.handleSignInCallback(window.location.href);
        navigate('/dashboard', { replace: true });
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      {err ? (
        <Card className="max-w-md border-destructive">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <CardTitle>{t('loginFailed')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{err}</p>
            <a href="/" className="text-sm underline underline-offset-4">
              {t('backToHome')}
            </a>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">{t('completing')}</p>
        </div>
      )}
    </div>
  );
}

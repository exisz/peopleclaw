import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn, Activity, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { logtoClient } from '../lib/logto';

export default function Home() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const { t } = useTranslation(['home', 'auth']);

  useEffect(() => {
    logtoClient.isAuthenticated().then(setAuthed);
  }, []);

  useEffect(() => {
    if (authed === true) navigate('/dashboard', { replace: true });
  }, [authed, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <Badge variant="secondary">Admin</Badge>
            <Badge variant="outline">shadcn/ui</Badge>
          </div>
          <CardTitle className="text-3xl mt-2">{t('home:title')}</CardTitle>
          <CardDescription>{t('home:tagline')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('home:intro', { path: 'apps/admin/' })}
          </p>

          {authed === null ? (
            <Button disabled className="w-full">
              <Activity className="h-4 w-4 animate-pulse" />
              {t('auth:checking')}
            </Button>
          ) : (
            <Button asChild className="w-full">
              <Link to="/signin">
                <LogIn className="h-4 w-4" />
                {t('auth:signIn')}
              </Link>
            </Button>
          )}

          <div className="text-xs text-muted-foreground text-center">
            <a href="/api/health" className="underline-offset-4 hover:underline">
              GET /api/health
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

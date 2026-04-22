import { Link } from 'react-router-dom';
import { ArrowLeft, Construction } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { ThemeToggle } from '../components/theme-toggle';
import TenantSwitcher from '../components/TenantSwitcher';
import { LanguageToggle } from '../components/language-toggle';

/**
 * PLANET-1051: Background Settings placeholder page.
 * Previously this route was unregistered, causing a blank screen when clicked
 * from the top nav. This placeholder ensures the page is always visible.
 */
export default function SettingsBackground() {
  const { t } = useTranslation(['common']);

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4" /> {t('buttons.back')}
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">背景设定</h1>
              <p className="text-sm text-muted-foreground">Background Settings</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TenantSwitcher />
            <ThemeToggle />
            <LanguageToggle />
          </div>
        </header>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Construction className="h-6 w-6 text-muted-foreground" />
              <div>
                <CardTitle>功能建设中</CardTitle>
                <CardDescription>敬请期待</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              背景设定功能正在开发中，将支持为工作流配置 AI 角色背景、提示词模板和上下文参数。
            </p>
            <div className="mt-4">
              <Button asChild variant="outline" size="sm">
                <Link to="/workflows">
                  <ArrowLeft className="h-4 w-4 mr-1" /> 返回工作流
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

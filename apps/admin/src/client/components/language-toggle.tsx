import { Globe, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

// Language self-names live in each locale's common.json (`language.english`, `language.chinese`)
// so the option always shows in its own native script regardless of UI language.
const OPTIONS = [
  { value: 'en', testId: 'language-option-en' },
  { value: 'zh', testId: 'language-option-zh' },
] as const;

export function LanguageToggle() {
  const { i18n, t } = useTranslation('common');
  const current = (i18n.language || 'en').slice(0, 2);
  // Always render labels from the *target* language's locale so each item
  // shows its own self-name (e.g. English / native Chinese), independent of current UI language.
  const labelFor = (lng: string): string => {
    const key = lng === 'zh' ? 'language.chinese' : 'language.english';
    return t(key, { lng });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          data-testid="lang-switcher"
          aria-label="Toggle language"
        >
          <Globe className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPTIONS.map((opt) => {
          const selected = current === opt.value;
          return (
            <DropdownMenuItem
              key={opt.value}
              data-testid={opt.testId}
              onSelect={() => {
                void i18n.changeLanguage(opt.value);
              }}
              className="justify-between"
            >
              <span>{labelFor(opt.value)}</span>
              {selected ? <Check className="h-3.5 w-3.5 text-muted-foreground" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

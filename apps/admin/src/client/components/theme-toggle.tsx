import { Moon, Sun, Monitor, Check } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useTheme, type Theme } from './theme-provider';

const OPTIONS: { value: Theme; label: string; testId: string }[] = [
  { value: 'light', label: 'Light', testId: 'theme-option-light' },
  { value: 'dark', label: 'Dark', testId: 'theme-option-dark' },
  { value: 'system', label: 'System', testId: 'theme-option-system' },
];

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative"
          data-testid="theme-toggle"
          aria-label="Toggle theme"
        >
          <Sun
            className={
              'h-4 w-4 transition-all ' +
              (resolvedTheme === 'dark'
                ? '-rotate-90 scale-0'
                : 'rotate-0 scale-100')
            }
          />
          <Moon
            className={
              'absolute h-4 w-4 transition-all ' +
              (resolvedTheme === 'dark'
                ? 'rotate-0 scale-100'
                : 'rotate-90 scale-0')
            }
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPTIONS.map((opt) => {
          const Icon =
            opt.value === 'light'
              ? Sun
              : opt.value === 'dark'
              ? Moon
              : Monitor;
          const selected = theme === opt.value;
          return (
            <DropdownMenuItem
              key={opt.value}
              data-testid={opt.testId}
              onSelect={() => setTheme(opt.value)}
              className="justify-between"
            >
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {opt.label}
              </span>
              {selected ? (
                <Check className="h-3.5 w-3.5 text-muted-foreground" />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

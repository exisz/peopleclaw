import { Sun, Moon, Eye, Leaf, Cloud, Check } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useTheme, type Theme } from './theme-provider';

const OPTIONS: { value: Theme; label: string; icon: React.ElementType; testId: string }[] = [
  { value: 'light',    label: '日间',  icon: Sun,   testId: 'theme-option-light' },
  { value: 'dark',     label: '夜间',  icon: Moon,  testId: 'theme-option-dark' },
  { value: 'eye-care', label: '护眼',  icon: Eye,   testId: 'theme-option-eye-care' },
  { value: 'green',    label: '淡绿',  icon: Leaf,  testId: 'theme-option-green' },
  { value: 'gray',     label: '浅灰',  icon: Cloud, testId: 'theme-option-gray' },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const current = OPTIONS.find((o) => o.value === theme) ?? OPTIONS[0];
  const Icon = current.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative"
          data-testid="theme-toggle"
          aria-label="切换主题"
        >
          <Icon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPTIONS.map((opt) => {
          const ItemIcon = opt.icon;
          const selected = theme === opt.value;
          return (
            <DropdownMenuItem
              key={opt.value}
              data-testid={opt.testId}
              onSelect={() => setTheme(opt.value)}
              className="justify-between"
            >
              <span className="flex items-center gap-2">
                <ItemIcon className="h-4 w-4" />
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

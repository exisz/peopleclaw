/**
 * PLANET-1385: Code Block — generative UI component.
 * Syntax-highlighted code display with copy button.
 */
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CodeBlockProps {
  title: string;
  language: string;
  code: string;
}

export function CodeBlock({ title, language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="rounded-lg border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-muted/70 border-b">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">{title}</h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-primary/10 text-primary uppercase">
              {language}
            </span>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {/* Code */}
        <pre className="p-4 overflow-x-auto bg-zinc-950 text-zinc-100">
          <code className="text-sm font-mono leading-relaxed whitespace-pre">{code}</code>
        </pre>
      </div>
    </div>
  );
}

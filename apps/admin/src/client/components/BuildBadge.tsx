import { useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';

const shortSha = import.meta.env.VITE_BUILD_SHORT_SHA || 'dev';
const sha = import.meta.env.VITE_BUILD_SHA || 'dev-local';
const branch = import.meta.env.VITE_BUILD_BRANCH || 'dev';
const message = import.meta.env.VITE_BUILD_MESSAGE || '';
const builtAt = import.meta.env.VITE_BUILD_AT || '';

export function BuildBadge() {
  const [expanded, setExpanded] = useState(false);

  const label = `build: ${shortSha} · ${branch}`;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip open={expanded} onOpenChange={setExpanded}>
        <TooltipTrigger asChild>
          <button
            className="text-[9px] font-mono text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-default select-text text-center leading-tight"
            onClick={() => setExpanded(v => !v)}
            data-testid="build-badge"
          >
            {label}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs font-mono max-w-xs space-y-1">
          <div><span className="text-muted-foreground">sha:</span> {sha}</div>
          <div><span className="text-muted-foreground">branch:</span> {branch}</div>
          {message && <div><span className="text-muted-foreground">msg:</span> {message}</div>}
          {builtAt && <div><span className="text-muted-foreground">built:</span> {builtAt}</div>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

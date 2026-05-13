/**
 * PLANET-1671: Living SaaS — native PI Codex agent chat page.
 *
 * Chat is a full App-shell page backed by server-side OpenAI Codex OAuth,
 * JSONL-style session storage, and the reusable @united-robotics/agent-ui-core
 * React/SSE adapter. Tokens never leave the server.
 */
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { AgentChatSurface, createFetchAgentChatTransport } from '@united-robotics/agent-ui-core';
import { apiFetch } from '../../lib/api';

export default function AppChatPage() {
  const { id: appId } = useParams<{ id: string }>();
  const transport = useMemo(() => createFetchAgentChatTransport('/api', { fetch: apiFetch }), []);

  return (
    <div data-testid="page-app-chat" className="flex h-full min-h-0 flex-col bg-muted/20">
      <header className="shrink-0 border-b border-border bg-background/85 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <h1 className="text-lg font-semibold tracking-tight">Chat</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Talk to this App. Sessions are preserved and streamed through the native PI Codex adapter.
        </p>
      </header>
      <div className="min-h-0 flex-1 p-3 sm:p-4 lg:p-6">
        <div className="h-full min-h-0 overflow-hidden rounded-3xl border border-border/80 bg-background shadow-sm ring-1 ring-black/5 dark:ring-white/10">
          <AgentChatSurface
            appId={appId}
            emptyTitle="Talk to this App"
            emptyDescription="Ask for product decisions, component plans, implementation notes, or the next safest action."
            inputPlaceholder="Message this App…"
            transport={transport}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * PLANET-1671: Living SaaS — native PI Codex agent chat page.
 *
 * Chat is a full App-shell page backed by server-side OpenAI Codex OAuth,
 * JSONL-style session storage, and the reusable @united-robotics/agent-ui-core
 * React/SSE adapter. Tokens never leave the server.
 */
import { useParams } from 'react-router-dom';
import { AgentChatSurface } from '@united-robotics/agent-ui-core';

export default function AppChatPage() {
  const { id: appId } = useParams<{ id: string }>();

  return (
    <div data-testid="page-app-chat" className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Chat</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Talk to this App. Sessions are preserved and streamed through the native PI Codex adapter.
        </p>
      </header>
      <div className="min-h-0 flex-1">
        <AgentChatSurface
          appId={appId}
          emptyTitle="Talk to this App"
          emptyDescription="Ask for product decisions, component plans, implementation notes, or the next safest action."
          inputPlaceholder="Message this App…"
        />
      </div>
    </div>
  );
}

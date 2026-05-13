# @united-robotics/agent-ui-core

Reusable React chat surface plus a small transport facade. The package does not own auth, routing, tenant selection, or gateway-specific state; host apps inject those through `AgentChatTransport` or the `fetch` option.

## PeopleClaw

```tsx
import { AgentChatSurface, createFetchAgentChatTransport } from '@united-robotics/agent-ui-core';
import { apiFetch } from './lib/api';

const transport = createFetchAgentChatTransport('/api', { fetch: apiFetch });

<AgentChatSurface appId={appId} transport={transport} />
```

Expected routes:

- `GET/POST /api/apps/:appId/agent-sessions`
- `GET/DELETE /api/apps/:appId/agent-sessions/:sessionId`
- `POST /api/apps/:appId/agent-sessions/:sessionId/messages` as SSE

## Clawdius compatibility

Clawdius can consume the same UI by using the compatibility adapter. Pass the selected Clawdius `agentId` as `appId`; the adapter maps it to Clawdius Gateway's current `/api/threads` and `/api/chat` routes.

```tsx
import {
  AgentChatSurface,
  createClawdiusAgentChatTransport,
} from '@united-robotics/agent-ui-core';

const transport = createClawdiusAgentChatTransport({
  basePath: '/api',
  fetch: (input, init) => fetch(input, init), // inject auth headers here if needed
});

<AgentChatSurface
  appId={selectedAgentId}
  transport={transport}
  emptyTitle={`Chat with ${selectedAgent?.title ?? selectedAgentId}`}
  inputPlaceholder={`Message ${selectedAgent?.title ?? selectedAgentId}…`}
/>
```

Adapter mapping:

- `listSessions(appId)` → `GET /api/threads?agentId=:appId`
- `createSession(appId, title)` → `POST /api/threads { agentId: appId, title }`
- `get/deleteSession` → `/api/threads/:id`
- `sendMessage(appId, sessionId, message)` → `POST /api/chat { agentId: appId, threadId: sessionId, message }`
- Clawdius SSE events (`message_update`, `tool_execution_*`, `subagent_*`, `done`, `error`) are normalized to `AgentStreamEvent`.

If Clawdius wants to keep its current bespoke subagent/memory panels, use only `createClawdiusAgentChatTransport` as a reference boundary. If it wants the shared surface, no PeopleClaw-specific auth is required in core; inject it in `fetch`.

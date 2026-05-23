# PeopleClaw external-agent API reference

Use the CLI when possible. These HTTP endpoints are the same scoped surface the CLI uses.

## Authentication

```http
Authorization: Bearer pc_m2m_...
```

Tokens are created by a signed-in tenant user from:

```text
/app/<APP_ID>/system/external-agent
```

The secret token is revealed once. Later list responses include only key metadata such as `prefix`, `name`, `scopes`, `lastUsedAt`, and `revokedAt`.

## Tenant user key lifecycle

These routes require normal PeopleClaw user auth and selected tenant context.

### `GET /api/external-agent-keys`

Lists external-agent keys for the current tenant. Does **not** return secret tokens or token hashes.

### `POST /api/external-agent-keys`

Creates a new key.

```json
{
  "name": "Codex setup · Customer Portal",
  "appId": "app_...",
  "scopes": ["agent:read", "app:read", "app:write", "component:read", "component:write", "component:run"]
}
```

Response includes `token` exactly once:

```json
{
  "key": { "id": "...", "prefix": "pc_m2m_...", "scopes": ["agent:read"] },
  "token": "pc_m2m_...",
  "tokenHint": "Store this token now. PeopleClaw only stores a hash and cannot reveal it again."
}
```

### `DELETE /api/external-agent-keys/:id`

Revokes a key for the current tenant.

## External-agent routes

### `GET /api/external-agent/whoami`

Returns the verified token identity, tenant, app scope, and scopes.

### `GET /api/external-agent/apps`

Lists apps visible to the token. App-scoped tokens return only their target app.

### `GET /api/external-agent/apps/:appId`

Inspects one app and its safe component metadata. Cross-app access returns `403`; unknown or inaccessible app IDs return `404`.

### `POST /api/external-agent/safety/check`

Checks whether an operation would be allowed before attempting it.

```json
{ "operation": "update_app_component", "dryRun": true }
```

### `GET /api/external-agent/safety/policy`

Returns allowed scopes and operation policies for diagnostics.

### `POST /api/external-agent/apps/:appId/action`

Runs an allowlisted app operation. Mutating operations require dry-run first and then explicit confirmation.

```json
{
  "operation": "update_app_component",
  "dryRun": true,
  "input": { "componentId": "cmp_...", "code": "..." }
}
```

### `POST /api/external-agent/apps/:appId/chat`

Sends a chat-style instruction to the app agent through the scoped external-agent surface. Mutations still obey the same safety policy and confirmation requirement.

## Scopes

- `agent:read` — identity and safety checks.
- `app:read` — list/inspect apps.
- `app:write` — safe app-level mutations when allowlisted.
- `component:read` — inspect component/module metadata.
- `component:write` — create/update allowlisted components with dry-run/confirm.
- `component:run` — run components with dry-run/confirm.

## Hard-denied operations

External agents cannot use this API for raw SQL, migrations, schema changes, plaintext secret reads/export, platform secret rotation, table drops/truncation, or cross-tenant mutation.

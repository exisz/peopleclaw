# Empire SSO Email Bridge — Logto → Resend

## Background (PLANET-1045)

Logto's built-in **http-email connector** (current version) does **not** support sending directly to third-party transactional email APIs like Resend. It only POSTs its own webhook payload:

```json
{ "to": "user@example.com", "type": "Register", "payload": { "code": "123456" } }
```

Resend expects `{ from, to, subject, html }` — incompatible. The old `requestBodyTemplate` field was removed in newer Logto versions.

**Solution**: A lightweight bridge endpoint that translates Logto's webhook format → Resend API.

---

## Architecture

```
Logto (id.rollersoft.com.au)
  └─ http-email connector
       └─ POST /api/webhooks/logto-email   ← PeopleClaw Express server
            └─ renders HTML template
            └─ POST https://api.resend.com/emails
```

## Endpoint

```
POST /api/webhooks/logto-email
Authorization: Bearer <LOGTO_EMAIL_WEBHOOK_SECRET>
```

**Input** (Logto's webhook payload):
```json
{
  "to": "user@example.com",
  "type": "Register | SignIn | ForgotPassword | Generic | Test",
  "payload": { "code": "123456" }
}
```

**Output** (success):
```json
{ "ok": true, "id": "<resend-message-id>" }
```

## Health Check

```
GET /api/webhooks/logto-email/health
→ { "ok": true, "hasResendKey": true, "hasWebhookSecret": true }
```

## Required Environment Variables

| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | Resend API key (`re_xxx`) |
| `LOGTO_EMAIL_WEBHOOK_SECRET` | Shared secret between Logto connector and bridge |

Generate a secret: `openssl rand -base64 32`

## Other Products

Any future product using the same Logto instance (id.rollersoft.com.au) can point its http-email connector at this endpoint, as long as it uses the same `LOGTO_EMAIL_WEBHOOK_SECRET`.

If a product needs its own secret or routing, deploy its own bridge instance or extend this one with multi-tenant routing.

## ⚠️ Important: Do NOT direct-connect Logto to Resend

Do not attempt to configure the Logto http-email connector to POST directly to `https://api.resend.com/emails`. Logto's payload format is incompatible with the Resend API — you will get **422 missing html** errors. Always use the bridge.

## Switching the Connector

After deploying and adding Vercel env vars, run:
```bash
node apps/admin/scripts/switch-logto-email-to-bridge.mjs --secret=$LOGTO_EMAIL_WEBHOOK_SECRET
```

## Testing

```bash
node apps/admin/scripts/test-logto-email-bridge.mjs \
  --to=you@example.com \
  --target=https://app.peopleclaw.rollersoft.com.au \
  --secret=$LOGTO_EMAIL_WEBHOOK_SECRET
```

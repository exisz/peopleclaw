/**
 * PLANET-1045: Logto → Resend email bridge.
 *
 * Logto's http-email connector POSTs its own webhook payload — it cannot
 * directly speak the Resend API format. This route translates between them.
 *
 * POST /api/webhooks/logto-email   — forward email via Resend
 * GET  /api/webhooks/logto-email/health — liveness + env check
 */

import { Router, type Request, type Response } from 'express';

export const logtoEmailWebhookRouter = Router();

// ─── Types ────────────────────────────────────────────────────────────────────

type LogtoEmailType = 'Register' | 'SignIn' | 'ForgotPassword' | 'Generic' | 'Test';

interface LogtoEmailPayload {
  to: string;
  type: LogtoEmailType;
  payload: {
    code?: string;
    link?: string;
    [key: string]: unknown;
  };
}

// ─── HTML template ────────────────────────────────────────────────────────────

function renderEmail(type: LogtoEmailType, code?: string, link?: string): { subject: string; html: string } {
  let subject: string;
  let heading: string;
  let bodyText: string;
  let codeDisplay = '';

  switch (type) {
    case 'Register':
      subject = 'Welcome to Roller — verify your email';
      heading = 'Welcome to Roller';
      bodyText = 'Your verification code is:';
      codeDisplay = code ?? '';
      break;
    case 'SignIn':
      subject = 'Your Roller sign-in code';
      heading = 'Sign in to Roller';
      bodyText = 'Your sign-in code is:';
      codeDisplay = code ?? '';
      break;
    case 'ForgotPassword':
      subject = 'Reset your Roller password';
      heading = 'Password Reset';
      bodyText = 'Your password reset code is:';
      codeDisplay = code ?? '';
      break;
    case 'Test':
    case 'Generic':
    default:
      subject = 'Roller — verification code';
      heading = 'Verification Code';
      bodyText = 'Your verification code is:';
      codeDisplay = code ?? '';
  }

  const linkSection = link
    ? `<p style="margin:24px 0 0;text-align:center;">
        <a href="${link}" style="display:inline-block;padding:12px 28px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">
          Proceed
        </a>
       </p>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:480px;background:#1e293b;border-radius:12px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:28px 32px 20px;border-bottom:1px solid #334155;">
              <span style="font-size:22px;font-weight:700;color:#f1f5f9;letter-spacing:-0.5px;">Roller</span>
              <span style="font-size:12px;color:#64748b;margin-left:8px;">by rollersoft.com.au</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 28px;">
              <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#f1f5f9;">${heading}</h1>
              <p style="margin:0 0 20px;font-size:15px;color:#94a3b8;line-height:1.6;">${bodyText}</p>
              ${codeDisplay ? `
              <div style="display:block;text-align:center;margin:0 0 24px;">
                <span style="display:inline-block;background:#0f172a;border:1px solid #334155;border-radius:8px;padding:16px 40px;font-size:36px;font-weight:700;color:#a5b4fc;letter-spacing:8px;font-variant-numeric:tabular-nums;">${codeDisplay}</span>
              </div>
              <p style="margin:0;font-size:13px;color:#475569;text-align:center;">This code expires in 10 minutes. Do not share it with anyone.</p>
              ` : ''}
              ${linkSection}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid #334155;">
              <p style="margin:0;font-size:12px;color:#475569;text-align:center;">
                You're receiving this because an action was requested on your Roller account.<br/>
                If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

// ─── Health endpoint ──────────────────────────────────────────────────────────

logtoEmailWebhookRouter.get('/webhooks/logto-email/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    hasResendKey: Boolean(process.env.RESEND_API_KEY),
    hasWebhookSecret: Boolean(process.env.LOGTO_EMAIL_WEBHOOK_SECRET),
  });
});

// ─── Webhook endpoint ─────────────────────────────────────────────────────────

logtoEmailWebhookRouter.post('/webhooks/logto-email', async (req: Request, res: Response) => {
  // Auth check
  const secret = process.env.LOGTO_EMAIL_WEBHOOK_SECRET;
  const authHeader = req.headers['authorization'] ?? '';
  const expected = `Bearer ${secret}`;

  if (!secret || authHeader !== expected) {
    console.warn('[logto-email-bridge] 401 — bad or missing Authorization header');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { to, type, payload } = req.body as Partial<LogtoEmailPayload>;

  if (!to || !type) {
    res.status(400).json({ error: 'Missing required fields: to, type' });
    return;
  }

  const { subject, html } = renderEmail(type as LogtoEmailType, payload?.code, payload?.link);

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.error('[logto-email-bridge] RESEND_API_KEY not set');
    res.status(503).json({ error: 'Email service not configured' });
    return;
  }

  let resendRes: globalThis.Response;
  try {
    resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Roller <noreply@rollersoft.com.au>',
        to,
        subject,
        html,
      }),
    });
  } catch (err) {
    console.error('[logto-email-bridge] fetch error:', err);
    res.status(502).json({ error: 'Failed to reach Resend API' });
    return;
  }

  if (!resendRes.ok) {
    let errorBody: unknown;
    try { errorBody = await resendRes.json(); } catch { errorBody = null; }
    console.error(`[logto-email-bridge] Resend ${resendRes.status}:`, errorBody);
    res.status(502).json({ error: 'Resend API error', details: errorBody });
    return;
  }

  const data = await resendRes.json() as { id?: string };
  console.log(`[logto-email-bridge] sent ${type} email to ${to} — id=${data.id}`);
  res.json({ ok: true, id: data.id });
});
// redeploy trigger to pick up new envs (PLANET-1045)

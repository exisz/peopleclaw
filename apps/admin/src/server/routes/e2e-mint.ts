import { Router } from 'express';
import type { Request, Response } from 'express';

/**
 * PLANET-1427: E2E mint endpoint — CI-friendly login without OAuth UI flow.
 *
 * POST /api/internal/e2e-mint-session
 * Header: X-E2E-Secret = process.env.E2E_SECRET
 * Body: { email?: string } (defaults to e2e@peopleclaw.test)
 *
 * Returns a signed session token that our auth middleware will accept.
 * Uses Logto Management API to get a real user access token via token exchange,
 * OR falls back to issuing an opaque e2e token that our middleware recognizes.
 *
 * Only registered when E2E_SECRET env var is set.
 */
export const e2eMintRouter = Router();

const E2E_SECRET = process.env.E2E_SECRET;

if (E2E_SECRET) {
  e2eMintRouter.post('/internal/e2e-mint-session', async (req: Request, res: Response) => {
    const secret = req.header('x-e2e-secret') || '';
    if (secret !== E2E_SECRET) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const email = (req.body?.email as string) || 'e2e@peopleclaw.test';

    const endpoint = process.env.LOGTO_ENDPOINT || 'https://id.rollersoft.com.au';
    const appId = process.env.LOGTO_APP_ID || '';
    const appSecret = process.env.LOGTO_APP_SECRET || '';
    const apiResource = process.env.LOGTO_API_RESOURCE || '';

    if (!appId || !appSecret || !apiResource) {
      res.status(500).json({ error: 'Missing LOGTO_APP_ID/SECRET/API_RESOURCE' });
      return;
    }

    try {
      // Step 1: Get M2M access token for Logto Management API
      const tokenEndpoint = `${endpoint}/oidc/token`;
      const m2mRes = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${appId}:${appSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          resource: `${endpoint}/api`,
          scope: 'all',
        }),
      });

      if (!m2mRes.ok) {
        const text = await m2mRes.text();
        res.status(502).json({ error: 'M2M token failed', detail: text });
        return;
      }

      const m2m = (await m2mRes.json()) as { access_token: string };

      // Step 2: Find user by email
      const usersRes = await fetch(
        `${endpoint}/api/users?search=${encodeURIComponent(email)}`,
        { headers: { Authorization: `Bearer ${m2m.access_token}` } },
      );
      if (!usersRes.ok) {
        res.status(502).json({ error: 'User lookup failed' });
        return;
      }
      const users = (await usersRes.json()) as Array<{ id: string; primaryEmail?: string }>;
      const matched = users.find((u) => u.primaryEmail === email);
      if (!matched) {
        res.status(404).json({ error: `User not found: ${email}` });
        return;
      }

      // Step 3: Get user token via subject token (token exchange / impersonation)
      // Logto Cloud supports user impersonation via Management API:
      // POST /api/users/{userId}/personal-access-tokens
      const patRes = await fetch(
        `${endpoint}/api/users/${matched.id}/personal-access-tokens`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${m2m.access_token}`,
          },
          body: JSON.stringify({
            name: `e2e-${Date.now()}`,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min
          }),
        },
      );

      if (!patRes.ok) {
        const text = await patRes.text();
        // Fallback: try token exchange grant
        const exchangeRes = await fetch(tokenEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${appId}:${appSecret}`).toString('base64')}`,
          },
          body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
            subject_token: m2m.access_token,
            subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
            resource: apiResource,
            actor_token: matched.id,
            actor_token_type: 'urn:logto:token-type:user-id',
          }),
        });

        if (!exchangeRes.ok) {
          const exchText = await exchangeRes.text();
          res.status(502).json({
            error: 'Both PAT and token-exchange failed',
            patDetail: text,
            exchangeDetail: exchText,
          });
          return;
        }

        const exchange = (await exchangeRes.json()) as {
          access_token: string;
          expires_in: number;
        };
        res.json({
          accessToken: exchange.access_token,
          expiresIn: exchange.expires_in,
          sub: matched.id,
        });
        return;
      }

      // PAT success — but PATs aren't JWTs usable as Bearer for our API resource.
      // We need to exchange it. For now return M2M info + user sub so fixture
      // can use the e2e-bypass auth path.
      const pat = (await patRes.json()) as { value?: string };

      // Actually: simplest approach — return the e2e bypass token.
      // Our auth middleware will check for X-E2E-Secret + X-E2E-User-Id as bypass.
      res.json({
        accessToken: `e2e:${E2E_SECRET}:${matched.id}`,
        expiresIn: 600,
        sub: matched.id,
        mode: 'e2e-bypass',
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: 'mint failed', detail: msg });
    }
  });
}

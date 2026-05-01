import { Router } from 'express';
import type { Request, Response } from 'express';

/**
 * PLANET-1427: E2E mint endpoint — CI-friendly login without OAuth UI flow.
 *
 * POST /api/internal/e2e-mint-session
 * Header: X-E2E-Secret = process.env.E2E_SECRET
 * Body: { userId?: string } (defaults to e2e@peopleclaw.test)
 *
 * Uses Logto Management API (M2M app credentials) to issue an access token
 * for the given user, scoped to our API resource.
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

    const userId = (req.body?.userId as string) || 'e2e@peopleclaw.test';

    const endpoint = process.env.LOGTO_ENDPOINT || 'https://id.rollersoft.com.au';
    const appId = process.env.LOGTO_APP_ID || '';
    const appSecret = process.env.LOGTO_APP_SECRET || '';
    const apiResource = process.env.LOGTO_API_RESOURCE || '';

    if (!appId || !appSecret || !apiResource) {
      res.status(500).json({ error: 'Missing LOGTO_APP_ID/SECRET/API_RESOURCE' });
      return;
    }

    try {
      // Step 1: Get M2M access token for Management API
      const tokenEndpoint = `${endpoint}/oidc/token`;
      const m2mRes = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${appId}:${appSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          resource: `${endpoint}/api`, // Logto Management API resource
          scope: 'all',
        }),
      });

      if (!m2mRes.ok) {
        const text = await m2mRes.text();
        res.status(502).json({ error: 'M2M token failed', detail: text });
        return;
      }

      const m2m = (await m2mRes.json()) as { access_token: string };

      // Step 2: Find user by email (or use userId as sub directly)
      let sub = userId;
      if (userId.includes('@')) {
        const usersRes = await fetch(
          `${endpoint}/api/users?search=${encodeURIComponent(userId)}`,
          { headers: { Authorization: `Bearer ${m2m.access_token}` } },
        );
        if (!usersRes.ok) {
          res.status(502).json({ error: 'User lookup failed' });
          return;
        }
        const users = (await usersRes.json()) as Array<{ id: string; primaryEmail?: string }>;
        const matched = users.find((u) => u.primaryEmail === userId);
        if (!matched) {
          res.status(404).json({ error: `User not found: ${userId}` });
          return;
        }
        sub = matched.id;
      }

      // Step 3: Exchange for user token using subject_token grant (Logto personal access token flow)
      // Alternative: use token exchange (RFC 8693) if supported, or custom token endpoint
      // Logto supports: POST /oidc/token with grant_type=urn:ietf:params:oauth:grant-type:token-exchange
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
          actor_token: sub,
          actor_token_type: 'urn:logto:token-type:user-id',
        }),
      });

      if (!exchangeRes.ok) {
        const text = await exchangeRes.text();
        res.status(502).json({ error: 'Token exchange failed', detail: text });
        return;
      }

      const exchange = (await exchangeRes.json()) as {
        access_token: string;
        expires_in: number;
        token_type: string;
      };

      res.json({
        accessToken: exchange.access_token,
        expiresIn: exchange.expires_in,
        sub,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: 'mint failed', detail: msg });
    }
  });
}

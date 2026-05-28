import 'dotenv/config';
import { getCodexAccessToken } from '../src/server/lib/codexAuth.js';

try {
  const auth = await getCodexAccessToken();
  const expires = auth.expires ? new Date(auth.expires).toISOString() : 'unknown';
  console.log(JSON.stringify({
    ok: true,
    source: auth.profileId,
    emailConfigured: Boolean(auth.email),
    expires,
  }));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ ok: false, error: message.replace(/\b[A-Za-z0-9_-]{40,}\b/g, '[redacted]') }));
  process.exit(1);
}

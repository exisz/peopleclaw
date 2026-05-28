import 'dotenv/config';

const args = new Set(process.argv.slice(2));
const requireDurableProduction = args.has('--require-durable-production');

if (requireDurableProduction) {
  process.env.NODE_ENV = 'production';
  process.env.VERCEL = process.env.VERCEL || '1';
}

function redact(value: string): string {
  return value
    .replace(/\b((?:access|refresh|id)_?token)\s*[:=]\s*[^\s,;)]+/gi, '$1=[redacted]')
    .replace(/shp(?:at|ca|ss)_[A-Za-z0-9_\-]+/g, '[redacted]')
    .replace(/\b(?:eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}|[A-Za-z0-9_-]{40,})\b/g, '[redacted]');
}

try {
  const { getCodexAccessToken } = await import('../src/server/lib/codexAuth.js');
  const auth = await getCodexAccessToken();
  const expires = auth.expires ? new Date(auth.expires).toISOString() : 'unknown';
  const result = {
    ok: true,
    source: auth.profileId,
    emailConfigured: Boolean(auth.email),
    expires,
    durableProduction: auth.profileId === 'durable-db',
  };

  if (requireDurableProduction && auth.profileId !== 'durable-db') {
    console.error(JSON.stringify({
      ok: false,
      error: `Expected production Codex auth to use encrypted durable storage, got ${auth.profileId}`,
      source: auth.profileId,
      durableProduction: false,
    }));
    process.exit(1);
  }

  if (auth.expires && auth.expires <= Date.now()) {
    console.error(JSON.stringify({ ok: false, error: 'Codex token expiry is not in the future', source: auth.profileId, expires }));
    process.exit(1);
  }

  console.log(JSON.stringify(result));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ ok: false, error: redact(message), durableProduction: false }));
  process.exit(1);
}

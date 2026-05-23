import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Bot, Check, Copy, KeyRound, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { apiClient } from '../../lib/api';
import {
  EXTERNAL_AGENT_ONBOARDING_SCOPES,
  buildCodexOnboardingPrompt,
  buildPeopleClawCliConfig,
  normalizeBaseUrl,
} from '../../lib/externalAgentOnboarding';

type ExternalAgentKey = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  appId: string | null;
  app?: { id: string; name: string } | null;
  createdAt: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
};

type CreatedKeyResponse = {
  key: ExternalAgentKey;
  token: string;
  tokenHint: string;
};

type AppDetails = {
  id: string;
  name: string;
  description?: string | null;
};

export default function AppExternalAgentPage() {
  const { id } = useParams<{ id: string }>();
  const [app, setApp] = useState<AppDetails | null>(null);
  const [keys, setKeys] = useState<ExternalAgentKey[]>([]);
  const [created, setCreated] = useState<CreatedKeyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const baseUrl = normalizeBaseUrl(typeof window === 'undefined' ? 'https://app.peopleclaw.rollersoft.com.au' : window.location.origin);

  const visibleKeys = useMemo(
    () => keys.filter((key) => key.appId === id),
    [keys, id],
  );
  const setupText = useMemo(
    () => buildPeopleClawCliConfig({ baseUrl, appId: id ?? '', appName: app?.name, token: created?.token }),
    [app?.name, baseUrl, created?.token, id],
  );
  const codexPrompt = useMemo(
    () => buildCodexOnboardingPrompt({ baseUrl, appId: id ?? '', appName: app?.name, token: created?.token }),
    [app?.name, baseUrl, created?.token, id],
  );

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const [appResponse, keyResponse] = await Promise.all([
        apiClient.get<{ app: AppDetails }>(`/api/apps/${id}`),
        apiClient.get<{ keys: ExternalAgentKey[] }>('/api/external-agent-keys'),
      ]);
      setApp(appResponse.app);
      setKeys(keyResponse.keys);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load external-agent setup');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function createKey() {
    if (!id) return;
    setCreating(true);
    try {
      const response = await apiClient.post<CreatedKeyResponse>('/api/external-agent-keys', {
        appId: id,
        name: `Codex setup · ${app?.name ?? id} · ${new Date().toISOString().slice(0, 10)}`,
        scopes: [...EXTERNAL_AGENT_ONBOARDING_SCOPES],
      });
      setCreated(response);
      setKeys((current) => [response.key, ...current.filter((key) => key.id !== response.key.id)]);
      toast.success('Codex key created. Copy the token now — it will not be shown again.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create Codex key');
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(keyId: string) {
    try {
      const response = await apiClient.delete<{ key: ExternalAgentKey }>(`/api/external-agent-keys/${keyId}`);
      setKeys((current) => current.map((key) => (key.id === keyId ? response.key : key)));
      if (created?.key.id === keyId) setCreated(null);
      toast.success('External-agent key revoked');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to revoke key');
    }
  }

  return (
    <div data-testid="page-app-system-external-agent" className="h-full overflow-auto bg-background">
      <header className="px-6 py-4 border-b border-border">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <Bot className="w-5 h-5" /> Connect Codex
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Create a scoped key and copy a ready-to-paste setup for this PeopleClaw app.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        </div>
      </header>

      <main className="p-6 space-y-6 max-w-6xl">
        <section className="grid gap-3 md:grid-cols-3">
          <InfoCard label="App" value={app?.name ?? (loading ? 'Loading…' : 'Unknown app')} hint={id ?? 'No app selected'} />
          <InfoCard label="Base URL" value={baseUrl} hint="Codex/CLI API endpoint" mono />
          <InfoCard label="Default scopes" value="read + safe app/component mutation" hint="Dry-run first; confirm required for writes" />
        </section>

        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="font-semibold flex items-center gap-2"><KeyRound className="w-4 h-4" /> 1. Generate this app's Codex key</h2>
              <p className="text-sm text-muted-foreground mt-1">
                The token is revealed once. PeopleClaw stores only a hash; existing keys below show prefix/metadata only.
              </p>
            </div>
            <Button onClick={() => void createKey()} disabled={!id || creating} data-testid="external-agent-create-key">
              {creating ? 'Creating…' : 'Create Codex key'}
            </Button>
          </div>

          {created ? (
            <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100 dark:border-amber-700/60" data-testid="external-agent-one-time-token">
              <div className="font-medium flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> One-time token — copy it now</div>
              <SecretBlock text={created.token} label="Copy token" className="mt-3" />
              <p className="mt-2 text-xs opacity-80">{created.tokenHint}</p>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              Create a key to fill the setup blocks with a real `pc_m2m_…` token. Until then, they show a placeholder.
            </div>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <SetupCard
            title="2. CLI setup"
            subtitle="Paste this in the repo where Codex/OpenClaw will work."
            text={setupText}
            testId="external-agent-cli-setup"
          />
          <SetupCard
            title="3. Copy-all Codex prompt"
            subtitle="Paste this whole block into your coding agent's first message or AGENTS.md."
            text={codexPrompt}
            testId="external-agent-codex-prompt"
          />
        </section>

        <section className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="font-semibold">Safe first run</h2>
          <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
            <li><code>peopleclaw whoami</code> — confirm tenant/app scope.</li>
            <li><code>peopleclaw apps list</code> and <code>peopleclaw app inspect "$PEOPLECLAW_APP_ID"</code> — inspect before editing.</li>
            <li>Use dry-run for chat/actions first.</li>
            <li>Only pass confirm after you intend the exact change.</li>
          </ol>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="font-semibold">Existing external-agent keys</h2>
              <p className="text-sm text-muted-foreground">No secret tokens are returned here after creation.</p>
            </div>
          </div>
          {visibleKeys.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">No keys for this app yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left py-2 pr-3">Name</th>
                    <th className="text-left py-2 pr-3">Prefix</th>
                    <th className="text-left py-2 pr-3">Scopes</th>
                    <th className="text-left py-2 pr-3">Last used</th>
                    <th className="text-left py-2 pr-3">Status</th>
                    <th className="text-right py-2 pl-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleKeys.map((key) => (
                    <tr key={key.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-3 font-medium">{key.name}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{key.prefix}</td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">{key.scopes.join(', ')}</td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">{formatDate(key.lastUsedAt)}</td>
                      <td className="py-2 pr-3 text-xs">{key.revokedAt ? 'Revoked' : 'Active'}</td>
                      <td className="py-2 pl-3 text-right">
                        <Button variant="outline" size="sm" disabled={Boolean(key.revokedAt)} onClick={() => void revokeKey(key.id)}>
                          <Trash2 className="w-3.5 h-3.5" /> Revoke
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function InfoCard({ label, value, hint, mono }: { label: string; value: string; hint: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={mono ? 'font-mono text-sm mt-1 truncate' : 'font-semibold mt-1 truncate'}>{value}</div>
      <div className="text-[11px] text-muted-foreground/80 mt-1 truncate">{hint}</div>
    </div>
  );
}

function SetupCard({ title, subtitle, text, testId }: { title: string; subtitle: string; text: string; testId: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3" data-testid={testId}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <CopyButton text={text} label="Copy" />
      </div>
      <pre className="max-h-[420px] overflow-auto rounded-lg bg-muted p-4 text-xs leading-relaxed whitespace-pre-wrap"><code>{text}</code></pre>
    </div>
  );
}

function SecretBlock({ text, label, className }: { text: string; label: string; className?: string }) {
  return (
    <div className={className}>
      <div className="flex gap-2">
        <code className="flex-1 min-w-0 overflow-x-auto rounded-md bg-background/80 border border-border px-3 py-2 text-xs font-mono">{text}</code>
        <CopyButton text={text} label={label} />
      </div>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied');
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error('Copy failed');
    }
  }
  return (
    <Button variant="outline" size="sm" onClick={() => void copy()}>
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {label}
    </Button>
  );
}

function formatDate(value?: string | null) {
  if (!value) return 'Never';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

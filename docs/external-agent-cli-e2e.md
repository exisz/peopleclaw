# External agent CLI E2E smoke

This smoke proves a clean Codex/BYO-agent style environment can mutate a PeopleClaw app only through the scoped external-agent CLI/API surface.

It exercises:

1. CLI config via a temp `PEOPLECLAW_CONFIG`
2. `peopleclaw whoami`
3. `peopleclaw apps list`
4. `peopleclaw app inspect <appId>`
5. `peopleclaw app action ... create_app_component` in default dry-run mode, with an assertion that component count does not change
6. Optional confirmed safe mutation, gated by `PEOPLECLAW_E2E_CONFIRM_MUTATION=1`
7. Optional dry-run chat, gated by `PEOPLECLAW_E2E_INCLUDE_CHAT=1`

## Safe local smoke (default)

```bash
pnpm smoke:external-cli
```

By default this starts a temporary local SQLite-backed admin server, mints an app-scoped external-agent key, runs the built CLI from a temp config file, verifies dry-run behavior, then deletes the temp database/config. It does **not** mutate production.

## Full local mutation proof

```bash
PEOPLECLAW_E2E_CONFIRM_MUTATION=1 pnpm smoke:external-cli
```

This still uses the temporary local server by default, but confirms one allowlisted `create_app_component` mutation and asserts exactly one component was created.

## Live/prod dry-run smoke

```bash
PEOPLECLAW_E2E_MODE=live \
PEOPLECLAW_E2E_BASE_URL=https://app.peopleclaw.rollersoft.com.au \
PEOPLECLAW_E2E_API_KEY=pc_m2m_... \
PEOPLECLAW_E2E_APP_ID=<app_id> \
pnpm smoke:external-cli
```

The live smoke is dry-run only unless `PEOPLECLAW_E2E_CONFIRM_MUTATION=1` is also set. Use an app-scoped key with these scopes:

- `agent:read`
- `app:read`
- `component:read`
- `component:write`

## Live confirmed mutation

Only run this against a disposable/test app:

```bash
PEOPLECLAW_E2E_MODE=live \
PEOPLECLAW_E2E_BASE_URL=https://app.peopleclaw.rollersoft.com.au \
PEOPLECLAW_E2E_API_KEY=pc_m2m_... \
PEOPLECLAW_E2E_APP_ID=<test_app_id> \
PEOPLECLAW_E2E_CONFIRM_MUTATION=1 \
pnpm smoke:external-cli
```

The script never enables live mutation implicitly. `PEOPLECLAW_E2E_CONFIRM_MUTATION=1` is required for any non-dry-run action.

## Optional chat check

```bash
PEOPLECLAW_E2E_INCLUDE_CHAT=1 pnpm smoke:external-cli
```

Chat stays in dry-run mode in this smoke. It is optional because model/Codex availability may vary by environment.

# Agent Workspace Standard

This workspace is designed for a human using ChatGPT/Codex/Claude/OpenClaw with a PeopleClaw Vercel broker token.

## Layout

```txt
.
├── AGENTS.md              # instructions for local coding agents
├── .env.example           # committed non-sensitive defaults
├── repos/                 # git submodules for owned/customer repos
└── secrets/               # local-only secret files and examples
```

Root repo = the agent workspace. Put related repos under `repos/` as git submodules so the agent has one stable root and explicit repo boundaries:

```bash
git submodule add git@github.com:ORG/skin-spirit.git repos/skin-spirit
git submodule update --init --recursive
```

Commit non-sensitive config plainly (`.env.example`, docs, agent instructions). Password-like values belong in `secrets/`, a password manager, or preferably the PeopleClaw broker/server vault. Real secrets must not be plaintext committed unless this workspace is intentionally local/private and you accept that risk.

## Vercel broker

The broker stores `VERCEL_TOKEN` on the server only. Customer agents receive scoped `pcv_...` tokens that are deny-by-default and allow only explicit Skin Spirit project/repo slugs.

```bash
pcv login --broker-url https://broker.example.com --token pcv_xxx.yyy
pcv whoami
pcv projects list
pcv deployments list --projectId skin-spirit
```

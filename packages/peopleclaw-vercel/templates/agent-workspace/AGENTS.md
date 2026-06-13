# Agent Workspace Instructions

- Treat this directory as the root workspace.
- Customer/application repos live under `repos/` as git submodules.
- Do not request or store raw Vercel tokens locally. Use `pcv` with the scoped broker token.
- Keep non-sensitive env defaults in committed `.env.example` files.
- Put local/private secret examples under `secrets/*.example`; keep real `secrets/*` uncommitted.
- For Skin Spirit work, only touch repos/projects explicitly listed by `pcv whoami`.

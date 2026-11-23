# Agent notes

This repository is a scaffold for running Nous Research Hermes Agent on
`shamiko`. It holds configuration templates, documentation, a TypeScript
validator, and CI. It does not install Hermes, run a gateway, or hold a real
credential.

## Layout

- `config/config.yaml` — the hardened `~/.hermes/config.yaml` template.
- `config/.env.example` — secret names, the owner allowlist, and forbidden
  switches.
- `src/validate.ts` — the validator. `tests/` holds its behaviour tests.
- `docs/` — the setup plan, architecture, threat model, secrets, runbooks, and
  decision log.
- `.agents/skills/` — agent skills. `.claude/skills/` mirrors each one with a
  relative symlink.
- `.github/workflows/` — CI, Dependabot auto-merge, and the zizmor config.

## Commands

Use `just`; do not call the tools directly.

```bash
just install
just fmt
just fmt-check
just lint
just typecheck
just test
just workflows
just secrets
just check
just hooks
just agent-files
```

## Invariants

- **The pilot is read-only.** `platform_toolsets` exposes only `web` and
  `todo`. `agent.disabled_toolsets` removes terminal, file, browser, code
  execution, computer use, cron, delegation, memory, session search, the
  search-only toolset, skills, images, video, voice, and third-party service
  toolsets everywhere.
- **Approvals fail closed.** `approvals.mode` is `manual`, the cron,
  single-query, and unattended modes are `deny`, and the approver list is the
  owner, never `["*"]`. The deny rules stay in place even under YOLO.
- **Execution is Docker-only.** No local backend, no network, no host mounts,
  no forwarded environment, no literal `docker_env`, no extra flags, no
  persistent container, and no `sudo_password`.
- **Network reach is public only.** `security.allow_private_urls` stays false.
  The pilot does not reach loopback, the LAN, the tailnet, or metadata.
- **Unknown senders get no agent turn.** `unauthorized_dm_behavior` is
  `decline`, and the global allow-all stays off.
- **State stays on the host.** Real secrets live in `~/.hermes/.env` and
  `~/.hermes/auth.json`, owned by the dedicated `hermes` user with mode `0600`.
  The repository keeps placeholders.
- **Mutation safety.** Do not run `hermes update`, `hermes gateway install`,
  `hermes gateway start`, or any command that writes to `~/.hermes` unless the
  task explicitly asks for it on the target machine. Do not change repository
  settings, rulesets, branch protection, or signing configuration.
- **Privacy.** No IP address, tailnet name, hostname beyond `shamiko`, username
  other than `deathpie` or `simpsonm09`, or secret enters the repository. Use
  placeholders such as `<TAILNET_NAME>`, `<MODEL_ID>`, and
  `<OWNER_PLATFORM_USER_ID>`.

## Never do

- Do not weaken a check in `src/validate.ts` to make a configuration pass.
  Change the configuration or record the decision first.
- Do not commit a deployed `.env`, `auth.json`, session database, or log.
- Do not add a plugin, MCP server, or skill from an unreviewed source.
- Do not push to `main`, force-push, or bypass the pull request gate.
- Do not add AI attribution or `Co-Authored-By` trailers to commits.
- Do not invent a Hermes key, command, or default. Check the upstream
  documentation, or mark the claim `UNVERIFIED` in the docs.

## Before proposing a change

```bash
just check
just agent-files
```

If the change widens or narrows a control, update `docs/threat-model.md` in the
same change. If it changes a decision, add a row to `docs/decisions.tsv`.

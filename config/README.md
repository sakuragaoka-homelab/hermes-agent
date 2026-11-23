# Configuration templates

| File           | Deploys to              | Purpose                                                           |
| -------------- | ----------------------- | ----------------------------------------------------------------- |
| `config.yaml`  | `~/.hermes/config.yaml` | Model, toolsets, approvals, network, sandbox, telemetry, updates. |
| `.env.example` | `~/.hermes/.env`        | Provider key name, owner allowlist, forbidden switches.           |

Both are templates. `config.yaml` keeps `<MODEL_ID>`, `<PROVIDER>`, and
`<OWNER_PLATFORM_USER_ID>`; `.env.example` keeps `<OWNER_GATEWAY_USER_ID>` and a
commented Telegram id. The validator fails if a placeholder is replaced with a
concrete value in Git.

## Deploy

```bash
install -d -m 0700 ~/.hermes
install -m 0600 config/config.yaml ~/.hermes/config.yaml
install -m 0600 config/.env.example ~/.hermes/.env
```

Then replace the placeholders in the deployed copy only. See
[`../docs/secrets.md`](../docs/secrets.md).

## Why these values

- **Model and provider are placeholders.** Phase 0 chooses them. Do not guess a
  provider for the owner.
- **Only `web` and `todo`.** The pilot answers public status questions without
  host access.
- **Global toolset disable.** `agent.disabled_toolsets` runs after the
  per-platform rows, so a later row cannot add terminal, file, browser, code,
  cron, memory, skills, or third-party tools back.
- **Manual approvals and deny rules.** Dangerous commands prompt the owner, and
  a fixed deny list blocks `sudo`, `docker`, `systemctl`, forced pushes, and
  disk formatting even under YOLO.
- **Public URLs only.** `security.allow_private_urls: false` keeps the web
  tools off loopback, the LAN, the tailnet, and metadata.
- **Docker-only execution.** The terminal toolset is off in the pilot. If it is
  widened, the backend is Docker with no network, no host mounts, no forwarded
  environment, no literal env, no volumes, no extra flags, no persistent
  container, and no plaintext sudo password.
- **Decline unknown DMs.** The global allow-all stays off, and the owner id is
  the only approver.
- **No shared telemetry, no borrowed logins.** Both are off.
- **A pre-update backup.** `quick` keeps critical state before `hermes update`.

## Validate

```bash
bun src/validate.ts
```

The validator checks the committed template. A deployed copy has real values and
is expected to fail the placeholder checks. Every rule maps to a row in
[`../docs/threat-model.md`](../docs/threat-model.md).

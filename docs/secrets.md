# Secrets

## Rule

No secret is committed to this repository. The configuration template keeps
placeholders, the environment example keeps names and placeholders, and the
validator rejects a real-looking value in a secret-shaped key.

## What lives where

| Secret                       | Lives in                                     | Never in               |
| ---------------------------- | -------------------------------------------- | ---------------------- |
| Model provider API key       | `~/.hermes/.env`                             | `config.yaml`, Git     |
| OAuth provider credentials   | `~/.hermes/auth.json`                        | `config.yaml`, Git     |
| Messaging bot token          | `~/.hermes/.env`                             | `config.yaml`, Git     |
| Owner platform ids           | `~/.hermes/.env`                             | Git, logs, screenshots |
| Relay or webhook secret      | `~/.hermes/.env`                             | Git                    |
| Session history and memories | `~/.hermes/sessions/`, `~/.hermes/memories/` | Git                    |

`hermes config set` writes an `UPPER_SNAKE` name to `.env`, not `config.yaml`.
Use it for a secret so the value never lands in the configuration file.

## Permissions

```bash
install -d -m 0700 ~/.hermes
install -m 0600 config/config.yaml ~/.hermes/config.yaml
install -m 0600 config/.env.example ~/.hermes/.env
chmod 0600 ~/.hermes/auth.json
```

The directory and its secret files belong to the dedicated `hermes` user. No
other unprivileged user needs access.

## Deployment

1. Copy `config/config.yaml` to `~/.hermes/config.yaml`.
2. Copy `config/.env.example` to `~/.hermes/.env`.
3. Replace `<OWNER_GATEWAY_USER_ID>` with the owner's numeric platform id.
4. Uncomment exactly one provider key and set it.
5. Leave every `*_ALLOW_ALL_USERS` flag unset.
6. Run `hermes doctor` as the `hermes` user.

Do not run the repository validator against the deployed copy. It is a template
linter: a deployed file has real values and is expected to fail the placeholder
checks.

## Rotation

1. Create the replacement key or token at the provider or platform.
2. Write it to `~/.hermes/.env` with mode `0600`.
3. Run `hermes doctor`.
4. Start a new session and confirm the tool works.
5. Revoke the old key or token.
6. If the old value may have leaked, inspect `~/.hermes/logs/` and the provider's
   usage history.

## Backups

`hermes backup` archives the Hermes home, which includes `.env` and
`auth.json`. Treat the archive as a secret: mode `0600`, encrypted at rest, and
stored off the host. The pre-update backup (`updates.pre_update_backup: quick`)
keeps critical state in `state-snapshots/`. `UNVERIFIED`: whether Hermes
encrypts either artifact itself.

## CI

`just secrets` runs gitleaks over the pull request diff. GitHub secret scanning
and push protection are on for the public repository. A real credential in a
commit is a rotation event, not a force-push cleanup.

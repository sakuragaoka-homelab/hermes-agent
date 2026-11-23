# Security policy

## Reporting a vulnerability

Report a suspected vulnerability privately through this repository's
[security advisory form](https://github.com/sakuragaoka-homelab/hermes-agent/security/advisories/new).
Do not open a public issue for a security report.

Include the affected file or workflow, the impact, and a minimal reproduction.
Do not include a real credential; use a placeholder.

## What this repository is

A scaffold for a self-hosted Hermes Agent. It holds configuration templates,
documentation, and a validator. It does not install Hermes, run a gateway, or
store a real credential.

## Checks that run

- `gitleaks` scans the pull request diff for credentials.
- `actionlint` and `zizmor` lint the workflows.
- Dependabot keeps action and package pins current; major updates are held for
  owner review.
- GitHub secret scanning and push protection are on for the public repository.
- CodeQL is left to GitHub's default setup; this repository has no CodeQL
  workflow of its own.

## Secrets

No secret is committed here. `config/config.yaml` keeps placeholders, and the
validator rejects a real value in a secret-shaped key. `config/.env.example`
contains names and placeholders only. The deployed `~/.hermes/.env` and
`~/.hermes/auth.json` live on the host, owned by the dedicated `hermes` user
with mode `0600`. See [`docs/secrets.md`](docs/secrets.md).

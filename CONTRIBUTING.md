# Contributing

This repository is a scaffold: configuration templates, documentation, and a
validator. It does not install Hermes Agent.

## Before you change anything

Read [`AGENTS.md`](AGENTS.md) and the core standard at
[`sakuragaoka-homelab/.github`](https://github.com/sakuragaoka-homelab/.github/blob/main/standards/core.md).
Run the checks once to confirm the toolchain:

```bash
mise install
just install
just check
just agent-files
```

## Branches and pull requests

- `main` is protected. Every change goes through a branch and a pull request.
- Branch names are `type/kebab-slug`, for example
  `feat/hermes-agent-scaffold`.
- Pull request titles use Conventional Commits: `type(scope)?: lowercase
imperative summary`, no trailing period.
- Squash merge only. The head branch is deleted on merge.
- Commits are signed. Do not add AI attribution or `Co-Authored-By` trailers.

## Scope

Keep changes inside the repository's purpose. A change that widens a control
must update `docs/threat-model.md` and, when it changes a decision, add a row to
`docs/decisions.tsv`. Do not commit secrets, IP addresses, tailnet names, or
machine-specific paths; use the placeholders in `config/` and the docs.

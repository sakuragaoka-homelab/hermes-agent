# hermes-agent

Hardened configuration, validation, and runbooks for a self-hosted
[Nous Research Hermes Agent](https://github.com/NousResearch/hermes-agent) on
the homelab server `shamiko`.

**Status: scaffold only.** Nothing here installs or runs Hermes. The repository
holds the plan, the hardened configuration templates, the validator, and the
runbooks. Installation starts in [Phase 1](docs/setup-plan.md).

Part of the [`sakuragaoka-homelab`](https://github.com/sakuragaoka-homelab)
fleet. Work happens on a branch with a pull request into `main`. Shared CI,
security, and branch rules live in the
[core standard](https://github.com/sakuragaoka-homelab/.github/blob/main/standards/core.md).

## Why this exists

Hermes is a personal agent with real tools: web access, files, a terminal,
browser automation, cron, and messaging. The risk is not the model. It is that
the agent runs unattended with access to the host and to the accounts it can
reach.

This repository makes the deployment deliberate. The first phase is a
read-only pilot: public web search and an in-memory task list, nothing else. The
terminal, file, browser, code execution, cron, memory, search-only, and
third-party service toolsets are disabled globally, so a per-platform row cannot
add them back. Execution, if it is ever widened, is Docker-only with no network,
no host mounts, no forwarded secrets, and no extra flags.

## Quick start

```bash
mise install        # just, bun, oxlint, actionlint, zizmor, shellcheck, gitleaks
just install        # bun install --frozen-lockfile
just check          # format, lint, types, tests, workflows, secrets, agent files
just agent-files    # skill and symlink check
```

`just check` runs the same recipes CI runs. On a branch it scans
`origin/main..HEAD` for secrets; set `GITLEAKS_LOG_OPTS` to scan another range.

## Commands

| Command            | What it does                                              |
| ------------------ | --------------------------------------------------------- |
| `just install`     | Install the locked Bun dependencies.                      |
| `just fmt`         | Format TypeScript, JSON, YAML, Markdown, and CSS.         |
| `just fmt-check`   | Fail when a file is not formatted.                        |
| `just lint`        | Lint TypeScript with oxlint and the hook with shellcheck. |
| `just typecheck`   | Type-check with Bun.                                      |
| `just test`        | Run the validator tests.                                  |
| `just workflows`   | Lint workflows with actionlint and zizmor.                |
| `just secrets`     | Scan a commit range with gitleaks.                        |
| `just check`       | Run everything CI requires.                               |
| `just hooks`       | Point Git at `.githooks/`.                                |
| `just agent-files` | Verify skills, symlinks, and named recipes.               |

## Layout

| Path                   | What it holds                                            |
| ---------------------- | -------------------------------------------------------- |
| `config/config.yaml`   | Hardened Hermes `~/.hermes/config.yaml` template.        |
| `config/.env.example`  | Secret names, owner allowlist, and forbidden switches.   |
| `src/validate.ts`      | The validator that enforces the hardening rules.         |
| `tests/`               | Behaviour tests for the validator.                       |
| `docs/setup-plan.md`   | The phased rollout.                                      |
| `docs/architecture.md` | Components, trust boundaries, and data flow.             |
| `docs/threat-model.md` | Assets, actors, and the control for each threat.         |
| `docs/secrets.md`      | Where secrets live and where they must not.              |
| `docs/runbooks/`       | Pilot, update, and incident procedures.                  |
| `docs/decisions.tsv`   | Decision log.                                            |
| `.agents/skills/`      | Agent skills; `.claude/skills/` mirrors them by symlink. |

## Validate the templates

```bash
bun src/validate.ts
```

The validator parses `config/config.yaml` and `config/.env.example`, then fails
on any weakened control: a concrete model in the template, a toolset outside
the pilot allowlist, an approval mode that does not prompt, a permissive
approver, a local terminal backend, Docker networking or host mounts, a
plaintext sudo password, a global allow-all, shared telemetry, or a disabled
pre-update backup. It also rejects a real-looking credential in a secret-shaped
key.

The validator checks the committed template, not a deployed copy. A deployed
copy has real model and owner values and is expected to fail the placeholder
checks.

## Privacy

The repository uses placeholders for secrets, owner ids, and network names. It
contains no IP addresses, tailnet names, or credentials. Machine names are
limited to `shamiko`. See [`docs/secrets.md`](docs/secrets.md).

## License

MIT. See [`LICENSE`](LICENSE).

---
name: verify
description: Validate the hardened Hermes Agent configuration template and the agent files before proposing a change.
---

# Verify

Use this skill when a change touches `config/`, `src/validate.ts`, the docs
that describe a control, or the agent instruction files.

## Commands

```bash
just install
just check
just agent-files
```

`just check` runs the format check, oxlint, Bun's type checker, the validator
tests, actionlint, zizmor, and a gitleaks scan of the branch diff.

## What the validator proves

`bun src/validate.ts` parses `config/config.yaml` and `config/.env.example` and
fails when a control is weakened. It covers:

- placeholder model, provider, and owner values in the template;
- the global toolset kill switch and the per-platform allowlist;
- manual approvals, closed headless modes, a named approver, and deny rules;
- public-URL-only web access and protected instruction files;
- a Docker-only execution backend with no network, mounts, forwarded secrets,
  extra flags, or plaintext sudo password;
- declined unknown DMs, no global allow-all, no external login adoption, no
  shared telemetry, and a pre-update backup.

## When a control changes

Update `docs/threat-model.md` in the same change. If the change widens a
control, record it in `docs/decisions.tsv` and move the phase in
`docs/setup-plan.md`. Do not edit the validator to accept a weaker value
without that record.

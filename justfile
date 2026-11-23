# Single entry point for humans, agents, and CI. `just --list` documents every
# recipe. See https://github.com/sakuragaoka-homelab/.github/blob/main/standards/core.md
set shell := ["bash", "-euo", "pipefail", "-c"]
set positional-arguments

mise := "mise exec --"

# List the recipes.
default:
    @just --list

# Install the locked dependencies.
install:
    bun install --frozen-lockfile

# Lefthook re-stages the fixes (`stage_fixed`).
# Format the given files, or the whole repository when none are given.
fmt *files:
    #!/usr/bin/env bash
    set -euo pipefail
    if (( $# )); then
        {{ mise }} bun fmt -- "$@"
    else
        {{ mise }} bun fmt
    fi

# Fail when a tracked file is not formatted.
fmt-check:
    {{ mise }} bun fmt --check

# Workflows and shell are linted too because `lint` is a CI context.
# Lint the given files, or the whole repository when none are given.
lint *files:
    #!/usr/bin/env bash
    set -euo pipefail
    if (( $# )); then
        {{ mise }} oxlint --deny-warnings -- "$@"
    else
        {{ mise }} oxlint --deny-warnings src tests scripts
    fi

# Type-check the project with Bun's checker.
typecheck:
    {{ mise }} bun check

# Run the validator tests.
test:
    {{ mise }} bun test

# actionlint and zizmor over the given workflows, or every workflow.
workflows *files:
    #!/usr/bin/env bash
    set -euo pipefail
    if (( $# )); then
        {{ mise }} actionlint -- "$@"
        {{ mise }} zizmor --quiet "$@"
    else
        {{ mise }} actionlint
        {{ mise }} zizmor .
    fi

# Staged secret scan; gitleaks never prints a finding value.
[private]
secrets-staged:
    {{ mise }} gitleaks git --staged --redact --no-banner

# Reject env files, private keys, kubeconfigs and files over 5 MB.
forbidden-files *files:
    #!/usr/bin/env bash
    set -euo pipefail
    {{ mise }} bun scripts/forbidden-files.ts "$@"

# shellcheck over the given scripts; nothing to do when none are given.
shellcheck *files:
    #!/usr/bin/env bash
    set -euo pipefail
    if (( $# )); then
        {{ mise }} shellcheck -- "$@"
    fi

# Advisory Conventional Commit check (C2.4); never fails the commit.
commit-msg file:
    {{ mise }} bun scripts/commit-msg.ts {{ quote(file) }}

# Conservative secret-shaped content scan; matched values are never printed.
privacy:
    {{ mise }} bun scripts/git-hook.ts privacy

# Effective author and committer emails are the owner's GitHub no-reply address.
privacy-identity:
    {{ mise }} bun scripts/git-hook.ts privacy-identity

# The exact staged blobs.
privacy-staged:
    {{ mise }} bun scripts/git-hook.ts privacy-staged

# Commits in BASE..REV, including messages and diffs.
privacy-range revision base:
    {{ mise }} bun scripts/git-hook.ts privacy-range {{ quote(revision) }} {{ quote(base) }}

# Every commit reachable from REV.
privacy-commits revision:
    {{ mise }} bun scripts/git-hook.ts privacy-commits {{ quote(revision) }}

whitespace:
    {{ mise }} bun scripts/git-hook.ts whitespace

whitespace-staged:
    {{ mise }} bun scripts/git-hook.ts whitespace-staged

# gitleaks over the pushed range or pull-request diff; values are never printed.
gitleaks range="":
    {{ mise }} bun scripts/git-hook.ts gitleaks {{ quote(range) }}

# Scan the pull request diff for secrets.
secrets:
    {{ mise }} gitleaks git --no-banner --redact --log-opts="${GITLEAKS_LOG_OPTS:-origin/main..HEAD}"

# Everything CI requires.
check: install fmt-check lint typecheck test workflows secrets agent-files

# Refuses a global or foreign core.hooksPath; migrates only `.githooks`.
# Enable the shared Lefthook hooks without changing global Git settings.
hooks:
    #!/usr/bin/env bash
    set -euo pipefail

    if ! {{ mise }} lefthook version >/dev/null 2>&1; then
        printf 'lefthook is not installed; run `mise install` first.\n' >&2
        exit 1
    fi

    global=$(git config --global --get core.hooksPath || true)
    if [[ -n "$global" ]]; then
        printf 'A global core.hooksPath is set (%s); lefthook install refuses it.\n' "$global" >&2
        printf 'Remove it yourself, or use `lefthook install --force` only if you really mean it.\n' >&2
        exit 1
    fi

    existing=$(git config --get core.hooksPath || true)
    case "$existing" in
        ""|.githooks) ;;
        *)
            printf 'core.hooksPath is %s; integrate it manually.\n' "$existing" >&2
            exit 1
            ;;
    esac

    if [[ "$existing" == ".githooks" ]]; then
        git config --unset-all --local core.hooksPath
    fi

    {{ mise }} lefthook install
    # A failed remote sync only warns in 2.2.2 and still exits 0, so assert the
    # shared jobs loaded before declaring success. `dump` loads and merges the
    # same config that `validate` checks in CI.
    dump=$({{ mise }} lefthook dump)
    if ! grep -q 'name: core-' <<<"$dump" || ! grep -q 'name: owner-' <<<"$dump"; then
        printf 'The shared hook config did not load; check access to the .github repository.\n' >&2
        exit 1
    fi
    hookdir=$(git rev-parse --path-format=absolute --git-path hooks)
    if [[ ! -x "$hookdir/pre-commit" || ! -x "$hookdir/pre-push" ]]; then
        printf 'Lefthook did not write the pre-commit and pre-push shims.\n' >&2
        exit 1
    fi
    printf 'Shared Lefthook hooks installed; no global settings changed.\n'

[private]
hook-pre-commit:
    {{ mise }} bun scripts/git-hook.ts pre-commit

[private]
hook-pre-push:
    {{ mise }} bun scripts/git-hook.ts pre-push

# Fast subset for pre-push (C7.10): type check and the validator tests, under 30 s.
pre-push-check:
    {{ mise }} bun check
    {{ mise }} bun test

# Refresh locked dependencies when a manifest changed (post-checkout, post-merge).
deps-refresh:
    {{ mise }} bun scripts/deps-refresh.ts mise.toml bun.lock

# Verify the agent skills and their Claude Code symlinks.
agent-files:
    {{ mise }} bun scripts/agent-files.ts

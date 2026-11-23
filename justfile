# Single entry point for humans, agents, and CI. `just --list` documents every
# recipe. See https://github.com/sakuragaoka-homelab/.github/blob/main/standards/core.md
set shell := ["bash", "-euo", "pipefail", "-c"]

# List the recipes.
default:
    @just --list

# Install the locked dependencies.
install:
    bun install --frozen-lockfile

# Format JavaScript, TypeScript, JSON, YAML, Markdown, and CSS.
fmt:
    bun fmt

# Fail when a tracked file is not formatted.
fmt-check:
    bun fmt --check

# Lint TypeScript with oxlint and the shell hook with shellcheck.
lint:
    oxlint --deny-warnings src tests scripts
    shellcheck .githooks/pre-push

# Type-check the project with Bun's checker.
typecheck:
    bun check

# Run the validator tests.
test:
    bun test

# Lint the workflows with actionlint and zizmor.
workflows:
    actionlint
    zizmor .

# Scan the pull request diff for secrets.
secrets:
    gitleaks git --no-banner --redact --log-opts="${GITLEAKS_LOG_OPTS:-origin/main..HEAD}"

# Everything CI requires.
check: install fmt-check lint typecheck test workflows secrets agent-files

# Install the repository git hooks.
hooks:
    git config --local core.hooksPath .githooks

# Verify the agent skills and their Claude Code symlinks.
agent-files:
    bun scripts/agent-files.ts

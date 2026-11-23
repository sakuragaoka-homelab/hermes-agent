# Setup plan

The phased rollout for Hermes Agent on `shamiko`. Each phase ends in a
verifiable state. Do not start the next phase until the current one is checked.

This repository stops at Phase 0. Phases 1 onward touch the machine and run only
when asked.

## Phase 0 — Decide, no install

Nothing on `shamiko` changes in this phase.

- Choose the provider and model. Fill `<PROVIDER>` and `<MODEL_ID>` in a local
  copy only; the repository keeps the placeholders.
- Choose a monthly budget and confirm how the provider reports usage. Hermes has
  `agent.max_turns`, but a hard spend cap is `UNVERIFIED`.
- Record the owner's numeric platform user id and, for Phase 2, the Telegram
  user id. Do not use a `@username`.
- Confirm the dedicated unprivileged user name. The plan assumes `hermes`.
- Confirm `~` is on ext4, so `database.journal_mode: wal` is crash-safe.
- Confirm the backup destination and that it is encrypted at rest.
- Read and accept [`threat-model.md`](threat-model.md).

**Acceptance:** the decisions are recorded in a local note or in
[`decisions.tsv`](decisions.tsv), and no secret is in Git.

**Rollback:** none needed; nothing changed.

## Phase 1 — Read-only pilot on shamiko

The pilot is CLI-only. No gateway, no messaging platform, no Docker execution.

1. Create the user without sudo and without the Docker group:

   ```bash
   sudo adduser --disabled-password --gecos "" hermes
   sudo -iu hermes
   ```

2. Install Hermes as that user:

   ```bash
   curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
   ```

   `UNVERIFIED`: whether the installer needs sudo or writes outside the user's
   home. If it asks for sudo, stop and record what it needs before continuing.

3. Choose the provider and model:

   ```bash
   hermes setup
   ```

   `UNVERIFIED`: whether `hermes setup --non-interactive` can complete a
   provider choice without prompts. Prefer the interactive wizard for the first
   install.

4. Deploy the templates with the permissions in
   [`secrets.md`](secrets.md). Replace the placeholders in the deployed copy
   only.

5. Run the health gate:

   ```bash
   hermes doctor
   ```

   `UNVERIFIED`: whether `hermes doctor` checks Docker reachability. Docker is
   not part of this phase, so a Docker warning is expected and acceptable.

6. Confirm the tool surface:

   ```bash
   hermes tools --summary
   hermes config get agent.disabled_toolsets
   ```

   `--summary` prints the enabled-tools summary, so expect only `web` and
   `todo` on the CLI row. The second command confirms the global disable.

7. Start a session and ask for a public health summary:

   ```bash
   hermes chat
   ```

   Ask it to search the public web and summarize a public status page. Then ask
   it to run `id`. The second request must fail: the terminal toolset is
   disabled.

8. Stop the session and review `~/.hermes/logs/` for errors or unexpected tool
   calls.

**Acceptance:** the model answers with public web content, no terminal, file,
browser, code, cron, memory, or skill tool is available, and no private address
is reachable. The owner confirms the summary is useful enough to continue.

**Rollback:** exit the session. If the pilot is abandoned, remove the user and
its home only when the owner asks; `sudo deluser --remove-home hermes`.

## Phase 2 — One messaging platform

Start with Telegram and one owner. Do not add a second platform until this one
is stable for a week.

1. Create the bot and get its token from `@BotFather`.
2. Put `TELEGRAM_BOT_TOKEN` and the owner's numeric `TELEGRAM_ALLOWED_USERS` in
   `~/.hermes/.env`.
3. Configure the platform:

   ```bash
   hermes gateway setup
   ```

   Choose Telegram, leave the allowlist to the owner, and choose the polite
   decline for unknown senders.

4. Install and start the service:

   ```bash
   hermes gateway install
   hermes gateway start
   hermes gateway status
   ```

   `UNVERIFIED`: whether `hermes gateway install` creates a user unit or a
   system unit, and the exact unit name. The upstream docs refer to
   `hermes-gateway.service`; confirm on the host.

5. Message the bot from the owner account. Ask for a public summary.
6. Message from a second account. Expect one polite decline and no agent turn.
7. Confirm the approval settings are intact:

   ```bash
   hermes config get approvals.mode
   hermes config get approvals.approvers
   ```

   Expect `manual` and the owner's id. No dangerous command can run in this
   phase because the terminal toolset is still disabled.

**Acceptance:** only the owner reaches the agent, unknown senders are declined,
the approval settings are intact, and the gateway restarts cleanly.

**Rollback:** `hermes gateway stop`, then `hermes gateway uninstall`. Remove the
bot token from `.env` and revoke it at `@BotFather`.

## Phase 3 — Widen execution, only if needed

The pilot does not need execution. Do not start this phase for convenience.

1. Pin the sandbox image by digest instead of the `:desktop` tag.
2. Update [`threat-model.md`](threat-model.md), [`decisions.tsv`](decisions.tsv),
   and `src/validate.ts` in the same change. The validator intentionally fails
   while `terminal` is enabled, so the widening must be explicit.
3. Remove `terminal` from `agent.disabled_toolsets` and add it to the CLI row
   only. Keep it off every messaging platform.
4. Confirm the sandbox has no network, no host mount, no forwarded secret, no
   extra flag, and a fresh container per process.
5. Run a read-only command such as `pwd` and confirm it runs in `/workspace`.
6. Confirm `curl` fails inside the container because the network is disabled.

**Acceptance:** execution works only in the Docker container, the host is not
mounted, the network is off, and the deny rules still block `sudo`, `docker`,
`systemctl`, and forced pushes.

**Rollback:** add `terminal` back to `agent.disabled_toolsets` and remove it
from the CLI row. Restart the session.

## Phase 4 — Operations

- Weekly: `hermes update --check`, then review the changelog.
- Monthly: `hermes backup`, then `hermes update`, then `hermes doctor`.
- After every update: confirm the tool surface and the allowlist.
- Review `~/.hermes/logs/` and the provider usage report monthly.
- Rotate the provider key and the bot token on a schedule and after any
  suspected exposure.

**Acceptance:** the update completes, the pre-update backup exists, `hermes
doctor` exits 0, and the tool surface is unchanged.

**Rollback:** restore the `hermes backup` archive with `hermes import`, or the
pre-update snapshot if the host can restore it. See
[`runbooks/update.md`](runbooks/update.md).

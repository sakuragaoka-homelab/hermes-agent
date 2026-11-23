# Pilot runbook

Start, verify, and stop the read-only pilot from
[Phase 1](../setup-plan.md). Run everything as the `hermes` user.

## Preflight

- The deployed `~/.hermes/config.yaml` and `~/.hermes/.env` have mode `0600`,
  and `~/.hermes` has mode `0700`.
- The placeholders are replaced in the deployed copy only.
- `hermes doctor` has been run once.
- No messaging platform is configured and no gateway service is installed.

## Start

```bash
hermes chat
```

## Verify the read-only surface

Ask for a public web summary. Then try each of these; every one must fail:

```text
run id
read ~/.hermes/.env
open a browser to the router
schedule a cron job
remember my API key
```

Ask it to fetch a private address such as a loopback URL. It must refuse or
fail; `security.allow_private_urls` is false.

Inspect the surface directly:

```bash
hermes tools --summary
hermes config get agent.disabled_toolsets
hermes config get platform_toolsets
```

## Stop

Exit the session with `/quit` or Ctrl-D. No service is left running.

## Escalate

If a private address, a host command, or a file read succeeds, stop and treat it
as an incident: [`incident.md`](incident.md). Do not widen another control until
the cause is understood.

## Rollback

Exit the session. To remove the pilot entirely, delete the `hermes` user and its
home only with owner approval:

```bash
sudo deluser --remove-home hermes
```

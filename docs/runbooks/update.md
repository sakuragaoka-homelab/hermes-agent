# Update runbook

Use this for a Hermes Agent update on `shamiko`. Run it as the `hermes` user.
Do not update while an incident is open.

## Before

```bash
hermes update --check
hermes backup -o ~/hermes-backup-before-update.zip
chmod 600 ~/hermes-backup-before-update.zip
hermes doctor
```

Record the current version and the `hermes doctor` output. Confirm the backup
file exists and has mode `0600`.

## Update

```bash
hermes update
```

If the gateway is installed:

```bash
hermes gateway restart
hermes gateway status
```

`UNVERIFIED`: whether `hermes update` restarts a running gateway by itself. The
docs describe a restart-phase recovery for supervised profiles; confirm the
state on the host rather than assuming.

## After

```bash
hermes doctor
hermes tools --summary
hermes config get agent.disabled_toolsets
hermes config get platform_toolsets
```

Start one session and ask for a public summary. Confirm the tool surface is
unchanged. If the update rewrote `config.yaml`, diff it against the template and
restore the hardening values.

## Rollback

Stop the gateway first if it is installed:

```bash
hermes gateway stop
```

Restore the backup:

```bash
hermes import ~/hermes-backup-before-update.zip
```

Then run `hermes doctor` and confirm the tool surface. `hermes import` overwrites
files in the Hermes home; read its confirmation prompt before continuing.

`UNVERIFIED`: whether a quick `state-snapshots/` entry can be restored directly
with `hermes import`. Prefer the full `hermes backup` archive for a rollback.

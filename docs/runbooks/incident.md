# Incident runbook

Use this when the agent may have reached something it should not have: a host
command, a file outside `~/.hermes`, a private address, an unknown sender, or a
leaked credential.

## 1. Contain

```bash
hermes gateway stop
```

Exit any open `hermes chat` session. If the gateway is not installed, this is a
no-op. Do not delete logs or the state directory.

## 2. Revoke access

- Revoke the provider API key at the provider and create a replacement.
- Revoke the messaging bot token at the platform and create a replacement.
- Remove unknown paired users:

  ```bash
  hermes pairing list
  hermes pairing revoke <platform> <user-id>
  hermes pairing clear-pending
  ```

- If a relay or webhook secret exists, revoke it at the source.

## 3. Inspect

- `~/.hermes/logs/` for the affected period.
- `~/.hermes/sessions/` for the prompts and tool calls.
- `~/.hermes/config.yaml` for a changed toolset, approval, or network setting.
- The provider's usage report for unexpected spend.

Compare the deployed configuration with `config/config.yaml` from this
repository. Any difference is a finding.

## 4. Recover

- Replace the secrets in `~/.hermes/.env` with mode `0600`.
- Restore the known-good configuration from the template, with the real values.
- If the state may be corrupted, restore a backup:

  ```bash
  hermes import <backup.zip>
  ```

- Run `hermes doctor` and confirm the tool surface with `hermes tools --summary`.

## 5. Re-enable

Start with the read-only pilot only. Do not restart the gateway or widen a tool
until the cause is understood and recorded in
[`../decisions.tsv`](../decisions.tsv). Add a note to
[`../threat-model.md`](../threat-model.md) if the incident exposes a missing
control.

## 6. Record

Write down the timeline, the affected credentials, the commands run, and the
control that failed. A credential in Git is a rotation event: revoke it, do not
just rewrite history.

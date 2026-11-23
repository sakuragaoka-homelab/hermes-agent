## What changed

Describe the change and why it is needed.

## Verification

State how you proved the change: the command you ran and its output. For a
configuration change, name the validator check that covers it.

```bash
just check
just agent-files
```

## Related context

Link the issue, the phase in `docs/setup-plan.md`, and any decision row in
`docs/decisions.tsv`. Note whether the change widens a control.

## Checklist

- [ ] `just check` passes.
- [ ] `just agent-files` passes.
- [ ] A control change updates `docs/threat-model.md`.
- [ ] No secret, IP address, tailnet name, or machine-specific path is included.
- [ ] Commits are signed.

# Documentation

Index for this repository.

## Guides

- [Architecture](architecture.md) — components, trust boundaries, and data flow.
- [Threat model](threat-model.md) — assets, actors, and the control for each threat.
- [Secrets](secrets.md) — where secrets live, permissions, rotation, backups.
- [Setup plan](setup-plan.md) — the phased rollout.
- [Decisions](decisions.tsv) — the decision log.

## Runbooks

- [Pilot](runbooks/pilot.md) — start, verify, and stop the read-only pilot.
- [Update](runbooks/update.md) — back up, update, verify, roll back.
- [Incident](runbooks/incident.md) — contain, revoke, inspect, recover.

## Templates

- [`config/config.yaml`](../config/config.yaml) — Hermes configuration template.
- [`config/.env.example`](../config/.env.example) — secret names and the owner allowlist.

## Unverified claims

Facts that were not confirmed against upstream documentation are marked
`UNVERIFIED` in the page that uses them. They are listed together in
[`threat-model.md`](threat-model.md#unverified) and
[`setup-plan.md`](setup-plan.md).

# Threat model

## Assets

| Asset                   | Why it matters                                                                  |
| ----------------------- | ------------------------------------------------------------------------------- |
| The host `shamiko`      | A shell on the host reaches every service and file the `hermes` user can reach. |
| `~/.hermes/`            | `config.yaml`, `.env`, `auth.json`, sessions, logs, and skills.                 |
| Provider credentials    | A leaked key bills the owner and can reach other data at the provider.          |
| Messaging identity      | The bot speaks as the owner in the platforms it joins.                          |
| Conversation history    | Prompts and tool output contain private context.                                |
| The rest of the homelab | The agent must not become a pivot into the LAN or tailnet.                      |

## Actors

- **Owner** — trusted. Chooses the model, allowlist, and tools.
- **Unknown sender** — untrusted. May reach a messaging platform.
- **Web content** — untrusted. A route for prompt injection.
- **Model provider** — semi-trusted. Receives prompts and returns tool calls.
- **Compromised dependency, plugin, skill, or MCP server** — untrusted code.
- **Local unprivileged user** — can read only what file permissions allow.

## Threats and controls

| Threat                                                       | Control                                                                                | Config key                                                                                          | Validator check                                                                                                                                                           |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A web page injects a command                                 | The pilot has no terminal, file, browser, code, or delegation tool.                    | `agent.disabled_toolsets`, `platform_toolsets`                                                      | `agent.disabled_toolsets`, `platform_toolsets.*`                                                                                                                          |
| The agent runs a host command                                | Terminal is disabled globally; if widened, only Docker is allowed.                     | `terminal.backend`                                                                                  | `terminal.backend`                                                                                                                                                        |
| A Docker flag or mount escapes the sandbox                   | No extra flags, volumes, forwarded env, literal env, network, or persistent container. | `terminal.docker_*`                                                                                 | `terminal.docker_extra_args`, `terminal.docker_volumes`, `terminal.docker_forward_env`, `terminal.docker_env`, `terminal.docker_network`, `terminal.container_persistent` |
| A plaintext sudo password leaks                              | The key is never set.                                                                  | `terminal.sudo_password`                                                                            | `terminal.sudo_password`                                                                                                                                                  |
| A dangerous command runs unattended                          | Manual approvals; headless modes deny.                                                 | `approvals.mode`, `approvals.cron_mode`, `approvals.single_query_mode`, `approvals.unattended_mode` | the same keys                                                                                                                                                             |
| A non-owner answers an approval                              | The approver list is the owner, never `["*"]`.                                         | `approvals.approvers`                                                                               | `approvals.approvers`                                                                                                                                                     |
| A known-bad command runs under YOLO                          | Unconditional deny rules.                                                              | `approvals.deny`                                                                                    | `approvals.deny`                                                                                                                                                          |
| The agent rewrites its own instructions                      | Protected instruction files stay on.                                                   | `security.protected_instruction_files`                                                              | `security.protected_instruction_files`                                                                                                                                    |
| The agent probes loopback, the LAN, the tailnet, or metadata | Private URLs are blocked.                                                              | `security.allow_private_urls`                                                                       | `security.allow_private_urls`                                                                                                                                             |
| An unknown sender triggers the agent                         | Unknown DMs are declined; the global allow-all stays off.                              | `unauthorized_dm_behavior`, `gateway.allow_all_users`                                               | the same keys                                                                                                                                                             |
| A wildcard allowlist admits everyone                         | The env template has one owner placeholder and no `*`.                                 | `GATEWAY_ALLOWED_USERS`                                                                             | `env.GATEWAY_ALLOWED_USERS`                                                                                                                                               |
| A real credential is committed                               | Placeholders in the template; a secret-shaped key must stay empty.                     | `config.yaml`, `.env.example`                                                                       | `checkSecrets`, `checkEnvTemplate`                                                                                                                                        |
| A secret is shared with the provider's telemetry             | Shared metrics are off.                                                                | `telemetry.shared_metrics.*`                                                                        | `telemetry.shared_metrics.enabled`, `telemetry.shared_metrics.send`                                                                                                       |
| Hermes borrows a Codex or Claude Code login                  | External login adoption is off.                                                        | `auth.adopt_external_logins`                                                                        | `auth.adopt_external_logins`                                                                                                                                              |
| A third-party tool arrives unreviewed                        | No MCP server and no enabled plugin.                                                   | `mcp_servers`, `plugins.enabled`                                                                    | `mcp_servers`, `plugins.enabled`                                                                                                                                          |
| A run costs without bound                                    | A small turn budget and container limits.                                              | `agent.max_turns`, `terminal.container_*`                                                           | the same keys                                                                                                                                                             |
| An update breaks the state                                   | A pre-update backup is kept.                                                           | `updates.pre_update_backup`                                                                         | `updates.pre_update_backup`                                                                                                                                               |
| A supply-chain change lands unreviewed                       | Dependabot, pinned actions, gitleaks, actionlint, zizmor.                              | `.github/`                                                                                          | CI                                                                                                                                                                        |

## Accepted risks

- **The provider sees prompts.** A hosted model receives the prompt and tool
  results. That is the trade for a reliable model.
- **Web content is untrusted.** The pilot cannot execute it, but it can still
  mislead a summary. Treat a health summary as a draft, not a fact.
- **The Docker image is tag-pinned, not digest-pinned.** The template uses the
  documented `nousresearch/hermes-sandbox:desktop` tag. A moved tag changes the
  sandbox contents. Pin a digest before widening execution.
- **The agent process itself is not network-isolated.** Only the Docker
  execution container is air-gapped. The Hermes process reaches the provider
  and public web. OS-level egress filtering is a host concern.
- **A local root user can read `~/.hermes/`.** File permissions protect against
  other unprivileged users, not root.
- **Platform metadata is visible to the platform.** A messaging platform sees
  the bot token, the owner id, and message timing.

## Out of scope

- Hardening the Ubuntu host. That belongs in
  [`shamiko-ubuntu-server`](https://github.com/sakuragaoka-homelab/shamiko-ubuntu-server).
- Multi-user or multi-tenant operation.
- A model safety evaluation. This repository constrains tools, not model
  judgment.

## Unverified

These claims were not confirmed against upstream documentation and are marked
`UNVERIFIED` rather than assumed:

- Whether Hermes enforces a hard spend cap or request budget beyond
  `agent.max_turns`. `UNVERIFIED`
- Whether `web_extract` blocks a redirect from a public URL to a private
  address when `security.allow_private_urls` is false. `UNVERIFIED`
- Whether the `nousresearch/hermes-sandbox:desktop` tag is mutable or resolves
  to a fixed digest. `UNVERIFIED`
- Whether `terminal.container_disk` is enforced on ext4, where the documented
  overlay2 plus XFS pquota requirement is absent. `UNVERIFIED`
- Whether the Phase 2 gateway opens any inbound port on the host, or only
  outbound connections to the platform. `UNVERIFIED`

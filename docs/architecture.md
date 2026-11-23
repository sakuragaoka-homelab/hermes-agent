# Architecture

## Components

| Component                    | Role                                                        | Trust                                                 |
| ---------------------------- | ----------------------------------------------------------- | ----------------------------------------------------- |
| `hermes` CLI                 | Interactive and one-shot client run by the owner.           | Operator-controlled.                                  |
| Hermes gateway               | Long-running service for messaging platforms.               | Operator-controlled; reachable through platform APIs. |
| Agent session                | Model loop that proposes tool calls.                        | Model output is untrusted.                            |
| State directory `~/.hermes/` | `config.yaml`, `.env`, `auth.json`, sessions, logs, skills. | Secret-bearing.                                       |
| Model provider               | Hosted API that receives prompts.                           | Semi-trusted.                                         |
| Web tools                    | Public search and page extraction.                          | Fetched content is untrusted.                         |
| Docker sandbox               | Execution container for terminal, file, and code tools.     | Blast-radius limit, not a security boundary.          |

The read-only pilot uses the CLI only. It does not install the gateway, connect
a messaging platform, or enable the sandbox.

## Trust boundaries

```text
owner
  │  trusted input
  ▼
hermes CLI ──────────────► model provider
  │                              │
  │ tool calls (untrusted)       │ untrusted output
  ▼                              ▼
policy gate ── allowed ──► web tools ──► public web
  │
  └── denied ──► tool error

~/.hermes/  (config, .env, auth.json, sessions, logs)
  ▲
  └── owned by the dedicated hermes user, mode 0700/0600
```

1. **Operator input is trusted.** The owner chooses the model, the allowlist,
   and the tools.
2. **Model output is untrusted.** A tool call is a proposal; the policy gate
   decides whether it runs.
3. **Web content is untrusted.** A fetched page can contain prompt injection.
   The pilot has no terminal or file tool to escalate into.
4. **The host is the trust anchor.** The agent process and its state live on
   `shamiko`.
5. **The sandbox is a blast-radius limit.** Docker isolates the execution
   container, but it is not a hard security boundary. A separate OS user or
   machine is the real boundary.

## Data flow for one turn

1. The owner starts `hermes` as the `hermes` user.
2. Hermes reads `~/.hermes/config.yaml` and `~/.hermes/.env`.
3. The session sends the prompt and the enabled tool schemas to the model
   provider.
4. The model returns text or a tool call.
5. Hermes checks the toolset allowlist and the approval policy.
6. An allowed tool runs. In the pilot that means `web_search`, `web_extract`,
   or the in-memory `todo` tool.
7. The result returns to the model, then to the owner.

## Deployment shape

- **Phase 1:** CLI-only on `shamiko`, as the unprivileged `hermes` user, with
  `~/.hermes` mode `0700` and its secret files mode `0600`. No listening port,
  no Docker socket, no host mount.
- **Phase 2:** the gateway runs as a systemd service for one messaging
  platform. The platform allowlist admits the owner only.
- **Phase 3, only if needed:** execution widens to the Docker backend. The
  container has no network, no host mounts, no forwarded secrets, and no extra
  flags.

## What is not here

- No model selection. Phase 0 chooses the provider and model; the template
  keeps `<PROVIDER>` and `<MODEL_ID>`.
- No messaging credentials. Phase 2 adds the bot token and the owner id.
- No deployment automation. The setup plan is run by hand so each step is
  visible.

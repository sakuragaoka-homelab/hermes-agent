import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  checkControls,
  checkEnvTemplate,
  checkSecrets,
  DEFAULT_CONFIG,
  DEFAULT_ENV,
  isRecord,
  loadConfig,
  validate,
  type Violation,
} from "../src/validate.ts";

const baseConfig = loadConfig(DEFAULT_CONFIG);
const baseEnv = readFileSync(DEFAULT_ENV, "utf8");

type Config = Record<string, unknown>;

function cloneConfig(): Config {
  return structuredClone(baseConfig);
}

function setPath(config: Config, dotted: string, value: unknown): void {
  const parts = dotted.split(".");
  let node: Config = config;
  for (const part of parts.slice(0, -1)) {
    const next = node[part];
    if (!isRecord(next)) throw new Error(`missing mapping at ${part}`);
    node = next;
  }
  node[parts.at(-1) as string] = value;
}

function deletePath(config: Config, dotted: string): void {
  const parts = dotted.split(".");
  let node: Config = config;
  for (const part of parts.slice(0, -1)) {
    const next = node[part];
    if (!isRecord(next)) throw new Error(`missing mapping at ${part}`);
    node = next;
  }
  delete node[parts.at(-1) as string];
}

function keys(violations: Violation[]): string[] {
  return violations.map((violation) => violation.key);
}

describe("the committed template", () => {
  test("passes every control and secret check", () => {
    expect(validate(baseConfig, baseEnv)).toEqual([]);
  });
});

describe("approval controls", () => {
  test("rejects mode off", () => {
    const config = cloneConfig();
    setPath(config, "approvals.mode", "off");
    expect(keys(checkControls(config))).toContain("approvals.mode");
  });

  test("rejects a wildcard approver", () => {
    const config = cloneConfig();
    setPath(config, "approvals.approvers", ["*"]);
    expect(keys(checkControls(config))).toContain("approvals.approvers");
  });

  test("rejects a missing deny rule", () => {
    const config = cloneConfig();
    const deny = (config.approvals as Config).deny as string[];
    setPath(
      config,
      "approvals.deny",
      deny.filter((pattern) => pattern !== "sudo *"),
    );
    expect(keys(checkControls(config))).toContain("approvals.deny");
  });

  test("rejects a permissive headless mode", () => {
    const config = cloneConfig();
    setPath(config, "approvals.cron_mode", "approve");
    expect(keys(checkControls(config))).toContain("approvals.cron_mode");
  });
});

describe("tool controls", () => {
  test("rejects a toolset outside the pilot allowlist", () => {
    const config = cloneConfig();
    setPath(config, "platform_toolsets.cli", ["web", "terminal"]);
    expect(keys(checkControls(config))).toContain("platform_toolsets.cli");
  });

  test("rejects a missing global disable", () => {
    const config = cloneConfig();
    const disabled = (config.agent as Config).disabled_toolsets as string[];
    setPath(
      config,
      "agent.disabled_toolsets",
      disabled.filter((toolset) => toolset !== "terminal"),
    );
    expect(keys(checkControls(config))).toContain("agent.disabled_toolsets");
  });

  test("rejects the deprecated top-level toolsets key", () => {
    const config = cloneConfig();
    config.toolsets = ["web"];
    expect(keys(checkControls(config))).toContain("toolsets");
  });

  test("rejects a non-empty MCP server mapping", () => {
    const config = cloneConfig();
    config.mcp_servers = { time: { command: "uvx" } };
    expect(keys(checkControls(config))).toContain("mcp_servers");
  });

  test("rejects a turn budget above the pilot limit", () => {
    const config = cloneConfig();
    setPath(config, "agent.max_turns", 500);
    expect(keys(checkControls(config))).toContain("agent.max_turns");
  });
});

describe("execution sandbox", () => {
  test("rejects the local backend", () => {
    const config = cloneConfig();
    setPath(config, "terminal.backend", "local");
    expect(keys(checkControls(config))).toContain("terminal.backend");
  });

  test("rejects container networking", () => {
    const config = cloneConfig();
    setPath(config, "terminal.docker_network", true);
    expect(keys(checkControls(config))).toContain("terminal.docker_network");
  });

  test("rejects host mounts", () => {
    const config = cloneConfig();
    setPath(config, "terminal.docker_mount_cwd_to_workspace", true);
    expect(keys(checkControls(config))).toContain(
      "terminal.docker_mount_cwd_to_workspace",
    );
  });

  test("rejects forwarded environment variables", () => {
    const config = cloneConfig();
    setPath(config, "terminal.docker_forward_env", ["GITHUB_TOKEN"]);
    expect(keys(checkControls(config))).toContain(
      "terminal.docker_forward_env",
    );
  });

  test("rejects extra docker flags", () => {
    const config = cloneConfig();
    setPath(config, "terminal.docker_extra_args", ["--cap-add", "SETUID"]);
    expect(keys(checkControls(config))).toContain("terminal.docker_extra_args");
  });

  test("rejects a plaintext sudo password", () => {
    const config = cloneConfig();
    setPath(config, "terminal.sudo_password", "hunter2");
    expect(keys(checkControls(config))).toContain("terminal.sudo_password");
  });

  test("rejects a persistent container", () => {
    const config = cloneConfig();
    setPath(config, "terminal.container_persistent", true);
    expect(keys(checkControls(config))).toContain(
      "terminal.container_persistent",
    );
  });
});

describe("network and privacy controls", () => {
  test("rejects private URL access", () => {
    const config = cloneConfig();
    setPath(config, "security.allow_private_urls", true);
    expect(keys(checkControls(config))).toContain(
      "security.allow_private_urls",
    );
  });

  test("rejects the global allow-all switch", () => {
    const config = cloneConfig();
    setPath(config, "gateway.allow_all_users", true);
    expect(keys(checkControls(config))).toContain("gateway.allow_all_users");
  });

  test("rejects pairing codes for unknown senders", () => {
    const config = cloneConfig();
    config.unauthorized_dm_behavior = "pair";
    expect(keys(checkControls(config))).toContain("unauthorized_dm_behavior");
  });

  test("rejects shared telemetry", () => {
    const config = cloneConfig();
    setPath(config, "telemetry.shared_metrics.send", true);
    expect(keys(checkControls(config))).toContain(
      "telemetry.shared_metrics.send",
    );
  });
});

describe("secret handling", () => {
  test("rejects a credential in config.yaml", () => {
    const config = cloneConfig();
    setPath(config, "model.api_key", "not-a-real-key");
    expect(keys(checkSecrets(config))).toContain("model.api_key");
  });

  test("allows a placeholder credential", () => {
    const config = cloneConfig();
    setPath(config, "model.api_key", "<OPENROUTER_API_KEY>");
    expect(checkSecrets(config)).toEqual([]);
  });

  test("rejects a global allow-all in .env.example", () => {
    const env = `${baseEnv}\nGATEWAY_ALLOW_ALL_USERS=true\n`;
    expect(keys(checkEnvTemplate(env))).toContain(
      "env.GATEWAY_ALLOW_ALL_USERS",
    );
  });

  test("rejects a wildcard allowlist in .env.example", () => {
    const env = baseEnv.replace(
      "GATEWAY_ALLOWED_USERS=<OWNER_GATEWAY_USER_ID>",
      "GATEWAY_ALLOWED_USERS=*",
    );
    expect(keys(checkEnvTemplate(env))).toContain("env.GATEWAY_ALLOWED_USERS");
  });

  test("rejects a filled-in bot token in .env.example", () => {
    const env = `${baseEnv}\nTELEGRAM_BOT_TOKEN=not-a-real-token\n`;
    expect(keys(checkEnvTemplate(env))).toContain("env.TELEGRAM_BOT_TOKEN");
  });

  test("rejects a missing gateway allowlist", () => {
    const env = baseEnv.replace(
      "GATEWAY_ALLOWED_USERS=<OWNER_GATEWAY_USER_ID>",
      "",
    );
    expect(keys(checkEnvTemplate(env))).toContain("env.GATEWAY_ALLOWED_USERS");
  });

  test("rejects an uncommented secret with a value", () => {
    const env = `${baseEnv}\nOPENROUTER_API_KEY=not-a-real-key\n`;
    expect(keys(checkEnvTemplate(env))).toContain("env.OPENROUTER_API_KEY");
  });

  test("rejects a secret-shaped value under an unrelated name", () => {
    const fakeKey = ["sk", "or-v1", "a".repeat(20)].join("-");
    const env = `${baseEnv}\nSOME_VALUE=${fakeKey}\n`;
    expect(keys(checkEnvTemplate(env))).toContain("env.SOME_VALUE");
  });
});

describe("template placeholders", () => {
  test("rejects a concrete model in the template", () => {
    const config = cloneConfig();
    setPath(config, "model.default", "anthropic/claude-opus-4.6");
    expect(keys(checkControls(config))).toContain("model.default");
  });

  test("rejects a concrete provider in the template", () => {
    const config = cloneConfig();
    setPath(config, "model.provider", "openrouter");
    expect(keys(checkControls(config))).toContain("model.provider");
  });

  test("rejects a disabled pre-update backup", () => {
    const config = cloneConfig();
    setPath(config, "updates.pre_update_backup", "off");
    expect(keys(checkControls(config))).toContain("updates.pre_update_backup");
  });

  test("rejects an absent journal mode", () => {
    const config = cloneConfig();
    deletePath(config, "database.journal_mode");
    expect(keys(checkControls(config))).toContain("database.journal_mode");
  });
});

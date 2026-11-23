#!/usr/bin/env bun
/**
 * Validate the hardened Hermes Agent configuration template.
 *
 * Every check maps to a control in docs/threat-model.md and a phase in
 * docs/setup-plan.md. The validator is intentionally dependency-free beyond
 * Bun's built-in YAML parser, so it runs the same way locally and in CI.
 *
 * Usage: bun src/validate.ts [config.yaml] [.env.example]
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface Violation {
  key: string;
  message: string;
}

type Config = Record<string, unknown>;

export const DEFAULT_CONFIG = fileURLToPath(
  new URL("../config/config.yaml", import.meta.url),
);
export const DEFAULT_ENV = fileURLToPath(
  new URL("../config/.env.example", import.meta.url),
);

/** The template keeps these placeholders until Phase 0 chooses real values. */
export const MODEL_PLACEHOLDER = "<MODEL_ID>";
export const PROVIDER_PLACEHOLDER = "<PROVIDER>";
export const OWNER_PLATFORM_PLACEHOLDER = "<OWNER_PLATFORM_USER_ID>";
export const GATEWAY_OWNER_PLACEHOLDER = "<OWNER_GATEWAY_USER_ID>";
export const TELEGRAM_OWNER_PLACEHOLDER = "<OWNER_TELEGRAM_USER_ID>";

/** Toolsets the read-only pilot may expose on any surface. */
export const ALLOWED_PILOT_TOOLSETS = new Set(["web", "todo"]);

/** Toolsets removed globally so a platform row cannot add them back. */
export const FORBIDDEN_TOOLSETS = [
  "browser",
  "catalog",
  "clarify",
  "code_execution",
  "computer_use",
  "connections",
  "cronjob",
  "delegation",
  "desktop_ui",
  "discord",
  "discord_admin",
  "feishu_doc",
  "feishu_drive",
  "file",
  "image_gen",
  "kanban",
  "memory",
  "project",
  "search",
  "session_search",
  "skills",
  "skills_hub",
  "terminal",
  "tts",
  "video",
  "video_gen",
  "vision",
  "x_search",
] as const;

/** Every platform row the template sets. */
export const PILOT_PLATFORMS = [
  "cli",
  "telegram",
  "discord",
  "whatsapp",
  "slack",
  "signal",
  "qqbot",
  "teams",
  "google_chat",
] as const;

/** Deny rules that must survive any future widening. */
export const REQUIRED_DENY_PATTERNS = [
  "sudo *",
  "docker *",
  "git push --force*",
  "git push -f*",
  "*curl*|*sh*",
  "*wget*|*sh*",
  "reboot*",
  "shutdown*",
  "systemctl *",
  "mkfs*",
  "dd if=* of=/dev/*",
] as const;

const FORBIDDEN_ENV_KEYS = [
  "API_SERVER_ENABLED",
  "BROWSER_CDP_URL",
  "GATEWAY_RELAY_SECRET",
  "HERMES_YOLO_MODE",
  "SUDO_PASSWORD",
] as const;

const SECRET_KEY_PATTERN =
  /(api[_-]?key|token|secret|password|passwd|credential|private[_-]?key)$/i;

const SECRET_VALUE_PATTERNS: RegExp[] = [
  /^sk-[A-Za-z0-9_-]{16,}$/,
  /^sk-ant-[A-Za-z0-9_-]{16,}$/,
  /^xox[baprs]-[A-Za-z0-9-]{10,}$/,
  /^gh[pousr]_[A-Za-z0-9]{20,}$/,
  /^github_pat_[A-Za-z0-9_]{20,}$/,
  /^AIza[0-9A-Za-z_-]{35}$/,
  /^EAA[A-Za-z0-9]{20,}$/,
  /^\d{8,10}:[A-Za-z0-9_-]{35}$/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

export function isRecord(value: unknown): value is Config {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getPath(config: Config, dotted: string): unknown {
  let node: unknown = config;
  for (const part of dotted.split(".")) {
    if (!isRecord(node) || !(part in node)) return undefined;
    node = node[part];
  }
  return node;
}

export function hasPath(config: Config, dotted: string): boolean {
  let node: unknown = config;
  for (const part of dotted.split(".")) {
    if (!isRecord(node) || !(part in node)) return false;
    node = node[part];
  }
  return true;
}

export function loadConfig(path: string): Config {
  const text = readFileSync(path, "utf8");
  const parsed: unknown = Bun.YAML.parse(text);
  if (!isRecord(parsed)) {
    throw new Error(`${path}: configuration must be a YAML mapping`);
  }
  return parsed;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isIntegerInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): boolean {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function isEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0;
}

function isEmptyMapping(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).length === 0;
}

function isAbsentOrEmptyArray(value: unknown): boolean {
  return value === undefined || isEmptyArray(value);
}

function isAbsentOrEmptyMapping(value: unknown): boolean {
  return value === undefined || isEmptyMapping(value);
}

function isPlaceholder(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return (
    trimmed === "" ||
    /^<[A-Z0-9_]+>$/.test(trimmed) ||
    /^REPLACE_ME_[A-Z0-9_]+$/.test(trimmed) ||
    /^\$\{[A-Z0-9_]+(:-[^}]*)?\}$/.test(trimmed) ||
    /^(changeme|example|placeholder)$/i.test(trimmed)
  );
}

function looksLikeSecret(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return false;
  return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function walk(
  value: unknown,
  path: string[],
  visit: (key: string, value: unknown) => void,
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, [...path, String(index)], visit));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    visit([...path, key].join("."), child);
    walk(child, [...path, key], visit);
  }
}

export function checkControls(config: Config): Violation[] {
  const violations: Violation[] = [];

  const require = (key: string, condition: boolean, message: string): void => {
    if (!condition) violations.push({ key, message });
  };

  require("model.default", getPath(config, "model.default") ===
    MODEL_PLACEHOLDER, `must stay '${MODEL_PLACEHOLDER}' in the template; Phase 0 chooses the real model`);
  require("model.provider", getPath(config, "model.provider") ===
    PROVIDER_PLACEHOLDER, `must stay '${PROVIDER_PLACEHOLDER}' in the template; Phase 0 chooses the real provider`);
  require("database.journal_mode", getPath(config, "database.journal_mode") ===
    "wal", "must be 'wal' on the local ext4 filesystem");

  require("agent.max_turns", isIntegerInRange(
    getPath(config, "agent.max_turns"),
    1,
    50,
  ), "must be an integer between 1 and 50 for the read-only pilot");

  const disabled = getPath(config, "agent.disabled_toolsets");
  require("agent.disabled_toolsets", isStringArray(
    disabled,
  ), "must be a list of toolsets removed on every surface");
  if (isStringArray(disabled)) {
    for (const toolset of FORBIDDEN_TOOLSETS) {
      require("agent.disabled_toolsets", disabled.includes(
        toolset,
      ), `must include '${toolset}' so a platform row cannot re-enable it`);
    }
  }

  const platformToolsets = getPath(config, "platform_toolsets");
  require("platform_toolsets", isRecord(
    platformToolsets,
  ), "must map each platform to an explicit allowlist");
  if (isRecord(platformToolsets)) {
    for (const platform of PILOT_PLATFORMS) {
      const key = `platform_toolsets.${platform}`;
      const toolsets = platformToolsets[platform];
      if (!isStringArray(toolsets) || toolsets.length === 0) {
        violations.push({ key, message: "must be a non-empty list" });
        continue;
      }
      for (const toolset of toolsets) {
        require(key, ALLOWED_PILOT_TOOLSETS.has(
          toolset,
        ), `'${toolset}' is not allowed in the read-only pilot (${[
          ...ALLOWED_PILOT_TOOLSETS,
        ].join(", ")})`);
      }
    }
    for (const platform of Object.keys(platformToolsets)) {
      require(`platform_toolsets.${platform}`, (
        PILOT_PLATFORMS as readonly string[]
      ).includes(platform), "is not a known Hermes platform key");
    }
  }

  require("toolsets", !hasPath(
    config,
    "toolsets",
  ), "the top-level 'toolsets' key is deprecated and ignored; use platform_toolsets");
  require("mcp_servers", isAbsentOrEmptyMapping(
    getPath(config, "mcp_servers"),
  ), "MCP servers add third-party tools; keep the mapping empty until reviewed");
  require("plugins.enabled", isAbsentOrEmptyArray(
    getPath(config, "plugins.enabled"),
  ), "plugins are third-party code; keep the enabled list empty until reviewed");

  require("approvals.mode", getPath(config, "approvals.mode") ===
    "manual", "must be 'manual' so dangerous commands always prompt");
  require("approvals.timeout", isIntegerInRange(
    getPath(config, "approvals.timeout"),
    1,
    300,
  ), "must be an integer between 1 and 300 seconds");
  for (const modeKey of ["cron_mode", "single_query_mode", "unattended_mode"]) {
    require(`approvals.${modeKey}`, getPath(config, `approvals.${modeKey}`) ===
      "deny", "must be 'deny' so headless and unattended runs fail closed");
  }

  const approvers = getPath(config, "approvals.approvers");
  require("approvals.approvers", isStringArray(approvers) &&
    approvers.length > 0, "must list the owner's platform user id");
  if (isStringArray(approvers)) {
    require("approvals.approvers", !approvers.includes(
      "*",
    ), "must not be ['*']; only the owner may answer an approval");
    require("approvals.approvers", approvers.every(
      (approver) =>
        approver === OWNER_PLATFORM_PLACEHOLDER || /^\d+$/.test(approver),
    ), `must contain only '${OWNER_PLATFORM_PLACEHOLDER}' or numeric user ids`);
  }

  require("approvals.mcp_reload_confirm", getPath(
    config,
    "approvals.mcp_reload_confirm",
  ) === true, "must be true");
  require("approvals.destructive_slash_confirm", getPath(
    config,
    "approvals.destructive_slash_confirm",
  ) === true, "must be true");

  const deny = getPath(config, "approvals.deny");
  require("approvals.deny", isStringArray(
    deny,
  ), "must be a list of fnmatch command patterns");
  if (isStringArray(deny)) {
    for (const pattern of REQUIRED_DENY_PATTERNS) {
      require("approvals.deny", deny.includes(
        pattern,
      ), `must include '${pattern}'`);
    }
  }

  require("security.allow_private_urls", getPath(
    config,
    "security.allow_private_urls",
  ) ===
    false, "must be false so web tools cannot reach loopback, LAN, or metadata");
  require("security.protected_instruction_files", getPath(
    config,
    "security.protected_instruction_files",
  ) ===
    true, "must be true so the agent cannot silently rewrite its own instructions");
  require("security.approval.transport", getPath(
    config,
    "security.approval.transport",
  ) === "builtin", "must be 'builtin'");
  require("security.approval.transport_fallback", getPath(
    config,
    "security.approval.transport_fallback",
  ) === "deny", "must be 'deny' so a missing approval transport fails closed");

  require("terminal.backend", getPath(config, "terminal.backend") ===
    "docker", "must be 'docker'; the local backend has no isolation");
  require("terminal.cwd", getPath(config, "terminal.cwd") ===
    "/workspace", "must be '/workspace' inside the execution container");
  require("terminal.home_mode", getPath(config, "terminal.home_mode") ===
    "profile", "must be 'profile' so tool subprocesses see the profile home, not the host home");
  require("terminal.docker_image", typeof getPath(
    config,
    "terminal.docker_image",
  ) === "string" &&
    String(getPath(config, "terminal.docker_image")).length >
      0, "must name an execution image");
  require("terminal.docker_mount_cwd_to_workspace", getPath(
    config,
    "terminal.docker_mount_cwd_to_workspace",
  ) ===
    false, "must be false; the launch directory is not mounted into the sandbox");
  require("terminal.docker_run_as_host_user", getPath(
    config,
    "terminal.docker_run_as_host_user",
  ) ===
    true, "must be true so sandbox writes are owned by the unprivileged user");
  require("terminal.docker_network", getPath(
    config,
    "terminal.docker_network",
  ) === false, "must be false; the execution container gets no network egress");
  require("terminal.docker_forward_env", isAbsentOrEmptyArray(
    getPath(config, "terminal.docker_forward_env"),
  ), "must be empty; forwarded environment variables leak into the container");
  require("terminal.docker_env", isAbsentOrEmptyMapping(
    getPath(config, "terminal.docker_env"),
  ), "must be empty; literal environment values can carry secrets");
  require("terminal.docker_volumes", isAbsentOrEmptyArray(
    getPath(config, "terminal.docker_volumes"),
  ), "must be empty; host mounts break the sandbox boundary");
  require("terminal.docker_extra_args", isAbsentOrEmptyArray(
    getPath(config, "terminal.docker_extra_args"),
  ), "must be empty; extra docker flags can add capabilities or host mounts");
  require("terminal.docker_persist_across_processes", getPath(
    config,
    "terminal.docker_persist_across_processes",
  ) === false, "must be false so a new process gets a fresh container");
  require("terminal.sudo_password", !hasPath(
    config,
    "terminal.sudo_password",
  ), "must not be set; it stores a plaintext password");
  require("terminal.container_cpu", isIntegerInRange(
    getPath(config, "terminal.container_cpu"),
    1,
    2,
  ), "must be an integer between 1 and 2");
  require("terminal.container_memory", isIntegerInRange(
    getPath(config, "terminal.container_memory"),
    512,
    4096,
  ), "must be an integer between 512 and 4096 MB");
  require("terminal.container_disk", isIntegerInRange(
    getPath(config, "terminal.container_disk"),
    1024,
    20480,
  ), "must be an integer between 1024 and 20480 MB");
  require("terminal.container_persistent", getPath(
    config,
    "terminal.container_persistent",
  ) === false, "must be false so the sandbox filesystem is ephemeral");
  require("terminal.timeout", isIntegerInRange(
    getPath(config, "terminal.timeout"),
    1,
    180,
  ), "must be an integer between 1 and 180 seconds");
  require("terminal.lifetime_seconds", isIntegerInRange(
    getPath(config, "terminal.lifetime_seconds"),
    1,
    300,
  ), "must be an integer between 1 and 300 seconds");

  require("cron.catch_up_missed", getPath(config, "cron.catch_up_missed") ===
    false, "must be false; do not replay missed jobs after downtime");
  require("unauthorized_dm_behavior", ["decline", "ignore"].includes(
    String(getPath(config, "unauthorized_dm_behavior")),
  ), "must be 'decline' or 'ignore'; never reply with a pairing code in the pilot");

  const platforms = getPath(config, "platforms");
  if (isRecord(platforms)) {
    for (const [platform, settings] of Object.entries(platforms)) {
      if (!isRecord(settings)) continue;
      const behavior = settings.unauthorized_dm_behavior;
      if (behavior === undefined) continue;
      require(`platforms.${platform}.unauthorized_dm_behavior`, [
        "decline",
        "ignore",
      ].includes(String(behavior)), "must be 'decline' or 'ignore'");
    }
  }

  require("gateway.allow_all_users", getPath(
    config,
    "gateway.allow_all_users",
  ) !== true, "must be false or absent; allowlists live in ~/.hermes/.env");
  require("allow_all_users", getPath(config, "allow_all_users") !==
    true, "must be false or absent; allowlists live in ~/.hermes/.env");
  require("auth.adopt_external_logins", getPath(
    config,
    "auth.adopt_external_logins",
  ) ===
    false, "must be false; do not borrow Codex or Claude Code logins on a shared server");
  require("telemetry.shared_metrics.enabled", getPath(
    config,
    "telemetry.shared_metrics.enabled",
  ) === false, "must be false");
  require("telemetry.shared_metrics.send", getPath(
    config,
    "telemetry.shared_metrics.send",
  ) === false, "must be false");
  require("updates.pre_update_backup", ["quick", "full"].includes(
    String(getPath(config, "updates.pre_update_backup")),
  ), "must be 'quick' or 'full'; never disable the pre-update backup");
  require("updates.backup_keep", isIntegerInRange(
    getPath(config, "updates.backup_keep"),
    1,
    10,
  ), "must be an integer between 1 and 10");

  return violations;
}

export function checkSecrets(config: Config): Violation[] {
  const violations: Violation[] = [];
  walk(config, [], (key, value) => {
    const leaf = key.split(".").at(-1) ?? "";
    if (!SECRET_KEY_PATTERN.test(leaf)) return;
    if (typeof value !== "string") return;
    if (isPlaceholder(value)) return;
    violations.push({
      key,
      message:
        "must stay empty or a <PLACEHOLDER>; secrets belong in ~/.hermes/.env",
    });
  });
  return violations;
}

export function checkEnvTemplate(text: string): Violation[] {
  const violations: Violation[] = [];
  const values = new Map<string, string>();

  text.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) return;
    const match = /^(?:export\s+)?([A-Z][A-Z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) {
      violations.push({
        key: `env:${index + 1}`,
        message: "must be a KEY=value line or a comment",
      });
      return;
    }
    const key = match[1] as string;
    let value = (match[2] ?? "").trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  });

  const gatewayAllowlist = values.get("GATEWAY_ALLOWED_USERS");
  if (gatewayAllowlist === undefined) {
    violations.push({
      key: "env.GATEWAY_ALLOWED_USERS",
      message: `is required; keep '${GATEWAY_OWNER_PLACEHOLDER}' in the template`,
    });
  } else if (gatewayAllowlist !== GATEWAY_OWNER_PLACEHOLDER) {
    violations.push({
      key: "env.GATEWAY_ALLOWED_USERS",
      message: `must stay '${GATEWAY_OWNER_PLACEHOLDER}' in the template`,
    });
  }

  for (const [key, value] of values) {
    const enabled = !["", "0", "false", "no", "off"].includes(
      value.toLowerCase(),
    );
    if (
      enabled &&
      (key.endsWith("_ALLOW_ALL_USERS") ||
        (FORBIDDEN_ENV_KEYS as readonly string[]).includes(key))
    ) {
      violations.push({
        key: `env.${key}`,
        message: "must stay unset; it grants access or weakens a control",
      });
    }

    if (key.endsWith("_ALLOWED_USERS") || key.endsWith("_ALLOWED_CHATS")) {
      if (value.split(",").some((entry) => entry.trim() === "*")) {
        violations.push({
          key: `env.${key}`,
          message: "must not contain '*'; use explicit ids",
        });
      }
    }

    if (SECRET_KEY_PATTERN.test(key) && !isPlaceholder(value)) {
      violations.push({
        key: `env.${key}`,
        message: "must stay empty or a placeholder in the example file",
      });
    }
    if (looksLikeSecret(value) && !isPlaceholder(value)) {
      violations.push({
        key: `env.${key}`,
        message: "looks like a real credential; use a placeholder",
      });
    }
  }

  if (
    values.has("TELEGRAM_ALLOWED_USERS") &&
    values.get("TELEGRAM_ALLOWED_USERS") !== TELEGRAM_OWNER_PLACEHOLDER
  ) {
    violations.push({
      key: "env.TELEGRAM_ALLOWED_USERS",
      message: `must stay '${TELEGRAM_OWNER_PLACEHOLDER}' in the template`,
    });
  }

  return violations;
}

export function validate(config: Config, envText?: string): Violation[] {
  const violations = [...checkControls(config), ...checkSecrets(config)];
  if (envText !== undefined) violations.push(...checkEnvTemplate(envText));
  return violations;
}

export function main(argv: string[] = process.argv.slice(2)): number {
  const configPath = argv[0] ?? DEFAULT_CONFIG;
  const envPath = argv[1] ?? DEFAULT_ENV;
  try {
    const config = loadConfig(configPath);
    const envText = readFileSync(envPath, "utf8");
    const violations = validate(config, envText);
    if (violations.length > 0) {
      console.error(`${configPath}: ${violations.length} violation(s)`);
      for (const violation of violations) {
        console.error(`  - ${violation.key}: ${violation.message}`);
      }
      return 1;
    }
    console.log(`${configPath}: ok`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${configPath}: ${message}`);
    return 1;
  }
}

if (import.meta.main) {
  process.exit(main());
}

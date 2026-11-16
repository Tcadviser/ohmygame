import type { AgentUsageLimit } from "./contracts.js";
/**
 * A conversation runs on Pi. A plugin can still add its own coding agent
 * (`contributes.agents`); the model's provider is that agent's ID.
 * Claude Code, Codex, and OpenCode are not built in.
 */

export const AGENT_RUNTIME_IDS = [] as const;
export type BuiltInAgentRuntimeId = (typeof AGENT_RUNTIME_IDS)[number];
/**
 * A coding agent a plugin adds (`contributes.agents`), spoken to over the
 * Agent Client Protocol: `agent.<publisher>.<name>.<id>`.
 */
export type PluginAgentRuntimeId = `agent.${string}`;
export type AgentRuntimeId = BuiltInAgentRuntimeId | PluginAgentRuntimeId;

const PLUGIN_AGENT_ID = /^agent(?:\.[a-z0-9]+(?:-[a-z0-9]+)*){3}$/;

export function pluginAgentRuntimeId(pluginId: string, agentId: string): PluginAgentRuntimeId {
  return `agent.${pluginId.replace("/", ".")}.${agentId}`;
}

export function isPluginAgentRuntimeId(value: unknown): value is PluginAgentRuntimeId {
  return typeof value === "string" && PLUGIN_AGENT_ID.test(value);
}

export function isBuiltInAgentRuntimeId(value: unknown): value is BuiltInAgentRuntimeId {
  return typeof value === "string" && (AGENT_RUNTIME_IDS as readonly string[]).includes(value);
}

export const ACCOUNT_RUNTIME_IDS = [] as const;
export type AccountRuntimeId = (typeof ACCOUNT_RUNTIME_IDS)[number];
export type AccountProfileIds = Partial<Record<AccountRuntimeId, string>>;

export function isAccountRuntimeId(value: unknown): value is AccountRuntimeId {
  return typeof value === "string" && (ACCOUNT_RUNTIME_IDS as readonly string[]).includes(value);
}

export function isAccountProfileIds(value: unknown): value is AccountProfileIds {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.entries(value).every(([runtime, id]) =>
    isAccountRuntimeId(runtime) && typeof id === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(id));
}

export function isAgentRuntimeId(value: unknown): value is AgentRuntimeId {
  return isBuiltInAgentRuntimeId(value) || isPluginAgentRuntimeId(value);
}

/**
 * A native model's effort: the first preferred value the model offers, else
 * the model's first. Undefined for a model without efforts.
 */
export function nativeEffort(
  model: { nativeReasoningLevels?: readonly string[] } | undefined,
  ...preferred: Array<string | undefined>
): string | undefined {
  const offered = model?.nativeReasoningLevels ?? [];
  return (
    preferred.find((level) => level !== undefined && offered.includes(level)) ??
    offered[0]
  );
}

/** Where the agent's model requests are billed, as far as OhMyGame can tell. */
export type AgentRuntimeBilling =
  "subscription" | "api-key" | "provider" | "unknown";

export type AgentRuntimeAuthStatus = "signed-in" | "signed-out" | "unknown";

export type AgentRuntimeDiagnosticCode =
  | "not-installed"
  | "invalid-executable"
  | "runtime-incompatible"
  | "signed-out"
  | "probe-failed"
  | "models-unavailable";

export interface AgentRuntimeDiagnostic {
  code: AgentRuntimeDiagnosticCode;
  /** English detail for logs and error reports; the interface shows its own text for the code. */
  message: string;
  /** A protocol field or CLI flag that the installed program lacks. */
  capability?: string;
  /** A command the person can run in a terminal to fix it, such as a sign-in. */
  command?: string;
}

/**
 * How freely a plugin coding agent works. `default` follows the agent's own
 * rules. `allow` asks nothing, as Pi does. Planning uses the agent's
 * read-only mode whatever is chosen.
 */
/** An agent a plugin adds asks as its own rules say (`default`), or is allowed everything. */
export const PLUGIN_AGENT_PERMISSION_MODES = ["default", "allow"] as const;
export type AgentPermissionMode = (typeof PLUGIN_AGENT_PERMISSION_MODES)[number];

export function agentPermissionModes(_runtime: AgentRuntimeId): readonly AgentPermissionMode[] {
  return PLUGIN_AGENT_PERMISSION_MODES;
}

/** The mode that asks nothing, as Pi does. */
export function fullAccessPermissionMode(_runtime: AgentRuntimeId): AgentPermissionMode {
  return "allow";
}

export function isAgentPermissionMode(
  runtime: AgentRuntimeId,
  value: unknown,
): value is AgentPermissionMode {
  return (agentPermissionModes(runtime) as readonly unknown[]).includes(value);
}

export type AgentRuntimeBinarySource =
  | "manual"
  | "path"
  | "login-shell"
  | "common-directory"
  | "codex-app"
  | "chatgpt-app";

/** A CLI-owned configuration directory; credentials are never stored in app settings. */
export interface AgentAccountProfile {
  id: string;
  name: string;
  /** Absent for the existing system CLI configuration. */
  configDirectory?: string;
  /** Only app-created directories may be removed with the profile. */
  managed?: boolean;
}

export interface AgentAccountProfileStatus extends AgentAccountProfile {
  /** The folder the CLI uses for this account, System default's included. */
  directory: string;
  auth: { status: AgentRuntimeAuthStatus; account?: string; billing: AgentRuntimeBilling };
  limits?: AgentUsageLimit[];
}

/** Only a directory the person connected can change; the app keeps its own where it put them. */
export interface UpdateAgentAccountProfileRequest {
  name?: string;
  configDirectory?: string;
}

export interface AgentRuntimeStatus {
  id: AgentRuntimeId;
  name: string;
  enabled: boolean;
  /** Send one message to carry on once a usage limit resets. */
  autoContinue: boolean;
  /** Claude Code only: conversations report OhMyGame, not the generic `sdk-cli`, as the client. */
  identifyAsOhMyGame?: boolean;
  installed: boolean;
  /** The executable that runs, resolved to an absolute path. */
  binaryPath?: string;
  /** The person's override, kept even when it cannot be resolved. Empty means automatic discovery. */
  configuredBinaryPath?: string;
  /** Default account configuration for new conversations on this CLI. */
  defaultProfileId?: string;
  binarySource?: AgentRuntimeBinarySource;
  version?: string;
  /** Version used for real acceptance; it is not a compatibility floor. */
  testedVersion?: string;
  /** The plugin that adds this agent, for agents that come from plugins. */
  plugin?: string;
  /** The command line a plugin's agent starts with, shown before it is turned on. */
  launch?: string;
  auth: {
    status: AgentRuntimeAuthStatus;
    /** Account or plan text the CLI reports, such as an email address. */
    account?: string;
    billing: AgentRuntimeBilling;
  };
  permissionMode: AgentPermissionMode;
  /** The account's quota windows as last reported, by a conversation or a check of the CLI. */
  limits?: AgentUsageLimit[];
  diagnostics: AgentRuntimeDiagnostic[];
  checkedAt?: string;
}

export interface UpdateAgentRuntimeRequest {
  defaultProfileId?: string;
  enabled?: boolean;
  autoContinue?: boolean;
  identifyAsOhMyGame?: boolean;
  permissionMode?: AgentPermissionMode;
  /** An executable to use instead of the one found on PATH; empty clears it. */
  binaryPath?: string;
}

export interface AgentRuntimeLoginResponse {
  /** A browser page that completes the sign-in, when the CLI hands one out. */
  url?: string;
  /** A command to run in a terminal instead, when the CLI only signs in interactively. */
  command?: string;
}

/** What an agent asks to be allowed to do. */
export type ApprovalKind = "command" | "file" | "tool" | "other";

export type ApprovalDecision = "allow" | "allow-always" | "deny";

/** Decisions stored before "allow-always" replaced OhMyGame's own conversation grants. */
export type StoredApprovalDecision = ApprovalDecision | "allow-session";

export interface ApprovalRequestDetails {
  kind: ApprovalKind;
  /** The agent's own name for the tool. */
  tool: string;
  title?: string;
  command?: string;
  path?: string;
  paths?: Array<{ path: string; access: "read" | "write" }>;
  network?: boolean;
  reason?: string;
  /**
   * What the agent itself offers in place of asking again, when it does:
   * for the rest of its session, or saved in its own settings. The rules
   * are the agent's own description of what that covers.
   */
  always?: { scope: "session" | "saved"; rules: string[] };
}

export interface AnswerApprovalRequest {
  decision: ApprovalDecision;
}

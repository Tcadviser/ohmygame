import type { AgentRuntimeId } from "../../shared/agent-runtimes.js";

/** The prefix survives native turn records and session replay, which store error text. */
export class AgentRuntimeCompatibilityError extends Error {
  readonly code = "AGENT_RUNTIME_INCOMPATIBLE";

  constructor(
    detail: string,
    readonly capability?: string,
  ) {
    super(
      detail.startsWith("Local CLI compatibility: ")
        ? detail
        : `Local CLI compatibility: ${detail}`,
    );
    this.name = "AgentRuntimeCompatibilityError";
  }
}

export class AgentRuntimeProbeError extends Error {
  readonly code = "AGENT_RUNTIME_PROBE_FAILED";

  constructor(detail: string) {
    super(`Local CLI check failed: ${detail}`);
    this.name = "AgentRuntimeProbeError";
  }
}

/** A startup failure occurred before a model turn; keep its local origin on replay. */
export function runtimeStartupError(cause: unknown): Error {
  if (
    cause instanceof AgentRuntimeCompatibilityError ||
    cause instanceof AgentRuntimeProbeError
  )
    return cause;
  return new AgentRuntimeProbeError(
    cause instanceof Error ? cause.message : String(cause),
  );
}

/**
 * Only use a version rule when a required behavior cannot be read back from
 * the CLI. Keep its source beside the rule.
 */
export function checkRuntimeVersionRequirement(
  _id: AgentRuntimeId,
  _version: string | undefined,
): void {
  // Plugin agents report their own compatibility when a session starts.
}

/** A failed launch is not evidence of incompatibility unless the CLI rejects the command. */
export function cliProbeError(name: string, detail: string): Error {
  return /unknown (?:argument|option|command)|unrecognized (?:argument|option|command)|unexpected argument|method not found|unsupported (?:method|control request)/i.test(
    detail,
  )
    ? new AgentRuntimeCompatibilityError(`${name}: ${detail}`)
    : new Error(detail);
}

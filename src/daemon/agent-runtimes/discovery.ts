import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  access,
  constants,
  mkdir,
  realpath,
  rm,
  stat,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AgentModel, AgentUsageLimit } from "../../shared/contracts.js";
import type {
  AgentRuntimeAuthStatus,
  AgentRuntimeBilling,
  AgentRuntimeBinarySource,
  AgentRuntimeId,
} from "../../shared/agent-runtimes.js";
import {
  agentRuntimeDefinition,
  parseVersion,
  compareVersions,
} from "./definitions.js";
import {
  agentEnvironment,
  commonBinaryDirectories,
  loginShellPath,
} from "./environment.js";
import { leaseAgentDirectory } from "./process-recovery.js";
import { probeAcpModels } from "./acp.js";
import { launchCommand, npmShimTarget } from "./npm-shim.js";

const PROBE_TIMEOUT_MS = 15_000;
/** Starting an ACP session can start the agent's own MCP servers first. */
const ACP_PROBE_TIMEOUT_MS = 45_000;

export interface ResolvedBinary {
  path: string;
  source: AgentRuntimeBinarySource;
  /** Changes when the CLI is updated in place, so a cached probe is not trusted past it. */
  signature: string;
}

/** A Windows npm shim of a plugin agent, which is read instead of run. */
export function isReadableShim(id: AgentRuntimeId, binaryPath: string): boolean {
  return process.platform === "win32" && Boolean(agentRuntimeDefinition(id).acp) && npmShimTarget(binaryPath) !== undefined;
}

/**
 * Finds a CLI's executable: the one the person chose, or else the newest of
 * those on PATH, the login shell's PATH, the usual install folders and the
 * copies other apps bundle. A computer often has several, such as an old
 * global npm install next to the Codex in the ChatGPT app, and the oldest one
 * found first may not know the account's current models. The result is an
 * absolute path that is then always run as is.
 */
export async function resolveBinary(
  id: AgentRuntimeId,
  override?: string,
  recheck = false,
): Promise<ResolvedBinary | undefined> {
  if (override && /\.(?:cmd|bat|ps1)$/i.test(override) && !isReadableShim(id, override))
    return undefined;
  if (recheck) await loginShellPath(true);
  if (recheck)
    for (const key of versionCache.keys())
      if (key.startsWith(`${id}:`)) versionCache.delete(key);
  const definition = agentRuntimeDefinition(id);
  const candidates = override
    ? [{ path: override, source: "manual" as const }]
    : [
        ...(await searchCandidates(definition.binaries, Boolean(definition.acp))),
        ...(definition.bundledPaths?.[process.platform] ?? []).map(
          (candidate) => ({
            ...candidate,
            path: candidate.path.startsWith("~/")
              ? path.join(os.homedir(), candidate.path.slice(2))
              : candidate.path,
          }),
        ),
      ];
  const found: ResolvedBinary[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    try {
      await access(
        candidate.path,
        process.platform === "win32" ? constants.F_OK : constants.X_OK,
      );
      // A shim stays the same across updates, so the file it runs says when the CLI changed.
      const script = /\.cmd$/i.test(candidate.path);
      const shim = script ? npmShimTarget(candidate.path) : undefined;
      if (script && !shim) continue;
      const info = await stat(shim ? (shim.args[0] ?? shim.file) : candidate.path);
      if (!info.isFile()) continue;
      // One installation is often reachable through several links.
      const target = await realpath(candidate.path);
      if (seen.has(target)) continue;
      seen.add(target);
      found.push({
        ...candidate,
        signature: `${candidate.path}:${info.size}:${info.mtimeMs}`,
      });
    } catch {
      continue;
    }
  }
  if (found.length <= 1) return found[0];
  const versions = await Promise.all(
    found.map((binary) => cachedVersion(binary, id)),
  );
  // The newest wins; among equal or unreadable versions, the one found first, as PATH orders them.
  let best = 0;
  for (let index = 1; index < found.length; index++) {
    const version = versions[index];
    const current = versions[best];
    if (version && (!current || compareVersions(version, current) > 0))
      best = index;
  }
  return found[best];
}

const versionCache = new Map<
  string,
  { at: number; promise: Promise<string | undefined> }
>();
const VERSION_TTL_MS = 5 * 60_000;

/** Coalesces concurrent probes; failures are retried on the next check. */
function cachedVersion(
  binary: ResolvedBinary,
  id: AgentRuntimeId,
): Promise<string | undefined> {
  const key = `${id}:${binary.signature}`;
  const cached = versionCache.get(key);
  if (cached && Date.now() - cached.at < VERSION_TTL_MS) return cached.promise;
  const entry = {
    at: Date.now(),
    promise: probeVersion(
      binary.path,
      id,
      agentEnvironment(id, binary.path),
    ).catch(() => undefined),
  };
  versionCache.set(key, entry);
  void entry.promise.then((version) => {
    if (!version && versionCache.get(key) === entry) versionCache.delete(key);
  });
  if (versionCache.size > 128)
    versionCache.delete(versionCache.keys().next().value!);
  return entry.promise;
}

async function searchCandidates(
  names: readonly string[],
  npmShims = false,
): Promise<Array<{ path: string; source: AgentRuntimeBinarySource }>> {
  const shell = await loginShellPath();
  const directories = new Map<string, AgentRuntimeBinarySource>();
  for (const [folders, source] of [
    [(process.env.PATH ?? "").split(path.delimiter), "path"],
    [(shell ?? "").split(path.delimiter), "login-shell"],
    [commonBinaryDirectories(), "common-directory"],
  ] as const)
    for (const folder of folders)
      if (folder && !directories.has(folder)) directories.set(folder, source);
  // Node cannot start a .cmd or .bat script, such as an npm shim, without a
  // shell, and the CLIs' long JSON arguments are not safe to pass through one.
  // An ACP agent npm installed is found by its shim, which is read, not run.
  const extensions = process.platform === "win32" ? (npmShims ? [".exe", ".cmd"] : [".exe"]) : [""];
  return [...directories].flatMap(([directory, source]) =>
    names.flatMap((name) =>
      extensions.map((extension) => ({
        path: path.join(directory, `${name}${extension}`),
        source,
      })),
    ),
  );
}

export function runCli(
  binaryPath: string,
  args: readonly string[],
  env: Record<string, string>,
  cwd?: string,
  timeout = PROBE_TIMEOUT_MS,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  const command = launchCommand(binaryPath, args, env);
  return new Promise((resolve) => {
    execFile(
      command.file,
      command.args,
      {
        env,
        timeout,
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
        encoding: "utf8",
        ...(cwd ? { cwd } : {}),
      },
      (error, stdout, stderr) => {
        const code = error
          ? typeof (error as NodeJS.ErrnoException & { code?: unknown })
              .code === "number"
            ? (error as unknown as { code: number }).code
            : 1
          : 0;
        resolve({ stdout: stdout ?? "", stderr: stderr ?? "", code });
      },
    );
  });
}

export async function probeVersion(
  binaryPath: string,
  id: AgentRuntimeId,
  env: Record<string, string>,
): Promise<string | undefined> {
  const { stdout, stderr, code } = await runCli(
    binaryPath,
    agentRuntimeDefinition(id).versionArgs,
    env,
  );
  return code === 0 ? parseVersion(`${stdout}\n${stderr}`) : undefined;
}

export interface AuthProbe {
  status: AgentRuntimeAuthStatus;
  account?: string;
  billing: AgentRuntimeBilling;
}

/** Asks the CLI who it is signed in as. OhMyGame never reads a CLI's credential files. */
export async function probeAuth(
  _binaryPath: string,
  id: AgentRuntimeId,
  _env: Record<string, string>,
): Promise<AuthProbe> {
  // A plugin agent says it needs signing in only when a session starts.
  agentRuntimeDefinition(id);
  return { status: "unknown", billing: "unknown" };
}

/** The models a plugin agent offers, as OhMyGame's model picker lists them. */
export async function probeModels(
  binaryPath: string,
  id: AgentRuntimeId,
  env: Record<string, string>,
  privateDirectory: string,
): Promise<{
  models: AgentModel[];
  account?: string;
  limits?: AgentUsageLimit[];
  /** The agent refused to start a session until it is signed in. */
  signedOut?: true;
}> {
  const definition = agentRuntimeDefinition(id);
  if (!definition.acp) throw new Error(`${definition.name} is not available`);
  const name = definition.name;
  const model = (
    modelId: string,
    label: string,
    levels: readonly string[],
  ): AgentModel => ({
    provider: id,
    id: modelId,
    name: label,
    providerName: name,
    reasoningLevels: [],
    nativeReasoningLevels: [...new Set(levels)],
  });
  const listed = await probeAcpModels(
    binaryPath,
    { name, args: definition.acp.args },
    env,
    privateDirectory,
    ACP_PROBE_TIMEOUT_MS,
  );
  return {
    models: listed.models.map((entry) =>
      model(entry.id, entry.name, entry.levels),
    ),
    ...(listed.signedOut ? { signedOut: true as const } : {}),
  };
}

/** A private folder for one probe or session, removed with it. */
export async function privateFolder(
  root: string,
  name: string,
): Promise<{ path: string; remove: () => Promise<void> }> {
  const folder = path.join(root, `${name}-${randomUUID()}`);
  await mkdir(folder, { recursive: true, mode: 0o700 });
  const lease = leaseAgentDirectory(folder);
  return {
    path: folder,
    remove: async () => {
      await lease.release();
      await rm(folder, { recursive: true, force: true });
    },
  };
}

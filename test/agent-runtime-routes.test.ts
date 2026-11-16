import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ConversationManager } from "../src/daemon/conversations.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureOhMyGamePiEnvironment } from "../src/daemon/pi-agent.js";
import { createApp } from "../src/daemon/app.js";
import * as environment from "../src/daemon/agent-runtimes/environment.js";
import type { AgentRuntimeStatus } from "../src/shared/agent-runtimes.js";
import type { ConversationDetail, ConversationSummary, ProjectState } from "../src/shared/contracts.js";
import type { StorePlugin } from "../src/shared/plugins.js";

const cleanup: Array<() => Promise<unknown>> = [];
beforeEach(() => {
  vi.spyOn(environment, "loginShellPath").mockResolvedValue(undefined);
});
afterEach(async () => {
  try {
    for (const close of cleanup.splice(0).reverse()) await close();
  } finally {
    vi.restoreAllMocks();
  }
});

async function start() {
  const dataDirectory = await mkdtemp(path.join(tmpdir(), "ohmygame-agent-routes-"));
  cleanup.push(() => rm(dataDirectory, { recursive: true, force: true }));
  await ensureOhMyGamePiEnvironment(path.join(dataDirectory, "pi-agent"));
  const app = createApp({
    dataDirectory,
    piAgentDirectory: path.join(dataDirectory, "pi-agent"),
    accessToken: "app-token",
  });
  cleanup.push(() => app.close());
  await app.ready();
  const call = async <T>(method: string, url: string, payload?: unknown, token = "app-token") => {
    const response = await app.inject({
      method: method as "GET",
      url,
      headers: { authorization: `Bearer ${token}` },
      ...(payload !== undefined ? { payload: payload as object } : {}),
    });
    return {
      status: response.statusCode,
      body: (response.body ? JSON.parse(response.body) : undefined) as T,
    };
  };
  return { app, call, dataDirectory };
}

/** An agent that speaks the Agent Client Protocol with `--acp`, as a plugin declares it. */
const FAKE_ACP = `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === "--version") { console.log("fake-acp 1.2.3"); process.exit(0); }
if (args[0] !== "--acp") process.exit(2);
const send = (value) => console.log(JSON.stringify(value));
require("node:readline").createInterface({ input: process.stdin }).on("line", (line) => {
  const m = JSON.parse(line);
  if (m.id === undefined || !m.method) return;
  const reply = (result) => send({ jsonrpc: "2.0", id: m.id, result });
  if (m.method === "initialize") return reply({ protocolVersion: 1, agentCapabilities: { mcpCapabilities: { http: true } } });
  if (m.method === "session/new") return reply({ sessionId: "fake-session", configOptions: [{ id: "model", name: "Model", category: "model", type: "select", currentValue: "fake-model", options: [{ value: "fake-model", name: "Fake model" }] }] });
  if (m.method === "session/prompt") {
    send({ jsonrpc: "2.0", method: "session/update", params: { sessionId: m.params.sessionId, update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "ACP reply" } } } });
    return reply({ stopReason: "end_turn" });
  }
  reply({});
});
`;

describe("coding agent routes", () => {
  it.skipIf(process.platform === "win32")("adds a plugin's ACP agent to Agents, runs a conversation with it and follows the plugin", async () => {
    const { app, call, dataDirectory } = await start();
    await app.listen({ port: 0, host: "127.0.0.1" });
    const source = path.join(dataDirectory, "acp-plugin");
    await mkdir(path.join(source, ".ohmygame-plugin"), { recursive: true });
    await writeFile(path.join(source, ".ohmygame-plugin", "plugin.json"), JSON.stringify({
      id: "acme/fake-acp", version: "1.0.0", engines: { "ohmygame-api": "^2.3.0" }, displayName: "Fake ACP", description: "An ACP agent",
      capabilities: { processes: ["fake-acp"] },
      contributes: { agents: [{ id: "fake", title: "Fake ACP", command: "fake-acp", args: ["--acp", "--note=a b"], loginCommand: "fake-acp login" }] },
    }));
    const payload = { source: { type: "directory", path: source } };
    const inspected = await call<{ digest: string }>("POST", "/plugin-sources/inspect", payload);
    expect(inspected.status).toBe(200);
    expect((await call("POST", "/plugin-sources/install", { ...payload, digest: inspected.body.digest })).status).toBe(201);
    expect((await call<StorePlugin[]>("GET", "/plugin-store/plugins")).body.find((plugin) => plugin.id === "acme/fake-acp")).toMatchObject({ appOnly: true });
    const id = "agent.acme.fake-acp.fake";
    expect((await call<AgentRuntimeStatus[]>("GET", "/agent-runtimes")).body.find((agent) => agent.id === id)).toMatchObject({
      name: "Fake ACP", plugin: "acme/fake-acp", launch: 'fake-acp --acp "--note=a b"', enabled: false, permissionMode: "allow",
    });
    const executable = path.join(dataDirectory, "fake-acp");
    await writeFile(executable, FAKE_ACP);
    await chmod(executable, 0o755);
    const status = await call<AgentRuntimeStatus>("PATCH", `/agent-runtimes/${id}`, { binaryPath: executable, enabled: true, permissionMode: "default" });
    expect(status.body).toMatchObject({ installed: true, version: "1.2.3", enabled: true, permissionMode: "default", diagnostics: [], launch: `${executable} --acp "--note=a b"` });
    expect((await call("POST", `/agent-runtimes/${id}/login`)).body).toEqual({ command: "fake-acp login" });
    const project = (await call<ProjectState>("POST", "/projects", { type: "general" })).body;
    const conversation = (await call<ConversationSummary>("POST", `/projects/${project.id}/conversations`, { model: { provider: id, id: "fake-model" } })).body;
    const base = `/projects/${project.id}/conversations/${conversation.id}`;
    expect(await call("POST", `${base}/turns`, { prompt: "Hello" })).toMatchObject({ status: 202 });
    await vi.waitFor(async () => expect(JSON.stringify((await call<ConversationDetail>("GET", base)).body)).toContain("ACP reply"), { timeout: 10_000 });
    expect((await call("PUT", "/plugin-store/acme/fake-acp/every-project", { on: false })).status).toBe(204);
    await vi.waitFor(async () =>
      expect((await call<AgentRuntimeStatus[]>("GET", "/agent-runtimes")).body.some((agent) => agent.id === id)).toBe(false),
    );
    expect((await call("POST", `/agent-runtimes/${id}/recheck`)).status).toBe(404);
  });

  it("branches a completed stored response through the API and rejects invalid targets", async () => {
    const { call } = await start();
    const project = (await call<ProjectState>("POST", "/projects", {})).body;
    const conversations = new ConversationManager();
    const source = await conversations.create(project);
    const session = conversations.open(project, source);
    session.appendMessage({ role: "user", content: "Question", timestamp: Date.now() } as never);
    const entryId = session.appendMessage({ role: "assistant", content: [{ type: "text", text: "Answer" }], stopReason: "stop", timestamp: Date.now() } as never);
    const base = `/projects/${project.id}/conversations/${source.summary.id}`;
    const detail = (await call<ConversationDetail>("GET", base)).body;
    expect(detail.turns.flatMap((turn) => turn.items).find((item) => item.type === "agentMessage")).toMatchObject({ branchEntryId: entryId });
    const branched = await call<ConversationSummary>("POST", `${base}/branch`, { entryId });
    expect(branched.status).toBe(201);
    expect(branched.body.id).not.toBe(source.summary.id);
    expect(branched.body.messageCount).toBe(2);
    expect((await call("POST", `${base}/branch`, { entryId: "missing" })).status).toBe(400);
    expect((await call("POST", `${base}/branch`, {})).status).toBe(400);
    expect((await call("POST", `/projects/${project.id}/conversations/missing/branch`, { entryId })).status).toBe(404);
  });

  it("answers the tool bridge only with a session's own token, never the app's", async () => {
    const { app, call } = await start();
    const anonymous = await app.inject({
      method: "POST",
      url: "/agent-runtime-bridge/mcp",
      payload: { jsonrpc: "2.0", id: 1, method: "tools/list" },
    });
    expect(anonymous.statusCode).toBe(401);
    const withAppToken = await call("POST", "/agent-runtime-bridge/mcp", {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    });
    expect(withAppToken.status).toBe(401);
    expect((await app.inject({ method: "GET", url: "/agent-runtime-bridge/mcp" })).statusCode).toBe(405);
    expect((await app.inject({ method: "GET", url: "/agent-runtimes" })).statusCode).toBe(401);
  });

  it("refuses an answer to an approval request that is not waiting", async () => {
    const { call } = await start();
    const project = await call<{ id: string }>("POST", "/projects", { name: "Game", type: "general" });
    const conversation = await call<{ id: string }>("POST", `/projects/${project.body.id}/conversations`, {});
    expect((await call("POST", `/projects/${project.body.id}/conversations/${conversation.body.id}/approvals/nothing`, { decision: "allow" })).status).toBe(409);
    expect((await call("POST", `/projects/${project.body.id}/conversations/${conversation.body.id}/approvals/nothing`, { decision: "maybe" })).status).toBe(400);
  });
});

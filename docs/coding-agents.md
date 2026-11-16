# Coding agents

Conversations run on Pi (`src/daemon/agent.ts`). One conversation has one agent
loop. Skills are instructions that same loop loads; they are not separate
model processes.

Claude Code, Codex, and OpenCode are not included. A chat saved on one of them
opens, and its old transcript still names that agent, but the next turn cannot
start that CLI. Choose a Pi model instead.

A plugin can still add an agent. The id looks like `agent.<publisher>.<plugin>.<agent>`
and the agent speaks the Agent Client Protocol. Settings → Agents lists those
plugin agents only. OhMyGame can also be an MCP server for an agent you run
yourself: [External agents](external-agents.md).

Pi's model providers include ones named `opencode` and `openai-codex`. Those are
model APIs, not the conversation CLIs this page used to describe.

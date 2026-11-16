# Agent runtimes

Pi is the conversation runtime. `AgentManager` in `src/daemon/agent.ts` is the
only turn orchestrator. It starts a Pi session unless the selected model
belongs to a plugin agent.

Plugin agents are optional. Their definitions live beside the plugin, and
`src/daemon/agent-runtimes/` discovers them, starts an ACP driver, and bridges
OhMyGame tools into that session. There are no built-in CLI runtimes.

Claude Code, Codex, and OpenCode used to be built-in runtimes. Their drivers,
account profiles, and Codex image provider are gone. Saved settings for those
ids are ignored. Saved usage rows still use their old names. Image nodes that
name the `codex-cli` protocol stay readable and refuse to generate.

The implementation notes that used to live here described those three CLIs.
`src/shared/agent-runtimes.ts` and the tests under `test/agent-runtime-*.ts`
are the current contract for plugin agents.

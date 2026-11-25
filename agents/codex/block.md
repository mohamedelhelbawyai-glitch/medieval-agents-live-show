## Agent Realm (live pixel show)

Codex tool activity in this workspace is streamed to **Agent Realm**, a live pixel-art medieval town at http://localhost:4747, through Codex hooks. The tool in use decides where the character walks (shell commands to the Barracks, test runs to the Arena, `apply_patch` to the Forge, MCP tools to the Docks, `update_plan` and subagents to the Castle), and a finished turn is presented on the Theatre stage.

- Do not edit or remove the Agent Realm entries in `hooks.json`; use `agent-realm hooks uninstall --agent codex` instead.
- Codex asks you to review new hooks the first time: open `/hooks` and trust the Agent Realm entries.
- If the show is not running, the hooks fail silently and nothing breaks. Start it with `agent-realm start --open`.
- Optional environment variables: `REALM_NAME`, `REALM_ROLE`, `REALM_URL` (default http://127.0.0.1:4747), `REALM_REDACT=1` (tool names only).

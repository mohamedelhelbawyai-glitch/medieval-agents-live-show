## Agent Realm (live pixel show)

Cursor agent activity in this workspace is streamed to **Agent Realm**, a live pixel-art medieval town at http://localhost:4747, through Cursor hooks. Each agent becomes a character with a job title (Craftsman, Master Craftsmen, Guild Inspector, Chancellor, Swordsman, Royal Steward, Keeper of the Arsenal, Royal Scribe or Keeper of Records; see `roles.json`). The tool in use decides where the character walks (Shell to the Barracks, test runs to the Arena, Write to the Forge, Read and Grep to the Library, MCP tools to the Docks, subagents to the Castle), failed tools show as red "FAILED" bubbles, and a finished run is presented on the Theatre stage.

- Do not edit or remove the Agent Realm entries in `hooks.json`; use `agent-realm hooks uninstall --agent cursor` instead.
- The hooks only observe: they always answer "allow" and never change what the agent does.
- If the show is not running, the hooks fail silently and nothing breaks. Start it with `agent-realm start --open`.
- A Swordsman (bug fixing) fights enemies that stand for the bugs: failing tool calls wound him, and he falls if the fix fails.
- Optional environment variables: `REALM_NAME`, `REALM_ROLE`, `REALM_URL` (default http://127.0.0.1:4747), `REALM_REDACT=1` (tool names only).

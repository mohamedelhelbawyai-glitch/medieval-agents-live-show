## Agent Realm (live pixel show)

This session's tool activity is streamed to **Agent Realm**, a live pixel-art medieval town at http://localhost:4747, through Claude Code hooks. Each agent appears as a character; the tool in use decides where it walks (Read/Grep to the Library, Edit/Write to the Forge, Bash to the Barracks, web tools to the Market, MCP tools to the Docks, Task/TodoWrite to the Castle).

- Do not edit or remove the hooks tagged `# agent-realm` in `.claude/settings.json`; use `agent-realm uninstall-hooks` instead.
- Write a clear one-line `description` when you start a subagent or todo item. It is shown to viewers as the character's speech bubble.
- If the show is not running, the hooks fail silently and nothing breaks. Start it with `agent-realm start --open`.
- Optional environment variables for the hooks: `REALM_NAME` (character name), `REALM_ROLE` (governor, knight, merchant, trader, worker, farmer, scribe, bard), `REALM_URL` (default http://127.0.0.1:4747).

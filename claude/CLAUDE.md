## Agent Realm (live pixel show)

This session's tool activity is streamed to **Agent Realm**, a live pixel-art medieval town at http://localhost:4747, through Claude Code hooks. Each agent role is a named character (see `roles.json`); the tool in use decides where it walks (Read/Grep to the Library, Edit/Write to the Forge, shell commands to the Barracks, test runs to the Arena, web tools to the Market, MCP tools to the Docks, Task/TodoWrite to the Castle) and finished reports are presented on the Theatre stage.

- Do not edit or remove the hooks tagged `# agent-realm` in `.claude/settings.json`; use `agent-realm uninstall-hooks` instead.
- Launch subagents with their defined agent name as `subagent_type` (for example `code-reviewer`) so the right character appears.
- Write a clear one-line `description` when you start a subagent or todo item. It is shown to viewers as the character's speech bubble.
- If the show is not running, the hooks fail silently and nothing breaks. Start it with `agent-realm start --open`.
- Optional environment variables for the hooks: `REALM_NAME` (character name), `REALM_ROLE` (a role id from roles.json, such as `code-reviewer`), `REALM_URL` (default http://127.0.0.1:4747).

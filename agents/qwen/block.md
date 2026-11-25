## Agent Realm (live pixel show)

Qwen Code tool activity is streamed to **Agent Realm**, a live pixel-art medieval town at http://localhost:4747, through Qwen Code hooks. The tool in use decides where the character walks (`run_shell_command` to the Barracks, test runs to the Arena, `write_file` and `edit` to the Forge, `read_file` and `grep_search` to the Library, web tools to the Market, MCP tools to the Docks, `todo_write` and subagents to the Castle), and a finished turn is presented on the Theatre stage.

- Do not edit or remove the Agent Realm entries under `hooks` in `settings.json`; use `agent-realm hooks uninstall --agent qwen` instead.
- If the show is not running, the hooks fail silently and nothing breaks. Start it with `agent-realm start --open`.
- Optional environment variables: `REALM_NAME`, `REALM_ROLE`, `REALM_URL` (default http://127.0.0.1:4747), `REALM_REDACT=1` (tool names only).

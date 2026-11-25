# Agent Realm

A live, pixel-art medieval town where your working AI agents show up as characters
(governor, knights, merchants, traders, workers, farmers, scribes, bards) and walk to
the building that matches what they are doing. Think "AgentsTV", but in a castle town.

No dependencies. Needs Node.js 18 or newer.

## 1. Install the CLI (from GitHub, on any machine)

```bash
npm install -g github:mohamedelhelbawyai-glitch/medieval-agents-live-show
agent-realm --version
```

To update, run the same command again. To try it without installing:
`npx github:mohamedelhelbawyai-glitch/medieval-agents-live-show start --open`.

Hacking on a local clone instead? Run `npm install -g .` (or `npm link`) inside it.

## 2. Start the live show

```bash
agent-realm start --open        # open the town in your browser
agent-realm start --demo --open # same, with a simulated cast of agents
```

It listens on `http://localhost:4747` (change with `--port`). Other commands:

| Command | What it does |
|---|---|
| `agent-realm start [--port] [--open] [--demo]` | Run the live show |
| `agent-realm status` | Is it running, and how many viewers are watching |
| `agent-realm emit --agent a1 --tool Bash --status start --text "npm test"` | Send a test event |
| `agent-realm init [--scope project\|user] [--dry-run]` | Connect Claude Code (see below) |
| `agent-realm install-hooks` | Only add the hooks |
| `agent-realm uninstall-hooks [--all]` | Remove hooks (`--all` also removes `/realm` and the CLAUDE.md block) |

## 3. Connect Claude Code

Run this once in the project you want to watch:

```bash
agent-realm init
```

It sets up three things (re-running is safe, and your own hooks and settings are kept):

1. **Hooks** in `.claude/settings.json` for `PreToolUse`, `PostToolUse`, `Notification` and `Stop`. Each tool call becomes an event.
2. **`/realm` slash command** in `.claude/commands/realm.md` to start, check or open the show from inside Claude Code.
3. **A short block in `CLAUDE.md`** (between `agent-realm:start` / `agent-realm:end` markers) so Claude knows about the show.

The hooks run `agent-realm hook`, so they work wherever the CLI is installed and contain no machine-specific paths. Use `--scope user` to install for every project (writes to `~/.claude`). Preview with `--dry-run`.
Restart Claude Code afterwards, or check `/hooks`, so the hooks load.

Then open the town and use Claude Code as usual:

```bash
agent-realm start --open
```

The Claude Code files live in [`claude/`](claude/) if you'd rather copy them by hand:
`claude/settings.example.json` (hooks), `claude/commands/realm.md` (slash command), `claude/CLAUDE.md` (memory block).

### Who goes where

| Tool | Place | Character |
|---|---|---|
| Task, TodoWrite, plans | Castle | Governor |
| Read, Grep, Glob | Library | Scribe |
| Edit, Write | Forge | Worker |
| Bash | Barracks | Knight |
| WebSearch, WebFetch | Market | Merchant |
| `mcp__*` tools | Docks | Trader |
| database, memory, data tools | Farm | Farmer |
| idle, notifications | Tavern | Bard |

Characters take their name from the project folder. Set `REALM_NAME`, `REALM_ROLE`
(governor, knight, merchant, trader, worker, farmer, scribe, bard) or `REALM_URL` in the environment
to override the name, class or server address.

## Event format (any agent, not just Claude Code)

```bash
curl -X POST localhost:4747/event -H 'Content-Type: application/json' \
  -d '{"agent":"a1","tool":"Bash","status":"start","text":"npm test"}'
```

Fields: `agent` (id, required), `status` (`start` | `done` | `error` | `idle`), `tool`, `text`,
and optional `name`, `role`, `location` (castle, library, forge, barracks, market, docks, farm, tavern).

## Notes

- The server only listens on `127.0.0.1`, and `POST /event` requires a JSON content type so other websites can't inject events.
- Hooks never block Claude Code: they time out in under a second and always exit 0, so a stopped show is harmless.
- Remove everything with `agent-realm uninstall-hooks --all`.

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

1. **Hooks** in `.claude/settings.json` for `PreToolUse`, `PostToolUse`, `Notification`, `SubagentStop` and `Stop`. Each tool call becomes an event.
2. **`/realm` slash command** in `.claude/commands/realm.md` to start, check or open the show from inside Claude Code.
3. **A short block in `CLAUDE.md`** (between `agent-realm:start` / `agent-realm:end` markers) so Claude knows about the show.

The hooks run `agent-realm hook`, so they work wherever the CLI is installed and contain no machine-specific paths. Environment overrides for the hooks: `REALM_ROLE` (act as that role), `REALM_NAME`, `REALM_URL`, `REALM_DEBUG`. Use `--scope user` to install for every project (writes to `~/.claude`). Preview with `--dry-run`.
Restart Claude Code afterwards, or check `/hooks`, so the hooks load.

Then open the town and use Claude Code as usual:

```bash
agent-realm start --open
```

The Claude Code files live in [`claude/`](claude/) if you'd rather copy them by hand:
`claude/settings.example.json` (hooks), `claude/commands/realm.md` (slash command), `claude/CLAUDE.md` (memory block).

### The cast (roles, not tasks)

Every character is an **agent role**, not a task. A role keeps its identity and moves around the town as its
work changes. The cast lives in [`roles.json`](roles.json), one entry per agent name (the `subagent_type` Claude
Code launches). The default cast matches an orchestrated, phase-based agent system:

| Role | Character | Look |
|---|---|---|
| orchestrator (main session) | Lord Aldric, Conductor | Governor |
| intake-auditor | Brother Osric, Herald of Intake | Herald |
| spec-author | Maud, Scribe of Specs | Scribe |
| spec-reviewer / plan-reviewer / coverage-reviewer | Magistrates Hartwin, Ysolde, Wulfric | Judge |
| feature-architect | Master Godric, Architect | Architect |
| task-planner | Steward Bran, Keeper of Tasks | Steward |
| flutter-expert / kotlin-specialist / node-specialist | Sir Percival, Sir Galen, Sir Tristan | Knights (blue, purple, green shield) |
| sql-pro | Dame Ingrid, Keeper of the Archives | Archivist |
| code-reviewer | Sir Cedric the Just | Knight in silver |
| qa-verifier | Captain Roderic, Inquisitor | Inquisitor |
| test-scenario-designer | Pip the Jester | Jester |
| debugger | Doctor Corvin | Plague doctor |
| performance-engineer | Alchemist Thorne | Alchemist |
| final-auditor | High Justice Eadric | Judge in purple |

Edit or add roles with your own file: `agent-realm roles --init` writes `agent-realm.roles.json` into the current
folder (picked up automatically), or pass `agent-realm start --roles my-roles.json`. Each role has `name`, `title`,
`look`, optional `body`/`accent` colours, a `home` place, and a list of `tasks` (shown in the sidebar's cast panel).
`agent-realm roles` lists the cast in use. Agents with an unknown role still appear, as a generic villager.

### Where they stand

The **tool** an agent is using decides the place; the role decides who it is.

| Place | Tools | Nature of work |
|---|---|---|
| Castle | Task, TodoWrite, plans | Delegation and planning |
| Library | Read, Grep, Glob | Reading, research, reviewing |
| Forge | Edit, Write, build commands | Writing code |
| Barracks | other shell commands | Running things |
| Market | WebSearch, WebFetch | Looking things up outside |
| Docks | `mcp__*` tools, deploy commands | External services |
| Archives (farm) | database, memory tools | Data |
| **Arena** | test commands (`npm test`, `flutter test`, `pytest`...) | **Tests are fights**: the agent duels a training dummy |
| **Theatre** | a Stop / subagent finishing | **Reports are shows**: the agent presents its result on stage |
| Tavern, arena stands, theatre seats | idle | Breaks: idle agents drink, watch a fight, or watch a show |

When a role has no tool activity of its own (for example while a subagent is running), it stands at its `home` place.

### How subagents are detected

- When the orchestrator calls the `Task` tool, the hook reads `subagent_type`, so the matching character appears
  and stays "on duty" until the subagent returns, then presents its report on the theatre stage.
- If Claude Code includes `agent_type` in a hook payload, that subagent's own tool calls are attributed to it.
  Otherwise they are shown as the orchestrator's. To see which fields your Claude Code version sends, run with
  `REALM_DEBUG=/tmp/realm-hooks.log` and inspect the file.

## Event format (any agent, not just Claude Code)

```bash
curl -X POST localhost:4747/event -H 'Content-Type: application/json' \
  -d '{"agent":"a1","tool":"Bash","status":"start","text":"npm test"}'
```

Fields: `agent` (id, required), `status` (`start` | `done` | `error` | `idle`), `tool`, `text`, and optional
`role` (a key from roles.json), `name`, `project`, `location` (castle, library, forge, barracks, market, docks, farm,
tavern, arena, theatre), `activity: "report"` (present on the theatre stage) and `hold: true` (stay on duty until a
later event for the same agent).

## Notes

- The server only listens on `127.0.0.1`, and `POST /event` requires a JSON content type so other websites can't inject events.
- Hooks never block Claude Code: they time out in under a second and always exit 0, so a stopped show is harmless.
- Remove everything with `agent-realm uninstall-hooks --all`.

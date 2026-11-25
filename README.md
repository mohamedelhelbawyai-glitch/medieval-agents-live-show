# Agent Realm

**Watch your AI agents work, as a medieval town.**

Every agent role is a named pixel character. The tool it is using decides where it walks: readers go to the
library, coders to the forge, shell commands to the barracks, test runs to the arena, and when an agent
finishes, it presents its report on the theatre stage. Works with **Claude Code, Codex, Qwen Code and Cursor**.

```
        library ─── castle ─── barracks ─── ARENA   ← test runs are tournaments
           │          │           │           │
         forge ─── market ─── tavern ─── THEATRE   ← finished reports are shows
           │                      │
         farm ────── river ─── docks              ← MCP and deploys arrive by boat
```

## Two commands

```bash
npm install -g github:mohamedelhelbawyai-glitch/medieval-agents-live-show
agent-realm hooks install
```

Then run `agent-realm` to open the town, and use your agent in another terminal as usual.

`hooks install` finds the agents on your machine, shows you exactly which files it will change, and asks first.
Nothing else is needed: no accounts, no network, no config.

```
$ agent-realm hooks install

Agents on this machine
  ✔ Claude Code  /opt/homebrew/bin/claude
  ✔ Codex        /opt/homebrew/bin/codex
  – Qwen Code    not found
  ✔ Cursor       ~/.cursor

Install Agent Realm for Claude Code, Codex, Cursor  (user scope)
  Claude Code  hooks → ~/.claude/settings.json
  Codex        hooks → ~/.codex/hooks.json
  Cursor       hooks → ~/.cursor/hooks.json

Install these changes? (files are backed up as *.bak) [Y/n]
```

## Works with

| Agent | How it connects | Config it writes | Good to know |
|---|---|---|---|
| **Claude Code** | Hooks: `PreToolUse`, `PostToolUse`, `Notification`, `SubagentStop`, `Stop` | `~/.claude/settings.json` | Subagents launched by name (`code-reviewer`...) appear as their own characters |
| **Codex** | Hooks: `PreToolUse`, `PostToolUse`, `SubagentStart`, `SubagentStop`, `Stop` | `~/.codex/hooks.json` | Open `/hooks` once and **trust** the Agent Realm entries |
| **Qwen Code** | Hooks: the same set plus `PostToolUseFailure` and `Notification` | `~/.qwen/settings.json` | User hooks load automatically; project hooks ask for approval |
| **Cursor** | Hooks: `preToolUse`, `postToolUse`, `postToolUseFailure`, `subagentStart`, `subagentStop`, `stop` | `~/.cursor/hooks.json` | Observe-only: always answers "allow", never changes what the agent does |

Anything else that can send an HTTP request works too, see [Event format](#event-format).

## Install

| How | Command | Notes |
|---|---|---|
| Global CLI (recommended) | `npm install -g github:mohamedelhelbawyai-glitch/medieval-agents-live-show` | Hooks call `agent-realm`, so they work in every project and survive reboots. Run the same command to update. |
| Try without installing | `npx github:mohamedelhelbawyai-glitch/medieval-agents-live-show --demo` | Starts the show with a simulated cast. Don't run `hooks install` this way: `npx` caches are temporary. |
| From a clone | `git clone … && cd … && npm install -g .` | For hacking on it. `npm test` runs the adapter tests. |

Requires Node 18 or newer. There are no runtime dependencies.

If the `agent-realm` on your PATH is older than the one doing the install, the installer says so and points
the hooks at the new copy instead, so an old global install can never break a newer hook.

## Update

```bash
agent-realm update
```

It compares your installed commit with the latest one on GitHub, shows what changed, and reinstalls with
`npm install -g github:mohamedelhelbawyai-glitch/medieval-agents-live-show`. Restart a running show afterwards.

| Option | Meaning |
|---|---|
| `--check` | Only say whether a newer version exists (exit code 2 if so, 0 if current); installs nothing |
| `--hooks` | After updating, refresh the hooks of agents that already have them, to pick up any new hook events |
| `--force` | Reinstall even if you already have the latest |

Your hooks call `agent-realm hook`, so they use the new version automatically. Your settings, cast file and hooks are not touched
unless you pass `--hooks`. If you run from a git clone, `update` tells you to `git pull` instead. It contacts `github.com` only when you run it.

## How it works

1. **Hooks.** Each agent runs `agent-realm hook <agent>` around its tool calls. It reads the agent's own payload from stdin.
2. **Adapters.** One small adapter per agent turns Claude, Codex, Qwen and Cursor payloads into the same tiny event: who, which tool, a short detail, started/done/failed.
3. **Server.** A local Node server on `127.0.0.1:4747` relays events to the browser over a live stream.
4. **Town.** The browser draws the town. Tools map to places, roles map to characters, and your agent's work becomes walking, building, fighting and performing.

Hooks never block your agent: they exit 0 within a second even when the show isn't running.

## The town

### The cast (roles, not tasks)

A character is an **agent role**. It keeps its identity while its work changes. The default cast in
[`roles.json`](roles.json) matches an orchestrated, phase-based system:

| Role | Character | Look |
|---|---|---|
| orchestrator (the main session) | Lord Aldric, Conductor | Governor |
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

Agents with a role that isn't in the file still appear, as a villager. Make your own cast:
`agent-realm roles --init` writes `agent-realm.roles.json` here (picked up automatically), or use
`agent-realm start --roles my-roles.json`. Each role has `name`, `title`, `look`, optional `body` / `accent`
colours, a `home` place and a list of `tasks`. `agent-realm roles` lists the cast in use.

### Where they stand

The **tool** decides the place. Tool names from every agent are normalised (`run_shell_command`, `Shell`, `exec_command`
and `Bash` are all the same to the town).

| Place | Tools | Nature of work |
|---|---|---|
| Castle | Task, TodoWrite, plans, subagents | Delegation and planning |
| Library | Read, Grep, Glob | Reading, research, reviewing |
| Forge | Edit, Write, `apply_patch`, build commands | Writing code |
| Barracks | other shell commands | Running things |
| Market | WebSearch, WebFetch | Looking things up outside |
| Docks | `mcp__*` tools, deploy commands | External services |
| Farm | database, memory tools | Data |
| **Arena** | test commands (`npm test`, `flutter test`, `pytest`...) | **Tests are fights.** Idle agents come to watch |
| **Theatre** | a Stop or subagent finishing | **Reports are shows.** Idle agents come to watch |
| Tavern, stands, seats | idle | Breaks |

Failed tool calls (Qwen Code and Cursor report them) show a red FAILED bubble. When a role has no tool activity of its own
(for example while a subagent runs), it stands at its `home` place.

### The screen

The side panel is a menu: **Logs** (every event), **Tasks** (what is running right now and for how long), **Agents**
(everyone in town with a live status). Zoom with the **+ / − / FIT** buttons or **Ctrl/⌘ + scroll**, and drag to pan.
Characters hurry when they have work: any trip takes about 2.5 seconds however far, the work timer starts when they arrive, and the bubble stays up until they do, so a quick tool call is never over before they get there. `?demo` in the URL starts a simulated cast. An earlier pixel-art town map is kept under the git tag `pixel-town-map`.

## Commands

| Command | What it does |
|---|---|
| `agent-realm` | Start the show and open it in your browser |
| `agent-realm start [--port 4747] [--no-open] [--demo] [--roles file]` | Same, with options |
| `agent-realm hooks install` | Connect your agents (hooks only) |
| `agent-realm init` | Hooks **plus** short instruction files, so agents know about the show (below) |
| `agent-realm hooks status` | Which agents are found and connected, and whether the show is running |
| `agent-realm hooks uninstall [--all]` | Remove hooks; `--all` also removes the instruction files |
| `agent-realm roles [--init]` | List the cast, or write an editable copy here |
| `agent-realm emit --agent a1 --tool Bash --status start --text "npm test"` | Send a test event |
| `agent-realm status` | Is the show running? |
| `agent-realm update [--check] [--hooks] [--force]` | Get the latest version from GitHub (see [Update](#update)) |

Setup options (for `init` and `hooks install` / `uninstall`):

| Option | Meaning |
|---|---|
| `--agent claude,codex,qwen,cursor` or `all` | Which agents. Default: every agent found on this machine |
| `--scope user` or `project` | `user` (default) covers all your projects; `project` writes into the current folder only |
| `--dry-run` | Show what would change, write nothing |
| `--yes` | Don't ask for confirmation (needed in scripts) |

### What `init` adds beyond hooks

| Agent | Instruction file | Extra |
|---|---|---|
| Claude Code | a block in `CLAUDE.md` | a `/realm [start\|status\|open\|demo\|cast]` slash command |
| Codex | a block in `AGENTS.md` | |
| Qwen Code | a block in `QWEN.md` | |
| Cursor | `.cursor/rules/agent-realm.mdc` (project scope) | |

The blocks are fenced with `<!-- agent-realm:start -->` markers and are replaced, never duplicated. The text each agent gets lives
in [`agents/`](agents/): `block.md` (the instructions) and a ready-to-copy `settings.example.json` / `hooks.example.json` if you'd
rather edit the config by hand.

## Privacy

Agent Realm runs on your machine and talks only to `127.0.0.1`.

- **What an event carries:** the agent's session id (shortened), the tool name, and a short detail for the speech bubble:
  the first 100 characters of a command, a file's *name* (not its path or contents), a search query or URL, a subagent's one-line description, or the text of a notification ("needs your input"). It also carries the project folder's name, for the nameplate.
- **What it never carries:** file contents, prompts, model replies, transcripts, or environment variables. A unit test plants a secret in
  the file-content and prompt fields and checks it never appears in an event.
- **Stricter:** set `REALM_REDACT=1` in your environment and events carry tool names only. No commands, file names or queries.
- **Local only:** the server binds to `127.0.0.1` (the only outside contact is `agent-realm update`, which asks github.com for the latest commit), and `POST /event` requires a JSON content type so other websites can't inject events.
- **Non-destructive setup:** your other settings are kept, the original file is backed up, and uninstall puts the original back
  byte for byte (tested), including removing files and folders the installer created.

## Event format

Any agent, script or CI job can drive the town:

```bash
curl -X POST localhost:4747/event -H 'Content-Type: application/json' \
  -d '{"agent":"a1","tool":"Bash","status":"start","text":"npm test"}'
```

Fields: `agent` (id, required), `status` (`start` | `done` | `error` | `idle`), `tool`, `text`, and optional `role` (a key from
roles.json), `name`, `project`, `location` (castle, library, forge, barracks, market, docks, farm, tavern, arena, theatre),
`activity: "report"` (present on the theatre stage) and `hold: true` (stay on duty until a later event for the same agent).

## Troubleshooting

| Symptom | Try |
|---|---|
| Nothing appears | `agent-realm hooks status`: is the show running and the agent connected? Restart the agent so it loads hooks. |
| Codex shows nothing | Open `/hooks` in Codex and trust the Agent Realm entries. Hosted web search doesn't fire Codex hooks. |
| Qwen Code project hooks don't run | Approve them at startup, or install at user scope (the default). |
| "PATH has an older version" | `agent-realm update` (or the `npm install -g github:...` command), then re-run `hooks install`. |
| A tool shows up in the wrong place | See what your agent really sends: `REALM_DEBUG=/tmp/realm-hooks.log`, then read the file. |
| Remove everything | `agent-realm hooks uninstall --all --scope user` (and `--scope project` per project) |

## Status

What is verified and what isn't, plainly:

- **Tested here:** all four adapters against payloads built from each agent's published hook documentation (`npm test`); the installer and
  uninstaller in a sandbox home directory with pre-existing settings (idempotent, user data kept, byte-identical after uninstall); the actual
  command strings written into each config, piped realistic payloads, and received by the show; Cursor's required `allow` reply.
- **Not yet verified in a live session:** Codex, Qwen Code and Cursor running real agent work against it. Their payload fields come from
  documentation, and a few details are documented loosely (for example Cursor's file-edit payload). If a tool lands in the wrong place, the
  `REALM_DEBUG` log shows what your version sends, and `lib/adapters.js` is the one file to adjust.
- **Subagent attribution:** Claude Code subagents appear when the orchestrator launches them by name. Tool calls made *inside* a subagent are
  attributed to it only if your agent version includes the subagent's identity in the hook payload (Qwen Code does, as `agent_id`).

## Layout

```
bin/agent-realm.js   the CLI
lib/adapters.js      one payload adapter per agent (pure functions, unit-tested)
lib/agents.js        detect, install and uninstall per agent
lib/update.js        `agent-realm update`: check GitHub and reinstall
hook.js              the hook entry point the agents call
server.js            local server (events in, live stream out)
roles.json           the default cast
agents/<agent>/      instruction block + example config for each agent
public/              the town (canvas renderer, side panel, demo simulator)
test/                adapter tests
```

MIT.

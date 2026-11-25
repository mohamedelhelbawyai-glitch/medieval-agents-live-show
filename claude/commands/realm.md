---
description: Start, check or open the Agent Realm live show
argument-hint: [start|status|open|demo|cast]
allowed-tools: Bash(agent-realm:*)
---

Manage the Agent Realm live show for this session. The requested action is: `$ARGUMENTS` (default: `status`).

- `status`: run `agent-realm status` and report whether the show is running and how many viewers are watching.
- `start`: run `agent-realm start --open` in the background (do not wait for it to exit), then run `agent-realm status` to confirm.
- `open`: if `agent-realm status` says it is running, run `agent-realm start --open` (it only opens the browser when already running); otherwise start it first.
- `cast`: run `agent-realm roles` and show the cast.
- `demo`: run `agent-realm start --open --demo` in the background to show the simulated cast.

If the `agent-realm` command is not found, tell the user to install it (`npm install -g .` from the agent-realm project folder) and run `agent-realm init`. Keep the reply to two sentences and include the URL.

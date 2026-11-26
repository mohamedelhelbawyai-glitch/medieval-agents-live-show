'use strict';
// Turns each coding agent's hook payload into Agent Realm events.
// Pure functions: adapt(agent, payload, env) -> { events: [...], reply?: string }
const path = require('path');

const AGENTS = ['claude', 'codex', 'qwen', 'cursor'];

// Tool names differ per agent; the town speaks Claude Code's names.
const ALIASES = {
  qwen: { run_shell_command: 'Bash', read_file: 'Read', read_many_files: 'Read', write_file: 'Write', edit: 'Edit', grep_search: 'Grep', glob: 'Glob', list_directory: 'LS',
    todo_write: 'TodoWrite', web_fetch: 'WebFetch', google_web_search: 'WebSearch', web_search: 'WebSearch', notebook_edit: 'NotebookEdit', task: 'Task', agent: 'Task',
    ReadFile: 'Read', WriteFile: 'Write' },
  codex: { shell: 'Bash', exec_command: 'Bash', local_shell: 'Bash', apply_patch: 'Edit', update_plan: 'TodoWrite', spawn_agent: 'Task' },
  cursor: { Shell: 'Bash', Delete: 'Write', Subagent: 'Task' },
};
const PERMISSION_EVENTS = new Set(['preToolUse', 'subagentStart', 'beforeShellExecution', 'beforeMCPExecution', 'beforeReadFile', 'beforeTabFileRead']);
const ALLOW = '{"continue":true,"permission":"allow"}';

const base = f => path.basename(String(f));
const clip = (t, n = 100) => String(t).slice(0, n);

function normTool(agent, name) {
  name = String(name || ''); if (!name) return '';
  if (agent === 'cursor' && name.startsWith('MCP:')) return 'mcp__' + name.slice(4);
  return (ALIASES[agent] && ALIASES[agent][name]) || name;
}
// What the character's speech bubble says: a short detail, never file contents or prompts.
function detail(tool, input) {
  const i = input && typeof input === 'object' ? input : {};
  const cmd = Array.isArray(i.command) ? i.command.join(' ') : i.command;
  if (typeof cmd === 'string' && cmd) { const m = /\*\*\* (?:Update|Add|Delete) File: (.+)/.exec(cmd); return m ? base(m[1].trim()) : cmd; }   // codex apply_patch carries a patch
  const file = i.file_path || i.path || i.target_file || i.absolute_path;
  if (file) return base(file);
  return i.pattern || i.url || i.query || i.description || tool;
}

function adapt(agent, p, env = {}) {
  p = p && typeof p === 'object' ? p : {};
  const cursor = agent === 'cursor';
  const raw = String(p.hook_event_name || '');
  const hook = cursor && raw ? raw[0].toUpperCase() + raw.slice(1) : raw;        // cursor uses camelCase event names
  const out = { events: [] };
  if (cursor) out.reply = PERMISSION_EVENTS.has(raw) || !raw ? ALLOW : '{}';       // cursor blocks if a permission hook prints nothing

  const tool = normTool(agent, p.tool_name), i = p.tool_input && typeof p.tool_input === 'object' ? p.tool_input : {};
  const sid = String(p.session_id || p.conversation_id || agent).slice(0, 8);
  const root = p.cwd || (Array.isArray(p.workspace_roots) && p.workspace_roots[0]) || '';
  const project = root ? base(root) : undefined;
  const agentType = p.agent_type || p.subagent_type;
  let role = env.REALM_ROLE || agentType || 'orchestrator';
  if (!agentType && p.agent_id && !env.REALM_ROLE) role = 'subagent';           // a subagent we cannot name (qwen tool events carry agent_id only)
  const actor = role === 'orchestrator' ? sid : sid + ':' + (role === 'subagent' ? String(p.agent_id).slice(0, 6) : role);
  const common = { name: env.REALM_NAME || undefined, project };
  const redact = env.REALM_REDACT && env.REALM_REDACT !== '0';
  const txt = (t, input) => clip(redact ? t || 'working' : detail(t, input));
  const push = e => out.events.push(e);

  const sub = tool === 'Task' && i.subagent_type ? String(i.subagent_type).slice(0, 40) : null;
  const subId = sub ? sid + ':' + sub : null;

  switch (hook) {
    case 'PreToolUse':
      if (!tool) break;
      if (tool === 'Task') {
        push({ ...common, agent: actor, role, tool, status: 'start', text: clip(redact ? 'Dispatching a subagent' : `Dispatching ${sub || 'a subagent'}: ${i.description || ''}`) });
        if (subId) push({ agent: subId, role: sub, status: 'start', hold: true, text: clip(redact ? 'Working' : i.description || 'Working'), project });
      } else push({ ...common, agent: actor, role, tool, status: 'start', text: txt(tool, i) });
      break;
    case 'PostToolUse':
    case 'PostToolUseFailure':
      if (!tool) break;
      if (tool === 'Task') {
        push({ ...common, agent: actor, role, tool, status: 'done', text: clip(`${sub || 'Subagent'} returned`) });
        if (subId) push({ agent: subId, role: sub, activity: 'report', status: 'idle', hold: false, text: 'Reporting back to the Steward', project });
      } else push({ ...common, agent: actor, role, tool, status: hook === 'PostToolUseFailure' ? 'error' : 'done', text: txt(tool, i) });
      break;
    case 'SubagentStart': {
      const t = agentType || (p.agent_id && String(p.agent_id).slice(0, 6));
      if (t) push({ agent: sid + ':' + t, role: agentType, status: 'start', hold: true, text: clip(p.description || 'Subagent at work'), project });
      break;
    }
    case 'SubagentStop': {
      const t = agentType || (p.agent_id && String(p.agent_id).slice(0, 6));
      const failed = ['error', 'aborted', 'failed'].includes(String(p.status || ''));            // cursor reports how the subagent ended
      if (t && failed) push({ agent: sid + ':' + t, role: agentType, status: 'error', hold: false, text: 'The run failed', project });
      else if (t) push({ agent: sid + ':' + t, role: agentType, activity: 'report', status: 'idle', hold: false, text: 'Reporting back to the Steward', project });
      break;
    }
    case 'Stop':
      if (p.status === 'error') push({ ...common, agent: actor, role, status: 'error', text: 'The run failed' });
      else push({ ...common, agent: actor, role, activity: 'report', status: 'idle', text: 'Final report' });
      break;
    case 'Notification':
      push({ ...common, agent: actor, role, status: 'idle', text: clip(p.message || 'Waiting for you') });
      break;
    default: break;
  }
  return out;
}

module.exports = { AGENTS, adapt, normTool, detail };

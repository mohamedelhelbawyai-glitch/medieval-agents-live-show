'use strict';
const test = require('node:test'), assert = require('node:assert');
const { adapt, normTool } = require('../lib/adapters');

test('claude: tool call becomes a start event with the command as detail', () => {
  const { events } = adapt('claude', { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'npm test' }, session_id: 'abcdef123456', cwd: '/x/proj' });
  assert.deepStrictEqual(events.map(e => [e.agent, e.role, e.tool, e.status, e.text]), [['abcdef12', 'orchestrator', 'Bash', 'start', 'npm test']]);
  assert.strictEqual(events[0].project, 'proj');
});
test('claude: Task spawns the named subagent and holds it on duty, then it reports', () => {
  const pre = adapt('claude', { hook_event_name: 'PreToolUse', tool_name: 'Task', tool_input: { subagent_type: 'code-reviewer', description: 'Review diff' }, session_id: 'abcdef123456' }).events;
  assert.strictEqual(pre.length, 2); assert.deepStrictEqual([pre[1].agent, pre[1].role, pre[1].hold], ['abcdef12:code-reviewer', 'code-reviewer', true]);
  const post = adapt('claude', { hook_event_name: 'PostToolUse', tool_name: 'Task', tool_input: { subagent_type: 'code-reviewer' }, session_id: 'abcdef123456' }).events;
  assert.deepStrictEqual([post[1].activity, post[1].hold], ['report', false]);
});
test('claude: subagent tool calls are attributed via agent_type; Stop and Notification go idle/report', () => {
  assert.strictEqual(adapt('claude', { hook_event_name: 'PostToolUse', tool_name: 'Read', tool_input: { file_path: '/a/b.ts' }, session_id: 'abcdef123456', agent_type: 'qa-verifier' }).events[0].agent, 'abcdef12:qa-verifier');
  assert.strictEqual(adapt('claude', { hook_event_name: 'Stop', session_id: 's' }).events[0].activity, 'report');
  assert.strictEqual(adapt('claude', { hook_event_name: 'Notification', message: 'needs input', session_id: 's' }).events[0].status, 'idle');
});
test('codex: Bash, apply_patch (file name from the patch), MCP and plan tools', () => {
  const ev = (tool_name, tool_input) => adapt('codex', { hook_event_name: 'PreToolUse', tool_name, tool_input, session_id: 'thr_123456', cwd: '/w/app' }).events[0];
  assert.strictEqual(ev('Bash', { command: 'pytest -q' }).text, 'pytest -q');
  const patch = ev('apply_patch', { command: '*** Begin Patch\n*** Update File: src/server/app.ts\n@@\n-a\n+b\n*** End Patch' });
  assert.deepStrictEqual([patch.tool, patch.text], ['Edit', 'app.ts']);
  assert.strictEqual(ev('mcp__github__list_prs', {}).tool, 'mcp__github__list_prs');
  assert.strictEqual(ev('update_plan', {}).tool, 'TodoWrite');
});
test('codex: SubagentStart holds a character, SubagentStop makes it report', () => {
  const s = adapt('codex', { hook_event_name: 'SubagentStart', agent_id: 'a1', agent_type: 'explorer', session_id: 'thr_123456' }).events[0];
  assert.deepStrictEqual([s.agent, s.role, s.hold], ['thr_1234:explorer', 'explorer', true]);
  assert.strictEqual(adapt('codex', { hook_event_name: 'SubagentStop', agent_id: 'a1', agent_type: 'explorer', session_id: 'thr_123456' }).events[0].activity, 'report');
});
test('qwen: tool names are normalised, failures are errors, unnamed subagents get their own id', () => {
  const q = (hook_event_name, tool_name, extra = {}) => adapt('qwen', { hook_event_name, tool_name, tool_input: { command: 'ls' }, session_id: 'qwen-session-1', ...extra }).events[0];
  assert.strictEqual(q('PreToolUse', 'run_shell_command').tool, 'Bash');
  assert.strictEqual(q('PreToolUse', 'grep_search').tool, 'Grep');
  assert.strictEqual(q('PostToolUseFailure', 'write_file', { tool_input: { file_path: '/p/x.js' } }).status, 'error');
  const sub = q('PreToolUse', 'read_file', { agent_id: 'abcdef999' });
  assert.deepStrictEqual([sub.agent, sub.role], ['qwen-ses:abcdef', 'subagent']);
});
test('cursor: tools are normalised and permission events always get an allow reply', () => {
  const r = adapt('cursor', { hook_event_name: 'preToolUse', tool_name: 'Shell', tool_input: { command: 'flutter test' }, conversation_id: 'conv-0123456789', workspace_roots: ['/Users/me/app'] });
  assert.strictEqual(r.reply, '{"continue":true,"permission":"allow"}');
  assert.deepStrictEqual([r.events[0].tool, r.events[0].text, r.events[0].agent, r.events[0].project], ['Bash', 'flutter test', 'conv-012', 'app']);
  assert.strictEqual(adapt('cursor', { hook_event_name: 'postToolUse', tool_name: 'Write', tool_input: { file_path: '/a/b.dart' }, conversation_id: 'c' }).reply, '{}');
  assert.strictEqual(adapt('cursor', { hook_event_name: 'postToolUseFailure', tool_name: 'Shell', tool_input: { command: 'x' }, conversation_id: 'c' }).events[0].status, 'error');
  assert.strictEqual(normTool('cursor', 'MCP:search_docs'), 'mcp__search_docs');
});
test('cursor: unreadable payloads still get an allow reply (an empty reply would block the agent)', () => {
  assert.strictEqual(adapt('cursor', null).reply, '{"continue":true,"permission":"allow"}');
});
test('cursor: subagents and stop', () => {
  assert.strictEqual(adapt('cursor', { hook_event_name: 'subagentStart', subagent_type: 'explore', conversation_id: 'conv-0123456789' }).events[0].hold, true);
  assert.strictEqual(adapt('cursor', { hook_event_name: 'stop', status: 'completed', conversation_id: 'c' }).events[0].activity, 'report');
  assert.strictEqual(adapt('cursor', { hook_event_name: 'stop', status: 'error', conversation_id: 'c' }).events[0].status, 'error');
});
test('REALM_REDACT keeps tool names but drops commands and file names', () => {
  const e = adapt('claude', { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'curl -H secret http://x' }, session_id: 's' }, { REALM_REDACT: '1' }).events[0];
  assert.strictEqual(e.text, 'Bash');
});
test('events never contain file contents or prompts', () => {
  const marker = 'TOPSECRET';
  const e = adapt('claude', { hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: '/a/b.txt', content: marker }, prompt: marker, session_id: 's' }).events[0];
  assert.ok(!JSON.stringify(e).includes(marker));
});
test('a failed subagent is a final failure (no tool), so the Swordsman falls', () => {
  const e = adapt('cursor', { hook_event_name: 'subagentStop', subagent_type: 'debugger', status: 'error', conversation_id: 'conv-0123456789' }).events[0];
  assert.deepStrictEqual([e.status, e.tool, e.hold, e.role], ['error', undefined, false, 'debugger']);
  assert.strictEqual(adapt('cursor', { hook_event_name: 'subagentStop', subagent_type: 'debugger', status: 'completed', conversation_id: 'c' }).events[0].activity, 'report');
});

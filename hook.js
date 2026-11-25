#!/usr/bin/env node
// Claude Code hook -> Agent Realm bridge. Reads the hook JSON on stdin and POSTs events.
// Never fails or blocks Claude Code: always exits 0, with a short timeout.
// Optional env: REALM_URL (default http://127.0.0.1:4747), REALM_NAME, REALM_ROLE,
//               REALM_DEBUG=/path/file  (append every raw hook payload, to see which fields your Claude Code sends)
const http = require('http'), fs = require('fs'), path = require('path');
const target = new URL((process.env.REALM_URL || 'http://127.0.0.1:4747') + '/event');
let raw = '';
process.stdin.on('data', c => (raw += c)).on('end', () => {
  let p = {}; try { p = JSON.parse(raw); } catch {}
  if (process.env.REALM_DEBUG) { try { fs.appendFileSync(process.env.REALM_DEBUG, raw.trim() + '\n'); } catch {} }
  const hook = p.hook_event_name || '', tool = p.tool_name || '', i = p.tool_input || {};
  const sid = String(p.session_id || 'claude').slice(0, 8);
  const project = p.cwd ? path.basename(p.cwd) : undefined;
  // Who is acting? A subagent if the payload says so (agent_type), else this session's orchestrator.
  const role = process.env.REALM_ROLE || p.agent_type || 'orchestrator';
  const actor = role === 'orchestrator' ? sid : sid + ':' + role;
  const base = { name: process.env.REALM_NAME || undefined, project };
  const detail = i.command || (i.file_path && path.basename(i.file_path)) || i.pattern || i.url || i.query || i.description || tool;
  const clip = t => String(t).slice(0, 100);
  const events = [];

  if (tool === 'Task' || tool === 'Agent') {
    const sub = i.subagent_type ? String(i.subagent_type).slice(0, 40) : null;
    const subId = sub ? sid + ':' + sub : null;
    if (hook === 'PreToolUse') {
      events.push({ ...base, agent: actor, role, tool: 'Task', status: 'start', text: clip(`Dispatching ${sub || 'a subagent'}: ${i.description || ''}`) });
      if (subId) events.push({ agent: subId, role: sub, status: 'start', hold: true, text: clip(i.description || 'Working'), project });
    } else if (hook === 'PostToolUse') {
      events.push({ ...base, agent: actor, role, tool: 'Task', status: 'done', text: clip(`${sub || 'Subagent'} returned`) });
      if (subId) events.push({ agent: subId, role: sub, activity: 'report', status: 'idle', hold: false, text: 'Reporting back to the Conductor', project });
    }
  } else if (hook === 'SubagentStop') {
    if (p.agent_type) events.push({ agent: sid + ':' + p.agent_type, role: p.agent_type, activity: 'report', status: 'idle', hold: false, text: 'Reporting back to the Conductor', project });
  } else if (hook === 'Stop') {
    events.push({ ...base, agent: actor, role, activity: 'report', status: 'idle', text: 'Final report' });
  } else if (hook === 'Notification') {
    events.push({ ...base, agent: actor, role, status: 'idle', text: clip(p.message || 'Waiting for you') });
  } else if (tool) {
    events.push({ ...base, agent: actor, role, tool, status: hook === 'PostToolUse' ? 'done' : 'start', text: clip(detail) });
  }

  if (!events.length) process.exit(0);
  let left = events.length;
  const done = () => { if (--left <= 0) process.exit(0); };
  for (const ev of events) {
    const body = JSON.stringify(ev);
    const r = http.request({ host: target.hostname, port: target.port, path: target.pathname, method: 'POST', timeout: 800,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => { res.resume(); done(); });
    r.on('error', done); r.on('timeout', () => { r.destroy(); });
    r.end(body);
  }
});

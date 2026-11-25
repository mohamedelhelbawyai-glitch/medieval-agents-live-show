#!/usr/bin/env node
// Claude Code hook -> Agent Realm bridge. Reads the hook JSON on stdin and POSTs an event.
// Never fails or blocks Claude Code: always exits 0, with a short timeout.
// Optional env: REALM_URL (default http://127.0.0.1:4747), REALM_NAME, REALM_ROLE.
const http = require('http'), path = require('path');
const target = new URL((process.env.REALM_URL || 'http://127.0.0.1:4747') + '/event');
let raw = '';
process.stdin.on('data', c => (raw += c)).on('end', () => {
  let p = {}; try { p = JSON.parse(raw); } catch {}
  const i = p.tool_input || {}, tool = p.tool_name || '', hook = p.hook_event_name || '';
  const idle = hook === 'Stop' || hook === 'Notification' || hook === 'SubagentStop';
  const status = hook === 'PostToolUse' ? 'done' : idle ? 'idle' : 'start';
  const text = idle ? (p.message || 'Resting') : (i.command || (i.file_path && path.basename(i.file_path)) || i.pattern || i.url || i.query || i.description || tool);
  const ev = {
    agent: String(p.session_id || 'claude').slice(0, 8),
    name: process.env.REALM_NAME || (p.cwd ? path.basename(p.cwd) : undefined),
    role: process.env.REALM_ROLE || undefined,
    tool: idle ? '' : tool, status, text: String(text).slice(0, 100),
  };
  const body = JSON.stringify(ev);
  const r = http.request({ host: target.hostname, port: target.port, path: target.pathname, method: 'POST', timeout: 800,
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, () => process.exit(0));
  r.on('error', () => process.exit(0)); r.on('timeout', () => process.exit(0));
  r.end(body);
});

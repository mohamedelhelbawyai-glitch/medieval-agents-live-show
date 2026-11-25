#!/usr/bin/env node
// Agent hook -> Agent Realm bridge. Usage: agent-realm hook <claude|codex|qwen|cursor>
// Reads the agent's hook JSON on stdin and POSTs small events to the local show.
// Never fails or blocks the agent: always exits 0, short timeout. Events are local (127.0.0.1) only.
// Env: REALM_URL (default http://127.0.0.1:4747), REALM_NAME, REALM_ROLE, REALM_REDACT=1 (tool names only),
//      REALM_DEBUG=/path/file (append every raw payload, to inspect what your agent sends)
const http = require('http'), fs = require('fs');
const { AGENTS, adapt } = require('./lib/adapters');

const agent = process.argv.slice(2).find(a => AGENTS.includes(a)) || 'claude';
const target = new URL((process.env.REALM_URL || 'http://127.0.0.1:4747') + '/event');
let raw = '';
process.stdin.on('data', c => (raw += c)).on('end', () => {
  let p = {}; try { p = JSON.parse(raw); } catch {}
  if (process.env.REALM_DEBUG) { try { fs.appendFileSync(process.env.REALM_DEBUG, raw.trim() + '\n'); } catch {} }
  let res = { events: [] };
  try { res = adapt(agent, p, process.env); } catch {}
  if (res.reply !== undefined) process.stdout.write(res.reply + '\n');   // cursor needs an answer before anything else can go wrong
  if (!res.events.length) process.exit(0);
  let left = res.events.length;
  const done = () => { if (--left <= 0) process.exit(0); };
  for (const ev of res.events) {
    const body = JSON.stringify(ev);
    const r = http.request({ host: target.hostname, port: target.port, path: target.pathname, method: 'POST', timeout: 800,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, rs => { rs.resume(); done(); });
    r.on('error', done); r.on('timeout', () => r.destroy());
    r.end(body);
  }
});

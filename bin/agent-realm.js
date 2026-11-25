#!/usr/bin/env node
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const pkg = require('../package.json');
const MARK = '# agent-realm';                       // tags the hook commands we own
const BLOCK_START = '<!-- agent-realm:start -->', BLOCK_END = '<!-- agent-realm:end -->';
const EVENTS = [['PreToolUse', '*'], ['PostToolUse', '*'], ['Notification', null], ['Stop', null]];

const HELP = `agent-realm ${pkg.version}: a live pixel medieval town for your working agents

Usage: agent-realm <command> [options]

Commands
  start                 Start the live show           [--port 4747] [--open] [--demo]
  status                Check whether the show is running      [--port]
  emit                  Send a test event  --agent a1 --tool Bash --status start --text "npm test"
  hook                  (internal) Claude Code hook entry point; reads hook JSON on stdin
  init                  Set up Claude Code: hooks + /realm command + CLAUDE.md block
                                              [--scope project|user] [--dry-run]
  install-hooks         Only add the Claude Code hooks              [--scope] [--dry-run]
  uninstall-hooks       Remove the hooks (and with --all, the /realm command and CLAUDE.md block)
  help, --version

Scope: "project" writes into ./.claude and ./CLAUDE.md (default); "user" writes into ~/.claude.`;

function parse(argv) {
  const out = { _: [], f: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const [k, v] = a.slice(2).split('='); out.f[k] = v !== undefined ? v : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true); }
    else out._.push(a);
  }
  return out;
}
const portOf = f => +(f.port || process.env.PORT || 4747);
const urlOf = port => `http://localhost:${port}`;

function request(port, method, p, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({ host: '127.0.0.1', port, path: p, method, timeout: 1500,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {} }, res => {
      let b = ''; res.on('data', c => (b += c)); res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    r.on('error', reject); r.on('timeout', () => r.destroy(new Error('timeout')));
    r.end(data);
  });
}
async function health(port) { try { const r = await request(port, 'GET', '/health'); const j = JSON.parse(r.body); return j.name === 'agent-realm' ? j : null; } catch { return null; } }

function openUrl(u) {
  const [cmd, args] = process.platform === 'darwin' ? ['open', [u]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', u]] : ['xdg-open', [u]];
  try { cp.spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref(); } catch {}
}

/* ---- Claude Code config helpers ---- */
function targets(scope) {
  if (scope !== 'project' && scope !== 'user') die(`--scope must be "project" or "user" (got "${scope}")`);
  const base = scope === 'user' ? path.join(os.homedir(), '.claude') : path.join(process.cwd(), '.claude');
  return { base, settings: path.join(base, 'settings.json'), command: path.join(base, 'commands', 'realm.md'),
    claudeMd: scope === 'user' ? path.join(base, 'CLAUDE.md') : path.join(process.cwd(), 'CLAUDE.md') };
}
function die(msg) { console.error('agent-realm: ' + msg); process.exit(1); }
function readJSON(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return {}; die(`cannot parse ${f}: ${e.message}`); } }
function write(file, text, dry) { if (dry) { console.log(`  [dry-run] would write ${file}`); return; } fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }
function backup(file, dry) { if (!dry && fs.existsSync(file)) fs.copyFileSync(file, file + '.bak'); }

function stripOurs(settings) {
  const h = settings.hooks; if (!h) return settings;
  for (const ev of Object.keys(h)) {
    h[ev] = (h[ev] || []).map(g => ({ ...g, hooks: (g.hooks || []).filter(x => !(x.command || '').includes(MARK)) })).filter(g => g.hooks.length);
    if (!h[ev].length) delete h[ev];
  }
  if (!Object.keys(h).length) delete settings.hooks;
  return settings;
}
function installHooks(t, dry) {
  const s = stripOurs(readJSON(t.settings));
  s.hooks = s.hooks || {};
  const command = `agent-realm hook ${MARK}`;   // resolved from PATH, so no machine-specific paths
  for (const [ev, matcher] of EVENTS) {
    const group = { hooks: [{ type: 'command', command }] }; if (matcher) group.matcher = matcher;
    (s.hooks[ev] = s.hooks[ev] || []).push(group);
  }
  backup(t.settings, dry); write(t.settings, JSON.stringify(s, null, 2) + '\n', dry);
  console.log(`  hooks     ${EVENTS.map(e => e[0]).join(', ')} -> ${t.settings}`);
  if (!dry && cp.spawnSync('agent-realm', ['--version'], { shell: process.platform === 'win32' }).status !== 0)
    console.log('  warning   "agent-realm" is not on your PATH, so the hooks cannot run. Install it globally first (see README).');
}
function uninstallHooks(t, dry) {
  if (!fs.existsSync(t.settings)) return console.log(`  hooks     nothing to remove (${t.settings} not found)`);
  const s = stripOurs(readJSON(t.settings)); backup(t.settings, dry); write(t.settings, JSON.stringify(s, null, 2) + '\n', dry);
  console.log(`  hooks     removed from ${t.settings}`);
}
const snippet = () => fs.readFileSync(path.join(ROOT, 'claude', 'CLAUDE.md'), 'utf8').trim();
function claudeBlock() { return `${BLOCK_START}\n${snippet()}\n${BLOCK_END}`; }
function stripBlock(text) { const a = text.indexOf(BLOCK_START), b = text.indexOf(BLOCK_END); return a >= 0 && b > a ? (text.slice(0, a) + text.slice(b + BLOCK_END.length)).replace(/\n{3,}/g, '\n\n').trim() : text; }
function installMd(t, dry) {
  write(t.command, fs.readFileSync(path.join(ROOT, 'claude', 'commands', 'realm.md'), 'utf8'), dry);
  console.log(`  command   /realm -> ${t.command}`);
  const cur = fs.existsSync(t.claudeMd) ? stripBlock(fs.readFileSync(t.claudeMd, 'utf8')) : '';
  write(t.claudeMd, (cur ? cur + '\n\n' : '') + claudeBlock() + '\n', dry);
  console.log(`  memory    Agent Realm block -> ${t.claudeMd}`);
}
function uninstallMd(t, dry) {
  if (fs.existsSync(t.command)) { if (!dry) fs.rmSync(t.command); console.log(`  command   removed ${t.command}`); }
  if (fs.existsSync(t.claudeMd)) { const cur = fs.readFileSync(t.claudeMd, 'utf8'); if (cur.includes(BLOCK_START)) { const n = stripBlock(cur); if (!dry) n ? fs.writeFileSync(t.claudeMd, n + '\n') : fs.rmSync(t.claudeMd); console.log(`  memory    removed block from ${t.claudeMd}`); } }
}

/* ---- commands ---- */
const commands = {
  async start({ f }) {
    const port = portOf(f), url = urlOf(port) + (f.demo ? '/?demo' : '');
    if (await health(port)) { console.log(`Agent Realm is already running at ${urlOf(port)}`); if (f.open) openUrl(url); return; }
    try { await require('../server').start({ port, quiet: true }); }
    catch (e) { die(e.code === 'EADDRINUSE' ? `port ${port} is in use by another program (try --port)` : e.message); }
    console.log(`\n  AGENT REALM  v${pkg.version}\n  Live show:  ${urlOf(port)}${f.demo ? '  (demo cast)' : ''}\n  Events in:  POST ${urlOf(port)}/event\n  Hooks:      run "agent-realm init" once to connect Claude Code\n\n  Ctrl+C to stop.\n`);
    if (f.open) openUrl(url);
    const bye = () => process.exit(0); process.on('SIGINT', bye); process.on('SIGTERM', bye);
  },
  async hook() { require('../hook.js'); },
  async status({ f }) {
    const port = portOf(f), h = await health(port);
    if (!h) { console.log(`Agent Realm is not running on port ${port}. Start it with: agent-realm start`); process.exitCode = 1; return; }
    console.log(`Agent Realm is running at ${urlOf(port)} (${h.viewers} viewer${h.viewers === 1 ? '' : 's'} watching)`);
  },
  async emit({ f }) {
    const ev = { agent: String(f.agent || 'cli'), tool: f.tool === true ? '' : f.tool || '', status: f.status || 'start', text: f.text === true ? '' : f.text || f.tool || 'hello from the CLI' };
    if (f.name) ev.name = String(f.name); if (f.role) ev.role = String(f.role); if (f.location) ev.location = String(f.location);
    try { const r = await request(portOf(f), 'POST', '/event', ev); console.log(r.status === 204 ? 'sent' : `server replied ${r.status}`); }
    catch { die(`could not reach Agent Realm on port ${portOf(f)}. Is it running? (agent-realm start)`); }
  },
  async init({ f }) {
    const t = targets(f.scope || 'project'), dry = !!f['dry-run'];
    console.log(`${dry ? 'Previewing' : 'Setting up'} Claude Code (${f.scope || 'project'} scope):`);
    installHooks(t, dry); installMd(t, dry);
    console.log(`\nDone. Restart Claude Code (or open /hooks) to load the hooks, then run "agent-realm start --open".`);
  },
  async 'install-hooks'({ f }) { const dry = !!f['dry-run']; installHooks(targets(f.scope || 'project'), dry); },
  async 'uninstall-hooks'({ f }) { const t = targets(f.scope || 'project'), dry = !!f['dry-run']; uninstallHooks(t, dry); if (f.all) uninstallMd(t, dry); },
};

(async () => {
  const { _, f } = parse(process.argv.slice(2));
  const cmd = _[0];
  if (f.version || f.v || cmd === 'version') return console.log(pkg.version);
  if (!cmd || cmd === 'help' || f.help || f.h) return console.log(HELP);
  if (!commands[cmd]) { console.error(`agent-realm: unknown command "${cmd}"\n`); console.log(HELP); process.exit(1); }
  await commands[cmd]({ f, _ });
})().catch(e => die(e.message));

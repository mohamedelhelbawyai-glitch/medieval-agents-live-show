#!/usr/bin/env node
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), cp = require('child_process'), readline = require('readline');
const ROOT = path.resolve(__dirname, '..');
const pkg = require('../package.json');
const agents = require('../lib/agents');
const upd = require('../lib/update');

const tty = process.stdout.isTTY, c = (n, s) => tty ? `\x1b[${n}m${s}\x1b[0m` : s;
const bold = s => c(1, s), dim = s => c(2, s), green = s => c(32, s), yellow = s => c(33, s), red = s => c(31, s), gold = s => c(33, bold(s));

const HELP = `${bold('agent-realm')} ${pkg.version}  a live pixel medieval town for your working AI agents

${bold('Usage')}
  agent-realm                         start the show and open it in your browser
  agent-realm hooks install           connect your agents (Claude Code, Codex, Qwen Code, Cursor)
  agent-realm hooks status            what is connected, and whether the show is running

${bold('Commands')}
  start        Run the live show                 [--port 4747] [--no-open] [--demo] [--roles file]
  init         Guided setup: hooks + instruction files for the agents it finds
  hooks        install | uninstall | status       hooks only, no instruction files
  update       Get the latest version from GitHub    [--check] [--hooks] [--force]
  status       Is the show running?
  emit         Send a test event                 --agent a1 --tool Bash --status start --text "npm test"
  roles        List the cast; --init writes an editable agent-realm.roles.json here
  help, --version

${bold('Setup options')} (init, hooks install | uninstall)
  --agent claude,codex,qwen,cursor | all   default: every agent found on this machine
  --scope user | project                   user = all projects (default), project = this folder only
  --dry-run                                show what would change, write nothing
  --yes                                    do not ask for confirmation
  --all                                    (uninstall) also remove instruction files

${bold('Update options')}
  --check    only say whether a newer version exists, install nothing
  --hooks    after updating, refresh the hooks of agents that already have them (picks up new events)
  --force    reinstall even if you already have the latest`;

function parse(argv) {
  const out = { _: [], f: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const [k, v] = a.slice(2).split('='); out.f[k] = v !== undefined ? v : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true); }
    else out._.push(a);
  }
  return out;
}
const die = m => { console.error(red('agent-realm: ') + m); process.exit(1); };
const portOf = f => +(f.port || process.env.PORT || 4747);
const urlOf = port => `http://localhost:${port}`;
const short = f => f.replace(require('os').homedir(), '~').replace(process.cwd() + path.sep, './');

function request(port, method, p, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({ host: '127.0.0.1', port, path: p, method, timeout: 1500, headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {} }, res => {
      let b = ''; res.on('data', x => (b += x)); res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    r.on('error', reject); r.on('timeout', () => r.destroy(new Error('timeout')));
    r.end(data);
  });
}
async function health(port) { try { const j = JSON.parse((await request(port, 'GET', '/health')).body); return j.name === 'agent-realm' ? j : null; } catch { return null; } }
function openUrl(u) {
  const [cmd, args] = process.platform === 'darwin' ? ['open', [u]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', u]] : ['xdg-open', [u]];
  try { cp.spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref(); } catch {}
}
function confirm(q) {
  return new Promise(res => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(q + ' ', a => { rl.close(); res(!/^n/i.test(a.trim())); }); });
}

/* ---- agent selection ---- */
function pickAgents(f, { requireFound = true } = {}) {
  let ids;
  if (!f.agent || f.agent === true) { ids = agents.IDS.filter(i => agents.detect(i).found); if (!ids.length) die('no supported agent found on this machine. Name one with --agent claude|codex|qwen|cursor'); }
  else ids = f.agent === 'all' ? agents.IDS : String(f.agent).split(',').map(s => s.trim()).filter(Boolean);
  for (const i of ids) if (!agents.IDS.includes(i)) die(`unknown agent "${i}" (choose from ${agents.IDS.join(', ')}, or all)`);
  return ids;
}
const scopeOf = f => { const s = f.scope || 'user'; if (s !== 'user' && s !== 'project') die(`--scope must be "user" or "project" (got "${s}")`); return s; };

function printDetection() {
  console.log(bold('Agents on this machine'));
  for (const id of agents.IDS) { const d = agents.detect(id); console.log(`  ${d.found ? green('✔') : dim('–')} ${agents.AGENTS[id].label.padEnd(12)} ${dim(d.how)}`); }
  console.log('');
}

async function setup(f, { docs, remove }) {
  const scope = scopeOf(f), dry = !!f['dry-run'];
  if (!f.agent) printDetection();
  const ids = pickAgents(f), verb = remove ? 'Remove' : 'Install';
  console.log(bold(`${dry ? 'Preview: ' : ''}${verb} Agent Realm for ${ids.map(i => agents.AGENTS[i].label).join(', ')}`) + dim(`  (${scope} scope)`));
  for (const id of ids) {
    const A = agents.AGENTS[id];
    console.log(`  ${A.label.padEnd(12)} hooks → ${short(A.hooksFile(scope))}` + (docs && A.docFile(scope) ? `\n  ${''.padEnd(12)} notes → ${short(A.docFile(scope))}` : ''));
  }
  const pi = agents.pathInfo();
  if (!remove && pi.state !== 'ok') console.log(yellow(`\n  ! ${pi.state === 'stale' ? `the "agent-realm" on your PATH is v${pi.version}, this is v${pkg.version}` : '"agent-realm" is not on your PATH'}, so hooks will point at this install:\n    ${path.join(ROOT, 'bin', 'agent-realm.js')}\n    For a portable setup: ${pi.state === 'stale' ? 'update' : 'install'} it with  npm install -g github:mohamedelhelbawyai-glitch/medieval-agents-live-show  and re-run this command.`));
  console.log('');
  if (!dry && !f.yes) {
    if (!process.stdin.isTTY) die('not an interactive terminal; re-run with --yes to apply the changes above');
    if (!(await confirm(`${verb} these changes? ${dim('(files are backed up as *.bak)')} [Y/n]`))) { console.log('Nothing changed.'); return; }
  }
  const notes = [];
  for (const id of ids) {
    const A = agents.AGENTS[id];
    try {
      if (remove) {
        const r = agents.removeHooks(id, scope, dry);
        console.log(`  ${green('✔')} ${A.label}: ${r.count ? `${dry ? 'would remove' : 'removed'} ${r.count} hook${r.count === 1 ? '' : 's'}` : dim('no hooks to remove')}`);
        if (f.all) for (const d of agents.removeDocs(id, scope, dry)) console.log(`    ${dim(dry ? 'would remove' : 'removed')} ${short(d.file)}`);
      } else {
        const r = agents.installHooks(id, scope, dry);
        console.log(`  ${green('✔')} ${A.label}: ${dry ? 'would add' : 'added'} ${r.count} hooks in ${short(r.file)}`);
        if (docs) for (const d of agents.installDocs(id, scope, dry)) console.log(d.skipped ? `    ${yellow('skipped')} ${short(d.file)} (${d.skipped})` : `    ${dim(dry ? 'would write' : 'wrote')} ${short(d.file)}`);
        notes.push(`${A.label}: ${A.note}`);
      }
    } catch (e) { console.log(`  ${red('✘')} ${A.label}: ${e.message}`); process.exitCode = 1; }
  }
  if (!remove && !dry) {
    console.log('\n' + bold('Next'));
    for (const n of notes) console.log('  • ' + n);
    console.log(`  • Run ${gold('agent-realm')} to open the show, then use your agent as usual.`);
  }
}

async function hooksStatus(f) {
  const port = portOf(f), h = await health(port);
  console.log(bold('Show') + '    ' + (h ? green(`running at ${urlOf(port)}`) + dim(` (${h.viewers} viewer${h.viewers === 1 ? '' : 's'})`) : yellow('not running') + dim('  start it with: agent-realm')));
  const pi = agents.pathInfo();
  console.log(bold('CLI') + '     ' + (pi.state === 'ok' ? green('on PATH') + dim(`  v${pi.version}`) : pi.state === 'stale' ? yellow(`PATH has v${pi.version}, this is v${pkg.version}`) + dim('  (hooks use an absolute path; update the global install)') : yellow('not on PATH') + dim('  (hooks use an absolute path)')) + '\n');
  const pad = (txt, n, color) => color(txt) + ' '.repeat(Math.max(0, n - txt.length));
  console.log(bold('Agent'.padEnd(14) + 'Found'.padEnd(8) + 'User hooks'.padEnd(14) + 'Project hooks'));
  for (const id of agents.IDS) {
    const s = agents.status(id), cell = n => n < 0 ? ['unreadable', red] : n ? [`${n} installed`, green] : ['–', dim];
    const u = cell(s.hooks.user), p = cell(s.hooks.project);
    console.log(s.label.padEnd(14) + pad(s.detected.found ? 'yes' : 'no', 8, s.detected.found ? green : dim) + pad(u[0], 14, u[1]) + p[1](p[0]));
  }
}

/* ---- commands ---- */
const commands = {
  async start({ f }) {
    const port = portOf(f), url = urlOf(port) + (f.demo ? '/?demo' : ''), open = !f['no-open'] && f.open !== 'false';
    if (await health(port)) { console.log(`Agent Realm is already running at ${urlOf(port)}`); if (open) openUrl(url); return; }
    let srv;
    try { srv = await require('../server').start({ port, quiet: true, roles: f.roles === true ? undefined : f.roles }); }
    catch (e) { die(e.code === 'EADDRINUSE' ? `port ${port} is in use by another program (try --port)` : e.message); }
    console.log(`\n  ${gold('AGENT REALM')}  ${dim('v' + pkg.version)}\n  Live show:  ${urlOf(port)}${f.demo ? '  (demo cast)' : ''}\n  Events in:  POST ${urlOf(port)}/event  ${dim('(127.0.0.1 only)')}\n  Cast:       ${short(srv.rolesFile)}\n  Agents:     run "agent-realm hooks install" once to connect Claude Code, Codex, Qwen Code and Cursor\n\n  Ctrl+C to stop.\n`);
    if (open) openUrl(url);
    const bye = () => process.exit(0); process.on('SIGINT', bye); process.on('SIGTERM', bye);
  },
  async status({ f }) {
    const port = portOf(f), h = await health(port);
    if (!h) { console.log(`Agent Realm is not running on port ${port}. Start it with: agent-realm`); process.exitCode = 1; return; }
    console.log(`Agent Realm is running at ${urlOf(port)} (${h.viewers} viewer${h.viewers === 1 ? '' : 's'} watching)`);
  },
  async emit({ f }) {
    const ev = { agent: String(f.agent || 'cli'), tool: f.tool === true ? '' : f.tool || '', status: f.status || 'start', text: f.text === true ? '' : f.text || f.tool || 'hello from the CLI' };
    if (f.name) ev.name = String(f.name); if (f.role) ev.role = String(f.role); if (f.location) ev.location = String(f.location);
    try { const r = await request(portOf(f), 'POST', '/event', ev); console.log(r.status === 204 ? 'sent' : `server replied ${r.status}`); }
    catch { die(`could not reach Agent Realm on port ${portOf(f)}. Is it running? (agent-realm)`); }
  },
  async roles({ f }) {
    const { findRoles } = require('../server');
    if (f.init) { const dest = path.join(process.cwd(), 'agent-realm.roles.json'); if (fs.existsSync(dest)) die(`${dest} already exists`); fs.copyFileSync(path.join(ROOT, 'roles.json'), dest); return console.log(`Wrote ${dest}. Edit it, then restart agent-realm (it is picked up automatically from this folder).`); }
    const file = findRoles(f.roles === true ? undefined : f.roles), cfg = JSON.parse(fs.readFileSync(file, 'utf8')), { resolveRole } = require('../public/jobs');
    console.log(`Cast from ${file}\n`);
    console.log(bold('Jobs') + dim('  (any agent whose role id matches a job\'s patterns takes that job)'));
    for (const [job, j] of Object.entries(cfg.jobs || {})) console.log(`  ${job.padEnd(24)} look: ${String(j.look).padEnd(11)} home: ${String(j.home || '-').padEnd(9)} ${dim((j.match || []).length + ' patterns')}`);
    console.log('\n' + bold('Pinned roles'));
    for (const id of Object.keys(cfg.roles || {})) { const r = resolveRole(cfg, id); console.log(`  ${id.padEnd(24)} ${r.job}${r.specialty ? ' · ' + r.specialty : ''}`); }
  },
  async hook() { require('../hook.js'); },
  async init({ f }) { await setup(f, { docs: true }); },
  async hooks({ f, _ }) {
    const sub = _[1];
    if (sub === 'install') return setup(f, { docs: false });
    if (sub === 'uninstall') return setup(f, { docs: false, remove: true });
    if (sub === 'status' || !sub) return hooksStatus(f);
    die(`unknown: hooks ${sub} (use install, uninstall or status)`);
  },
};
commands['install-hooks'] = ({ f }) => setup(f, { docs: false });                                  // older names
commands['uninstall-hooks'] = ({ f }) => setup(f, { docs: false, remove: true });

(async () => {
  const { _, f } = parse(process.argv.slice(2)), cmd = _[0];
  if (f.version || f.v || cmd === 'version') return console.log(pkg.version);
  if (cmd === 'help' || f.help || f.h) return console.log(HELP);
  if (!cmd) return commands.start({ f, _ });
  if (!commands[cmd]) { console.error(`agent-realm: unknown command "${cmd}"\n`); console.log(HELP); process.exit(1); }
  await commands[cmd]({ f, _ });
})().catch(e => die(e.message));

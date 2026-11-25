'use strict';
// Per-agent setup: detect the agent, register/remove Agent Realm hooks, add/remove instruction files.
// Every write is non-destructive: other settings are preserved, a .bak is made, and only entries we own are removed.
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process'), { isDeepStrictEqual } = require('util');

const ROOT = path.resolve(__dirname, '..');
const HOME = os.homedir();
const BLOCK_START = '<!-- agent-realm:start -->', BLOCK_END = '<!-- agent-realm:end -->';
const OURS = /agent-realm[^\s]*\s+hook\s+(claude|codex|qwen|cursor)\b|# agent-realm/;   // current commands and older installs
const isOurs = c => OURS.test(c || '');
const cwd = () => process.cwd();
const codexHome = () => process.env.CODEX_HOME || path.join(HOME, '.codex');

const AGENTS = {
  claude: {
    label: 'Claude Code', bins: ['claude'], dirs: () => [path.join(HOME, '.claude')], shape: 'matcher',
    events: [['PreToolUse', '*'], ['PostToolUse', '*'], ['Notification'], ['SubagentStop'], ['Stop']],
    hooksFile: s => s === 'user' ? path.join(HOME, '.claude', 'settings.json') : path.join(cwd(), '.claude', 'settings.json'),
    docFile: s => s === 'user' ? path.join(HOME, '.claude', 'CLAUDE.md') : path.join(cwd(), 'CLAUDE.md'),
    commandFile: s => s === 'user' ? path.join(HOME, '.claude', 'commands', 'realm.md') : path.join(cwd(), '.claude', 'commands', 'realm.md'),
    note: 'Restart Claude Code (or open /hooks) to load the hooks.',
  },
  codex: {
    label: 'Codex', bins: ['codex'], dirs: () => [codexHome()], shape: 'matcher',
    events: [['PreToolUse'], ['PostToolUse'], ['SubagentStart'], ['SubagentStop'], ['Stop']],
    hooksFile: s => s === 'user' ? path.join(codexHome(), 'hooks.json') : path.join(cwd(), '.codex', 'hooks.json'),
    docFile: s => s === 'user' ? path.join(codexHome(), 'AGENTS.md') : path.join(cwd(), 'AGENTS.md'),
    note: 'Codex asks you to trust new hooks: open /hooks in Codex and trust the Agent Realm entries. Project hooks only load in trusted projects.',
  },
  qwen: {
    label: 'Qwen Code', bins: ['qwen'], dirs: () => [path.join(HOME, '.qwen')], shape: 'matcher', extra: { name: 'agent-realm' },
    events: [['PreToolUse'], ['PostToolUse'], ['PostToolUseFailure'], ['SubagentStart'], ['SubagentStop'], ['Notification'], ['Stop']],
    hooksFile: s => s === 'user' ? path.join(HOME, '.qwen', 'settings.json') : path.join(cwd(), '.qwen', 'settings.json'),
    docFile: s => s === 'user' ? path.join(HOME, '.qwen', 'QWEN.md') : path.join(cwd(), 'QWEN.md'),
    note: 'User hooks load automatically. Project hooks ask for approval the first time Qwen Code starts in the workspace.',
  },
  cursor: {
    label: 'Cursor', bins: ['cursor-agent', 'cursor'], dirs: () => [path.join(HOME, '.cursor'), '/Applications/Cursor.app'], shape: 'flat',
    events: [['preToolUse'], ['postToolUse'], ['postToolUseFailure'], ['subagentStart'], ['subagentStop'], ['stop']],
    hooksFile: s => s === 'user' ? path.join(HOME, '.cursor', 'hooks.json') : path.join(cwd(), '.cursor', 'hooks.json'),
    docFile: s => s === 'user' ? null : path.join(cwd(), '.cursor', 'rules', 'agent-realm.mdc'),
    docWholeFile: true,
    note: 'Cursor reloads hooks.json when it is saved. The hooks only observe and always answer "allow".',
  },
};
const IDS = Object.keys(AGENTS);

function onPath(bin) { const r = cp.spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], { encoding: 'utf8' }); return r.status === 0 ? r.stdout.split(/\r?\n/)[0].trim() : null; }
function detect(id) {
  const A = AGENTS[id];
  for (const b of A.bins) { const p = onPath(b); if (p) return { found: true, how: p }; }
  for (const d of A.dirs()) if (fs.existsSync(d)) return { found: true, how: d.replace(HOME, '~') };
  return { found: false, how: 'not found' };
}
// Is the "agent-realm" on PATH this very version? (An older global install would not understand newer hooks.)
function pathInfo() {
  const p = onPath('agent-realm'); if (!p) return { state: 'missing' };
  const r = cp.spawnSync('agent-realm', ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' }), v = (r.stdout || '').trim();
  return v === require('../package.json').version ? { state: 'ok', path: p, version: v } : { state: 'stale', path: p, version: v || 'unknown' };
}
// "agent-realm hook <agent>" when the matching CLI is on PATH, otherwise an absolute path to this install.
function hookCommand(id) {
  return pathInfo().state === 'ok' ? `agent-realm hook ${id}` : `node "${path.join(ROOT, 'bin', 'agent-realm.js')}" hook ${id}`;
}
const portable = () => pathInfo().state === 'ok';

/* ---- files ---- */
function readJSON(f) {
  if (!fs.existsSync(f)) return { obj: {}, indent: '  ', existed: false };
  const t = fs.readFileSync(f, 'utf8');
  if (!t.trim()) return { obj: {}, indent: '  ', existed: true };
  let obj; try { obj = JSON.parse(t); } catch (e) { throw new Error(`${f} is not plain JSON (${e.message}). Add the hooks by hand from the examples in agents/.`); }
  const m = /^([ \t]+)"/m.exec(t);
  return { obj, indent: m ? m[1] : '  ', existed: true };
}
function writeText(f, text, dry) {
  if (dry) return;
  fs.mkdirSync(path.dirname(f), { recursive: true });
  // keep the pristine original once: never back up our own earlier output
  if (fs.existsSync(f) && !fs.existsSync(f + '.bak') && !/agent-realm/.test(fs.readFileSync(f, 'utf8'))) fs.copyFileSync(f, f + '.bak');
  fs.writeFileSync(f, text);
}
const tidy = f => { for (const d of [path.dirname(f), path.dirname(path.dirname(f))]) { try { fs.rmdirSync(d); } catch { break; } } };          // remove a folder we emptied (fails quietly if not empty)
// After removing our entries: if the result equals the original (the .bak), put the original back byte for byte.
function restoreIfPristine(f, same) {
  const bak = f + '.bak';
  if (!fs.existsSync(bak)) return false;
  try { if (same(fs.readFileSync(bak, 'utf8'))) { fs.copyFileSync(bak, f); fs.rmSync(bak); return true; } } catch {}
  return false;
}
const writeJSON = (f, r, dry) => writeText(f, JSON.stringify(r.obj, null, r.indent) + '\n', dry);

function strip(A, hooks) {
  let removed = 0;
  for (const ev of Object.keys(hooks)) {
    if (!Array.isArray(hooks[ev])) continue;
    if (A.shape === 'flat') { const keep = hooks[ev].filter(h => !isOurs(h.command)); removed += hooks[ev].length - keep.length; hooks[ev] = keep; }
    else hooks[ev] = hooks[ev].map(g => { const keep = (g.hooks || []).filter(h => !isOurs(h.command)); removed += (g.hooks || []).length - keep.length; return { ...g, hooks: keep }; }).filter(g => g.hooks.length);
    if (!hooks[ev].length) delete hooks[ev];
  }
  return removed;
}
function countOurs(A, file) {
  if (!file || !fs.existsSync(file)) return 0;
  try { const h = readJSON(file).obj.hooks || {}; let n = 0; for (const ev of Object.keys(h)) for (const g of h[ev] || []) n += A.shape === 'flat' ? (isOurs(g.command) ? 1 : 0) : (g.hooks || []).filter(x => isOurs(x.command)).length; return n; } catch { return -1; }
}

function installHooks(id, scope, dry) {
  const A = AGENTS[id], file = A.hooksFile(scope), r = readJSON(file), command = hookCommand(id);
  r.obj.hooks = r.obj.hooks && typeof r.obj.hooks === 'object' ? r.obj.hooks : {};
  strip(A, r.obj.hooks);                                   // idempotent: replace our previous entries
  if (A.shape === 'flat' && r.obj.version === undefined) r.obj.version = 1;
  for (const [ev, matcher] of A.events) {
    const entry = A.shape === 'flat' ? { command, timeout: 5 } : { ...(matcher ? { matcher } : {}), hooks: [{ type: 'command', command, timeout: 5, ...(A.extra || {}) }] };
    (r.obj.hooks[ev] = r.obj.hooks[ev] || []).push(entry);
  }
  writeJSON(file, r, dry);
  return { file, count: A.events.length };
}
function removeHooks(id, scope, dry) {
  const A = AGENTS[id], file = A.hooksFile(scope);
  if (!fs.existsSync(file)) return { file, count: 0 };
  const r = readJSON(file), count = r.obj.hooks ? strip(A, r.obj.hooks) : 0;
  if (r.obj.hooks && !Object.keys(r.obj.hooks).length) delete r.obj.hooks;
  if (count && !dry) {
    const rest = Object.keys(r.obj).filter(k => k !== 'version');
    if (!rest.length && !fs.existsSync(file + '.bak')) { fs.rmSync(file); tidy(file); }                 // we created this file: remove it
    else if (!restoreIfPristine(file, t => isDeepStrictEqual(JSON.parse(t), r.obj))) writeJSON(file, r, dry);
  } else if (count) writeJSON(file, r, dry);
  return { file, count };
}

const snippet = id => fs.readFileSync(path.join(ROOT, 'agents', id, 'block.md'), 'utf8').trim();
const block = id => `${BLOCK_START}\n${snippet(id)}\n${BLOCK_END}`;
const stripBlock = t => { const a = t.indexOf(BLOCK_START), b = t.indexOf(BLOCK_END); return a >= 0 && b > a ? (t.slice(0, a) + t.slice(b + BLOCK_END.length)).replace(/\n{3,}/g, '\n\n').trim() : t; };

function installDocs(id, scope, dry) {
  const A = AGENTS[id], out = [], f = A.docFile(scope);
  if (f) {
    if (A.docWholeFile) {   // cursor rule file: a dedicated .mdc we own
      if (fs.existsSync(f) && !fs.readFileSync(f, 'utf8').includes(BLOCK_START)) out.push({ file: f, skipped: 'exists and is not ours' });
      else { writeText(f, `---\ndescription: Agent Realm live pixel show\nalwaysApply: true\n---\n\n${block(id)}\n`, dry); out.push({ file: f }); }
    } else {
      const cur = fs.existsSync(f) ? stripBlock(fs.readFileSync(f, 'utf8')) : '';
      writeText(f, (cur ? cur + '\n\n' : '') + block(id) + '\n', dry); out.push({ file: f });
    }
  }
  if (A.commandFile) { const c = A.commandFile(scope); writeText(c, fs.readFileSync(path.join(ROOT, 'agents', id, 'commands', 'realm.md'), 'utf8'), dry); out.push({ file: c }); }
  return out;
}
function removeDocs(id, scope, dry) {
  const A = AGENTS[id], out = [], f = A.docFile(scope);
  if (f && fs.existsSync(f)) {
    const cur = fs.readFileSync(f, 'utf8');
    if (cur.includes(BLOCK_START)) {
      if (A.docWholeFile) { if (!dry) { fs.rmSync(f); tidy(f); } }
      else { const n = stripBlock(cur); if (!dry && !restoreIfPristine(f, t => t.trim() === n.trim())) { n ? fs.writeFileSync(f, n + '\n') : fs.rmSync(f); } }
      out.push({ file: f });
    }
  }
  if (A.commandFile) { const c = A.commandFile(scope); if (fs.existsSync(c)) { if (!dry) { fs.rmSync(c); tidy(c); } out.push({ file: c }); } }
  return out;
}
function status(id) {
  const A = AGENTS[id], d = detect(id), rows = {};
  for (const scope of ['user', 'project']) rows[scope] = countOurs(A, A.hooksFile(scope));
  return { id, label: A.label, detected: d, hooks: rows };
}

module.exports = { AGENTS, IDS, detect, hookCommand, portable, pathInfo, installHooks, removeHooks, installDocs, removeDocs, status };

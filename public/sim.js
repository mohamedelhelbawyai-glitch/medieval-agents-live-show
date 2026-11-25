'use strict';
// Demo simulator: a cast of fake agents emitting the same events a real agent hook would.
(() => {
const pick = a => a[Math.floor(Math.random() * a.length)];
const CAST = [
  { id: 'lord-1', role: 'governor', name: 'Lord Aldric' },
  { id: 'knight-1', role: 'knight', name: 'Sir Gareth' }, { id: 'knight-2', role: 'knight', name: 'Sir Elara' },
  { id: 'merch-1', role: 'merchant', name: 'Mira' }, { id: 'trader-1', role: 'trader', name: 'Tobias' },
  { id: 'work-1', role: 'worker', name: 'Bran' }, { id: 'work-2', role: 'worker', name: 'Hild' },
  { id: 'farm-1', role: 'farmer', name: 'Edda' }, { id: 'scribe-1', role: 'scribe', name: 'Wulf' }, { id: 'bard-1', role: 'bard', name: 'Lark' },
];
const ACTS = {
  governor: [['Task', 'Dispatching a sub-agent'], ['TodoWrite', 'Updating the royal plan'], ['Task', 'Reviewing council report']],
  knight: [['Bash', 'npm run test'], ['Bash', 'git diff --stat'], ['Bash', 'cargo build --release'], ['Bash', 'docker compose up']],
  merchant: [['WebSearch', '"pixel art tilesets"'], ['WebFetch', 'docs.anthropic.com'], ['WebSearch', '"css grid guide"']],
  trader: [['mcp__github__list_prs', 'Fetching open PRs'], ['mcp__slack__post', 'Posting to #builds'], ['mcp__linear__issue', 'Syncing tickets']],
  worker: [['Edit', 'src/app.ts'], ['Write', 'README.md'], ['Edit', 'styles/main.css'], ['Edit', 'api/routes.py']],
  farmer: [['db_query', 'SELECT * FROM crops'], ['memory_read', 'Sowing training data'], ['data_ingest', 'Harvesting logs.csv']],
  scribe: [['Read', 'docs/ARCHITECTURE.md'], ['Grep', 'TODO in src/'], ['Glob', '**/*.test.ts'], ['Read', 'package.json']],
  bard: [['Notification', 'Singing the status report'], ['Notification', 'Tuning the lute']],
};
let timers = [], on = false;
const later = (fn, ms) => timers.push(setTimeout(fn, ms));
function loop(c) {
  if (!on) return;
  if (Math.random() < .1) { window.Realm.emit({ agent: c.id, name: c.name, role: c.role, status: 'idle', text: 'Taking a break at the tavern' }); return later(() => loop(c), 6000 + Math.random() * 6000); }
  const [tool, text] = pick(ACTS[c.role]);
  window.Realm.emit({ agent: c.id, name: c.name, role: c.role, tool, text, status: 'start' });
  later(() => { window.Realm.emit({ agent: c.id, name: c.name, role: c.role, tool, text, status: Math.random() < .12 ? 'error' : 'done' }); later(() => loop(c), 1500 + Math.random() * 4500); }, 3500 + Math.random() * 3500);
}
window.RealmSim = {
  running: () => on,
  start() { on = true; CAST.forEach((c, i) => later(() => loop(c), i * 900 + Math.random() * 600)); },
  stop() { on = false; timers.forEach(clearTimeout); timers = []; },
};
})();

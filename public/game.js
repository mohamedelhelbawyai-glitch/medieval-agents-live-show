'use strict';
// Agent Realm: pixel medieval town renderer. The map is a pixel-art image; characters and effects are drawn on top.
(() => {
const SC = 0.6, CW = 900, CH = 900;
const SPR = 1.6;   // characters are drawn this much larger than their 20x24 sprite   // the 1500px source image is drawn at 0.6 scale
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

/* ---------------------------------------------------------------- looks & roles */
// A "look" is a sprite family. roles.json maps each agent role to a look (+ recolour), a name and a title.
const LOOKS = {
  governor:     { body: '#a8232f', legs: '#3b2a4a', belt: '#ffd23f', color: '#ff6b7a' },
  knight:       { body: '#8a94a8', legs: '#555d6e', belt: '#3a3f4b', color: '#8fbcff' },
  merchant:     { body: '#7b3a96', legs: '#3d2a4f', belt: '#d9a521', color: '#d78bff' },
  trader:       { body: '#2f7a5a', legs: '#3a3326', belt: '#6b4a2a', color: '#5fe0a0', hat: '#1f5a40' },
  worker:       { body: '#b07a3c', legs: '#5a4630', belt: '#4a3520', color: '#ffb050', hat: '#6b4a2a' },
  farmer:       { body: '#e6dcae', legs: '#4a6fa5', belt: '#8a6a3a', color: '#c8e65a' },
  scribe:       { body: '#3a5cc0', legs: '#2a3a6a', belt: '#d9c27a', color: '#7fd0ff' },
  bard:         { body: '#c8553a', legs: '#3a2a2a', belt: '#e8c15a', color: '#ff9ec0' },
  herald:       { body: '#2b5ea8', legs: '#3a3a4a', belt: '#d9a521', color: '#7fb6ff' },
  judge:        { body: '#26263a', legs: '#1a1a28', belt: '#ffd23f', color: '#c9a6ff' },
  architect:    { body: '#c9a46a', legs: '#5a4630', belt: '#6b4a2a', color: '#ffd89a' },
  steward:      { body: '#5c7a52', legs: '#3a4a34', belt: '#d9a521', color: '#9fe08a' },
  archivist:    { body: '#6a4a8a', legs: '#3a2a4a', belt: '#d9c27a', color: '#d6a8ff' },
  inquisitor:   { body: '#2e2e3c', legs: '#1c1c26', belt: '#8a5a2b', color: '#ffcf70' },
  jester:       { body: '#c0394b', legs: '#2f5fb8', belt: '#ffd23f', color: '#ff8fa0' },
  plaguedoctor: { body: '#2a2a2e', legs: '#1e1e22', belt: '#8a5a2b', color: '#9ad0b0' },
  alchemist:    { body: '#2f7a86', legs: '#2a4a52', belt: '#8a5a2b', color: '#7fe0d0' },
};
const LOC_LOOK = { castle: 'governor', library: 'scribe', forge: 'worker', barracks: 'knight', market: 'merchant', docks: 'trader', farm: 'farmer', tavern: 'bard', chapel: 'scribe', arena: 'knight', stands: 'bard', theatre: 'bard', audience: 'bard' };
const FIRST = ['Aldric','Brenna','Cedric','Dagny','Edmund','Freya','Gareth','Hild','Ivo','Jorah','Kenna','Leofric','Mira','Nedd','Osric','Petra','Rolf','Sybil','Tobias','Ulric','Wulf','Yara','Edda','Bran'];
const fallbackName = (id, look) => { const f = FIRST[hash(id) % FIRST.length]; return look === 'governor' ? 'Lord ' + f : look === 'knight' ? 'Sir ' + f : f; };
let ROLEDEF = {};   // role id -> {name,title,look,body,accent,home,tasks}

/* ---------------------------------------------------------------- map data */
// The map is a 1500x1500 pixel-art town image (assets/town.jpg) drawn at 0.6 scale.
// All coordinates below are in SOURCE image pixels (feet positions for slots); SC converts to canvas pixels.
const ROADS = [   // walkable network: [x, y] points, consecutive points are connected
  [[750,1440],[750,1210],[750,1060],[750,830],[750,697],[750,347],[750,70]],       // main avenue, south gate to north gate
  [[249,697],[425,697],[750,697],[1065,697],[1260,697]],                            // street in front of the town hall and the inn
  [[249,347],[750,347],[1260,347]],                                                 // top ring road
  [[249,347],[249,697],[249,760],[249,1210]],                                       // west ring road
  [[1260,347],[1260,697],[1260,760],[1260,1210]],                                   // east ring road
  [[249,1210],[430,1210],[750,1210],[905,1210],[1100,1210],[1260,1210]],            // south ring road
  [[30,760],[249,760]],                                                             // west bridge
  [[1470,760],[1260,760]],                                                          // east bridge
];
// slot = [x, y, facing]  (facing -1 left, 1 right, omitted = keep walking direction)
const LOC = {
  castle:   { name: 'TOWN HALL',      node: '425,697',  label: [425, 600],  slots: [[385,672],[425,677],[465,672],[395,702],[455,702]] },
  library:  { name: 'LIBRARY',        node: '1260,347', label: [1295, 412], slots: [[1222,367],[1262,377],[1300,380],[1335,364]] },
  forge:    { name: 'FORGE',          node: '1100,1210',label: [1115, 1160],slots: [[1060,1190],[1100,1196],[1140,1190],[1180,1186]] },
  barracks: { name: 'BARRACKS',       node: '905,1210', label: [935, 1262], slots: [[860,1195],[905,1201],[950,1195],[995,1190]] },
  tavern:   { name: 'INN',            node: '1065,697', label: [1075, 520], slots: [[1010,663],[1050,668],[1095,668],[1135,663]] },
  market:   { name: 'MARKET',         node: '750,1060', label: [1010, 985], slots: [[800,1000],[825,1040],[795,1090],[830,1125]] },
  farm:     { name: 'FARM',           node: '430,1210', label: [430, 1275], slots: [[370,1236],[420,1242],[470,1242],[520,1236]] },
  docks:    { name: 'EAST GATE',      node: '1260,760', label: [1400, 720], slots: [[1325,748],[1365,778],[1405,748],[1350,793]] },
  chapel:   { name: 'CHAPEL',         node: '249,347',  label: [262, 372],  slots: [[222,342],[258,340],[292,344]] },
  arena:    { name: 'ARENA FIGHT',    node: '425,697',  label: [425, 858],  slots: [[298,765,-1],[552,765,1],[360,822,1],[490,822,-1]] },
  stands:   { name: 'WATCHING FIGHT', node: '425,697',  slots: [[215,712,1],[253,719,1],[600,705,-1],[560,712,-1],[215,752,1],[255,805,1],[610,750,-1],[600,805,-1]] },
  theatre:  { name: 'ON STAGE',       node: '1065,697', label: [1065, 905], slots: [[1015,856],[1065,860],[1115,856]] },
  audience: { name: 'WATCHING SHOW',  node: '1065,697', slots: [[950,712,1],[985,729,1],[1145,729,-1],[1180,712,-1],[940,772,1],[1190,772,-1],[985,822,1],[1150,825,-1]] },
};
const REST = ['tavern', 'chapel', 'stands', 'audience'];   // where idle agents spend their breaks
const GATE = '750,1440';
const LIGHTS = [[350,555,34],[495,555,34],[425,430,40],[985,600,30],[1170,600,30],[1290,185,40],[250,205,34],[740,1000,22]];   // glow at night
const nodes = new Map();
const nk = (x, y) => x + ',' + y;
function addNode(x, y) { const k = nk(x, y); if (!nodes.has(k)) nodes.set(k, { x, y, adj: new Set() }); return nodes.get(k); }
for (const line of ROADS) for (let i = 0; i < line.length; i++) {
  const [x, y] = line[i]; addNode(x, y);
  if (i) { const [px, py] = line[i - 1]; addNode(px, py).adj.add(nk(x, y)); addNode(x, y).adj.add(nk(px, py)); }
}
for (const [id, L] of Object.entries(LOC)) if (!nodes.has(L.node)) console.warn('agent-realm: place "' + id + '" uses a node that is not on a road: ' + L.node);
function bfs(from, to) {
  const prev = new Map([[from, null]]), q = [from];
  while (q.length) { const c = q.shift(); if (c === to) break; for (const n of nodes.get(c).adj) if (!prev.has(n)) { prev.set(n, c); q.push(n); } }
  const out = []; for (let c = to; c; c = prev.get(c)) out.unshift(c); return out;
}
const nodePx = k => { const n = nodes.get(k); return [n.x * SC, n.y * SC]; };

/* ---------------------------------------------------------------- static map (the image) */
const stat = document.createElement('canvas'); stat.width = CW; stat.height = CH;
const sg = stat.getContext('2d');
sg.fillStyle = '#4a8338'; sg.fillRect(0, 0, CW, CH);
const townImg = new Image();
townImg.onload = () => { sg.imageSmoothingEnabled = true; sg.imageSmoothingQuality = 'high'; sg.drawImage(townImg, 0, 0, CW, CH); };
townImg.src = 'assets/town.jpg';

/* ---------------------------------------------------------------- sprites */
const sprites = {};
function makeSprite(look, pal, frame) {
  const c = document.createElement('canvas'); c.width = 20; c.height = 24; const g = c.getContext('2d');
  const r = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x + 2, y + 1, w, h); };
  const S = { ...LOOKS[look] }; if (pal.body) S.body = pal.body;
  const acc = pal.accent, skin = '#f1c9a0', dark = '#2b2118', step = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  r(3, 19, 10, 3, 'rgba(0,0,0,.28)');
  const lh = step === 1 ? 3 : 4, rh = step === -1 ? 3 : 4;
  r(5, 16, 2, lh, S.legs); r(9, 16, 2, rh, S.legs); r(5, 16 + lh, 3, 1, dark); r(9, 16 + rh, 3, 1, dark);
  r(4, 9, 8, 7, S.body); r(4, 13, 8, 1, S.belt); r(4, 9, 8, 1, 'rgba(255,255,255,.18)'); r(4, 15, 8, 1, 'rgba(0,0,0,.18)');
  r(3, 10 + (step === 1 ? 1 : 0), 1, 5, S.body); r(12, 10 + (step === -1 ? 1 : 0), 1, 5, S.body);
  r(3, 15 + (step === 1 ? 1 : 0), 1, 1, skin); r(12, 15 + (step === -1 ? 1 : 0), 1, 1, skin);
  r(5, 3, 6, 6, skin); r(6, 5, 1, 2, dark); r(9, 5, 1, 2, dark); r(5, 8, 6, 1, 'rgba(0,0,0,.12)');
  switch (look) {
    case 'knight': r(4, 2, 8, 3, '#b7c0cf'); r(4, 2, 8, 1, '#e0e6ee'); r(4, 5, 1, 3, '#b7c0cf'); r(11, 5, 1, 3, '#b7c0cf'); r(7, 5, 2, 2, '#9aa4b4'); r(7, 0, 2, 2, '#c0392b'); r(8, 0, 1, 1, '#e8584a');
      r(0, 10, 4, 6, acc || '#2f5fb8'); r(1, 10, 1, 6, '#f0d060'); r(0, 12, 4, 1, '#f0d060'); r(13, 5, 1, 9, '#e6e6ee'); r(12, 13, 3, 1, '#c9a227'); r(13, 14, 1, 2, '#6b4a2a'); break;
    case 'merchant': r(2, 3, 12, 1, '#d9a521'); r(4, 1, 8, 2, '#d9a521'); r(10, 0, 1, 2, '#c0392b'); r(4, 3, 8, 1, '#8a6a10'); r(11, 13, 3, 3, '#c9a227'); r(12, 12, 1, 1, '#6b4a2a'); r(4, 15, 8, 1, S.body); break;
    case 'trader': r(4, 2, 8, 3, S.hat); r(4, 5, 1, 3, S.hat); r(11, 5, 1, 3, S.hat); r(0, 9, 4, 7, '#8a5a2b'); r(0, 9, 4, 1, '#c9a06a'); r(0, 12, 4, 1, '#5a3a1e'); r(13, 2, 1, 16, '#6b4a2a'); r(12, 1, 3, 2, '#c9a227'); break;
    case 'worker': r(4, 2, 8, 2, S.hat); r(3, 4, 10, 1, S.hat); r(5, 11, 6, 5, '#d8c9a8'); r(13, 9, 1, 7, '#6b4a2a'); r(12, 8, 3, 2, '#8d939c'); break;
    case 'farmer': r(1, 3, 14, 1, '#e2c44e'); r(4, 1, 8, 2, '#e2c44e'); r(4, 3, 8, 1, '#b3402a'); r(5, 11, 6, 5, '#4a6fa5'); r(5, 9, 1, 3, '#4a6fa5'); r(10, 9, 1, 3, '#4a6fa5');
      r(13, 3, 1, 14, '#6b4a2a'); r(12, 2, 1, 3, '#aaa'); r(13, 2, 1, 1, '#aaa'); r(14, 2, 1, 3, '#aaa'); break;
    case 'governor': r(4, 2, 8, 2, '#3a2a1a'); r(5, 1, 6, 2, '#ffd23f'); r(5, 0, 1, 1, '#ffd23f'); r(7, 0, 2, 1, '#ffd23f'); r(10, 0, 1, 1, '#ffd23f'); r(8, 1, 1, 1, '#c0392b');
      r(5, 7, 6, 3, '#f0f0f0'); r(6, 6, 4, 1, '#f0f0f0'); r(4, 9, 8, 1, '#f4f4f4'); r(7, 10, 2, 6, '#ffd23f'); r(13, 5, 1, 11, '#c9a227'); r(12, 3, 3, 3, '#ffd23f'); r(13, 4, 1, 1, '#c0392b'); break;
    case 'scribe': r(4, 3, 8, 1, S.body); r(5, 2, 6, 1, S.body); r(6, 1, 4, 1, S.body); r(7, 0, 2, 1, S.body); r(8, 2, 1, 1, '#ffd23f'); r(3, 4, 10, 1, '#2d4a9e');
      r(12, 11, 4, 5, '#7a3b2e'); r(12, 11, 4, 1, '#e8d8a8'); r(13, 12, 2, 1, '#e8d8a8'); break;
    case 'bard': r(4, 2, 8, 2, '#c0392b'); r(3, 4, 10, 1, '#c0392b'); r(11, 0, 1, 3, '#f5f5f5'); r(12, 11, 4, 5, '#a0652f'); r(13, 12, 2, 2, '#4a2f17'); r(15, 6, 1, 6, '#6b4a2a'); break;
    case 'herald': r(4, 2, 8, 2, '#1e3f78'); r(3, 4, 10, 1, '#1e3f78'); r(11, 0, 1, 3, acc || '#d9a521'); r(7, 9, 2, 7, acc || '#d9a521'); r(7, 11, 2, 2, '#c0392b');
      r(12, 9, 3, 2, '#d9a521'); r(14, 8, 2, 1, '#d9a521'); r(15, 7, 1, 1, '#d9a521'); r(12, 11, 1, 1, '#a07a10'); break;
    case 'judge': r(4, 2, 8, 3, '#f2f2f2'); r(4, 5, 1, 3, '#f2f2f2'); r(11, 5, 1, 3, '#f2f2f2'); r(3, 4, 1, 3, '#d8d8d8'); r(12, 4, 1, 3, '#d8d8d8');
      r(5, 9, 6, 1, acc || '#ffd23f'); r(7, 10, 2, 3, acc || '#ffd23f'); r(4, 15, 8, 1, '#f2f2f2'); r(13, 11, 1, 4, '#6b4a2a'); r(12, 10, 3, 2, '#6b4a2a'); break;
    case 'architect': r(3, 2, 10, 2, acc || '#8a4a2a'); r(5, 1, 6, 1, acc || '#8a4a2a'); r(11, 10, 5, 3, '#8ac0ff'); r(11, 10, 5, 1, '#ffffff'); r(13, 5, 1, 9, '#c9a227'); r(12, 4, 3, 1, '#c9a227'); r(12, 13, 1, 2, '#c9a227'); r(14, 13, 1, 2, '#c9a227'); break;
    case 'steward': r(4, 2, 8, 2, '#4a6a42'); r(3, 4, 10, 1, '#4a6a42'); r(12, 10, 4, 6, '#4a3520'); r(12, 10, 4, 1, '#e8d8a8'); r(13, 12, 2, 1, '#9fe08a'); r(13, 14, 2, 1, '#9fe08a'); r(10, 13, 2, 3, '#d9a521'); break;
    case 'archivist': r(4, 2, 8, 2, '#4a2f66'); r(7, 0, 3, 2, '#4a2f66'); r(5, 5, 6, 1, '#c9a227'); r(5, 4, 2, 2, '#9ad0ff'); r(9, 4, 2, 2, '#9ad0ff'); r(13, 8, 1, 8, '#d9a521'); r(12, 8, 3, 2, '#d9a521'); r(12, 15, 1, 1, '#d9a521'); r(14, 14, 2, 2, '#8a5a2b'); break;
    case 'inquisitor': r(4, 2, 8, 6, '#1a1a24'); r(6, 4, 4, 3, skin); r(6, 5, 1, 2, dark); r(9, 5, 1, 2, dark); r(4, 8, 8, 1, '#1a1a24');
      r(13, 11, 3, 4, '#ffd23f'); r(13, 10, 3, 1, '#555'); r(14, 9, 1, 1, '#555'); r(12, 11, 1, 4, '#555'); r(14, 12, 1, 2, '#fff7c0'); break;
    case 'jester': r(8, 9, 4, 7, acc || '#2f5fb8'); r(2, 2, 4, 2, '#c0392b'); r(1, 0, 2, 3, '#c0392b'); r(10, 2, 4, 2, acc || '#2f5fb8'); r(12, 0, 2, 3, acc || '#2f5fb8'); r(5, 3, 6, 1, '#ffd23f'); r(1, 0, 1, 1, '#ffd23f'); r(13, 0, 1, 1, '#ffd23f');
      r(13, 6, 1, 10, '#6b4a2a'); r(12, 4, 3, 3, '#ffd23f'); r(13, 5, 1, 1, '#c0392b'); break;
    case 'plaguedoctor': r(2, 3, 12, 1, '#1a1a1a'); r(4, 1, 8, 2, '#1a1a1a'); r(5, 3, 6, 5, '#cdbd9a'); r(10, 5, 4, 2, '#cdbd9a'); r(13, 6, 1, 1, '#a89a78'); r(6, 4, 2, 2, '#bfe8ff'); r(4, 15, 8, 2, S.body); r(13, 3, 1, 14, '#6b4a2a'); r(12, 3, 3, 1, '#c9a227'); break;
    case 'alchemist': r(4, 2, 8, 2, '#2a4a52'); r(3, 4, 10, 1, '#2a4a52'); r(5, 4, 6, 2, '#8a5a2b'); r(6, 4, 2, 2, '#9ad0ff'); r(9, 4, 2, 2, '#9ad0ff');
      r(12, 11, 3, 4, '#9a5fe0'); r(13, 9, 1, 2, '#ccc'); r(12, 11, 3, 1, '#d8b8ff'); r(4, 15, 8, 1, '#2a4a52'); break;
  }
  const id = g.getImageData(0, 0, 20, 24), d = id.data, A = (x, y) => (x < 0 || y < 0 || x > 19 || y > 23) ? 0 : d[(y * 20 + x) * 4 + 3];
  g.fillStyle = '#1a120b';
  for (let y = 0; y < 24; y++) for (let x = 0; x < 20; x++) if (A(x, y) < 200 && (A(x - 1, y) >= 200 || A(x + 1, y) >= 200 || A(x, y - 1) >= 200 || A(x, y + 1) >= 200)) g.fillRect(x, y, 1, 1);
  return c;
}
function getSprite(a, frame) { const k = a.look + (a.pal.body || '') + (a.pal.accent || '') + frame; return sprites[k] || (sprites[k] = makeSprite(a.look, a.pal, frame)); }

/* ---------------------------------------------------------------- agents */
const agents = new Map();
const particles = [];
const stats = { events: 0, errors: 0 };
const overlay = $('#overlay');
const now = () => performance.now() / 1000;
let fightOn = false, showOn = false;   // is anyone fighting in the arena / performing on stage right now?

const TEST_RE = /\b(test|tests|jest|pytest|vitest|mocha|rspec|phpunit|xctest|e2e)\b/i;
const DEPLOY_RE = /\b(deploy|docker push|kubectl|helm|terraform apply|vercel|netlify|git push|npm publish|firebase deploy)\b/i;
const BUILD_RE = /\b(build|compile|make|assemble|webpack|tsc)\b/i;
function toolLoc(t, text) {
  t = (t || '').toLowerCase(); if (!t) return null;
  if (t.startsWith('mcp__')) return 'docks';
  if (/^(read|grep|glob|ls|notebookread)$/.test(t)) return 'library';
  if (/^(edit|write|multiedit|notebookedit)$/.test(t)) return 'forge';
  if (t === 'bash' || t === 'shell') { const c = text || ''; return TEST_RE.test(c) ? 'arena' : DEPLOY_RE.test(c) ? 'docks' : BUILD_RE.test(c) ? 'forge' : 'barracks'; }
  if (/web/.test(t)) return 'market';
  if (/^(task|agent|todowrite|exitplanmode|plan)/.test(t)) return 'castle';
  if (/db|sql|data|memory|query|ingest/.test(t)) return 'farm';
  if (/notif|stop|idle|chat|message/.test(t)) return pickRest();
  return 'castle';
}
function pickRest() {
  const w = { tavern: 1, chapel: 1, stands: fightOn ? 4 : 1, audience: showOn ? 4 : 1 }; let r = Math.random() * (w.tavern + w.chapel + w.stands + w.audience);
  for (const k of REST) if ((r -= w[k]) < 0) return k; return 'tavern';
}

function spawn(id, ev, loc) {
  const rid = String(ev.role || '').slice(0, 40), def = ROLEDEF[rid];
  let look, pal, name, title, home = null;
  if (def) { look = LOOKS[def.look] ? def.look : 'knight'; pal = { body: def.body, accent: def.accent }; name = def.name; title = def.title || ''; home = def.home; }
  else { look = LOOKS[rid] ? rid : (LOC_LOOK[loc] || 'merchant'); pal = {}; name = fallbackName(id, look); title = ''; }
  if (ev.name) name = String(ev.name).slice(0, 24);
  if (rid === 'orchestrator' && ev.project) title = String(ev.project).slice(0, 20);
  const color = LOOKS[look].color;
  const el = document.createElement('div'); el.className = 'ag';
  const nm = document.createElement('div'); nm.className = 'nm'; nm.style.color = color;
  const n1 = document.createElement('span'); n1.textContent = name; nm.append(n1);
  if (title) { const n2 = document.createElement('span'); n2.className = 't'; n2.textContent = title; nm.append(n2); }
  const bub = document.createElement('div'); bub.className = 'bub';
  el.append(bub, nm); overlay.append(el);
  const [x, y] = nodePx(GATE);
  const a = { id, rid, look, pal, color, name, title, home, x, y, path: [], node: GATE, loc: null, slot: null, slotFace: 0, state: 'idle', busy: false, busyUntil: 0, hold: false, holdUntil: 0, facing: 1,
    anim: Math.random() * 9, lastEvent: now(), status: 'idle', text: '', task: '', tool: '', taskStart: 0, el, bub, bubUntil: 0, partT: 0, leaving: false };
  agents.set(id, a); return a;
}

function goTo(a, loc) {
  const L = LOC[loc]; if (!L) return;
  a.loc = loc; a.leaving = false;
  const taken = new Set([...agents.values()].filter(o => o !== a && o.loc === loc && o.slot).map(o => o.slot));
  const free = L.slots.filter(s => !taken.has(s.join()));
  const s = (free.length ? free : L.slots)[Math.floor(Math.random() * (free.length || L.slots.length))];
  a.slot = s[0] + ',' + s[1]; a.slotFace = s[2] || 0;
  if (a.path.length && a.path[a.path.length - 1].slot) a.path.pop();
  else if (!a.path.length) a.path.push(nodePx(a.node));
  for (const k of bfs(a.node, L.node).slice(1)) a.path.push(nodePx(k));
  a.node = L.node;
  const p = [s[0] * SC + rand(-3, 3), s[1] * SC + rand(-1, 1)]; p.slot = true; a.path.push(p);
}

function say(a, text, status, secs, label) {
  a.bub.className = 'bub on ' + status; a.bub.textContent = '';
  const tag = label || (status === 'done' ? 'DONE' : status === 'error' ? 'FAILED' : '');
  if (tag) { const b = document.createElement('b'); b.textContent = tag; a.bub.append(b); }
  a.bub.append(document.createTextNode(text.slice(0, 48))); a.bubUntil = now() + secs;
}

function burst(x, y, col, n, spread = 1) { for (let i = 0; i < n; i++) particles.push({ x, y, vx: rand(-20, 20) * spread, vy: rand(-45, -15), life: 0, max: rand(.5, 1.1), col, s: Math.random() < .3 ? 2 : 1, g: 70 }); }

function emit(ev) {
  if (!ev || typeof ev !== 'object') return;
  const id = String(ev.agent || 'unknown').slice(0, 40);
  const status = ['start', 'done', 'error', 'idle'].includes(ev.status) ? ev.status : 'start';
  const tool = String(ev.tool || '').slice(0, 60), text = String(ev.text || tool || '...').slice(0, 120);
  const report = ev.activity === 'report', def = ROLEDEF[String(ev.role || '')];
  let loc = LOC[ev.location] ? ev.location : null;
  if (!loc) loc = report ? 'theatre' : status === 'idle' ? pickRest() : (toolLoc(tool, text) || (def && def.home) || 'castle');
  const a = agents.get(id) || spawn(id, ev, loc);
  const t = now();
  a.lastEvent = t; a.status = status; a.text = text;
  if (status === 'start' && (a.task !== text || !a.taskStart || !isRunning(a))) { a.task = text; a.taskStart = t; a.tool = tool; }
  if (ev.hold === true) { a.hold = true; } else if (ev.hold === false || status === 'idle') a.hold = false;
  if (a.hold) a.holdUntil = t + 600;
  a.busy = status === 'start' || report; a.busyUntil = t + (report ? 8 : a.hold ? 600 : 10);
  if (a.loc !== loc || a.leaving) goTo(a, loc);
  say(a, text, status === 'idle' ? 'start' : status, report ? 6 : status === 'start' ? 6 : 3.5, report ? 'REPORT' : '');
  if (status === 'done') burst(a.x, a.y - 14, '#ffd23f', 8);
  if (status === 'error') { burst(a.x, a.y - 14, '#e5484d', 10); stats.errors++; }
  if (report) burst(a.x, a.y - 14, '#ff9ec0', 8);
  stats.events++;
  logEvent(a, text, report ? 'report' : status);
  $('#empty').classList.add('hide');
}

const LOCATION_FX = { forge: ['#ff9a2a', 0.12], barracks: ['#ffffff', 0.4], library: ['#7fd0ff', 0.45], market: ['#ffd23f', 0.5], farm: ['#8fd070', 0.4], docks: ['#9fd0ff', 0.35],
  castle: ['#ffd23f', 0.7], tavern: ['#ff9ec0', 0.8], arena: ['#ffffff', 0.14], theatre: ['#ff9ec0', 0.4] };

function updateAgent(a, dt, t) {
  a.anim += dt;
  if (a.path.length) {
    const p = a.path[0], dx = p[0] - a.x, dy = p[1] - a.y, d = Math.hypot(dx, dy), step = 70 * dt;
    if (d <= step) { a.x = p[0]; a.y = p[1]; a.path.shift(); } else { a.x += dx / d * step; a.y += dy / d * step; if (Math.abs(dx) > .5) a.facing = dx > 0 ? 1 : -1; }
    a.state = 'walking';
  } else {
    if (a.leaving) { a.el.remove(); agents.delete(a.id); return; }
    a.state = a.busy ? 'working' : 'idle';
    if (a.slotFace) a.facing = a.slotFace;   // face the dummy, the partner, the stage or the fight
  }
  if (a.busy && t > a.busyUntil) a.busy = false;
  if (a.hold && t > a.holdUntil) a.hold = false;
  const idleFor = t - a.lastEvent;
  if (!a.leaving && !a.hold && idleFor > 16 && !REST.includes(a.loc) && !a.path.length) { a.busy = false; goTo(a, pickRest()); }
  if (!a.leaving && !a.hold && idleFor > 120) { a.leaving = true; a.loc = null; a.slot = null; if (a.path.length && a.path[a.path.length - 1].slot) a.path.pop(); else if (!a.path.length) a.path.push(nodePx(a.node)); for (const k of bfs(a.node, GATE).slice(1)) a.path.push(nodePx(k)); a.node = GATE; }
  a.cheer = a.state === 'idle' && ((a.loc === 'stands' && fightOn) || (a.loc === 'audience' && showOn));
  const fx = a.state === 'working' ? LOCATION_FX[a.loc] : a.cheer ? ['#ffd23f', 0.8] : null;
  if (fx) { a.partT -= dt; if (a.partT <= 0) { a.partT = fx[1] * rand(.7, 1.3); burst(a.x + (a.cheer ? 0 : a.facing * 8), a.y - (a.cheer ? 20 : 6), fx[0], a.cheer ? 1 : 2, .7); } }
  if (a.bubUntil && t > a.bubUntil) { a.bub.classList.remove('on'); a.bubUntil = 0; }
}

function drawAgent(a) {
  let frame = 0, bob = 0;
  if (a.state === 'walking') frame = [1, 0, 2, 0][Math.floor(a.anim * 8) % 4];
  else if (a.state === 'working') { frame = Math.floor(a.anim * (a.loc === 'arena' ? 7 : 5)) % 2 ? 1 : 0; bob = frame ? -1 : 0; }
  else if (a.cheer) bob = Math.floor(a.anim * 4) % 2 ? -2 : 0;
  else bob = Math.sin(a.anim * 2) > .6 ? -1 : 0;
  const spr = getSprite(a, frame), x = Math.round(a.x), y = Math.round(a.y + bob);
  ctx.save(); ctx.translate(x, y - 21 * SPR); ctx.scale(a.facing < 0 ? -SPR : SPR, SPR);
  ctx.drawImage(spr, -10, 0); ctx.restore();
}

/* ---------------------------------------------------------------- render */
const cv = $('#stage'); cv.width = CW; cv.height = CH;
const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
const DEBUG = /[?&]debug\b/.test(location.search);
let last = 0;

function drawLabel(text, cx, y) {
  ctx.font = '8px "Press Start 2P", monospace'; const w = Math.ceil(ctx.measureText(text).width) + 6, x = Math.round(cx - w / 2);
  R(ctx, x, y, w, 11, '#3a2814'); R(ctx, x + 1, y + 1, w - 2, 9, '#a8763a'); R(ctx, x + 1, y + 1, w - 2, 1, '#c4905a');
  ctx.fillStyle = '#2b1a0a'; ctx.textBaseline = 'top'; ctx.fillText(text, x + 4, y + 2);
}
function dummy(x, y) {   // straw training dummy, (x, y) = feet in canvas px
  R(ctx, x - 5, y, 10, 3, 'rgba(0,0,0,.25)'); R(ctx, x - 1, y - 22, 2, 22, '#6b4a2a'); R(ctx, x - 8, y - 17, 16, 3, '#6b4a2a');
  R(ctx, x - 6, y - 15, 12, 9, '#d9b86a'); R(ctx, x - 4, y - 13, 8, 5, '#c0394b'); R(ctx, x - 2, y - 11, 4, 1, '#fff'); R(ctx, x - 4, y - 25, 8, 7, '#d9b86a'); R(ctx, x - 4, y - 22, 8, 1, '#a88a3a');
}
function banner(x, y, c1, c2, t) {   // pennant pole that flutters
  R(ctx, x, y - 30, 2, 30, '#5a4630');
  for (let i = 0; i < 12; i++) R(ctx, x + 2 + i, y - 29 + Math.round(Math.sin(t * 5 - i * .5) * 1.5), 1, 9 - Math.floor(i * .6), i % 4 < 2 ? c1 : c2);
}
function arenaProps(t) {   // a tournament is on: training dummies, banners and a rope line appear
  for (const [x, y] of [[262, 770], [592, 770]]) dummy(x * SC, y * SC);
  banner(300 * SC, 690 * SC, '#c0394b', '#ffd23f', t); banner(550 * SC, 690 * SC, '#2f5fb8', '#ffd23f', t);
}
function showProps(t) {   // a show is on: a small wooden stage with curtains and bunting
  const x = 1065 * SC, y = 872 * SC;
  R(ctx, x - 56, y - 14, 112, 18, '#b8864a'); R(ctx, x - 56, y - 14, 112, 2, '#d7a56a'); R(ctx, x - 56, y + 2, 112, 4, '#6b4423');
  for (let i = 0; i < 112; i += 8) R(ctx, x - 56 + i, y - 12, 1, 14, '#8a5e2e');
  R(ctx, x - 56, y - 44, 6, 32, '#4a2f17'); R(ctx, x + 50, y - 44, 6, 32, '#4a2f17'); R(ctx, x - 56, y - 46, 112, 6, '#a8232f');
  for (let i = 0; i < 112; i += 8) R(ctx, x - 56 + i, y - 40, 5, 4, i % 16 ? '#ffd23f' : '#c0394b');
  banner(x - 80, y - 4, '#7b3a96', '#ffd23f', t); banner(x + 76, y - 4, '#2f7a5a', '#ffd23f', t);
}
function drawDebug() {
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,40,40,.9)'; ctx.fillStyle = '#f33';
  for (const n of nodes.values()) { for (const k of n.adj) { const m = nodes.get(k); ctx.beginPath(); ctx.moveTo(n.x * SC, n.y * SC); ctx.lineTo(m.x * SC, m.y * SC); ctx.stroke(); } ctx.fillRect(n.x * SC - 3, n.y * SC - 3, 6, 6); }
  ctx.font = '7px monospace';
  for (const [id, L] of Object.entries(LOC)) { ctx.fillStyle = '#0ff'; for (const s of L.slots) ctx.fillRect(s[0] * SC - 2, s[1] * SC - 2, 4, 4); ctx.fillStyle = '#ff0'; ctx.fillText(id, L.slots[0][0] * SC + 4, L.slots[0][1] * SC + 10); }
}

function frame(ms) {
  const t = ms / 1000, dt = Math.min(.5, t - last); last = t;
  ctx.drawImage(stat, 0, 0);
  if (fightOn) arenaProps(t);
  if (showOn) showProps(t);
  if (fontsOk() || t > 3) for (const L of Object.values(LOC)) if (L.label) drawLabel(L.name === 'ARENA FIGHT' ? 'ARENA' : L.name === 'ON STAGE' ? 'THEATRE' : L.name, L.label[0] * SC, L.label[1] * SC);
  const list = [...agents.values()];
  fightOn = list.some(o => o.loc === 'arena' && o.state === 'working'); showOn = list.some(o => o.loc === 'theatre' && o.state === 'working');
  for (const a of list) updateAgent(a, dt, t);
  list.sort((p, q) => p.y - q.y);
  for (const a of list) drawAgent(a);
  for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.life += dt; if (p.life > p.max) { particles.splice(i, 1); continue; }
    p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; ctx.globalAlpha = 1 - p.life / p.max; R(ctx, p.x, p.y, p.s, p.s, p.col); ctx.globalAlpha = 1; }
  // day / night
  const cycle = 300, hour = (9 + (t / cycle) * 24) % 24, day = 1 + Math.floor((9 + (t / cycle) * 24) / 24);
  const dark = 0.5 + 0.5 * Math.cos(2 * Math.PI * (hour - 1) / 24);
  if (dark > .05) { ctx.fillStyle = `rgba(12,16,50,${(dark * .5).toFixed(3)})`; ctx.fillRect(0, 0, CW, CH); }
  if (dark > .3) for (const [sx, sy, sr] of LIGHTS) { const x = sx * SC, y = sy * SC, r = sr * SC * 1.6; const g = ctx.createRadialGradient(x, y, 0, x, y, r); const f = (dark - .3) * 1.2 * (0.85 + 0.15 * Math.sin(t * 9 + x)); g.addColorStop(0, `rgba(255,200,90,${(.5 * f).toFixed(3)})`); g.addColorStop(1, 'rgba(255,200,90,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
  if (DEBUG) drawDebug();
  for (const a of list) { a.el.style.left = (a.x / CW * 100) + '%'; a.el.style.top = (a.y / CH * 100) + '%'; a.el.style.zIndex = Math.floor(a.y); }
  const hh = String(Math.floor(hour)).padStart(2, '0'), mm = String(Math.floor((hour % 1) * 60)).padStart(2, '0');
  if (!frame.lastClock || t - frame.lastClock > .5) { $('#clock').textContent = `DAY ${day}  ${hh}:${mm}`; frame.lastClock = t; refreshUi(); }
  requestAnimationFrame(frame);
}
const fontsOk = () => document.fonts && document.fonts.check('8px "Press Start 2P"');

/* ---------------------------------------------------------------- UI */
const logs = [];                       // every event, newest last (kept even while the Logs view is closed)
let view = null;                       // null = menu, else 'logs' | 'tasks' | 'agents'
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const fmtTime = s => { s = Math.max(0, Math.floor(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const placeName = a => a.leaving ? 'LEAVING' : a.state === 'walking' ? 'ON THE ROAD' : (LOC[a.loc] ? LOC[a.loc].name : '');

function logRow(l) {
  const d = el('div', 'ev ' + l.status);
  d.append(el('time', '', l.time));
  const who = el('b', '', l.name + ' '); who.style.color = l.color; who.style.fontWeight = 'normal';
  d.append(who, el('span', '', (l.status === 'done' ? 'finished: ' : l.status === 'error' ? 'FAILED: ' : l.status === 'report' ? 'reports: ' : l.status === 'idle' ? 'rests: ' : '') + l.text));
  return d;
}
function logEvent(a, text, status) {
  const l = { time: new Date().toTimeString().slice(0, 8), name: a.name, color: a.color, status, text };
  logs.push(l); if (logs.length > 300) logs.shift();
  if (view === 'logs') {
    const box = $('#log'), stick = box.scrollTop + box.clientHeight >= box.scrollHeight - 30;
    box.append(logRow(l)); while (box.children.length > 300) box.firstChild.remove();
    if (stick) box.scrollTop = box.scrollHeight;
  }
}

function statusOf(a) {
  if (a.leaving) return ['LEAVING', 'idle'];
  if (a.status === 'error' && a.busy === false && now() - a.lastEvent < 8) return ['FAILED', 'failed'];
  if (a.state === 'walking') return ['TRAVELING', 'walking'];
  if (a.loc === 'theatre' && a.busy) return ['REPORTING', 'reporting'];
  if (a.state === 'working') return ['WORKING', 'working'];
  if (a.hold) return ['ON DUTY', 'duty'];
  if (REST.includes(a.loc)) return ['RESTING', 'resting'];
  return ['IDLE', 'idle'];
}
const isRunning = a => (a.status === 'start' && a.busy) || a.hold;

function renderTasks(body) {
  const list = [...agents.values()].filter(isRunning).sort((p, q) => p.taskStart - q.taskStart);
  if (!list.length) { body.append(el('div', 'empty', 'No tasks running. The town is quiet.')); return; }
  const t = now();
  for (const a of list) {
    const c = el('div', 'card'); c.style.setProperty('--c', a.color);
    const top = el('div', 'top'); top.append(el('span', 'nm2', a.name + (a.title ? ' · ' + a.title : '')), el('span', 'pill working', fmtTime(t - a.taskStart)));
    c.append(top, el('div', 'txt', a.task || a.text || '...'), el('div', 'meta', (a.tool ? a.tool.toUpperCase() + ' · ' : '') + placeName(a)));
    body.append(c);
  }
}
function renderAgents(body) {
  const list = [...agents.values()];
  if (!list.length) { body.append(el('div', 'empty', 'No agents in the realm yet.')); return; }
  for (const a of list) {
    const [label, cls] = statusOf(a), c = el('div', 'card'); c.style.setProperty('--c', a.color);
    const top = el('div', 'top'); top.append(el('span', 'nm2', a.name + (a.title ? ' · ' + a.title : '')), el('span', 'pill ' + cls, label));
    c.append(top, el('div', 'txt', a.text || 'Waiting for work'), el('div', 'meta', placeName(a) + ' · last activity ' + fmtTime(now() - a.lastEvent) + ' ago'));
    body.append(c);
  }
}

function showView(name) {
  view = name;
  $('#menu').hidden = !!name; $('#view').hidden = !name;
  if (!name) return;
  $('#viewTitle').textContent = name.toUpperCase();
  const body = $('#viewBody'); body.textContent = '';
  if (name === 'logs') {
    const box = el('div'); box.id = 'log'; body.append(box);
    if (!logs.length) box.append(el('div', 'empty', 'Nothing has happened yet.'));
    for (const l of logs) box.append(logRow(l));
    box.scrollTop = box.scrollHeight;
  } else refreshUi(true);
}
function refreshUi(force) {
  $('#sAgents').textContent = agents.size; $('#sEvents').textContent = stats.events; $('#sErrors').textContent = stats.errors;
  $('#cLogs').textContent = logs.length; $('#cAgents').textContent = agents.size; $('#cTasks').textContent = [...agents.values()].filter(isRunning).length;
  if (view === 'tasks' || view === 'agents') {
    const body = $('#viewBody'), top = body.scrollTop; body.textContent = '';
    (view === 'tasks' ? renderTasks : renderAgents)(body); body.scrollTop = top;
  }
}
document.querySelectorAll('#menu button').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
$('#back').addEventListener('click', () => showView(null));

let zoom = 1;
function fit(keepPoint) {
  const wrap = $('#wrap'), box = $('#box'), pad = 16;
  const base = Math.min((wrap.clientWidth - pad) / CW, (wrap.clientHeight - pad) / CH), s = base * zoom;
  box.style.width = Math.floor(CW * s) + 'px'; box.style.height = Math.floor(CH * s) + 'px'; box.style.setProperty('--u', s.toFixed(3));
  cv.style.imageRendering = s >= 1 ? 'pixelated' : 'auto';   // sharp pixels when enlarged, smooth when shrunk
  wrap.classList.toggle('pan', zoom > 1.01);
}
function setZoom(z, cx, cy) {   // zoom around a point (client coords), default the middle of the view
  const wrap = $('#wrap'), box = $('#box'), r = box.getBoundingClientRect(), w = wrap.getBoundingClientRect();
  cx = cx === undefined ? w.left + w.width / 2 : cx; cy = cy === undefined ? w.top + w.height / 2 : cy;
  const fx = (cx - r.left) / r.width, fy = (cy - r.top) / r.height;
  zoom = clamp(z, 1, 4); fit();
  const n = box.getBoundingClientRect();
  wrap.scrollLeft += n.left + fx * n.width - cx; wrap.scrollTop += n.top + fy * n.height - cy;
}
{
  const wrap = $('#wrap'); let drag = null;
  $('#zIn').addEventListener('click', () => setZoom(zoom * 1.35));
  $('#zOut').addEventListener('click', () => setZoom(zoom / 1.35));
  $('#zFit').addEventListener('click', () => { setZoom(1); wrap.scrollLeft = wrap.scrollTop = 0; });
  wrap.addEventListener('wheel', e => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom(zoom * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY); } }, { passive: false });
  wrap.addEventListener('mousedown', e => { if (zoom > 1.01 && e.button === 0) { drag = { x: e.clientX, y: e.clientY, l: wrap.scrollLeft, t: wrap.scrollTop }; wrap.classList.add('dragging'); } });
  addEventListener('mousemove', e => { if (drag) { wrap.scrollLeft = drag.l - (e.clientX - drag.x); wrap.scrollTop = drag.t - (e.clientY - drag.y); } });
  addEventListener('mouseup', () => { drag = null; wrap.classList.remove('dragging'); });
}
addEventListener('resize', fit);

/* ---------------------------------------------------------------- connection */
const live = $('#live'); let liveConnected = false;
function setBadge() {
  const demo = window.RealmSim && window.RealmSim.running();
  live.className = 'badge ' + (demo ? 'demo' : liveConnected ? 'on' : 'off');
  live.textContent = demo ? 'DEMO' : liveConnected ? 'LIVE' : 'OFFLINE';
  $('#demoBtn').innerHTML = demo ? 'STOP &#9632;' : 'DEMO &#9654;';
}
function connect() {
  if (location.protocol === 'file:' || typeof EventSource === 'undefined') return;
  const es = new EventSource('/events');
  es.onopen = () => { liveConnected = true; setBadge(); };
  es.onerror = () => { liveConnected = false; setBadge(); };
  es.onmessage = m => { try { emit(JSON.parse(m.data)); } catch {} };
}
window.Realm = { emit, setBadge };

fit();
const rolesLoaded = location.protocol === 'file:' ? Promise.resolve() : fetch('/roles.json').then(r => r.json()).then(j => { ROLEDEF = j.roles || {}; }).catch(() => {});
rolesLoaded.then(() => {
  connect();
  if (/[?&]demo\b/.test(location.search)) setTimeout(() => { window.RealmSim.start(); setBadge(); }, 300);
  setTimeout(() => { if (!liveConnected && !agents.size && window.RealmSim && !window.RealmSim.running() && !/nodemo/.test(location.search)) { window.RealmSim.start(); setBadge(); } }, 1200);
});
if (document.fonts && document.fonts.load) document.fonts.load('8px "Press Start 2P"');
requestAnimationFrame(frame);
$('#demoBtn').addEventListener('click', () => { const s = window.RealmSim; s.running() ? s.stop() : s.start(); setBadge(); });
})();

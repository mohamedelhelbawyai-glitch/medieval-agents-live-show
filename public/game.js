'use strict';
// Agent Realm — pixel medieval town renderer. Everything is drawn procedurally (no image assets).
(() => {
const T = 16, W = 52, H = 24, CW = W * T, CH = H * T;
const SPR = 1.5;   // characters are drawn this much larger than their 20x24 sprite
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
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
const LOC_LOOK = { castle: 'governor', library: 'scribe', forge: 'worker', barracks: 'knight', market: 'merchant', docks: 'trader', farm: 'farmer', tavern: 'bard', arena: 'knight', stands: 'bard', theatre: 'bard', audience: 'bard' };
const FIRST = ['Aldric','Brenna','Cedric','Dagny','Edmund','Freya','Gareth','Hild','Ivo','Jorah','Kenna','Leofric','Mira','Nedd','Osric','Petra','Rolf','Sybil','Tobias','Ulric','Wulf','Yara','Edda','Bran'];
const fallbackName = (id, look) => { const f = FIRST[hash(id) % FIRST.length]; return look === 'governor' ? 'Lord ' + f : look === 'knight' ? 'Sir ' + f : f; };
let ROLEDEF = {};   // role id -> {name,title,look,body,accent,home,tasks}

/* ---------------------------------------------------------------- map data */
const ROADS = [   // drawn as dirt roads and walkable
  [[20,23],[20,16],[20,12],[20,9]],
  [[6,9],[20,9],[34,9],[40,9],[46,9]],
  [[6,16],[8,16],[20,16],[30,16],[34,16],[40,16],[46,16]],
  [[40,9],[40,16]],
  [[8,16],[8,18]],
  [[30,16],[30,17]],
];
const PATHS = [   // walkable but not drawn (gate and aisle)
  [[46,9],[46,7],[46,5]],
  [[46,16],[46,14],[46,12]],
];
const LOC = {
  castle:   { name: 'CASTLE',        node: '20,9',  slots: [[18,8],[19,8],[21,8],[22,8],[20,8]] },
  library:  { name: 'LIBRARY',       node: '6,9',   slots: [[4,8],[5,8],[7,8],[8,8]] },
  barracks: { name: 'BARRACKS',      node: '34,9',  slots: [[32,8],[33,8],[35,8],[36,8]] },
  forge:    { name: 'FORGE',         node: '6,16',  slots: [[4,15],[5,15],[7,15],[8,15]] },
  tavern:   { name: 'TAVERN',        node: '34,16', slots: [[32,15],[33,15],[35,15],[36,15]] },
  market:   { name: 'MARKET',        node: '20,12', slots: [[18,11],[19,13],[21,11],[22,13],[18,13],[22,11]] },
  farm:     { name: 'ARCHIVES',      node: '8,18',  slots: [[4,19],[6,20],[10,19],[12,20],[5,21],[11,21]] },
  docks:    { name: 'DOCKS',         node: '30,17', slots: [[30,19],[31,20],[30,21],[31,18]] },
  arena:    { name: 'ARENA FIGHT',   node: '46,5',  slots: [[43,5],[49,5],[45,6],[47,6]] },
  stands:   { name: 'WATCHING FIGHT', node: '46,5', slots: [[42,2],[44,2],[48,2],[50,2],[43,3],[45,3],[47,3],[49,3]] },
  theatre:  { name: 'ON STAGE',      node: '46,12', slots: [[44,12],[46,12],[48,12],[45,13],[47,13]] },
  audience: { name: 'WATCHING SHOW', node: '46,14', slots: [[42,15],[44,14],[48,14],[50,15],[43,14],[49,15]] },
};
const REST = ['tavern', 'stands', 'audience'];   // where idle agents spend their breaks
const GATE = '20,23';
const nodes = new Map();
const nk = (x, y) => x + ',' + y;
function addNode(x, y) { const k = nk(x, y); if (!nodes.has(k)) nodes.set(k, { x, y, adj: new Set() }); return nodes.get(k); }
const roadTiles = new Set();
for (const [lines, draw] of [[ROADS, true], [PATHS, false]]) for (const line of lines) for (let i = 0; i < line.length; i++) {
  const [x, y] = line[i]; addNode(x, y);
  if (i) { const [px, py] = line[i - 1]; const a = addNode(px, py), b = addNode(x, y); a.adj.add(nk(x, y)); b.adj.add(nk(px, py));
    if (draw) for (let tx = Math.min(px, x); tx <= Math.max(px, x); tx++) for (let ty = Math.min(py, y); ty <= Math.max(py, y); ty++) roadTiles.add(nk(tx, ty)); }
}
function bfs(from, to) {
  const prev = new Map([[from, null]]), q = [from];
  while (q.length) { const c = q.shift(); if (c === to) break; for (const n of nodes.get(c).adj) if (!prev.has(n)) { prev.set(n, c); q.push(n); } }
  const out = []; for (let c = to; c; c = prev.get(c)) out.unshift(c); return out;
}
const footPx = (tx, ty) => [tx * T + 8, ty * T + 13];
const nodePx = k => { const n = nodes.get(k); return footPx(n.x, n.y); };
const isWater = (tx, ty) => ty >= 18 && tx <= 39 && tx >= (ty < 20 ? 25 : ty < 22 ? 24 : 23);

/* ---------------------------------------------------------------- static map */
const stat = document.createElement('canvas'); stat.width = CW; stat.height = CH;
const sg = stat.getContext('2d');
const lights = [];      // glowing windows/torches
const chimneys = [];    // smoke sources
const labels = [];      // [text, cx, y]
const waterSpark = [];
const occ = new Uint8Array(W * H);
const mark = (tx, ty, w, h) => { for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) if (x >= 0 && y >= 0 && x < W && y < H) occ[y * W + x] = 1; };

function building(g, tx, ty, tw, th, o) {
  const x = tx * T, y = ty * T, w = tw * T, h = th * T, roofH = Math.round(h * 0.45);
  mark(tx, ty, tw, th);
  R(g, x + 4, y + h - 3, w, 6, 'rgba(0,0,0,.28)');
  R(g, x, y + roofH - 4, w, h - roofH + 4, o.wall);
  for (let yy = y + roofH, r = 0; yy < y + h; yy += 6, r++) {
    R(g, x, yy, w, 1, o.wallDark);
    for (let xx = x + (r % 2 ? 4 : 0); xx < x + w; xx += 8) R(g, xx, yy, 1, 6, o.wallDark);
  }
  R(g, x, y + roofH, 2, h - roofH, 'rgba(0,0,0,.15)'); R(g, x + w - 2, y + roofH, 2, h - roofH, 'rgba(0,0,0,.2)');
  for (let i = 0; i < roofH; i++) {
    const inset = Math.floor((roofH - i) / 3);
    R(g, x - 4 + inset, y + i, w + 8 - 2 * inset, 1, i % 4 === 3 ? o.roofDark : o.roof);
    if (i % 4 === 0) for (let sx = x - 4 + inset + (i % 8 ? 3 : 0); sx < x + w + 4 - inset; sx += 6) R(g, sx, y + i, 1, 4, o.roofDark);
  }
  R(g, x - 4 + Math.floor(roofH / 3), y, w + 8 - 2 * Math.floor(roofH / 3), 2, o.roofLight);
  R(g, x - 4, y + roofH, w + 8, 2, 'rgba(0,0,0,.35)');
  const dw = 14, dh = 22, dx = x + w / 2 - dw / 2, dy = y + h - dh;
  R(g, dx - 2, dy - 2, dw + 4, dh + 2, '#3a2814'); R(g, dx, dy, dw, dh, '#6b4423'); R(g, dx + 6, dy, 2, dh, '#4a2f17'); R(g, dx + dw - 4, dy + 11, 2, 2, '#e8c15a');
  R(g, dx, dy, dw, 2, '#4a2f17');
  const wy = y + roofH + 7, ww = 10;
  if (h - roofH > 34) for (const wx of [x + w * 0.2 - ww / 2, x + w * 0.8 - ww / 2]) {
    R(g, wx - 1, wy - 1, ww + 2, ww + 2, '#3a2814'); R(g, wx, wy, ww, ww, o.glass || '#2a3a55'); R(g, wx + 4, wy, 1, ww, '#3a2814'); R(g, wx, wy + 4, ww, 1, '#3a2814');
    R(g, wx + 1, wy + 1, 2, 2, 'rgba(255,255,255,.25)'); lights.push([wx + ww / 2, wy + ww / 2, 22]);
  }
  if (o.chimney) { const cx = x + w - 14; R(g, cx, y - 6, 8, 14, '#7a6f66'); R(g, cx - 1, y - 7, 10, 3, '#5d544d'); chimneys.push([cx + 4, y - 8]); }
  labels.push([o.label, x + w / 2, y + roofH - 12]);
}

function castle(g) {
  const X = 14 * T, Y = T, TW = 3 * T;
  mark(14, 1, 13, 7);
  R(g, X + 4, Y + 7 * T - 3, 13 * T, 6, 'rgba(0,0,0,.28)');
  const stone = (x, y, w, h) => { R(g, x, y, w, h, '#a2a8b3'); for (let yy = y, r = 0; yy < y + h; yy += 8, r++) { R(g, x, yy, w, 1, '#7d838f'); for (let xx = x + (r % 2 ? 6 : 0); xx < x + w; xx += 12) R(g, xx, yy, 1, 8, '#7d838f'); } R(g, x, y, 2, h, '#bcc2cc'); R(g, x + w - 3, y, 3, h, '#7d838f'); };
  stone(X + TW, Y + 2 * T, 7 * T, 5 * T);
  for (let cx = X + TW; cx < X + TW + 7 * T; cx += 12) { R(g, cx, Y + 2 * T - 8, 8, 8, '#a2a8b3'); R(g, cx, Y + 2 * T - 8, 8, 1, '#bcc2cc'); R(g, cx + 7, Y + 2 * T - 8, 1, 8, '#7d838f'); }
  stone(X + 5 * T, Y + 0 * T + 8, 3 * T, 5 * T + 8 - 0);
  for (const tx of [X, X + 10 * T]) {
    stone(tx, Y + 12, TW, 6 * T - 12);
    for (let i = 0; i < 20; i++) { const inset = Math.floor((19 - i) * 1.3); R(g, tx - 4 + inset, Y - 8 + i, TW + 8 - 2 * inset, 1, i % 4 === 3 ? '#8f1d2a' : '#c0394b'); R(g, tx - 4 + inset, Y - 8 + i, 2, 1, '#e06070'); }
    R(g, tx - 4, Y + 11, TW + 8, 2, 'rgba(0,0,0,.35)');
    R(g, tx + TW / 2 - 1, Y - 15, 2, 8, '#5a4630');
    for (const wx of [tx + 10, tx + 30]) { R(g, wx, Y + 36, 8, 14, '#2a2030'); R(g, wx + 2, Y + 34, 4, 2, '#2a2030'); lights.push([wx + 4, Y + 43, 20]); }
  }
  // center keep + gate
  for (const wx of [X + 6 * T + 2, X + 6 * T + 2 + 2 * T]) { R(g, wx, Y + T + 4, 10, 18, '#2a2030'); R(g, wx + 2, Y + T + 2, 6, 2, '#2a2030'); lights.push([wx + 5, Y + T + 13, 22]); }
  const gx = X + 5 * T + 8, gy = Y + 4 * T;
  R(g, gx - 3, gy - 3, 3 * T - 10 + 6, 3 * T + 3, '#5d544d');
  R(g, gx, gy, 3 * T - 10, 3 * T, '#1b1420'); R(g, gx + 2, gy - 6, 3 * T - 14, 6, '#1b1420');
  for (let xx = gx + 3; xx < gx + 3 * T - 10; xx += 6) R(g, xx, gy + 2, 1, 3 * T - 2, '#4a4350');
  for (let yy = gy + 6; yy < gy + 3 * T; yy += 8) R(g, gx, yy, 3 * T - 10, 1, '#4a4350');
  for (const tx2 of [gx - 8, gx + 3 * T - 6]) { R(g, tx2, gy + 14, 2, 20, '#5a4630'); R(g, tx2 - 2, gy + 12, 6, 3, '#8a6a3a'); lights.push([tx2 + 1, gy + 10, 26]); }
  // courtyard cobble
  for (let tx = 16; tx <= 24; tx++) { R(g, tx * T, 8 * T, T, T, (tx & 1) ? '#b9a98a' : '#b1a182'); for (let i = 0; i < 4; i++) R(g, tx * T + (i * 5) % 14, 8 * T + (i * 7) % 14, 3, 2, '#8c7d62'); }
  labels.push(['CASTLE', 20 * T, 7 * T + 8]);
}

function tree(g, x, y, r) {
  R(g, x - 7, y - 1, 14, 3, 'rgba(0,0,0,.25)'); R(g, x - 2, y - 9, 4, 10, '#6b4a2a'); R(g, x - 2, y - 9, 1, 10, '#82592f');
  const rows = [[-5,10,-27,2],[-7,14,-25,2],[-9,18,-23,5],[-9,18,-18,4],[-8,16,-14,3],[-6,12,-11,2]];
  const dark = r() < .5 ? '#2c6a30' : '#2f7433', mid = '#3d8f3f', hi = '#5bb04e';
  for (const [dx, w, dy, h] of rows) R(g, x + dx, y + dy, w, h, dark);
  for (const [dx, w, dy, h] of rows) R(g, x + dx, y + dy, Math.ceil(w * .6), Math.ceil(h * .8), mid);
  R(g, x - 4, y - 24, 4, 2, hi); R(g, x - 7, y - 20, 3, 2, hi);
}

function stall(g, tx, ty, c1) {
  const x = tx * T, y = ty * T; mark(tx, ty, 3, 2);
  R(g, x + 3, y + 30, 3 * T, 4, 'rgba(0,0,0,.25)');
  R(g, x + 2, y + 14, 3, 18, '#5a3a1e'); R(g, x + 3 * T - 5, y + 14, 3, 18, '#5a3a1e');
  R(g, x, y + 20, 3 * T, 12, '#8a5a2b'); R(g, x, y + 20, 3 * T, 2, '#a8763a');
  for (let i = 0; i < 6; i++) R(g, x + 4 + i * 7, y + 17, 5, 3, ['#e0a030', '#c0394b', '#5bb04e'][i % 3]);
  for (let i = 0; i < 6; i++) { R(g, x + i * 8, y + 2, 8, 12, i % 2 ? '#f0e8d0' : c1); R(g, x + i * 8, y + 14, 8, 2, i % 2 ? '#d0c8b0' : c1); }
  R(g, x, y + 2, 3 * T, 2, 'rgba(255,255,255,.25)');
}

function field(g, x0, x1, kind) {
  for (let tx = x0; tx <= x1; tx++) for (let ty = 18; ty <= 22; ty++) {
    mark(tx, ty, 1, 1);
    const px = tx * T, py = ty * T; R(g, px, py, T, T, '#6e4b2c');
    for (let r = 0; r < 4; r++) { R(g, px, py + r * 4 + 3, T, 1, '#5a3c22'); for (let c = 0; c < 4; c++) {
      if (kind === 0) { R(g, px + c * 4 + 1, py + r * 4, 2, 3, (r + c) % 2 ? '#e6c84a' : '#cfae3a'); R(g, px + c * 4 + 1, py + r * 4 + 2, 2, 1, '#9a7a20'); }
      else { R(g, px + c * 4, py + r * 4 + 1, 3, 2, '#5bb04e'); R(g, px + c * 4 + 1, py + r * 4, 1, 1, '#8fd070'); } } }
  }
}

function arena(g) {
  const r = mulberry32(5), x0 = 41 * T, y0 = T, w = 10 * T;
  mark(41, 1, 10, 7);
  R(g, x0 + 4, y0 + 7 * T - 2, w, 6, 'rgba(0,0,0,.28)');
  // sand floor with raked lines
  R(g, x0, y0 + 3 * T, w, 4 * T, '#d9c58a');
  for (let i = 0; i < 60; i++) R(g, x0 + 8 + r() * (w - 20), y0 + 3 * T + r() * 4 * T, 3 + r() * 5, 1, i % 3 ? '#c4ae72' : '#e8d9a6');
  // back wall (stone) with crenellations
  R(g, x0, y0, w, T, '#8d939c');
  for (let yy = y0, k = 0; yy < y0 + T; yy += 8, k++) { R(g, x0, yy, w, 1, '#6f7686'); for (let xx = x0 + (k % 2 ? 6 : 0); xx < x0 + w; xx += 12) R(g, xx, yy, 1, 8, '#6f7686'); }
  for (let cx = x0; cx < x0 + w; cx += 12) { R(g, cx, y0 - 6, 8, 6, '#8d939c'); R(g, cx, y0 - 6, 8, 1, '#b4bac4'); }
  // two spectator tiers
  const tier = (y, col, dark) => { R(g, x0 + 8, y, w - 16, T, col); for (let i = 0; i < 4; i++) R(g, x0 + 8, y + 3 + i * 4, w - 16, 1, dark); R(g, x0 + 8, y + T - 2, w - 16, 2, 'rgba(0,0,0,.3)'); };
  tier(y0 + T, '#9a6a38', '#6b4423'); tier(y0 + 2 * T, '#b8864a', '#7a5226');
  // side walls
  R(g, x0, y0, 8, 7 * T, '#8d939c'); R(g, x0 + w - 8, y0, 8, 7 * T, '#8d939c'); R(g, x0 + 6, y0, 2, 7 * T, '#6f7686'); R(g, x0 + w - 8, y0, 2, 7 * T, '#6f7686');
  // front wall with gate at tile 46
  for (const [a, b] of [[x0, 46 * T], [47 * T, x0 + w]]) { R(g, a, y0 + 6 * T + 4, b - a, 12, '#8d939c'); R(g, a, y0 + 6 * T + 4, b - a, 2, '#b4bac4'); for (let xx = a; xx < b; xx += 12) R(g, xx, y0 + 6 * T + 4, 1, 12, '#6f7686'); }
  R(g, 46 * T - 3, y0 + 6 * T - 6, 3, 22, '#5d544d'); R(g, 47 * T, y0 + 6 * T - 6, 3, 22, '#5d544d');
  lights.push([46 * T - 2, y0 + 6 * T, 26], [47 * T + 2, y0 + 6 * T, 26]);
  // banners on the back wall
  for (const bx of [x0 + 20, x0 + 52, x0 + 100, x0 + 132]) { R(g, bx, y0 + 1, 8, 12, bx % 2 ? '#c0394b' : '#2f5fb8'); R(g, bx + 3, y0 + 4, 2, 6, '#ffd23f'); }
  // straw training dummies
  for (const dx of [42, 50]) { const px = dx * T + 8, py = 5 * T + 12;
    R(g, px - 5, py, 10, 3, 'rgba(0,0,0,.25)'); R(g, px - 1, py - 22, 2, 22, '#6b4a2a'); R(g, px - 8, py - 17, 16, 3, '#6b4a2a');
    R(g, px - 6, py - 15, 12, 9, '#d9b86a'); R(g, px - 4, py - 13, 8, 5, '#c0394b'); R(g, px - 2, py - 11, 4, 1, '#fff'); R(g, px - 4, py - 25, 8, 7, '#d9b86a'); R(g, px - 4, py - 22, 8, 1, '#a88a3a'); }
  labels.push(['ARENA', x0 + w / 2, 2]);
}

function theatre(g) {
  const x0 = 41 * T, y0 = 10 * T, w = 10 * T;
  mark(41, 10, 10, 6);
  R(g, x0 + 4, y0 + 6 * T - 2, w, 6, 'rgba(0,0,0,.28)');
  // audience floor
  R(g, x0, y0 + 4 * T, w, 2 * T, '#9a7a52'); for (let i = 0; i < 30; i++) R(g, x0 + 6 + (i * 37) % (w - 12), y0 + 4 * T + (i * 11) % (2 * T), 3, 1, '#7d6140');
  // stage back wall with painted backdrop
  R(g, x0, y0, w, 2 * T, '#5a3a1e'); R(g, x0 + 24, y0 + 4, w - 48, 2 * T - 4, '#6aa0d8'); R(g, x0 + 24, y0 + 22, w - 48, 10, '#4f8a3c');
  R(g, x0 + 64, y0 + 10, 12, 14, '#a2a8b3'); R(g, x0 + 80, y0 + 6, 14, 18, '#a2a8b3'); R(g, x0 + 66, y0 + 8, 8, 2, '#c0394b'); R(g, x0 + 84, y0 + 3, 6, 3, '#c0394b'); R(g, x0 + 86, y0 + 12, 2, 6, '#2a2030');
  R(g, x0 + 44, y0 + 6, 10, 4, '#fff'); R(g, x0 + 112, y0 + 8, 12, 4, '#fff');
  // stage floor (raised) with front edge
  R(g, x0, y0 + 2 * T, w, 2 * T, '#b8864a');
  for (let yy = y0 + 2 * T; yy < y0 + 4 * T; yy += 8) R(g, x0, yy, w, 1, '#8a5e2e');
  for (let xx = x0 + 10; xx < x0 + w; xx += 20) R(g, xx, y0 + 2 * T, 1, 2 * T, '#9c6f38');
  R(g, x0, y0 + 4 * T - 5, w, 5, '#6b4423'); R(g, x0, y0 + 4 * T - 5, w, 1, '#8a5e2e');
  // curtains + valance + roof beam
  for (const [cx, dir] of [[x0, 1], [x0 + w - 26, -1]]) { for (let i = 0; i < 26; i++) { const len = 2 * T + 8 - Math.floor(i * 0.5) * (dir > 0 ? 0 : 0); R(g, cx + i, y0 - 2, 1, len, i % 4 < 2 ? '#a8232f' : '#8a1a24'); } R(g, cx, y0 + 2 * T + 6, 26, 2, '#ffd23f'); }
  R(g, x0 - 4, y0 - 10, w + 8, 12, '#4a2f17'); R(g, x0 - 4, y0 - 10, w + 8, 2, '#6b4423');
  for (let xx = x0 + 4; xx < x0 + w; xx += 12) { R(g, xx, y0 + 2, 6, 6, '#a8232f'); R(g, xx + 1, y0 + 8, 4, 2, '#ffd23f'); }
  R(g, x0 - 4, y0 - 10, 6, 6 * T + 6, '#4a2f17'); R(g, x0 + w - 2, y0 - 10, 6, 6 * T + 6, '#4a2f17');
  // footlights
  for (let xx = x0 + 18; xx < x0 + w - 12; xx += 20) { R(g, xx, y0 + 4 * T - 8, 4, 3, '#ffd23f'); lights.push([xx + 2, y0 + 4 * T - 7, 22]); }
  // audience benches (aisle at tile 46) and red carpet
  for (const row of [14, 15]) for (let tx = 41; tx <= 50; tx++) { if (tx === 46) continue; const px = tx * T, py = row * T + 6;
    R(g, px + 1, py, 14, 4, '#7a5226'); R(g, px + 1, py, 14, 1, '#a8763a'); R(g, px + 1, py - 5, 14, 2, '#5a3a1e'); R(g, px + 2, py + 4, 2, 4, '#4a2f17'); R(g, px + 12, py + 4, 2, 4, '#4a2f17'); }
  R(g, 46 * T + 2, y0 + 4 * T, 12, 2 * T, '#a8232f'); R(g, 46 * T + 2, y0 + 4 * T, 2, 2 * T, '#ffd23f'); R(g, 46 * T + 12, y0 + 4 * T, 2, 2 * T, '#ffd23f');
  labels.push(['THEATRE', x0 + w / 2, y0 - 22]);
}

function buildStatic() {
  const g = sg, r = mulberry32(11);
  // grass
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    R(g, tx * T, ty * T, T, T, (tx + ty) & 1 ? '#4f8a3c' : '#4a8338');
    for (let i = 0; i < 3; i++) { const x = tx * T + r() * 14, y = ty * T + r() * 14; R(g, x, y, 1, 2, '#3b6f2e'); R(g, x + 1, y + 1, 1, 1, '#66a352'); }
  }
  for (let n = 0; n < 160; n++) { const cx = r() * CW, cy = r() * CH, c = r() < .5 ? 'rgba(0,30,0,.07)' : 'rgba(200,255,150,.06)'; for (let k = 0; k < 9; k++) R(g, cx + r() * 28 - 14, cy + r() * 18 - 9, 5 + r() * 10, 3 + r() * 4, c); }
  // water + shore
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    if (isWater(tx, ty)) { mark(tx, ty, 1, 1); R(g, tx * T, ty * T, T, T, (tx + ty) & 1 ? '#2f6fb5' : '#2c68ad'); if (!isWater(tx - 1, ty)) R(g, tx * T, ty * T + 2 + r() * 8, 2, 3, 'rgba(255,255,255,.55)'); if (!isWater(tx, ty - 1)) R(g, tx * T + 2 + r() * 8, ty * T, 4, 1, 'rgba(255,255,255,.55)'); if (r() < .35) waterSpark.push([tx * T + r() * 10, ty * T + r() * 12, r() * 6.28]); }
    else if (ty >= 17 && (isWater(tx + 1, ty) || isWater(tx, ty + 1) || isWater(tx + 1, ty + 1) || isWater(tx - 1, ty + 1))) { R(g, tx * T, ty * T, T, T, '#d9c58a'); for (let i = 0; i < 4; i++) R(g, tx * T + r() * 14, ty * T + r() * 14, 2, 1, '#bfa96c'); mark(tx, ty, 1, 1); }
  }
  // farm
  field(g, 1, 7, 0); field(g, 9, 13, 1);
  R(g, 1 * T, 17 * T + 9, 13 * T + T, 2, '#8a6a3a'); for (let x = 1 * T; x <= 14 * T; x += 16) R(g, x, 17 * T + 4, 2, 9, '#6b4a2a');
  // scarecrow
  R(g, 2 * T + 7, 19 * T - 2, 2, 20, '#6b4a2a'); R(g, 2 * T + 1, 19 * T + 5, 14, 2, '#6b4a2a'); R(g, 2 * T + 4, 19 * T - 6, 8, 7, '#d9b86a'); R(g, 2 * T + 2, 19 * T - 8, 12, 3, '#6b4a2a'); R(g, 2 * T + 5, 19 * T - 11, 6, 4, '#6b4a2a');
  // roads
  for (const k of roadTiles) { const [tx, ty] = k.split(',').map(Number); mark(tx, ty, 1, 1);
    R(g, tx * T, ty * T, T, T, (tx + ty) & 1 ? '#b8935a' : '#b08b52');
    for (let i = 0; i < 5; i++) R(g, tx * T + r() * 14, ty * T + r() * 14, 2, 1, '#8c6b3a');
    R(g, tx * T, ty * T, T, 1, 'rgba(255,255,255,.08)'); }
  // plaza
  for (let tx = 18; tx <= 22; tx++) for (let ty = 11; ty <= 13; ty++) { mark(tx, ty, 1, 1);
    R(g, tx * T, ty * T, T, T, '#b9a98a'); R(g, tx * T + 8, ty * T, 1, T, '#9a8a6c'); R(g, tx * T, ty * T + 8, T, 1, '#9a8a6c'); R(g, tx * T + 4, ty * T + 3, 3, 2, '#d0c3a6'); }
  // buildings
  castle(g); arena(g); theatre(g);
  building(g, 3, 2, 6, 5, { wall: '#c9b99a', wallDark: '#a89878', roof: '#3a5cc0', roofDark: '#2d4a9e', roofLight: '#6a88e0', glass: '#4a7ac0', label: 'LIBRARY' });
  building(g, 31, 2, 7, 5, { wall: '#8d94a3', wallDark: '#6f7686', roof: '#8a2430', roofDark: '#6a1a24', roofLight: '#b84050', label: 'BARRACKS' });
  building(g, 3, 10, 6, 5, { wall: '#9a8a78', wallDark: '#7a6a58', roof: '#5a4630', roofDark: '#463623', roofLight: '#7a6040', chimney: true, label: 'FORGE' });
  building(g, 31, 10, 6, 5, { wall: '#d2b48c', wallDark: '#b09468', roof: '#9a5a2a', roofDark: '#7a4620', roofLight: '#c07a3a', chimney: true, label: 'TAVERN' });
  stall(g, 15, 10, '#c0394b'); stall(g, 15, 13, '#2f7a5a'); stall(g, 23, 10, '#7b3a96'); stall(g, 23, 13, '#d9a521');
  // forge glow + barracks banners
  R(g, 3 * T + 40, 10 * T + 56, 14, 14, '#2a1a10'); R(g, 3 * T + 42, 10 * T + 62, 10, 6, '#ff8a2a'); R(g, 3 * T + 45, 10 * T + 60, 4, 4, '#ffd23f'); lights.push([3 * T + 47, 10 * T + 64, 26]);
  for (const bx of [31 * T + 8, 37 * T + 4]) { R(g, bx, 2 * T + 40, 8, 22, '#c0394b'); R(g, bx + 3, 2 * T + 44, 2, 10, '#ffd23f'); R(g, bx, 2 * T + 58, 3, 4, '#463623'); }
  // dock pier
  for (let ty = 17; ty <= 21; ty++) for (let tx = 30; tx <= 31; tx++) { R(g, tx * T, ty * T, T, T, '#8a5a2b'); for (let i = 0; i < 4; i++) R(g, tx * T, ty * T + i * 4, T, 1, '#6b4420'); R(g, tx * T + 2, ty * T + 2, 2, 2, '#4a2f17'); }
  R(g, 30 * T - 3, 17 * T, 3, 5 * T, '#5a3a1e'); R(g, 32 * T, 17 * T, 3, 5 * T, '#5a3a1e');
  // barrels / crates
  const barrel = (x, y) => { R(g, x, y, 8, 10, '#8a5a2b'); R(g, x, y + 2, 8, 1, '#4a2f17'); R(g, x, y + 7, 8, 1, '#4a2f17'); R(g, x + 1, y, 6, 1, '#a8763a'); };
  barrel(36 * T + 4, 15 * T - 4); barrel(37 * T + 2, 15 * T - 2); barrel(9 * T + 6, 14 * T + 4); barrel(29 * T + 4, 18 * T - 2);
  R(g, 28 * T, 17 * T + 2, 12, 12, '#a8763a'); R(g, 28 * T, 17 * T + 2, 12, 2, '#c4905a'); R(g, 28 * T + 5, 17 * T + 2, 2, 12, '#7a5226');
  // windmill body
  mark(15, 18, 2, 4);
  R(g, 15 * T + 2, 22 * T - 2, 2 * T + 2, 4, 'rgba(0,0,0,.25)');
  for (let i = 0; i < 44; i++) { const inset = Math.floor(i / 6); R(g, 15 * T + 2 + inset, 18 * T + 8 + i, 2 * T - 2 * inset, 1, i % 6 === 0 ? '#a89878' : '#d8c8a8'); }
  R(g, 15 * T + 8, 21 * T + 2, 8, 14, '#6b4423'); R(g, 15 * T + 10, 19 * T + 12, 4, 6, '#2a3a55');
  R(g, 15 * T - 2, 18 * T + 2, 2 * T + 6, 8, '#8a4a2a'); R(g, 15 * T + 2, 18 * T - 2, 2 * T - 2, 6, '#a85a34');
  // trees + flowers on free grass
  const spots = [];
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) if (!occ[ty * W + tx]) spots.push([tx, ty]);
  const near = (tx, ty) => { for (const L of Object.values(LOC)) for (const [sx, sy] of L.slots) if (Math.abs(sx - tx) <= 1 && Math.abs(sy - ty) <= 1) return true; return false; };
  const treeSpots = spots.filter(([tx, ty]) => !near(tx, ty) && ty > 0 && !(ty >= 8 && ty <= 9) && !(ty >= 15 && ty <= 17 && tx > 2 && tx < 48) && !(tx >= 19 && tx <= 21));
  const placed = [];
  for (let n = 0; n < 220 && placed.length < 46; n++) {
    const [tx, ty] = treeSpots[Math.floor(r() * treeSpots.length)];
    if (placed.some(([px, py]) => Math.abs(px - tx) < 2 && Math.abs(py - ty) < 2)) continue;
    placed.push([tx, ty]);
  }
  placed.sort((a, b) => a[1] - b[1]);
  for (const [tx, ty] of placed) tree(g, tx * T + 8, ty * T + 14, r);
  for (let n = 0; n < 90; n++) { const [tx, ty] = spots[Math.floor(r() * spots.length)]; if (placed.some(p => p[0] === tx && p[1] === ty) || near(tx, ty)) continue;
    const x = tx * T + 3 + r() * 9, y = ty * T + 3 + r() * 9, c = ['#ff6b8a', '#ffd23f', '#ffffff', '#c78bff'][Math.floor(r() * 4)]; if (r() < .12) { R(g, x - 2, y + 2, 7, 4, 'rgba(0,0,0,.22)'); R(g, x - 1, y, 6, 4, '#8d939c'); R(g, x, y - 1, 4, 2, '#aab0b8'); R(g, x + 3, y + 2, 3, 2, '#6f7580'); continue; }
    if (r() < .12) { R(g, x - 3, y + 4, 12, 3, 'rgba(0,0,0,.22)'); R(g, x - 2, y, 10, 6, '#2f7433'); R(g, x, y - 2, 6, 3, '#3d8f3f'); R(g, x - 1, y + 1, 3, 2, '#5bb04e'); R(g, x + 5, y + 2, 2, 2, '#e5484d'); continue; }
    R(g, x, y, 2, 2, c); R(g, x, y + 2, 1, 2, '#3b6f2e'); }
  // castle torches
  for (const tx2 of [14 * T + 5 * T + 8 - 8, 14 * T + 5 * T + 8 + 3 * T - 6]) { /* poles drawn in castle() */ void tx2; }
}

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
  const w = { tavern: 1, stands: fightOn ? 4 : 1, audience: showOn ? 4 : 1 }; let r = Math.random() * (w.tavern + w.stands + w.audience);
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
  const a = { id, rid, look, pal, color, name, title, home, x, y, path: [], node: GATE, loc: null, slot: null, state: 'idle', busy: false, busyUntil: 0, hold: false, holdUntil: 0, facing: 1,
    anim: Math.random() * 9, lastEvent: now(), status: 'idle', text: '', task: '', tool: '', taskStart: 0, el, bub, bubUntil: 0, partT: 0, leaving: false };
  agents.set(id, a); return a;
}

function pathLen(a) { let d = 0, x = a.x, y = a.y; for (const p of a.path) { d += Math.hypot(p[0] - x, p[1] - y); x = p[0]; y = p[1]; } return d; }

function goTo(a, loc, calm) {
  const L = LOC[loc]; if (!L) return;
  a.loc = loc; a.leaving = false;
  const taken = new Set([...agents.values()].filter(o => o !== a && o.loc === loc && o.slot).map(o => o.slot));
  const free = L.slots.filter(s => !taken.has(s.join()));
  const s = (free.length ? free : L.slots)[Math.floor(Math.random() * (free.length || L.slots.length))];
  a.slot = s.join();
  if (a.path.length && a.path[a.path.length - 1].slot) a.path.pop();
  else if (!a.path.length) a.path.push(nodePx(a.node));
  for (const k of bfs(a.node, L.node).slice(1)) a.path.push(nodePx(k));
  a.node = L.node;
  const [px, py] = footPx(s[0], s[1]); const p = [px + rand(-3, 3), py + rand(-1, 1)]; p.slot = true; a.path.push(p);
  const len = pathLen(a);
  a.speed = calm ? clamp(len / 6, 56, 120) : clamp(len / 2.5, 70, 320);   // working trips hurry so the task isn't over before they arrive
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
  a.busy = status !== 'idle' || report; a.workFor = report ? 8 : status === 'start' ? (a.hold ? 600 : 10) : 2.5;
  if (a.loc !== loc || a.leaving) goTo(a, loc, status === 'idle' && !report);
  a.busyUntil = a.path.length ? Infinity : t + a.workFor;   // the work timer starts when they arrive
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
  a.anim += dt * (a.path.length ? clamp((a.speed || 56) / 70, 1, 2.2) : 1);
  if (a.path.length) {
    const p = a.path[0], dx = p[0] - a.x, dy = p[1] - a.y, d = Math.hypot(dx, dy), step = (a.speed || 56) * dt;
    if (d <= step) { a.x = p[0]; a.y = p[1]; a.path.shift(); } else { a.x += dx / d * step; a.y += dy / d * step; if (Math.abs(dx) > .5) a.facing = dx > 0 ? 1 : -1; }
    a.state = 'walking';
  } else {
    if (a.leaving) { a.el.remove(); agents.delete(a.id); return; }
    a.state = a.busy ? 'working' : 'idle';
    if (a.loc === 'arena' && a.slot) { const sx = +a.slot.split(',')[0]; a.facing = sx <= 43 ? -1 : sx >= 49 ? 1 : sx < 46 ? 1 : -1; }   // face the dummy or the sparring partner
    if (a.loc === 'theatre' || a.loc === 'audience' || a.loc === 'stands') a.facing = a.loc === 'stands' ? (a.x < 736 ? 1 : -1) : a.facing;
  }
  if (!a.path.length && a.busyUntil === Infinity) a.busyUntil = t + (a.workFor || 5);   // just arrived: start the work timer
  if (a.busy && t > a.busyUntil) a.busy = false;
  if (a.path.length && a.bubUntil) a.bubUntil = Math.max(a.bubUntil, t + 3);          // keep the bubble up until they get there
  if (a.hold && t > a.holdUntil) a.hold = false;
  const idleFor = t - a.lastEvent;
  if (!a.leaving && !a.hold && idleFor > 16 && !REST.includes(a.loc) && !a.path.length) { a.busy = false; goTo(a, pickRest(), true); }
  if (!a.leaving && !a.hold && idleFor > 120) { a.leaving = true; a.loc = null; a.slot = null; if (a.path.length && a.path[a.path.length - 1].slot) a.path.pop(); else if (!a.path.length) a.path.push(nodePx(a.node)); for (const k of bfs(a.node, GATE).slice(1)) a.path.push(nodePx(k)); a.node = GATE; a.speed = 110; }
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
let last = 0, smokeT = 0;

function fontReady() { return document.fonts && document.fonts.check('8px "Press Start 2P"'); }
function drawLabel(text, cx, y) {
  ctx.font = '8px "Press Start 2P", monospace'; const w = Math.ceil(ctx.measureText(text).width) + 6, x = Math.round(cx - w / 2);
  R(ctx, x, y, w, 11, '#3a2814'); R(ctx, x + 1, y + 1, w - 2, 9, '#a8763a'); R(ctx, x + 1, y + 1, w - 2, 1, '#c4905a');
  ctx.fillStyle = '#2b1a0a'; ctx.textBaseline = 'top'; ctx.fillText(text, x + 4, y + 2);
}

function frame(ms) {
  const t = ms / 1000, dt = Math.min(.5, t - last); last = t;
  ctx.drawImage(stat, 0, 0);
  // water shimmer + boat
  for (const [x, y, ph] of waterSpark) if (Math.sin(t * 1.6 + ph) > .55) R(ctx, x, y, 4, 1, 'rgba(255,255,255,.4)');
  const by = Math.round(Math.sin(t * 1.5) * 1.2), bx = 33 * T;
  R(ctx, bx, 20 * T + 4 + by, 40, 8, '#6b4423'); R(ctx, bx + 2, 20 * T + 12 + by, 36, 3, '#4a2f17'); R(ctx, bx + 19, 20 * T - 14 + by, 2, 18, '#4a2f17'); R(ctx, bx + 21, 20 * T - 12 + by, 12, 14, '#f0e8d0'); R(ctx, bx + 21, 20 * T - 12 + by, 12, 2, '#c0394b');
  // windmill blades
  const wa = Math.floor(t * 2.2) * Math.PI / 4 / 2 + 0.3, wcx = 16 * T + 1, wcy = 18 * T + 6;
  for (let k = 0; k < 4; k++) { const ang = wa + k * Math.PI / 2; for (let i = 3; i < 26; i++) { const px = wcx + Math.cos(ang) * i, py = wcy + Math.sin(ang) * i; R(ctx, px, py, 2, 2, i > 8 ? '#efe6cc' : '#6b4a2a'); if (i > 8) { const nx = -Math.sin(ang), ny = Math.cos(ang); R(ctx, px + nx * 2, py + ny * 2, 2, 2, '#d8cdb0'); } } }
  R(ctx, wcx - 2, wcy - 2, 5, 5, '#4a2f17');
  // flags on towers
  for (const fx of [14 * T + 24, 24 * T + 24]) for (let i = 0; i < 12; i++) R(ctx, fx + 1 + i, 2 + Math.round(Math.sin(t * 5 - i * .5) * 1.5) + (i > 8 ? 1 : 0), 1, 8 - Math.floor(i / 4), '#ffd23f');
  // labels
  if (fontReady() || t > 3) for (const [txt, cx, y] of labels) drawLabel(txt, cx, y);
  // smoke
  smokeT -= dt; if (smokeT <= 0) { smokeT = .45; for (const [x, y] of chimneys) particles.push({ x, y, vx: rand(2, 8), vy: -rand(8, 14), life: 0, max: 2.2, col: 'rgba(210,210,215,.55)', s: 2, g: 0 }); }
  // agents
  const list = [...agents.values()];
  fightOn = list.some(o => o.loc === 'arena' && o.state === 'working'); showOn = list.some(o => o.loc === 'theatre' && o.state === 'working');
  for (const a of list) updateAgent(a, dt, t);
  list.sort((p, q) => p.y - q.y);
  for (const a of list) drawAgent(a);
  // particles
  for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.life += dt; if (p.life > p.max) { particles.splice(i, 1); continue; }
    p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; ctx.globalAlpha = 1 - p.life / p.max; R(ctx, p.x, p.y, p.s, p.s, p.col); ctx.globalAlpha = 1; }
  // day / night
  const cycle = 300, hour = (9 + (t / cycle) * 24) % 24, day = 1 + Math.floor((9 + (t / cycle) * 24) / 24);
  const dark = 0.5 + 0.5 * Math.cos(2 * Math.PI * (hour - 1) / 24);
  if (dark > .05) { ctx.fillStyle = `rgba(12,16,50,${(dark * .55).toFixed(3)})`; ctx.fillRect(0, 0, CW, CH); }
  if (dark > .3) for (const [x, y, r] of lights) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); const f = (dark - .3) * 1.2 * (0.85 + 0.15 * Math.sin(t * 9 + x)); g.addColorStop(0, `rgba(255,200,90,${(.55 * f).toFixed(3)})`); g.addColorStop(1, 'rgba(255,200,90,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
  // overlay positions
  for (const a of list) { a.el.style.left = (a.x / CW * 100) + '%'; a.el.style.top = (a.y / CH * 100) + '%'; a.el.style.zIndex = Math.floor(a.y); }
  const hh = String(Math.floor(hour)).padStart(2, '0'), mm = String(Math.floor((hour % 1) * 60)).padStart(2, '0');
  if (!frame.lastClock || t - frame.lastClock > .5) { $('#clock').textContent = `DAY ${day}  ${hh}:${mm}`; frame.lastClock = t; refreshUi(); }
  requestAnimationFrame(frame);
}

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

buildStatic(); fit();
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

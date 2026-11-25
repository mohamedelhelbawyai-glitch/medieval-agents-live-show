'use strict';
// Agent Realm — pixel medieval town renderer. Everything is drawn procedurally (no image assets).
(() => {
const T = 16, W = 40, H = 24, CW = W * T, CH = H * T;
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

/* ---------------------------------------------------------------- roles */
const ROLES = {
  governor: { label: 'Governor', body: '#a8232f', legs: '#3b2a4a', belt: '#ffd23f', color: '#ff6b7a' },
  knight:   { label: 'Knight',   body: '#8a94a8', legs: '#555d6e', belt: '#3a3f4b', color: '#8fbcff' },
  merchant: { label: 'Merchant', body: '#7b3a96', legs: '#3d2a4f', belt: '#d9a521', color: '#d78bff' },
  trader:   { label: 'Trader',   body: '#2f7a5a', legs: '#3a3326', belt: '#6b4a2a', color: '#5fe0a0', hat: '#1f5a40' },
  worker:   { label: 'Worker',   body: '#b07a3c', legs: '#5a4630', belt: '#4a3520', color: '#ffb050', hat: '#6b4a2a' },
  farmer:   { label: 'Farmer',   body: '#e6dcae', legs: '#4a6fa5', belt: '#8a6a3a', color: '#c8e65a' },
  scribe:   { label: 'Scribe',   body: '#3a5cc0', legs: '#2a3a6a', belt: '#d9c27a', color: '#7fd0ff' },
  bard:     { label: 'Bard',     body: '#c8553a', legs: '#3a2a2a', belt: '#e8c15a', color: '#ff9ec0' },
};
const LOC_ROLE = { castle: 'governor', library: 'scribe', forge: 'worker', barracks: 'knight', market: 'merchant', docks: 'trader', farm: 'farmer', tavern: 'bard' };
const FIRST = ['Aldric','Brenna','Cedric','Dagny','Edmund','Freya','Gareth','Hild','Ivo','Jorah','Kenna','Leofric','Mira','Nedd','Osric','Petra','Rolf','Sybil','Tobias','Ulric','Wulf','Yara','Edda','Bran'];
const roleName = (id, role) => { const f = FIRST[hash(id) % FIRST.length]; return role === 'governor' ? 'Lord ' + f : role === 'knight' ? 'Sir ' + f : f; };

/* ---------------------------------------------------------------- map data */
const ROADS = [
  [[20,23],[20,16],[20,12],[20,9]],
  [[6,9],[20,9],[34,9]],
  [[6,16],[8,16],[20,16],[30,16],[34,16]],
  [[8,16],[8,18]],
  [[30,16],[30,17]],
];
const LOC = {
  castle:   { name: 'CASTLE',   node: '20,9',  slots: [[18,8],[19,8],[21,8],[22,8],[20,8]] },
  library:  { name: 'LIBRARY',  node: '6,9',   slots: [[4,8],[5,8],[7,8],[8,8]] },
  barracks: { name: 'BARRACKS', node: '34,9',  slots: [[32,8],[33,8],[35,8],[36,8]] },
  forge:    { name: 'FORGE',    node: '6,16',  slots: [[4,15],[5,15],[7,15],[8,15]] },
  tavern:   { name: 'TAVERN',   node: '34,16', slots: [[32,15],[33,15],[35,15],[36,15]] },
  market:   { name: 'MARKET',   node: '20,12', slots: [[18,11],[19,13],[21,11],[22,13],[18,13],[22,11]] },
  farm:     { name: 'FARM',     node: '8,18',  slots: [[4,19],[6,20],[10,19],[12,20],[5,21],[11,21]] },
  docks:    { name: 'DOCKS',    node: '30,17', slots: [[30,19],[31,20],[30,21],[31,18]] },
};
const GATE = '20,23';
const nodes = new Map();
const nk = (x, y) => x + ',' + y;
function addNode(x, y) { const k = nk(x, y); if (!nodes.has(k)) nodes.set(k, { x, y, adj: new Set() }); return nodes.get(k); }
const roadTiles = new Set();
for (const line of ROADS) for (let i = 0; i < line.length; i++) {
  const [x, y] = line[i]; addNode(x, y);
  if (i) { const [px, py] = line[i - 1]; const a = addNode(px, py), b = addNode(x, y); a.adj.add(nk(x, y)); b.adj.add(nk(px, py));
    for (let tx = Math.min(px, x); tx <= Math.max(px, x); tx++) for (let ty = Math.min(py, y); ty <= Math.max(py, y); ty++) roadTiles.add(nk(tx, ty)); }
}
function bfs(from, to) {
  const prev = new Map([[from, null]]), q = [from];
  while (q.length) { const c = q.shift(); if (c === to) break; for (const n of nodes.get(c).adj) if (!prev.has(n)) { prev.set(n, c); q.push(n); } }
  const out = []; for (let c = to; c; c = prev.get(c)) out.unshift(c); return out;
}
const footPx = (tx, ty) => [tx * T + 8, ty * T + 13];
const nodePx = k => { const n = nodes.get(k); return footPx(n.x, n.y); };
const isWater = (tx, ty) => ty >= 18 && tx >= (ty < 20 ? 25 : ty < 22 ? 24 : 23);

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
  castle(g);
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
  const treeSpots = spots.filter(([tx, ty]) => !near(tx, ty) && ty > 0 && !(ty >= 8 && ty <= 9) && !(ty >= 15 && ty <= 17 && tx > 2 && tx < 38) && !(tx >= 19 && tx <= 21));
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
function makeSprite(role, frame) {
  const c = document.createElement('canvas'); c.width = 20; c.height = 24; const g = c.getContext('2d');
  const r = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x + 2, y + 1, w, h); };
  const S = ROLES[role], skin = '#f1c9a0', dark = '#2b2118', step = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  r(3, 19, 10, 3, 'rgba(0,0,0,.28)');
  const lh = step === 1 ? 3 : 4, rh = step === -1 ? 3 : 4;
  r(5, 16, 2, lh, S.legs); r(9, 16, 2, rh, S.legs); r(5, 16 + lh, 3, 1, dark); r(9, 16 + rh, 3, 1, dark);
  r(4, 9, 8, 7, S.body); r(4, 13, 8, 1, S.belt); r(4, 9, 8, 1, 'rgba(255,255,255,.18)'); r(4, 15, 8, 1, 'rgba(0,0,0,.18)');
  r(3, 10 + (step === 1 ? 1 : 0), 1, 5, S.body); r(12, 10 + (step === -1 ? 1 : 0), 1, 5, S.body);
  r(3, 15 + (step === 1 ? 1 : 0), 1, 1, skin); r(12, 15 + (step === -1 ? 1 : 0), 1, 1, skin);
  r(5, 3, 6, 6, skin); r(6, 5, 1, 2, dark); r(9, 5, 1, 2, dark); r(5, 8, 6, 1, 'rgba(0,0,0,.12)');
  switch (role) {
    case 'knight': r(4, 2, 8, 3, '#b7c0cf'); r(4, 2, 8, 1, '#e0e6ee'); r(4, 5, 1, 3, '#b7c0cf'); r(11, 5, 1, 3, '#b7c0cf'); r(7, 5, 2, 2, '#9aa4b4'); r(7, 0, 2, 2, '#c0392b'); r(8, -0, 1, 1, '#e8584a');
      r(0, 10, 4, 6, '#2f5fb8'); r(1, 10, 1, 6, '#f0d060'); r(0, 12, 4, 1, '#f0d060'); r(13, 5, 1, 9, '#e6e6ee'); r(12, 13, 3, 1, '#c9a227'); r(13, 14, 1, 2, '#6b4a2a'); break;
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
  }
  const id = g.getImageData(0, 0, 20, 24), d = id.data, A = (x, y) => (x < 0 || y < 0 || x > 19 || y > 23) ? 0 : d[(y * 20 + x) * 4 + 3];
  const out = [];
  for (let y = 0; y < 24; y++) for (let x = 0; x < 20; x++) if (A(x, y) < 200 && (A(x - 1, y) >= 200 || A(x + 1, y) >= 200 || A(x, y - 1) >= 200 || A(x, y + 1) >= 200)) out.push([x, y]);
  g.fillStyle = '#1a120b'; for (const [x, y] of out) g.fillRect(x, y, 1, 1);
  return c;
}
function getSprite(role, frame) { const k = role + frame; return sprites[k] || (sprites[k] = makeSprite(role, frame)); }

/* ---------------------------------------------------------------- agents */
const agents = new Map();
const particles = [];
const stats = { events: 0, errors: 0 };
let clockNow = 0;
const overlay = $('#overlay');

function toolLoc(t) {
  t = (t || '').toLowerCase();
  if (!t) return 'tavern';
  if (t.startsWith('mcp__')) return 'docks';
  if (/^(read|grep|glob|ls|notebookread)$/.test(t)) return 'library';
  if (/^(edit|write|multiedit|notebookedit)$/.test(t)) return 'forge';
  if (t === 'bash' || t === 'shell') return 'barracks';
  if (/web/.test(t)) return 'market';
  if (/^(task|agent|todowrite|exitplanmode|plan)/.test(t)) return 'castle';
  if (/db|sql|data|memory|query|ingest/.test(t)) return 'farm';
  if (/notif|stop|idle|chat|message/.test(t)) return 'tavern';
  return 'castle';
}

function spawn(id, ev, tool) {
  const role = ROLES[ev.role] ? ev.role : LOC_ROLE[toolLoc(tool)];
  const el = document.createElement('div'); el.className = 'ag';
  const nm = document.createElement('div'); nm.className = 'nm'; const bub = document.createElement('div'); bub.className = 'bub';
  el.append(bub, nm); overlay.append(el);
  const [x, y] = nodePx(GATE);
  const a = { id, role, name: String(ev.name || roleName(id, role)).slice(0, 24), x, y, path: [], node: GATE, loc: null, slot: null, state: 'idle', busy: false, busyUntil: 0, facing: 1, anim: Math.random() * 9, lastEvent: now(), status: 'idle', text: '', el, nm, bub, bubUntil: 0, partT: 0, leaving: false };
  nm.textContent = a.name; nm.style.color = ROLES[role].color;
  agents.set(id, a); return a;
}
const now = () => performance.now() / 1000;

function goTo(a, loc) {
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
}

function say(a, text, status, secs) {
  a.bub.className = 'bub on ' + status; a.bub.textContent = '';
  if (status === 'done' || status === 'error') { const b = document.createElement('b'); b.textContent = status === 'done' ? 'DONE' : 'FAILED'; a.bub.append(b); }
  a.bub.append(document.createTextNode(text.slice(0, 48))); a.bubUntil = now() + secs;
}

function burst(x, y, col, n, spread = 1) { for (let i = 0; i < n; i++) particles.push({ x, y, vx: rand(-20, 20) * spread, vy: rand(-45, -15), life: 0, max: rand(.5, 1.1), col, s: Math.random() < .3 ? 2 : 1, g: 70 }); }

function emit(ev) {
  if (!ev || typeof ev !== 'object') return;
  const id = String(ev.agent || 'unknown').slice(0, 40);
  const status = ['start', 'done', 'error', 'idle'].includes(ev.status) ? ev.status : 'start';
  const tool = String(ev.tool || '').slice(0, 60);
  const text = String(ev.text || tool || '...').slice(0, 120);
  const a = agents.get(id) || spawn(id, ev, tool);
  const loc = status === 'idle' ? 'tavern' : (LOC[ev.location] ? ev.location : toolLoc(tool));
  a.lastEvent = now(); a.status = status; a.text = text; a.busy = status === 'start'; a.busyUntil = now() + 10;
  if (a.loc !== loc || a.leaving) goTo(a, loc);
  say(a, text, status === 'idle' ? 'start' : status, status === 'start' ? 6 : 3.5);
  if (status === 'done') burst(a.x, a.y - 14, '#ffd23f', 8);
  if (status === 'error') { burst(a.x, a.y - 14, '#e5484d', 10); stats.errors++; }
  stats.events++;
  logEvent(a, text, status);
  $('#empty').classList.add('hide');
}

const LOCATION_FX = { forge: ['#ff9a2a', 0.12], barracks: ['#ffffff', 0.4], library: ['#7fd0ff', 0.45], market: ['#ffd23f', 0.5], farm: ['#8fd070', 0.4], docks: ['#9fd0ff', 0.35], castle: ['#ffd23f', 0.7], tavern: ['#ff9ec0', 0.8] };

function updateAgent(a, dt, t) {
  a.anim += dt;
  if (a.path.length) {
    const p = a.path[0], dx = p[0] - a.x, dy = p[1] - a.y, d = Math.hypot(dx, dy), step = 36 * dt;
    if (d <= step) { a.x = p[0]; a.y = p[1]; a.path.shift(); } else { a.x += dx / d * step; a.y += dy / d * step; if (Math.abs(dx) > .5) a.facing = dx > 0 ? 1 : -1; }
    a.state = 'walking';
  } else {
    if (a.leaving) { a.el.remove(); agents.delete(a.id); return; }
    a.state = a.busy ? 'working' : 'idle';
  }
  if (a.busy && t > a.busyUntil) a.busy = false;
  const idleFor = t - a.lastEvent;
  if (!a.leaving && idleFor > 16 && a.loc !== 'tavern' && !a.path.length) { a.busy = false; goTo(a, 'tavern'); }
  if (!a.leaving && idleFor > 120) { a.leaving = true; a.loc = null; a.slot = null; if (a.path.length && a.path[a.path.length - 1].slot) a.path.pop(); else if (!a.path.length) a.path.push(nodePx(a.node)); for (const k of bfs(a.node, GATE).slice(1)) a.path.push(nodePx(k)); a.node = GATE; }
  if (a.state === 'working' && LOCATION_FX[a.loc]) { a.partT -= dt; if (a.partT <= 0) { a.partT = LOCATION_FX[a.loc][1] * rand(.7, 1.3); burst(a.x + a.facing * 8, a.y - 6, LOCATION_FX[a.loc][0], 2, .7); } }
  if (a.bubUntil && t > a.bubUntil) { a.bub.classList.remove('on'); a.bubUntil = 0; }
}

function drawAgent(a) {
  let frame = 0, bob = 0;
  if (a.state === 'walking') frame = [1, 0, 2, 0][Math.floor(a.anim * 8) % 4];
  else if (a.state === 'working') { frame = Math.floor(a.anim * 5) % 2 ? 1 : 0; bob = frame ? -1 : 0; }
  else bob = Math.sin(a.anim * 2) > .6 ? -1 : 0;
  const spr = getSprite(a.role, frame), x = Math.round(a.x), y = Math.round(a.y + bob);
  ctx.save(); ctx.translate(x, y - 21);
  if (a.facing < 0) ctx.scale(-1, 1);
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
  const t = ms / 1000, dt = Math.min(.05, t - last); last = t;
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
function logEvent(a, text, status) {
  const log = $('#log'), d = document.createElement('div'); d.className = 'ev ' + status;
  const tm = document.createElement('time'); tm.textContent = new Date().toTimeString().slice(0, 8);
  const who = document.createElement('b'); who.textContent = a.name + ' '; who.style.color = ROLES[a.role].color; who.style.fontWeight = 'normal';
  const sp = document.createElement('span'); sp.textContent = (status === 'done' ? 'finished: ' : status === 'error' ? 'FAILED: ' : status === 'idle' ? 'rests: ' : '') + text;
  d.append(tm, who, sp);
  const stick = log.scrollTop + log.clientHeight >= log.scrollHeight - 30;
  log.append(d); while (log.children.length > 80) log.firstChild.remove();
  if (stick) log.scrollTop = log.scrollHeight;
}
function refreshUi() {
  $('#sAgents').textContent = agents.size; $('#sEvents').textContent = stats.events; $('#sErrors').textContent = stats.errors;
  const ul = $('#roster'); ul.textContent = '';
  for (const a of agents.values()) {
    const li = document.createElement('li'); li.style.setProperty('--c', ROLES[a.role].color); if (a.status === 'error') li.classList.add('error');
    const n = document.createElement('span'); n.className = 'n'; n.textContent = a.name;
    const w = document.createElement('span'); w.className = 'w'; w.textContent = a.leaving ? 'LEAVING' : a.state === 'walking' ? 'TRAVELS' : (LOC[a.loc] ? LOC[a.loc].name : '');
    li.append(n, w); ul.append(li);
  }
}

function fit() {
  const wrap = $('#wrap'), box = $('#box'), pad = 24;
  const s = Math.min((wrap.clientWidth - pad) / CW, (wrap.clientHeight - pad) / CH);
  box.style.width = Math.floor(CW * s) + 'px'; box.style.height = Math.floor(CH * s) + 'px'; box.style.setProperty('--u', s.toFixed(3));
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

buildStatic(); fit(); connect();
if (document.fonts && document.fonts.load) document.fonts.load('8px "Press Start 2P"');
requestAnimationFrame(frame);
$('#demoBtn').addEventListener('click', () => { const s = window.RealmSim; s.running() ? s.stop() : s.start(); setBadge(); });
if (/[?&]demo\b/.test(location.search)) setTimeout(() => { window.RealmSim.start(); setBadge(); }, 300);
setTimeout(() => { if (!liveConnected && !agents.size && window.RealmSim && !window.RealmSim.running() && !/nodemo/.test(location.search)) { window.RealmSim.start(); setBadge(); } }, 1200);
})();

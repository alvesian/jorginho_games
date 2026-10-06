// Jorginho Kart — corrida pseudo-3D (estilo Out Run) num canvas de baixa resolução.
// A pista é uma lista de segmentos com curvatura; cada frame projeta ~130 segmentos
// à frente da câmera e desenha os sprites (pixel art) de trás pra frente.

const LAPS = 3;            // voltas por corrida
const RIVAL_SKILL = 0.84;  // multiplicador da velocidade dos rivais (0.6–1)
const ITEM_DENSITY = 1;    // densidade de casquinhas, milk-shakes e poças (0.5–2)

const SEG = 200, RW = 2000, CAMH = 1000, DRAW = 130, RUMBLE = 3, MAX = 7600;
const CAMD = 1 / Math.tan(50 * Math.PI / 180);
const PZ = CAMH * CAMD;
const LANES = [-0.62, -0.22, 0.22, 0.62];
const BEST_KEY = 'jorginho-kart-best';

const PAL = { o:'#33241a', h:'#6b4a2f', H:'#8a6440', s:'#f1c7a3', b:'#b7c9de', B:'#8f9fb4', k:'#4a8fd6', K:'#2f6aa8', w:'#2a2a2e', W:'#6a6a72', r:'#ff5a4a', g:'#a6a6ad', p:'#ff7aa8', P:'#ffb3cc', c:'#d9a05b', C:'#b07a3a', t:'#4f8c46', T:'#6fb35e', n:'#8a6440' };
const KART = [
  '.......oooooooo.......', '.......ohhhhhho.......', '.......ohHHhhho.......', '.......ohhhhhho.......', '.......ohhhhhho.......',
  '........osssso........', '......oobbbbbboo......', '.....obbbbbbbbbbo.....', '.....obbbbBBbbbbo.....',
  '...ookkkkkkkkkkkkoo...', '..okkkkkkkkkkkkkkkko..', '.okKKkkkkkkkkkkkkKKko.', 'ooKKKKKKKKKKKKKKKKKKoo',
  'owwoKKrrKKKKKKrrKKowwo', 'owwoKKKKKKKKKKKKKKowwo', 'oWwoggggggggggggggowWo', 'owwo..............owwo', '.oo................oo.'
];
const SHAKE = ['....oo....', '...oqqo...', '..oqqqqo..', '.oqPqqqqo.', '.oqqqqqqo.', '..oqqqqo..', '.oooooooo.', '.ommmmmmo.', '.omMmmmmo.', '.ommmmmmo.', '..ommmmo..', '..ommmmo..', '...oooo...'];
const CONE = ['...oooo...', '..oppppo..', '.oppPpppo.', '.opPppppo.', '.oppppppo.', '..oppppo..', '.oooooooo.', '.occcccco.', '..oCccCo..', '..occcco..', '...oCco...', '...occo...', '....oo....'];
const TREE = ['...oooooo...', '..oTTTTTTo..', '.oTTtttttTo.', 'oTttttttttto', 'otttttttttto', 'otttttttttto', '.otttttttto.', '..otttttto..', '...oooooo...', '.....onno...', '.....onno...', '.....onno...', '....oonnoo..'];
const FLAV = [['#ff7aa8', '#ffb3cc'], ['#6b3f2a', '#8a5a3e'], ['#fbf4e6', '#ffffff']];
const RIV = [
  { name: 'Dona Casquinha', ov: { k:'#d8232a', K:'#a8171d', h:'#f0d070', H:'#f7e6a0', b:'#fbf4e6', B:'#d9ccb3' }, base: 1.0, z: 6, off: -0.5 },
  { name: 'Seu Milk-shake', ov: { k:'#ff7aa8', K:'#c9507d', h:'#33241a', H:'#4a3528', b:'#f7e04a', B:'#c9b53a' }, base: 0.96, z: 9, off: 0.5 },
  { name: 'Tio Açaí', ov: { k:'#6fd9a8', K:'#3f9f78', h:'#8a3b1a', H:'#a85a30', b:'#2fe8ff', B:'#23b0c2' }, base: 0.92, z: 12, off: -0.45 }
];
const WIN = ['Três voltas, nenhuma casquinha derrubada. Lenda.', 'Chegou primeiro e ainda pediu uma de chocolate.', 'A Dona Casquinha quer revanche. Jorginho quer sorvete.'];
const LOSE = ['Perdeu a corrida, mas não perdeu a fome.', 'Parou pra ler o cardápio no meio da pista.', 'Escorregou tanto que virou milk-shake.'];

const rng = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const fmt = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); };
const ord = (n) => n + 'º';

const $ = (id) => document.getElementById(id);
const cv = $('cv');
const ctx = cv.getContext('2d');
const keys = {};
let W = 480, H = 270;
let segs, N, L, items, S, g;

let best = null;
try { const b = parseFloat(localStorage.getItem(BEST_KEY)); if (isFinite(b) && b > 0) best = b; } catch (e) {}

// ---------- Pista ----------

function build(density) {
  segs = [];
  const add = (c) => segs.push({ i: segs.length, curve: c, decor: [], items: [] });
  const road = (e, h, l, c) => { for (let i = 0; i < e; i++) add(c * i / e); for (let i = 0; i < h; i++) add(c); for (let i = 0; i < l; i++) add(c * (1 - i / l)); };
  const str = (n) => road(0, n, 0, 0);
  str(60); road(30, 50, 30, 2); str(40); road(30, 60, 30, -3); str(30); road(20, 40, 20, 4); road(20, 40, 20, -4);
  str(60); road(40, 60, 40, 2); str(40); road(30, 50, 30, -2.5); str(50);
  N = segs.length; L = N * SEG;

  const r = rng(7);
  for (let i = 0; i < N; i++) {
    if (i % 7 === 3) { const side = Math.floor(i / 7) % 2 ? 1 : -1; segs[i].decor.push({ k: 'tree', off: side * (1.5 + r() * 1.3), w: 0.9 }); }
    if (i % 45 === 20) segs[i].decor.push({ k: 'board', off: Math.floor(i / 45) % 2 ? 1.75 : -1.75, w: 1.2 });
    if (i % 60 === 50) segs[i].decor.push({ k: 'statue', off: Math.floor(i / 60) % 2 ? -1.5 : 1.5, w: 0.7 });
  }
  segs[2].decor.push({ k: 'gantry', off: 0, w: 3.2 });

  items = [];
  const sc = Math.max(8, Math.round(50 / density)), sp = Math.max(10, Math.round(70 / density));
  for (let i = 20; i < N - 6; i++) {
    if (i % sc === 0) { const it = { k: Math.floor(i / sc) % 2 ? 'shake' : 'cone', off: LANES[Math.floor(r() * 4)], fl: Math.floor(r() * 3), taken: 0, w: 0.22 }; segs[i].items.push(it); items.push(it); }
    if (i % sp === sp - 3) { const it = { k: 'puddle', off: LANES[Math.floor(r() * 4)], fl: Math.floor(r() * 3), taken: 0, w: 0.6 }; segs[i].items.push(it); items.push(it); }
  }
}

function reset() {
  build(ITEM_DENSITY);
  g = {
    pos: 0, px: 0.3, speed: 0, steer: 0, lap: 1, laps: LAPS, t: 0, state: 'count', count: 3.6, go: 0,
    boost: 0, spin: 0, toast: '', toastT: 0, rank: 4, skyOff: 0, final: 0, finalRank: 4, results: [], endLine: '',
    rivals: RIV.map((r) => ({ name: r.name, base: r.base * RIVAL_SKILL, speed: 0, z: r.z * SEG, dist: r.z * SEG, off: r.off, target: r.off, laneT: 2 + Math.random() * 3 }))
  };
  $('endOverlay').hidden = true;
}

const segAt = (z) => segs[Math.floor((((z % L) + L) % L) / SEG)];

// ---------- Sprites ----------

function mk(rows, ov) {
  const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, i) => { if (ch === '.') return; x.fillStyle = (ov && ov[ch]) || PAL[ch]; x.fillRect(i, y, 1, 1); }));
  return c;
}

function makeSprites() {
  const s = {};
  s.karts = [mk(KART), ...RIV.map((r) => mk(KART, r.ov))];
  s.cones = FLAV.map(([p, P]) => mk(CONE, { p, P }));
  s.shakes = FLAV.map(([p, P]) => mk(SHAKE, { q: '#fbf4e6', P: '#ffffff', m: p, M: P }));
  s.tree = mk(TREE);
  s.puddles = FLAV.map(([p, P]) => {
    const c = document.createElement('canvas'); c.width = 40; c.height = 12; const x = c.getContext('2d');
    x.fillStyle = PAL.o; x.beginPath(); x.ellipse(20, 6, 20, 6, 0, 0, 7); x.fill();
    x.fillStyle = p; x.beginPath(); x.ellipse(20, 6, 18, 4.6, 0, 0, 7); x.fill();
    x.fillStyle = P; x.beginPath(); x.ellipse(14, 5, 6, 1.6, 0, 0, 7); x.fill();
    return c;
  });

  const board = document.createElement('canvas'); board.width = 64; board.height = 44;
  {
    const x = board.getContext('2d');
    x.fillStyle = '#8a6440'; x.fillRect(8, 24, 5, 20); x.fillRect(51, 24, 5, 20);
    x.fillStyle = PAL.o; x.fillRect(0, 0, 64, 28); x.fillStyle = '#d8232a'; x.fillRect(2, 2, 60, 24); x.fillStyle = '#fbf4e6'; x.fillRect(5, 5, 54, 18);
    x.fillStyle = '#d8232a'; x.font = '800 11px "Baloo 2", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('CHIQUINHO', 32, 14.5);
  }
  s.board = board;

  const gan = document.createElement('canvas'); gan.width = 160; gan.height = 50;
  {
    const x = gan.getContext('2d');
    [0, 152].forEach((px) => { x.fillStyle = PAL.o; x.fillRect(px, 12, 8, 38); for (let y = 14; y < 48; y += 8) { x.fillStyle = (y / 8) % 2 ? '#d8232a' : '#fbf4e6'; x.fillRect(px + 2, y, 4, 6); } });
    x.fillStyle = PAL.o; x.fillRect(0, 0, 160, 18); x.fillStyle = '#d8232a'; x.fillRect(2, 2, 156, 14);
    x.fillStyle = '#fbf4e6'; x.font = '800 12px "Baloo 2", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('CHIQUINHO', 80, 9.5);
  }
  s.gantry = gan;

  // horizonte de Brasília
  const sky = document.createElement('canvas'); sky.width = 480; sky.height = 70;
  {
    const x = sky.getContext('2d'); const ink = '#ffffff', sh = '#dfe9f0', ln = '#b9c9d4';
    // Catedral — 16 colunas hiperbólicas
    const cx0 = 80, by = 68;
    x.fillStyle = sh; x.fillRect(cx0 - 26, by - 3, 52, 3);
    for (let i = -7; i <= 7; i += 2) {
      x.strokeStyle = i % 4 ? ink : sh; x.lineWidth = 2.2; x.beginPath();
      x.moveTo(cx0 + i * 3, by); x.quadraticCurveTo(cx0 + i * 1.2, by - 16, cx0 + i * 3.6, by - 34); x.stroke();
    }
    x.fillStyle = ink; x.fillRect(cx0 - 1, by - 36, 2, 5); x.fillRect(cx0 - 2.5, by - 34.5, 5, 1.2);
    // Congresso — cúpula, cuia e torres gêmeas
    const gx = 300;
    x.fillStyle = ink; x.fillRect(gx - 70, by - 8, 140, 8);
    x.fillStyle = sh; x.fillRect(gx - 70, by - 2, 140, 2);
    x.fillStyle = ink; x.beginPath(); x.arc(gx - 42, by - 8, 20, Math.PI, 0); x.fill();
    x.fillStyle = sh; x.beginPath(); x.moveTo(gx + 20, by - 12); x.quadraticCurveTo(gx + 44, by - 36, gx + 68, by - 12); x.closePath(); x.fill();
    x.fillStyle = ink; x.fillRect(gx + 20, by - 13, 48, 2);
    x.fillStyle = ink; x.fillRect(gx - 7, by - 64, 6, 56); x.fillRect(gx + 1, by - 64, 6, 56);
    x.fillStyle = ln; for (let y = by - 60; y < by - 10; y += 4) { x.fillRect(gx - 7, y, 6, 1); x.fillRect(gx + 1, y, 6, 1); }
    x.fillStyle = ink; x.fillRect(gx - 7, by - 38, 14, 2);
    // Torre de TV
    const tx = 440;
    x.strokeStyle = ink; x.lineWidth = 1.5; x.beginPath(); x.moveTo(tx - 10, by); x.lineTo(tx, by - 48); x.lineTo(tx + 10, by); x.stroke();
    x.beginPath(); x.moveTo(tx, by - 48); x.lineTo(tx, by - 66); x.stroke();
    x.fillStyle = ink; x.fillRect(tx - 7, by - 30, 14, 2.5); x.fillRect(tx - 4, by - 18, 8, 1.5);
  }
  s.skyline = sky;
  S = s;
}

// ---------- Lógica ----------

function toast(t, d) { g.toast = t; g.toastT = d || 1.4; g.toastId = (g.toastId || 0) + 1; }

function update(dt) {
  g.toastT = Math.max(0, g.toastT - dt);
  if (g.state === 'count') { g.count -= dt; if (g.count <= 0) { g.state = 'race'; g.go = 0.8; } return; }
  g.go = Math.max(0, g.go - dt);
  if (g.state === 'done') { updRivals(dt); g.speed = Math.max(0, g.speed - MAX * 0.5 * dt); g.pos += g.speed * dt; return; }

  g.t += dt;
  const spd = g.speed / MAX, seg = segAt(g.pos + PZ), dx = dt * 2 * spd;
  const steer = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
  if (g.spin <= 0) { g.px += dx * steer * 1.15; g.steer = steer; } else g.steer = 0;
  g.px -= dx * spd * seg.curve * 0.3; // força centrífuga

  const top = g.boost > 0 ? MAX * 1.35 : MAX;
  if (g.spin > 0) g.speed -= MAX * 0.6 * dt;
  else if (keys.up) g.speed += (g.boost > 0 ? MAX * 0.9 : MAX / 3.2) * dt;
  else if (keys.down) g.speed -= MAX * dt;
  else g.speed -= MAX / 5 * dt;
  if (Math.abs(g.px) > 1 && g.speed > MAX / 4) g.speed -= MAX / 2 * dt; // grama freia
  g.speed = clamp(g.speed, 0, top);
  g.px = clamp(g.px, -2.3, 2.3);
  g.boost = Math.max(0, g.boost - dt); g.spin = Math.max(0, g.spin - dt);
  g.pos += g.speed * dt;
  g.skyOff += seg.curve * spd * dt * 0.5;
  items.forEach((it) => { it.taken = Math.max(0, it.taken - dt); });

  while (g.pos >= L) {
    g.pos -= L; g.lap++;
    if (g.lap > g.laps) { finish(); return; }
    toast(g.lap === g.laps ? 'ÚLTIMA VOLTA!' : 'VOLTA ' + g.lap, 1.6);
  }

  segAt(g.pos + PZ).items.forEach((it) => {
    if (it.taken > 0 || Math.abs(it.off - g.px) > 0.36) return;
    if (it.k === 'cone') { g.boost = 1.6; it.taken = 12; toast('CASQUINHA! TURBO', 1.2); }
    else if (it.k === 'shake') { g.boost = 2.4; it.taken = 12; toast('MILK-SHAKE! TURBÃO', 1.2); }
    else { g.spin = 0.9; g.boost = 0; g.speed *= 0.45; it.taken = 2.5; toast('ESCORREGOU NO SORVETE DERRETIDO', 1.6); }
  });

  updRivals(dt);
  const pz = g.pos + PZ;
  g.rivals.forEach((r) => {
    const dz = ((r.z - pz) % L + L) % L;
    if (dz < SEG * 0.9 && Math.abs(r.off - g.px) < 0.42 && g.speed > r.speed) {
      g.speed = r.speed * 0.7; g.pos = Math.max(0, g.pos - (SEG * 0.9 - dz)); toast('BATIDA!', 0.8);
    }
  });
  const pd = (g.lap - 1) * L + g.pos + PZ;
  g.rank = 1 + g.rivals.filter((r) => r.dist > pd).length;
}

function updRivals(dt) {
  g.rivals.forEach((r) => {
    const c = segAt(r.z).curve;
    const target = r.base * MAX * (1 - Math.abs(c) * 0.03);
    r.speed += (target - r.speed) * Math.min(1, dt * 1.5);
    r.dist += r.speed * dt; r.z = r.dist % L;
    r.laneT -= dt;
    if (r.laneT <= 0) { r.target = LANES[Math.floor(Math.random() * 4)]; r.laneT = 3 + Math.random() * 4; }
    r.off += (r.target - r.off) * Math.min(1, dt * 0.8);
  });
}

function finish() {
  g.state = 'done'; g.final = g.t; g.lap = g.laps;
  const pd = g.laps * L + PZ;
  g.finalRank = 1 + g.rivals.filter((r) => r.dist > pd).length; g.rank = g.finalRank;
  const all = [{ name: 'Jorginho', dist: pd, me: true }, ...g.rivals.map((r) => ({ name: r.name, dist: r.dist }))].sort((a, b) => b.dist - a.dist);
  g.endLine = (g.finalRank === 1 ? WIN : LOSE)[Math.floor(Math.random() * 3)];
  if (g.finalRank === 1 && (!best || g.final < best)) {
    best = g.final;
    try { localStorage.setItem(BEST_KEY, String(g.final)); } catch (e) {}
  }

  $('endTitle').textContent = g.finalRank === 1 ? 'Jorginho venceu!' : 'Jorginho chegou em ' + ord(g.finalRank);
  $('endLine').textContent = g.endLine;
  $('finalTime').textContent = fmt(g.final);
  const list = $('results');
  list.innerHTML = '';
  all.forEach((a, i) => {
    const row = document.createElement('div');
    row.className = 'result' + (a.me ? ' me' : '');
    row.innerHTML = `<span class="result-pos">${ord(i + 1)}</span><span class="result-name"></span>`;
    row.lastChild.textContent = a.name;
    list.appendChild(row);
  });
  $('endOverlay').hidden = false;
}

// ---------- Render ----------

function proj(z, camX, camZ) {
  const cz = z - camZ, sc = CAMD / cz;
  return { cz, sc, x: Math.round(W / 2 - sc * camX * W / 2), y: Math.round(H / 2 + sc * CAMH * H / 2), w: Math.round(sc * RW * W / 2) };
}

function poly(x1, y1, x2, y2, x3, y3, x4, y4, col) {
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4); ctx.closePath(); ctx.fill();
}

function hills(hy, amp, k, off, col, ph) {
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, hy);
  for (let x = 0; x <= W; x += 6) ctx.lineTo(x, hy - amp * (0.55 + 0.45 * Math.sin((x + off) * k + ph)) - amp * 0.3 * Math.sin((x + off) * k * 2.7 + ph));
  ctx.lineTo(W, hy); ctx.closePath(); ctx.fill();
}

// Desenha um sprite cortando a parte que fica atrás de um morro/segmento mais próximo.
function spr(img, dx, dy, dw, dh, clipY) {
  const clipH = clipY ? Math.max(0, dy + dh - clipY) : 0;
  if (clipH < dh && dw > 0) ctx.drawImage(img, 0, 0, img.width, img.height - img.height * clipH / dh, dx, dy, dw, dh - clipH);
}

function drawSeg(s) {
  const p1 = s.p1, p2 = s.p2, alt = Math.floor(s.i / RUMBLE) % 2;
  const fin = s.i < 3; // linha de chegada quadriculada
  const grass = alt ? '#8fcf6a' : '#82c45e';
  const rumble = fin ? (s.i % 2 ? '#fbf4e6' : '#3a2a1c') : (alt ? '#d8232a' : '#fbf4e6');
  const road = fin ? (s.i % 2 ? '#fbf4e6' : '#3a2a1c') : (alt ? '#6e6e75' : '#68686f');
  const r1 = p1.w / 6, r2 = p2.w / 6, l1 = p1.w / 32, l2 = p2.w / 32;
  ctx.fillStyle = grass; ctx.fillRect(0, p2.y, W, p1.y - p2.y);
  poly(p1.x - p1.w - r1, p1.y, p1.x - p1.w, p1.y, p2.x - p2.w, p2.y, p2.x - p2.w - r2, p2.y, rumble);
  poly(p1.x + p1.w + r1, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x + p2.w + r2, p2.y, rumble);
  poly(p1.x - p1.w, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x - p2.w, p2.y, road);
  if (alt && !fin) poly(p1.x - l1 / 2, p1.y, p1.x + l1 / 2, p1.y, p2.x + l2 / 2, p2.y, p2.x - l2 / 2, p2.y, '#fbf4e6');
  if (s.fog > 0.02) { ctx.globalAlpha = s.fog; ctx.fillStyle = '#dff0f7'; ctx.fillRect(0, p2.y, W, p1.y - p2.y); ctx.globalAlpha = 1; }
}

function draw() {
  if (!S) return;
  const spd = g.speed / MAX;
  ctx.imageSmoothingEnabled = false;

  // céu, sol e morros com parallax
  const sk = ctx.createLinearGradient(0, 0, 0, H / 2); sk.addColorStop(0, '#8fcdee'); sk.addColorStop(1, '#eaf6fb');
  ctx.fillStyle = sk; ctx.fillRect(0, 0, W, H / 2 + 2);
  ctx.fillStyle = '#fbf4e6'; ctx.beginPath(); ctx.arc(W * 0.78 - g.skyOff * 20, H * 0.16, H * 0.07, 0, 7); ctx.fill();
  hills(H / 2 + 1, H * 0.1, 0.012, g.skyOff * 40, '#cfe6d8', 0);
  {
    const sk = S.skyline, sw = W * 1.4, sh = sw * sk.height / sk.width, sx = ((-g.skyOff * 60) % sw + sw) % sw;
    ctx.globalAlpha = 0.95;
    ctx.drawImage(sk, sx - sw, H / 2 + 1 - sh + H * 0.02, sw, sh);
    ctx.drawImage(sk, sx, H / 2 + 1 - sh + H * 0.02, sw, sh);
    ctx.globalAlpha = 1;
  }
  hills(H / 2 + 1, H * 0.065, 0.02, g.skyOff * 90, '#a9d98a', 2);
  ctx.fillStyle = '#8fcf6a'; ctx.fillRect(0, H / 2, W, H / 2);

  // estrada: frente pra trás
  const base = segAt(g.pos), basePct = (g.pos % SEG) / SEG, camX = g.px * RW;
  let x = 0, dx = -(base.curve * basePct), maxy = H;
  for (let n = 0; n < DRAW; n++) {
    const s = segs[(base.i + n) % N], looped = s.i < base.i, camZ = g.pos - (looped ? L : 0);
    s.p1 = proj(s.i * SEG, camX - x, camZ);
    s.p2 = proj((s.i + 1) * SEG, camX - x - dx, camZ);
    x += dx; dx += s.curve; s.clip = maxy; s.fog = 1 - 1 / Math.exp((n / DRAW) ** 2 * 4.5);
    if (s.p1.cz <= CAMD || s.p2.y >= maxy || s.p2.y >= s.p1.y) continue;
    drawSeg(s); maxy = s.p1.y;
  }

  // sprites: trás pra frente
  for (let n = DRAW - 1; n >= 0; n--) {
    const s = segs[(base.i + n) % N];
    if (s.p1.cz <= CAMD) continue;
    const p = s.p1;
    s.decor.forEach((d) => {
      const img = d.k === 'tree' ? S.tree : d.k === 'board' ? S.board : d.k === 'statue' ? S.cones[0] : S.gantry;
      const dw = d.w * p.w, dh = dw * img.height / img.width;
      spr(img, p.x + p.w * d.off - dw / 2, p.y - dh, dw, dh, s.clip);
    });
    s.items.forEach((it) => {
      if (it.k !== 'puddle' && it.taken > 0) return;
      const img = it.k === 'cone' ? S.cones[it.fl] : it.k === 'shake' ? S.shakes[it.fl] : S.puddles[it.fl];
      const dw = it.w * p.w, dh = dw * img.height / img.width;
      spr(img, p.x + p.w * it.off - dw / 2, p.y - dh + (it.k === 'puddle' ? dh * 0.6 : 0), dw, dh, s.clip);
    });
    g.rivals.forEach((r, i) => {
      if (segAt(r.z).i !== s.i) return;
      const pct = (r.z % SEG) / SEG, img = S.karts[i + 1];
      const rw = lerp(p.w, s.p2.w, pct), rx = lerp(p.x, s.p2.x, pct), ry = lerp(p.y, s.p2.y, pct);
      const dw = 0.28 * rw, dh = dw * img.height / img.width;
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(rx + rw * r.off, ry - dh * 0.03, dw * 0.5, dh * 0.08, 0, 0, 7); ctx.fill();
      spr(img, rx + rw * r.off - dw / 2, ry - dh, dw, dh, s.clip);
    });
  }

  // kart do Jorginho
  const img = S.karts[0], ps = Math.max(3, Math.round(W / 115)), dw = img.width * ps, dh = img.height * ps;
  const shake = Math.abs(g.px) > 1 && spd > 0.1 ? (Math.random() - 0.5) * 3 : 0;
  const cx = W / 2, cy = H - dh * 0.5 - Math.max(H * 0.05, kartLift) + Math.sin(g.t * 28) * spd * 1.2 + shake;
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(cx, cy + dh * 0.44, dw * 0.5, dh * 0.07, 0, 0, 7); ctx.fill();
  ctx.save(); ctx.translate(cx, cy);
  if (g.spin > 0) ctx.rotate((1 - g.spin / 0.9) * Math.PI * 2); else ctx.rotate(g.steer * 0.07 * spd);
  if (g.boost > 0) {
    [-0.3, 0.3].forEach((fx) => {
      const fh = dh * (0.25 + Math.random() * 0.3);
      ctx.fillStyle = '#ffb020'; ctx.fillRect(fx * dw - ps, dh * 0.42, ps * 2, fh);
      ctx.fillStyle = '#f7e04a'; ctx.fillRect(fx * dw - ps / 2, dh * 0.42, ps, fh * 0.6);
    });
  }
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();

  if (g.boost > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
      const sx = Math.random() < 0.5 ? Math.random() * W * 0.22 : W - Math.random() * W * 0.22, sy = H * 0.45 + Math.random() * H * 0.5;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + 14 + Math.random() * 30); ctx.stroke();
    }
  }
}

// ---------- HUD ----------

const hud = {
  lap: $('lap'), laps: $('laps'), rank: $('rank'), kmh: $('kmh'), time: $('time'),
  best: document.querySelectorAll('.best'), toastWrap: $('toastWrap'), toast: $('toast'),
  bigWrap: $('bigWrap'), big: $('big')
};
const shown = {};

// Só mexe no DOM quando o valor muda.
function setText(key, el, v) {
  if (shown[key] === v) return false;
  shown[key] = v;
  if (el) el.textContent = v;
  return true;
}

function renderHud() {
  setText('lap', hud.lap, String(Math.min(g.lap, g.laps)));
  setText('laps', hud.laps, String(g.laps));
  setText('rank', hud.rank, ord(g.rank));
  setText('kmh', hud.kmh, String(Math.round(g.speed / MAX * 120)));
  setText('time', hud.time, fmt(g.t));
  const bestLabel = best ? fmt(best) : '--:--';
  if (setText('best', null, bestLabel)) hud.best.forEach((el) => { el.textContent = bestLabel; });

  // toast: reinicia a animação quando o texto muda
  const hasToast = g.toastT > 0 && g.state !== 'count';
  hud.toastWrap.hidden = !hasToast;
  if (hasToast && setText('toastId', null, g.toastId)) {
    hud.toast.textContent = g.toast;
    hud.toast.style.animation = 'none';
    void hud.toast.offsetWidth;
    hud.toast.style.animation = '';
  }

  // contagem 3, 2, 1, VAI!
  const c = Math.ceil(g.count);
  let big = '';
  if (g.state === 'count') big = String(Math.max(1, Math.min(3, c)));
  else if (g.state === 'race' && g.go > 0) big = 'VAI!';
  hud.bigWrap.hidden = !big;
  if (setText('big', null, big) && big) {
    hud.big.textContent = big;
    hud.big.classList.toggle('go', big === 'VAI!');
    hud.big.style.animation = 'none';
    void hud.big.offsetWidth;
    hud.big.style.animation = '';
  }
}

// ---------- Entrada ----------

const KEYMAP = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down' };

function onKey(e) {
  if (e.key === ' ' || e.key === 'Enter') {
    if (e.target && e.target.tagName === 'A') return;
    e.preventDefault();
    if (e.type === 'keydown' && g.state === 'done') restart();
    return;
  }
  const k = KEYMAP[e.key.toLowerCase()];
  if (k) { e.preventDefault(); keys[k] = e.type === 'keydown'; }
}
window.addEventListener('keydown', onKey);
window.addEventListener('keyup', onKey);
window.addEventListener('blur', () => { Object.keys(keys).forEach((k) => { keys[k] = false; }); });

document.querySelectorAll('.key[data-key]').forEach((btn) => {
  const k = btn.dataset.key;
  const down = (e) => { e.preventDefault(); keys[k] = true; btn.classList.add('on'); };
  const up = () => { keys[k] = false; btn.classList.remove('on'); };
  btn.addEventListener('pointerdown', down);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, up));
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
});

function restart() { reset(); renderHud(); }
$('restart').addEventListener('click', restart);

// ---------- Loop ----------

let kartLift = 0; // altura (em px do canvas) ocupada pelos controles de baixo

function fit() {
  const r = cv.parentElement.getBoundingClientRect();
  W = 480; H = clamp(Math.round(480 * r.height / Math.max(1, r.width)), 200, 960);
  cv.width = W; cv.height = H;
  // sobe o kart pra ficar acima dos botões/velocímetro
  const tops = [...document.querySelectorAll('.controls > *')].map((el) => el.getBoundingClientRect().top).filter((t) => t > r.top + r.height / 2);
  kartLift = tops.length ? Math.max(0, (r.bottom - Math.min(...tops) + 8) * H / r.height) : H * 0.05;
}
fit();
new ResizeObserver(fit).observe(cv.parentElement);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

reset();
makeSprites();
// recria as placas quando a fonte Baloo carregar
if (document.fonts && document.fonts.load) document.fonts.load('800 12px "Baloo 2"').then(makeSprites).catch(() => {});

let last = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt); draw(); renderHud();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

'use strict';

// ---- Constantes do mundo ----
const T = 78, COLS = 9, EXT = 5;
const TILT = 58, YAW = 15;
const LANES = [
  { t: 'walk' },
  { t: 'grass' },
  { t: 'road', d: 1, s: 1.7, n: 2 },
  { t: 'road', d: -1, s: 2.3, n: 2 },
  { t: 'walk' },
  { t: 'road', d: -1, s: 1.9, n: 3 },
  { t: 'road', d: 1, s: 2.8, n: 2 },
  { t: 'grass' },
  { t: 'road', d: 1, s: 1.5, n: 3 },
  { t: 'road', d: -1, s: 3.2, n: 2 },
  { t: 'road', d: 1, s: 2.0, n: 2 },
  { t: 'walk' },
  { t: 'grass' },
  { t: 'road', d: -1, s: 2.6, n: 3 },
  { t: 'goal' }
];
const CARP = [
  ['#ef6b52', '#cf4a32', '#ab3520'],
  ['#5c8fc4', '#4571a5', '#355a86'],
  ['#f0cc5c', '#d3ac37', '#b18d20'],
  ['#efe8dc', '#cfc6b6', '#b2a795'],
  ['#6cae7b', '#4f9260', '#3b7549'],
  ['#8f7ab8', '#71609b', '#584a7c']
];
const GOAL = LANES.length - 1;
const TRAFFIC_SPEED = 1;
const BEST_KEY = 'jorginho.chiquinho.best';

// ---- DOM ----
const $ = (sel) => document.querySelector(sel);
const camEl = $('#cam');
const worldEl = $('#world');
const crossedEl = $('#crossed');
const bestEl = $('#best');
const deadOverlay = $('#deadOverlay');
const winOverlay = $('#winOverlay');

// Caixa 3D em CSS: tampa (top), lateral (side) e frente (end).
function makeBox(w, d, h, c, r) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:absolute;left:0;top:0;transform-style:preserve-3d';
  const rad = r ? `border-radius:${r}px;` : '';
  const top = document.createElement('div');
  top.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${d}px;background:${c[0]};${rad}transform:translateZ(${h}px)`;
  const side = document.createElement('div');
  side.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${h}px;background:${c[1]};transform-origin:0 0;transform:translateY(${d}px) rotateX(90deg)`;
  const end = document.createElement('div');
  end.style.cssText = `position:absolute;left:0;top:0;width:${h}px;height:${d}px;background:${c[2]};transform-origin:0 0;transform:translateX(${w}px) rotateY(-90deg)`;
  wrap.append(top, side, end);
  return wrap;
}

function place(el, x, y, z) {
  el.style.transform = `translate3d(${x}px,${y}px,${z || 0}px)`;
}

// ---- Cenário estático ----
function buildWorld() {
  worldEl.style.transform = `rotateX(${TILT}deg) rotateZ(${YAW}deg)`;

  LANES.forEach((l, row) => {
    const lane = document.createElement('div');
    let bg;
    if (l.t === 'road') bg = 'background-color:#484a53;background-image:repeating-linear-gradient(90deg,rgba(246,238,220,.8) 0 34px,rgba(0,0,0,0) 34px 78px);background-size:100% 5px;background-repeat:no-repeat;background-position:0 50%;';
    else if (l.t === 'grass') bg = `background-color:${row % 2 ? '#9cb865' : '#94b05c'};`;
    else if (l.t === 'goal') bg = 'background-color:#e6d9bd;background-image:repeating-linear-gradient(90deg,rgba(216,35,42,.13) 0 26px,rgba(0,0,0,0) 26px 52px);';
    else bg = 'background-color:#d9d1bf;background-image:repeating-linear-gradient(90deg,rgba(58,42,28,.07) 0 1px,rgba(0,0,0,0) 1px 78px);';
    lane.style.cssText = `position:absolute;left:${-EXT * T}px;top:${-row * T}px;width:${(COLS + 2 * EXT) * T}px;height:${T}px;${bg}`;
    worldEl.appendChild(lane);
  });

  const ring = document.createElement('div');
  ring.style.cssText = `position:absolute;left:${4 * T + 9}px;top:${-GOAL * T + 9}px;width:60px;height:60px;border-radius:50%;border:5px dashed rgba(216,35,42,.55)`;
  worldEl.appendChild(ring);

  // Árvores nos canteiros
  LANES.forEach((l, row) => {
    if (l.t !== 'grass') return;
    [0.15, 7.55, row % 2 ? 3.2 : 5.4, -2.4, -4.3, 10.2, 12.1].forEach((x, i) => {
      const h = 52 + ((row * 3 + i) % 3) * 14;
      const tree = makeBox(40, 40, h, ['#5f9a58', '#487f44', '#376634'], 6);
      place(tree, x * T + 16, -row * T + 18, 0);
      worldEl.appendChild(tree);
    });
  });

  // Sorveteria do Chiquinho
  const shopX = 4.5 * T - 140, shopY = -GOAL * T - 116;
  const shop = makeBox(280, 156, 122, ['#fbf4e6', '#f0e6d2', '#ded1b8'], 6);
  place(shop, shopX, shopY, 0);
  worldEl.appendChild(shop);
  const awning = makeBox(308, 30, 14, ['#d8232a', '#b81b21', '#9c1519'], 4);
  place(awning, shopX - 14, shopY + 146, 86);
  worldEl.appendChild(awning);

  // Placa sempre virada pra câmera
  const signWrap = document.createElement('div');
  signWrap.style.cssText = `position:absolute;left:0;top:0;transform-style:preserve-3d;transform:translate3d(${4.5 * T - 70}px,${shopY + 150}px,136px) rotateZ(${-YAW}deg) rotateX(${-TILT}deg);width:140px;display:flex;justify-content:center`;
  signWrap.innerHTML = '<div class="sign"><div class="sign-icon"><div class="sign-scoop"></div></div><div class="sign-name">CHIQUINHO</div></div>';
  worldEl.appendChild(signWrap);
}

// ---- Estado do jogo ----
let best = Number(localStorage.getItem(BEST_KEY)) || 0;
let g = null;

function crossedAt(row) {
  let n = 0;
  for (let i = 0; i < row; i++) if (LANES[i].t === 'road') n++;
  return n;
}

function reset() {
  if (g) g.cars.forEach((c) => c.el.remove());
  const cars = [];
  LANES.forEach((l, row) => {
    if (l.t !== 'road') return;
    const n = l.n + 1;
    for (let i = 0; i < n; i++) {
      const truck = (row + i) % 4 === 0;
      const car = {
        row, dir: l.d, sp: l.s,
        x: -EXT + i * ((COLS + 2 * EXT) / n) + (row % 3) * 0.7,
        w: truck ? 168 : 116, h: truck ? 52 : 36,
        c: CARP[(row * 2 + i) % CARP.length]
      };
      car.el = makeBox(car.w, 48, car.h, car.c, 4);
      worldEl.appendChild(car.el);
      cars.push(car);
    }
  });
  g = { px: 4, row: 0, ax: 4, arow: 0, hop: 0, cars, status: 'play', max: 0, cx: null, cy: null };
}

// ---- Jorginho ----
let shadowEl, bodyEl, headEl;
function buildPlayer() {
  shadowEl = document.createElement('div');
  shadowEl.style.cssText = 'position:absolute;left:0;top:0;width:46px;height:46px;border-radius:50%;background:rgba(58,42,28,.22)';
  bodyEl = makeBox(42, 42, 34, ['#4a86c9', '#3a6ca6', '#2c5583'], 5);
  headEl = makeBox(34, 34, 30, ['#f3d9b8', '#e0c19b', '#c9a87f'], 7);
  worldEl.append(shadowEl, bodyEl, headEl);
}

// ---- Ações ----
function move(dx, drow) {
  if (g.status !== 'play') return;
  if (Math.abs(g.px - g.ax) + Math.abs(g.row - g.arow) > 0.3) return;
  g.px = Math.max(0, Math.min(COLS - 1, g.px + dx));
  g.row = Math.max(0, Math.min(GOAL, g.row + drow));
  if (g.row > g.max) {
    g.max = g.row;
    if (crossedAt(g.max) > best) {
      best = crossedAt(g.max);
      localStorage.setItem(BEST_KEY, String(best));
    }
  }
  if (g.row === GOAL) g.status = 'win';
}

function restart() {
  reset();
  syncOverlays();
}

// ---- Simulação ----
function step(dt) {
  g.cars.forEach((c) => {
    c.x += c.dir * c.sp * dt * TRAFFIC_SPEED;
    const span = c.w / T;
    if (c.dir > 0 && c.x > COLS + EXT) c.x = -EXT - span;
    if (c.dir < 0 && c.x < -EXT - span) c.x = COLS + EXT;
  });

  const k = 1 - Math.pow(0.0009, dt);
  g.ax += (g.px - g.ax) * k;
  g.arow += (g.row - g.arow) * k;
  const dist = Math.abs(g.px - g.ax) + Math.abs(g.row - g.arow);
  g.hop = Math.sin(Math.min(1, dist / 0.95) * Math.PI) * 30;

  if (g.status === 'play') {
    const lane = Math.round(g.arow);
    if (LANES[lane] && LANES[lane].t === 'road' && Math.abs(g.arow - lane) < 0.38 && g.hop < 22) {
      const pl = g.ax * T + 18, pr = pl + 42;
      for (const c of g.cars) {
        if (c.row !== lane) continue;
        const cl = c.x * T, cr = cl + c.w;
        if (pr > cl && pl < cr) { g.status = 'dead'; break; }
      }
    }
  }
}

// ---- Render ----
function render() {
  const cos = Math.cos(TILT * Math.PI / 180);
  const ca = Math.cos(YAW * Math.PI / 180), sa = Math.sin(YAW * Math.PI / 180);
  const camX = 4.5 * T, camY = -g.arow * T;
  const sx = camX * ca - camY * sa;
  const sy = (camX * sa + camY * ca) * cos;
  if (g.cx === null) { g.cx = sx; g.cy = sy; }
  g.cx += (sx - g.cx) * 0.12;
  g.cy += (sy - g.cy) * 0.12;
  camEl.style.transform = `translate(${-g.cx}px,${-g.cy}px)`;

  g.cars.forEach((c) => place(c.el, c.x * T, -c.row * T + 15, 0));

  const px = g.ax * T, py = -g.arow * T;
  place(shadowEl, px + 16, py + 20, 1);
  place(bodyEl, px + 18, py + 18, g.hop);
  place(headEl, px + 22, py + 22, 34 + g.hop);

  crossedEl.textContent = crossedAt(g.max);
  bestEl.textContent = best;
  syncOverlays();
}

function syncOverlays() {
  deadOverlay.hidden = g.status !== 'dead';
  winOverlay.hidden = g.status !== 'win';
}

// ---- Entrada ----
window.addEventListener('keydown', (e) => {
  const k = e.key;
  if (k === ' ' || k === 'Enter') {
    e.preventDefault();
    if (g.status !== 'play') restart();
    return;
  }
  const m = {
    ArrowUp: [0, 1], w: [0, 1],
    ArrowDown: [0, -1], s: [0, -1],
    ArrowLeft: [-1, 0], a: [-1, 0],
    ArrowRight: [1, 0], d: [1, 0]
  }[k.length === 1 ? k.toLowerCase() : k];
  if (m) { e.preventDefault(); move(m[0], m[1]); }
});

const DIRS = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] };
document.querySelectorAll('[data-move]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const m = DIRS[btn.dataset.move];
    move(m[0], m[1]);
  });
});
document.querySelectorAll('[data-restart]').forEach((btn) => {
  btn.addEventListener('click', restart);
});

// ---- Loop ----
buildWorld();
buildPlayer();
reset();
$('#totalRoads').textContent = LANES.filter((l) => l.t === 'road').length;
$('#winRoads').textContent = LANES.filter((l) => l.t === 'road').length;

let last = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  step(dt);
  render();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

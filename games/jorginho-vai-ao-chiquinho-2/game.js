'use strict';

// ---- Câmera ----
const T = 78;
const TILT = 58, YAW = 15;

// ---- Fase 1: a rua ----
const COLS = 9, EXT = 5;
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
const TOTAL_ROADS = LANES.filter((l) => l.t === 'road').length;
const TRAFFIC_SPEED = 1;
const BEST_KEY = 'jorginho.chiquinho2.best';

// ---- Fase 2: a academia ----
const GCOLS = 7, GROWS = 6;
const REPS = 10;
const MACHINES = [
  { id: 'supino', label: 'SUPINO', x: 1, row: 3, verbs: ['DESCE', 'EMPURRA'] },
  { id: 'agacho', label: 'AGACHAMENTO', x: 3, row: 4, verbs: ['AGACHA', 'LEVANTA'] },
  { id: 'rosca', label: 'ROSCA', x: 5, row: 3, verbs: ['PUXA', 'SOLTA'] }
];
const STEEL = ['#cfcac1', '#ada8a0', '#8d8983'];
const IRON = ['#5a5560', '#48434f', '#3a3642'];
const RED = ['#d8232a', '#b81b21', '#9c1519'];
const MAT_OFF = ['#302b3c', '#282331', '#201c28'];
const MAT_ON = ['#5c2f45', '#4a2537', '#3b1e2c'];
const NEON = ['#ff2fb8', '#2fe8ff', '#f7e04a', '#5cff8f'];
const FLASH_MS = 2600;

// ---- DOM ----
const $ = (sel) => document.querySelector(sel);
const bgEl = $('#bg');
const camEl = $('#cam');
const worldEl = $('#world');
const subtitleEl = $('#subtitle');
const hudStreet = $('#hudStreet');
const hudGym = $('#hudGym');
const crossedEl = $('#crossed');
const bestEl = $('#best');
const doneCountEl = $('#doneCount');
const hudRepsEl = $('#hudReps');
const walkControls = $('#walkControls');
const repPanel = $('#repPanel');
const repNameEl = $('#repName');
const repNowEl = $('#repNow');
const repBarEl = $('#repBar');
const repBtnL = $('#repBtnL');
const repBtnR = $('#repBtnR');
const deadOverlay = $('#deadOverlay');
const flashOverlay = $('#flashOverlay');
const doneOverlay = $('#doneOverlay');
const ratPanes = [$('#ratFeed'), $('#ratForm'), $('#ratDone')];

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
  wrap.faces = [top, side, end];
  return wrap;
}

function place(el, x, y, z) {
  el.style.transform = `translate3d(${x}px,${y}px,${z || 0}px)`;
}

function paintBox(el, c) {
  el.faces[0].style.background = c[0];
  el.faces[1].style.background = c[1];
  el.faces[2].style.background = c[2];
}

// Altura da caixa muda em tempo real (o Jorginho agachando).
function setBoxHeight(el, h) {
  el.faces[0].style.transform = `translateZ(${h}px)`;
  el.faces[1].style.height = `${h}px`;
  el.faces[2].style.width = `${h}px`;
}

// Adiciona uma caixa já posicionada no mundo.
function addBox(x, y, z, w, d, h, c, r) {
  const el = makeBox(w, d, h, c, r);
  place(el, x, y, z);
  worldEl.appendChild(el);
  return el;
}

// Painel que sempre encara a câmera (desfaz a rotação do mundo).
function addBillboard(x, y, z, w, html) {
  const el = document.createElement('div');
  el.style.cssText = `position:absolute;left:0;top:0;transform-style:preserve-3d;transform:translate3d(${x}px,${y}px,${z}px) rotateZ(${-YAW}deg) rotateX(${-TILT}deg);width:${w}px;display:flex;justify-content:center`;
  el.innerHTML = html;
  worldEl.appendChild(el);
  return el;
}

// ---- Estado ----
let best = Number(localStorage.getItem(BEST_KEY)) || 0;
let g = null;
let flashTimer = null;
// Elementos que mudam a cada quadro
let shadowEl, bodyEl, headEl;
let neonTop = [], neonSide = [], lastBeat = -1;

function clearWorld() {
  worldEl.innerHTML = '';
  neonTop = [];
  neonSide = [];
  lastBeat = -1;
}

function buildPlayer(shirt, shadow) {
  shadowEl = document.createElement('div');
  shadowEl.style.cssText = `position:absolute;left:0;top:0;width:46px;height:46px;border-radius:50%;background:${shadow}`;
  bodyEl = makeBox(42, 42, 34, shirt, 5);
  headEl = makeBox(34, 34, 30, ['#f3d9b8', '#e0c19b', '#c9a87f'], 7);
  worldEl.append(shadowEl, bodyEl, headEl);
}

// ---- Cenário da rua ----
function buildStreet() {
  clearWorld();
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
      addBox(x * T + 16, -row * T + 18, 0, 40, 40, h, ['#5f9a58', '#487f44', '#376634'], 6);
    });
  });

  // Sorveteria do Chiquinho
  const shopX = 4.5 * T - 140, shopY = -GOAL * T - 116;
  addBox(shopX, shopY, 0, 280, 156, 122, ['#fbf4e6', '#f0e6d2', '#ded1b8'], 6);
  addBox(shopX - 14, shopY + 146, 86, 308, 30, 14, RED, 4);
  addBillboard(4.5 * T - 70, shopY + 150, 136, 140,
    '<div class="sign"><div class="sign-icon"><div class="sign-scoop"></div></div><div class="sign-name">CHIQUINHO</div></div>');
}

function buildCars() {
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
      car.el = addBox(0, 0, 0, car.w, 48, car.h, car.c, 4);
      cars.push(car);
    }
  });
  return cars;
}

// ---- Cenário da academia ----
function buildGym() {
  clearWorld();
  worldEl.style.transform = `rotateX(${TILT}deg) rotateZ(${YAW}deg)`;

  for (let row = 0; row < GROWS; row++) {
    const floor = document.createElement('div');
    floor.style.cssText = `position:absolute;left:0;top:${-row * T}px;width:${GCOLS * T}px;height:${T}px;` +
      `background-color:${row % 2 ? '#221e2b' : '#1e1a26'};` +
      'background-image:repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 2px,rgba(0,0,0,0) 2px 39px),' +
      'radial-gradient(70% 120% at 50% 0%, rgba(255,47,184,.10) 0%, rgba(0,0,0,0) 70%);';
    worldEl.appendChild(floor);
  }

  const backY = -(GROWS - 1) * T - 34;
  addBox(-24, backY, 0, GCOLS * T + 48, 30, 168, ['#332c42', '#241f31', '#1b1725'], 0);
  addBox(1.1 * T, backY + 24, 26, 3.2 * T, 8, 96, ['#3d4a58', '#2b3644', '#212a36'], 0); // espelho
  addBox(-30, backY + 30, 0, 26, (GROWS - 1) * T + 40, 150, ['#2c263a', '#221d2e', '#1a1624'], 0);
  addBox(GCOLS * T + 4, backY + 30, 0, 26, (GROWS - 1) * T + 40, 150, ['#2c263a', '#221d2e', '#1a1624'], 0);

  // Luzes de neon: a cor é trocada a cada batida no render.
  for (let i = 0; i < 11; i++) {
    neonTop.push(addBox(-10 + i * ((GCOLS * T + 20) / 11), backY + 6, 150, 34, 10, 6, NEON, 3));
  }
  for (let i = 0; i < 5; i++) {
    const y = backY + 44 + i * ((GROWS - 1) * T / 5);
    neonSide.push(addBox(-24, y, 132, 10, 34, 6, NEON, 3));
    neonSide.push(addBox(GCOLS * T + 14, y, 132, 10, 34, 6, NEON, 3));
  }

  // Halteres largados no canto e um banco extra
  [0, 1, 2].forEach((i) => {
    addBox(6, -(GROWS - 2) * T + 14 + i * 22, 0, 44, 16, 14 + i * 3, IRON, 3);
  });
  addBox(5.7 * T, -(GROWS - 2) * T + 14, 0, 56, 44, 46, ['#2f2940', '#241f32', '#1b1726'], 6);

  // Acima da parede do fundo (altura 168), senão a tampa dela corta o letreiro.
  addBillboard(GCOLS * T / 2 - 130, -(GROWS - 1) * T - 20, 190, 260,
    '<div class="gym-sign"><div class="gym-sign-name">CHIQUINHO FIT</div>' +
    '<div class="gym-sign-sub">SORVETE DEPOIS DO TREINO</div></div>');
}

// Monta um aparelho: a base muda de cor quando ativo e as barras sobem/descem.
function buildMachine(m) {
  const ox = m.x * T, oy = -m.row * T;
  const movers = [];
  const mover = (el, z0, k) => { movers.push({ el, x: Number(el.dataset.x), y: Number(el.dataset.y), z0, k }); return el; };
  const at = (x, y, z, w, d, h, c, r) => {
    const el = addBox(x, y, z, w, d, h, c, r);
    el.dataset.x = x;
    el.dataset.y = y;
    return el;
  };

  const pad = at(ox + 3, oy + 5, 0, T - 6, T - 10, 4, MAT_OFF, 8);

  if (m.id === 'supino') {
    at(ox + 14, oy + 16, 4, 50, 46, 22, ['#8a5a3c', '#70452c', '#5a3722'], 5);
    at(ox + 16, oy + 14, 26, 46, 50, 7, RED, 5);
    mover(at(ox - 6, oy + 30, 62, 92, 8, 6, STEEL, 3), 62, -24);
    mover(at(ox - 14, oy + 22, 53, 12, 24, 24, IRON, 4), 53, -24);
    mover(at(ox + 82, oy + 22, 53, 12, 24, 24, IRON, 4), 53, -24);
  } else if (m.id === 'agacho') {
    at(ox + 4, oy + 18, 4, 10, 10, 100, STEEL, 2);
    at(ox + 62, oy + 18, 4, 10, 10, 100, STEEL, 2);
    mover(at(ox - 2, oy + 20, 82, 80, 8, 6, STEEL, 3), 82, -26);
    mover(at(ox - 12, oy + 12, 73, 12, 24, 24, IRON, 4), 73, -26);
    mover(at(ox + 74, oy + 12, 73, 12, 24, 24, IRON, 4), 73, -26);
  } else {
    at(ox + 18, oy + 20, 4, 42, 38, 18, ['#6c6572', '#575162', '#474252'], 5);
    at(ox + 20, oy + 18, 22, 38, 40, 6, RED, 5);
    [ox + 2, ox + 60].forEach((dx) => {
      mover(at(dx, oy + 30, 26, 16, 10, 6, STEEL, 2), 26, 40);
      mover(at(dx - 4, oy + 26, 20, 8, 18, 18, IRON, 3), 20, 40);
      mover(at(dx + 12, oy + 26, 20, 8, 18, 18, IRON, 3), 20, 40);
    });
  }

  const label = addBillboard(m.x * T - 40, -m.row * T + 20, 132, 158, '<div class="m-pill"></div>');
  return { ...m, done: false, pad, movers, pill: label.firstChild };
}

// ---- Início de cada fase ----
function startStreet() {
  clearTimeout(flashTimer);
  buildStreet();
  buildPlayer(['#4a86c9', '#3a6ca6', '#2c5583'], 'rgba(58,42,28,.22)');
  const cars = buildCars();
  g = { phase: 'street', px: 4, row: 0, ax: 4, arow: 0, hop: 0, cars, status: 'play', max: 0, cx: null, cy: null };
  bgEl.classList.remove('gym');
  syncUI();
}

function startGym() {
  clearTimeout(flashTimer);
  buildGym();
  const machines = MACHINES.map(buildMachine);
  buildPlayer(RED, 'rgba(0,0,0,.45)');
  g = {
    phase: 'gym', px: 3, row: 0, ax: 3, arow: 0, hop: 0, cars: [], status: 'play',
    max: 0, cx: null, cy: null, machines, active: null, reps: 0, next: 0, lift: 0, liftT: 0, t: 0, rat: 0
  };
  bgEl.classList.add('gym');
  syncUI();
}

function restart() {
  startStreet();
}

// ---- Ações ----
function move(dx, drow) {
  if (g.status !== 'play') return;
  if (Math.abs(g.px - g.ax) + Math.abs(g.row - g.arow) > 0.3) return;

  if (g.phase === 'gym') {
    if (g.active !== null) return;
    g.px = Math.max(0, Math.min(GCOLS - 1, g.px + dx));
    g.row = Math.max(0, Math.min(GROWS - 1, g.row + drow));
    return;
  }

  g.px = Math.max(0, Math.min(COLS - 1, g.px + dx));
  g.row = Math.max(0, Math.min(GOAL, g.row + drow));
  if (g.row > g.max) {
    g.max = g.row;
    if (crossedAt(g.max) > best) {
      best = crossedAt(g.max);
      localStorage.setItem(BEST_KEY, String(best));
    }
  }
  if (g.row === GOAL) {
    g.status = 'flash';
    clearTimeout(flashTimer);
    flashTimer = setTimeout(startGym, FLASH_MS);
    syncUI();
  }
}

// Uma repetição = descer e subir, alternando os dois botões.
function tap(side) {
  if (g.phase !== 'gym' || g.active === null || side !== g.next) return;
  if (side === 0) { g.liftT = 1; g.next = 1; return; }
  g.liftT = 0; g.next = 0; g.reps += 1;
  if (g.reps >= REPS) {
    g.machines[g.active].done = true;
    g.active = null;
    g.liftT = 0;
    g.row = Math.max(0, g.row - 1);
    if (g.machines.every((m) => m.done)) {
      g.status = 'done';
      g.rat = 0;
    }
    syncUI();
  }
}

function ratNext() {
  if (g.status !== 'done' || g.rat >= 2) return;
  g.rat += 1;
  syncUI();
}

function crossedAt(row) {
  let n = 0;
  for (let i = 0; i < row; i++) if (LANES[i].t === 'road') n++;
  return n;
}

// ---- Simulação ----
function step(dt) {
  const k = 1 - Math.pow(0.0009, dt);

  if (g.phase === 'street') {
    g.cars.forEach((c) => {
      c.x += c.dir * c.sp * dt * TRAFFIC_SPEED;
      const span = c.w / T;
      if (c.dir > 0 && c.x > COLS + EXT) c.x = -EXT - span;
      if (c.dir < 0 && c.x < -EXT - span) c.x = COLS + EXT;
    });
  }

  g.ax += (g.px - g.ax) * k;
  g.arow += (g.row - g.arow) * k;
  const dist = Math.abs(g.px - g.ax) + Math.abs(g.row - g.arow);
  g.hop = Math.sin(Math.min(1, dist / 0.95) * Math.PI) * 30;

  if (g.phase === 'gym') {
    g.t += dt;
    g.lift += (g.liftT - g.lift) * (1 - Math.pow(0.004, dt));
    if (g.status === 'play' && g.active === null && dist < 0.12) {
      const i = g.machines.findIndex((m) => !m.done && m.x === g.px && m.row === g.row);
      if (i >= 0) {
        g.active = i;
        g.reps = 0;
        g.next = 0;
        g.liftT = 0;
        syncUI();
      }
    }
    return;
  }

  if (g.status === 'play') {
    const lane = Math.round(g.arow);
    if (LANES[lane] && LANES[lane].t === 'road' && Math.abs(g.arow - lane) < 0.38 && g.hop < 22) {
      const pl = g.ax * T + 18, pr = pl + 42;
      for (const c of g.cars) {
        if (c.row !== lane) continue;
        const cl = c.x * T, cr = cl + c.w;
        if (pr > cl && pl < cr) { g.status = 'dead'; syncUI(); break; }
      }
    }
  }
}

// ---- Render ----
function render() {
  const gym = g.phase === 'gym';
  const cos = Math.cos(TILT * Math.PI / 180);
  const ca = Math.cos(YAW * Math.PI / 180), sa = Math.sin(YAW * Math.PI / 180);
  const camX = (gym ? GCOLS / 2 : 4.5) * T, camY = -g.arow * T;
  const sx = camX * ca - camY * sa;
  const sy = (camX * sa + camY * ca) * cos;
  if (g.cx === null) { g.cx = sx; g.cy = sy; }
  g.cx += (sx - g.cx) * 0.12;
  g.cy += (sy - g.cy) * 0.12;
  camEl.style.transform = `translate(${-g.cx}px,${-g.cy}px)`;

  if (gym) renderGym();
  else renderStreet();

  const px = g.ax * T, py = -g.arow * T;
  const active = gym && g.active !== null ? g.machines[g.active] : null;
  const squat = active && active.id === 'agacho' ? g.lift * 13 : 0;
  const bodyH = 34 - squat;
  const z = g.hop + (active && active.id === 'supino' ? 6 : 0);
  setBoxHeight(bodyEl, bodyH);
  place(shadowEl, px + 16, py + 20, 1);
  place(bodyEl, px + 18, py + 18, z);
  place(headEl, px + 22, py + 22, z + bodyH);
}

function renderStreet() {
  g.cars.forEach((c) => place(c.el, c.x * T, -c.row * T + 15, 0));
  crossedEl.textContent = crossedAt(g.max);
  bestEl.textContent = best;
}

function renderGym() {
  const beat = Math.floor(g.t * 3.2);
  if (beat !== lastBeat) {
    lastBeat = beat;
    const dim = (c) => c + '33';
    neonTop.forEach((el, i) => {
      const c = NEON[(i + beat) % NEON.length];
      const v = (i + beat) % 3 !== 0 ? c : dim(c);
      paintBox(el, [v, v, v]);
    });
    neonSide.forEach((el, j) => {
      const i = Math.floor(j / 2);
      const c = NEON[(i + beat + 2) % NEON.length];
      const v = (i + beat + 1) % 3 !== 0 ? c : dim(c);
      paintBox(el, [v, v, v]);
    });
  }

  g.machines.forEach((m, i) => {
    const isActive = i === g.active;
    const lift = isActive ? g.lift : 0;
    paintBox(m.pad, isActive ? MAT_ON : MAT_OFF);
    m.movers.forEach((mv) => place(mv.el, mv.x, mv.y, mv.z0 + mv.k * lift));
    m.pill.className = 'm-pill' + (m.done ? ' done' : isActive ? ' active' : '');
    m.pill.textContent = m.done ? `${m.label} · FEITO`
      : isActive ? `${m.label} · ${g.reps}/${REPS}`
      : `${m.label} · ${REPS}x`;
  });

  doneCountEl.textContent = g.machines.filter((m) => m.done).length;
  hudRepsEl.textContent = g.active !== null ? g.reps : 0;
  if (g.active !== null) {
    repNowEl.textContent = g.reps;
    repBarEl.style.width = `${Math.min(100, (g.reps / REPS) * 100)}%`;
    repBtnL.classList.toggle('on', g.next === 0);
    repBtnR.classList.toggle('on', g.next === 1);
  }
}

// Estados de tela: HUD da fase, controles, painel de série e overlays.
function syncUI() {
  const gym = g.phase === 'gym';
  const active = gym && g.active !== null ? g.machines[g.active] : null;

  subtitleEl.textContent = gym ? 'fase 2 · academia chiquinho' : 'fase 1 · atravesse as ruas';
  hudStreet.hidden = gym;
  hudGym.hidden = !gym;

  walkControls.hidden = !(g.status === 'play' && !active);
  repPanel.hidden = !(active && g.status === 'play');
  if (active) {
    repNameEl.textContent = active.label;
    repBtnL.textContent = active.verbs[0];
    repBtnR.textContent = active.verbs[1];
  }

  deadOverlay.hidden = g.status !== 'dead';
  flashOverlay.hidden = g.status !== 'flash';
  doneOverlay.hidden = g.status !== 'done';
  ratPanes.forEach((pane, i) => { pane.hidden = i !== g.rat; });
}

// ---- Entrada ----
window.addEventListener('keydown', (e) => {
  const k = e.key;
  if (k === ' ' || k === 'Enter') {
    e.preventDefault();
    if (g.status === 'flash') startGym();
    else if (g.status === 'done') ratNext();
    else if (g.status !== 'play') restart();
    return;
  }
  const key = k.length === 1 ? k.toLowerCase() : k;
  if (g.phase === 'gym' && g.active !== null) {
    if (key === 'ArrowLeft' || key === 'a') { e.preventDefault(); tap(0); }
    if (key === 'ArrowRight' || key === 'd') { e.preventDefault(); tap(1); }
    return;
  }
  const m = {
    ArrowUp: [0, 1], w: [0, 1],
    ArrowDown: [0, -1], s: [0, -1],
    ArrowLeft: [-1, 0], a: [-1, 0],
    ArrowRight: [1, 0], d: [1, 0]
  }[key];
  if (m) { e.preventDefault(); move(m[0], m[1]); }
});

const DIRS = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] };
document.querySelectorAll('[data-move]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const m = DIRS[btn.dataset.move];
    move(m[0], m[1]);
  });
});
document.querySelectorAll('[data-tap]').forEach((btn) => {
  btn.addEventListener('click', () => tap(Number(btn.dataset.tap)));
});
document.querySelectorAll('[data-rat-next]').forEach((btn) => {
  btn.addEventListener('click', ratNext);
});
document.querySelectorAll('[data-restart]').forEach((btn) => {
  btn.addEventListener('click', restart);
});
flashOverlay.addEventListener('click', startGym);

// ---- Textos fixos ----
$('#totalRoads').textContent = TOTAL_ROADS;
$('#hudNeeded').textContent = REPS;
$('#repNeeded').textContent = REPS;
$('#doneReps').textContent = REPS;
$('#logRows').innerHTML = MACHINES.map((m) =>
  `<div class="log-row"><div class="log-check"></div><div class="log-label">${m.label}</div>` +
  `<div class="log-reps">${REPS} reps</div></div>`).join('');

// ---- Loop ----
startStreet();

let last = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  step(dt);
  render();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

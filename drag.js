/* IM DRIVN drag. Original quarter-mile. Not linked from the menus yet. */
const DRAG_KEY = 'imdrivn_drag';
const DRAG_CARS = [
  { id: 'daily', name: 'Daily', color: '#2F7BFF', power: 280, weight: 1450, gears: 5 },
  { id: '4x4', name: '4x4', color: '#1F5A32', power: 320, weight: 2100, gears: 5 },
  { id: 'performance', name: 'Performance', color: '#E5242B', power: 480, weight: 1550, gears: 6 },
  { id: 'supercar', name: 'Supercar', color: '#D9A441', power: 640, weight: 1480, gears: 7 }
];
const DRAG_FINISH = 402.336;
const DRAG_RATIOS = [3.2, 2.2, 1.62, 1.28, 1.05, 0.88, 0.74];
const DRAG_UPS = ['engine', 'turbo', 'tyres', 'gearbox', 'nitrous', 'weight'];
const DRAG_PRICE = { daily: 0, '4x4': 800, performance: 2200, supercar: 5000 };
const DRAG_COST = { engine: 200, turbo: 250, tyres: 150, gearbox: 180, nitrous: 300, weight: 160 };
const DRAG_MAX = 3;
const DRAG_UP_NAME = { engine: 'Engine', turbo: 'Turbo', tyres: 'Tyres', gearbox: 'Gearbox', nitrous: 'Nitrous', weight: 'Weight' };

function dragGarage() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(DRAG_KEY) || 'null'); } catch (e) { data = null; }
  const cars = {};
  DRAG_CARS.forEach(car => {
    const prev = data && data.cars && data.cars[car.id];
    const upgrades = {};
    DRAG_UPS.forEach(key => {
      const n = prev && prev.upgrades && prev.upgrades[key] > 0 ? prev.upgrades[key] | 0 : 0;
      upgrades[key] = Math.max(0, Math.min(DRAG_MAX, n));
    });
    const owned = prev ? prev.owned === true || (prev.owned == null && (car.id === 'daily' || car.id === data.selected)) : car.id === 'daily';
    cars[car.id] = { id: car.id, owned, upgrades };
  });
  const selected = data && cars[data.selected] && cars[data.selected].owned ? data.selected : 'daily';
  const trans = data && data.trans === 'auto' ? 'auto' : 'manual';
  return { cash: data && data.cash > 0 ? data.cash | 0 : 0, selected, trans, cars };
}
function dragSave(data) { localStorage.setItem(DRAG_KEY, JSON.stringify(data)); }
function dragSpec(id) { return DRAG_CARS.find(car => car.id === id) || DRAG_CARS[0]; }
function dragTune(id, saved) {
  const base = dragSpec(id);
  const u = saved && saved.upgrades ? saved.upgrades : {};
  return {
    id: base.id, name: base.name, color: base.color, gears: base.gears,
    power: base.power + (u.engine || 0) * 28 + (u.turbo || 0) * 36,
    weight: Math.max(980, base.weight - (u.weight || 0) * 45),
    grip: 1 + (u.tyres || 0) * 0.05,
    box: u.gearbox || 0,
    nitro: u.nitrous || 0
  };
}

function dragRace() {
  const host = document.getElementById('main');
  if (!host) return;
  host.innerHTML = '<section class="drag-page" id="drag-root"></section>';
  const root = document.getElementById('drag-root');
  const garage = dragGarage();
  let mode = 'pick';
  let hold = false;
  let armed = false;
  let shiftEdge = false;
  let treeT = 0;
  let greenAt = 0;
  let you = null;
  let cpu = null;
  let cpuLag = 0.16;
  let cpuShift = 6600;
  let last = 0;
  let raf = 0;
  let paid = false;

  root.innerHTML = '<div class="drag-top"><div><p class="eyebrow">IM DRIVN</p><h1>Drag</h1></div><p class="drag-cash" id="drag-cash"></p></div><div class="drag-stage"><canvas id="drag-canvas" width="640" height="280"></canvas><div class="drag-hud"><span id="drag-gear">Gear</span><span id="drag-rpm">RPM</span><span id="drag-speed">0 km/h</span></div><div class="drag-controls"><button type="button" id="drag-hold">Hold to rev</button><button type="button" id="drag-shift">Shift</button></div></div><div class="drag-trans" id="drag-trans"><button type="button" data-trans="auto">Auto</button><button type="button" data-trans="manual">Manual</button></div><div class="drag-pick" id="drag-pick"></div><div class="drag-ups" id="drag-ups"></div><p class="drag-read" id="drag-read">Pick a car, then stage. Hold through the ambers and launch on green.</p><div class="drag-actions"><button type="button" id="drag-stage">Stage</button></div>';
  const canvas = document.getElementById('drag-canvas');
  const ctx = canvas.getContext('2d');
  const cashEl = document.getElementById('drag-cash');
  const pickEl = document.getElementById('drag-pick');
  const readEl = document.getElementById('drag-read');
  const gearEl = document.getElementById('drag-gear');
  const rpmEl = document.getElementById('drag-rpm');
  const speedEl = document.getElementById('drag-speed');
  const holdBtn = document.getElementById('drag-hold');
  const shiftBtn = document.getElementById('drag-shift');
  const stageBtn = document.getElementById('drag-stage');
  const upsEl = document.getElementById('drag-ups');
  const transEl = document.getElementById('drag-trans');

  function paintCash() { cashEl.textContent = '$' + garage.cash; }
  function paintTrans() {
    transEl.querySelectorAll('button').forEach(btn => btn.classList.toggle('is-on', btn.getAttribute('data-trans') === garage.trans));
    shiftBtn.hidden = garage.trans !== 'manual';
  }
  function paintPick() {
    pickEl.innerHTML = DRAG_CARS.map(car => {
      const row = garage.cars[car.id];
      const tuned = dragTune(car.id, row);
      const on = car.id === garage.selected ? ' is-on' : '';
      const lock = row.owned ? '' : ' is-locked';
      const line = row.owned ? (tuned.power + ' hp · ' + tuned.weight + ' kg · ' + car.gears + ' gears') : ('Buy $' + DRAG_PRICE[car.id]);
      return '<button type="button" data-car="' + car.id + '" class="' + (on + lock).trim() + '"><b><i class="drag-swatch" style="background:' + car.color + '"></i>' + car.name + '</b><span>' + line + '</span></button>';
    }).join('');
  }
  function paintUps() {
    const row = garage.cars[garage.selected];
    upsEl.innerHTML = DRAG_UPS.map(key => {
      const lvl = row.upgrades[key];
      const maxed = lvl >= DRAG_MAX;
      const cost = DRAG_COST[key] * (lvl + 1);
      return '<button type="button" data-up="' + key + '"' + (maxed ? ' disabled' : '') + '>' + DRAG_UP_NAME[key] + ' ' + lvl + '/' + DRAG_MAX + '<span>' + (maxed ? 'Max' : '$' + cost) + '</span></button>';
    }).join('');
  }
  paintCash();
  paintPick();
  paintUps();
  paintTrans();

  function blank(spec) {
    return { spec, gear: 1, rpm: 900, speed: 0, dist: 0, launched: false, foul: false, reaction: null, launchRpm: 900, bog: 0, boost: 0, finished: false, et: 0, trap: 0, run: 0 };
  }
  function fresh() {
    you = blank(dragTune(garage.selected, garage.cars[garage.selected]));
    you.manual = garage.trans === 'manual';
    const others = DRAG_CARS.filter(car => car.id !== garage.selected);
    cpu = blank(others[(Math.random() * others.length) | 0]);
    cpuLag = 0.1 + Math.random() * 0.16;
    cpuShift = 6400 + Math.random() * 500;
    treeT = 0;
    greenAt = 0;
    paid = false;
    mode = 'tree';
    hold = false;
    armed = false;
    readEl.textContent = 'Tree is live. Hold to rev, release on green, then shift on the gold light.';
    stageBtn.hidden = true;
  }

  pickEl.onclick = e => {
    const btn = e.target.closest('[data-car]');
    if (!btn || mode === 'tree' || mode === 'race') return;
    const id = btn.getAttribute('data-car');
    const row = garage.cars[id];
    if (!row.owned) {
      const cost = DRAG_PRICE[id];
      if (garage.cash < cost) { readEl.textContent = 'Need $' + cost + ' to buy the ' + dragSpec(id).name + '.'; return; }
      garage.cash -= cost;
      row.owned = true;
    }
    garage.selected = id;
    dragSave(garage);
    paintCash();
    paintPick();
    paintUps();
  };
  upsEl.onclick = e => {
    const btn = e.target.closest('[data-up]');
    if (!btn || mode === 'tree' || mode === 'race') return;
    const key = btn.getAttribute('data-up');
    const row = garage.cars[garage.selected];
    const lvl = row.upgrades[key];
    if (lvl >= DRAG_MAX) return;
    const cost = DRAG_COST[key] * (lvl + 1);
    if (garage.cash < cost) { readEl.textContent = 'Need $' + cost + ' for ' + DRAG_UP_NAME[key] + '.'; return; }
    garage.cash -= cost;
    row.upgrades[key] = lvl + 1;
    dragSave(garage);
    paintCash();
    paintPick();
    paintUps();
  };
  transEl.onclick = e => {
    const btn = e.target.closest('[data-trans]');
    if (!btn || mode === 'tree' || mode === 'race') return;
    garage.trans = btn.getAttribute('data-trans') === 'auto' ? 'auto' : 'manual';
    dragSave(garage);
    paintTrans();
    readEl.textContent = garage.trans === 'manual' ? 'Manual: lift off the gas before every shift.' : 'Auto: it shifts for you. You still launch it.';
  };
  stageBtn.onclick = () => { if (mode === 'pick' || mode === 'done') fresh(); };
  holdBtn.addEventListener('pointerdown', e => { hold = true; armed = true; holdBtn.classList.add('is-down'); if (holdBtn.setPointerCapture) holdBtn.setPointerCapture(e.pointerId); });
  holdBtn.addEventListener('pointerup', () => { hold = false; holdBtn.classList.remove('is-down'); });
  holdBtn.addEventListener('pointercancel', () => { hold = false; holdBtn.classList.remove('is-down'); });
  shiftBtn.addEventListener('pointerdown', e => { shiftEdge = true; e.preventDefault(); });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  function onKeyDown(e) {
    if (!root.isConnected) { window.removeEventListener('keydown', onKeyDown); return; }
    if (e.repeat) return;
    if (e.code === 'Space') { hold = true; armed = true; holdBtn.classList.add('is-down'); e.preventDefault(); }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { shiftEdge = true; e.preventDefault(); }
  }
  function onKeyUp(e) {
    if (!root.isConnected) { window.removeEventListener('keyup', onKeyUp); return; }
    if (e.code === 'Space') { hold = false; holdBtn.classList.remove('is-down'); }
  }

  function noteMiss() {
    readEl.textContent = 'Lift off the gas before you shift.';
    shiftBtn.classList.add('is-miss');
    clearTimeout(noteMiss.t);
    noteMiss.t = setTimeout(() => { if (shiftBtn.isConnected) shiftBtn.classList.remove('is-miss'); }, 700);
  }
  function drive(car, dt, now, auto) {
    const ratios = DRAG_RATIOS.slice(0, car.spec.gears);
    const launching = auto ? (!car.launched && greenAt && now >= greenAt + cpuLag) : (!car.launched && !hold && car.reaction === null && (holdBtn.classList.contains('is-down') || car.armed));
    if (!car.launched) {
      if (auto) {
        const target = 6200;
        car.rpm = car.rpm < target ? Math.min(target, car.rpm + 5400 * dt) : Math.max(target, car.rpm - 1800 * dt);
      } else if (hold) car.rpm = Math.min(7800, car.rpm + 5400 * dt);
      else car.rpm = Math.max(850, car.rpm - 2600 * dt);
      const go = auto ? (greenAt && now >= greenAt + cpuLag) : (armed && !hold);
      if (go) {
        car.launched = true;
        car.reaction = greenAt ? now - greenAt : -1;
        if (car.reaction < -0.02) car.foul = true;
        car.launchRpm = car.rpm;
        const perfect = !car.foul && car.reaction >= 0 && car.reaction <= 0.09 && car.launchRpm >= 5000 && car.launchRpm <= 6800;
        car.boost = perfect ? 0.7 : 0;
        car.perfect = perfect;
        if (car.launchRpm < 3400) car.bog = 0.42;
        else if (car.launchRpm > 7300) car.bog = 0.36;
      }
      return;
    }
    if (car.finished) return;
    car.run += dt;
    if (car.bog > 0) car.bog -= dt;
    if (car.boost > 0) car.boost -= dt;
    const ratio = ratios[car.gear - 1];
    const top = 36 + (car.spec.power / car.spec.weight) * 42;
    const band = top / car.spec.gears;
    const ceil = band * car.gear;
    const floor = band * (car.gear - 1);
    let pull = (car.spec.power / car.spec.weight) * 24 * (car.spec.grip || 1);
    if (car.spec.nitro && car.run < 1.2) pull *= 1 + car.spec.nitro * 0.05;
    if (car.bog > 0) pull *= 0.28;
    if (car.boost > 0) pull *= 1.2;
    if (car.speed < floor * 0.9) pull *= 0.4;
    car.speed = Math.max(0, car.speed + pull * dt);
    if (car.speed > ceil) car.speed += (ceil - car.speed) * Math.min(1, dt * 8);
    const span = Math.max(1, ceil - floor);
    car.rpm = 900 + Math.max(0, Math.min(1, (car.speed - floor) / span)) * 6500;
    if (car.speed >= ceil - 0.2) car.rpm = 7520;
    const manual = !auto && car.manual;
    if (manual && shiftEdge && hold && car.gear < car.spec.gears) {
      car.bog = Math.max(car.bog, 0.55);
      noteMiss();
    }
    const wantShift = auto ? car.rpm >= cpuShift : (manual ? (shiftEdge && !hold) : car.rpm >= 6800);
    if (wantShift && car.gear < car.spec.gears) {
      const box = car.spec.box || 0;
      const good = 6200 - box * 80;
      const late = 7480 + box * 40;
      if (car.rpm < 5600) car.bog = Math.max(car.bog, 0.45);
      else if (car.rpm < good || car.rpm > late) car.bog = Math.max(car.bog, 0.22);
      const next = ratios[car.gear] || ratio;
      car.gear += 1;
      car.rpm = Math.max(1600, car.rpm * (next / ratio));
      if (auto) cpuShift = 6400 + Math.random() * 400;
    }
    car.dist += car.speed * dt;
    if (car.dist >= DRAG_FINISH) {
      car.finished = true;
      car.dist = DRAG_FINISH;
      car.et = greenAt ? Math.max(0, now - greenAt) : car.run;
      car.trap = car.speed * 3.6;
    }
  }

  function lights() {
    const t = treeT;
    return {
      amber: [t > 0.45, t > 0.95, t > 1.45],
      green: t > 1.95,
      red: !!(you && you.foul)
    };
  }

  function draw() {
    const w = canvas.clientWidth || 640;
    const h = canvas.clientHeight || 280;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#d9a441';
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.42);
    ctx.lineTo(w, h * 0.42);
    ctx.stroke();
    ctx.globalAlpha = 1;
    const cam = you ? Math.max(0, you.dist - 18) : 0;
    const scale = w / 70;
    function laneY(n) { return h * (n === 0 ? 0.58 : 0.78); }
    ctx.strokeStyle = '#1a1a1d';
    ctx.lineWidth = 8;
    [0, 1].forEach(n => {
      ctx.beginPath();
      ctx.moveTo(0, laneY(n) + 16);
      ctx.lineTo(w, laneY(n) + 16);
      ctx.stroke();
    });
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(217,164,65,.35)';
    for (let m = 0; m < 8; m++) {
      const x = ((m * 50 - cam * scale) % (w + 40)) - 20;
      ctx.beginPath();
      ctx.moveTo(x, h * 0.5);
      ctx.lineTo(x, h * 0.95);
      ctx.stroke();
    }
    const finishX = 40 + (DRAG_FINISH - cam) * scale;
    if (finishX > -10 && finishX < w + 10) {
      ctx.fillStyle = '#d9a441';
      ctx.fillRect(finishX, h * 0.48, 3, h * 0.42);
    }
    function carBody(car, y) {
      if (!car) return;
      const x = 40 + (car.dist - cam) * scale;
      ctx.fillStyle = car.spec.color;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 54, y);
      ctx.lineTo(x + 64, y - 10);
      ctx.lineTo(x + 40, y - 16);
      ctx.lineTo(x + 22, y - 16);
      ctx.lineTo(x + 12, y - 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#0a0a0a';
      ctx.beginPath();
      ctx.arc(x + 18, y + 2, 6, 0, Math.PI * 2);
      ctx.arc(x + 48, y + 2, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    carBody(cpu, laneY(0));
    carBody(you, laneY(1));
    const tree = lights();
    const bulbs = [tree.amber[0], tree.amber[1], tree.amber[2], tree.green];
    const colours = ['#e0a106', '#e0a106', '#e0a106', tree.red ? '#e5242b' : '#19a34a'];
    bulbs.forEach((on, i) => {
      ctx.fillStyle = on ? colours[i] : '#161618';
      ctx.beginPath();
      ctx.arc(22, 28 + i * 22, 7, 0, Math.PI * 2);
      ctx.fill();
    });
    const shiftOn = you && you.launched && you.gear < you.spec.gears && you.rpm >= 6400;
    shiftBtn.classList.toggle('is-on', !!shiftOn);
    if (you) {
      gearEl.textContent = 'Gear ' + you.gear;
      rpmEl.textContent = Math.round(you.rpm) + ' rpm' + (shiftOn ? ' · SHIFT' : '');
      speedEl.textContent = Math.round(you.speed * 3.6) + ' km/h';
    }
  }

  function finishCopy() {
    if (!you.finished || !cpu.finished) return;
    if (paid) return;
    paid = true;
    const win = !you.foul && you.et < cpu.et;
    if (win) { garage.cash += 150; dragSave(garage); paintCash(); }
    const tag = you.foul ? 'Foul. Red light. ' : (you.perfect ? 'Perfect launch. ' : '');
    const purse = win ? ' Win $150.' : '';
    readEl.textContent = tag + 'You ' + you.et.toFixed(3) + 's @ ' + Math.round(you.trap) + ' km/h. ' + cpu.spec.name + ' ' + cpu.et.toFixed(3) + 's @ ' + Math.round(cpu.trap) + ' km/h.' + purse;
    stageBtn.hidden = false;
    stageBtn.textContent = 'Run again';
    mode = 'done';
  }

  function frame(now) {
    if (!root.isConnected) return;
    raf = requestAnimationFrame(frame);
    const t = now / 1000;
    const dt = Math.min(0.05, last ? t - last : 0.016);
    last = t;
    if (mode === 'tree' || mode === 'race') {
      treeT += dt;
      if (!greenAt && treeT > 1.95) { greenAt = t; mode = 'race'; }
      if (you) drive(you, dt, t, false);
      if (cpu) drive(cpu, dt, t, true);
      shiftEdge = false;
      if (you && you.finished && cpu && cpu.finished) finishCopy();
    }
    shiftEdge = false;
    draw();
  }
  raf = requestAnimationFrame(frame);
}

window.dragRace = dragRace;

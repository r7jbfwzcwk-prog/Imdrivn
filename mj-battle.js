/*!
 * IMDRIVN — Stickman Dance Battle (desktop-only easter egg)
 * Left:  MJ fedora guy on top of IM BUYIN  (v2 routine, unchanged)
 * Right: b-boy with spiky hair on top of IM SELLIN (street / breakdance routine)
 * They trade 'your turn!' points across the gap; 22.4s seamless loop.
 *
 * Usage:
 *   MJBattle.mount(document.querySelector('a.path[href="#/buyin"]'),
 *                  document.querySelector('a.path[href="#/sell"]'),
 *                  { avoid: '.og-desk-seal' });
 * Deterministic hook (for capture/testing): window.__setAnimTime(t)
 */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var GOLD = '#d9a441', GOLD_HI = '#ffe2a0', BODY = '#f5f5f5', BODY_FAR = '#d2d2d2';
  var LOOP = 12.0, BATTLE_LOOP = 22.4;
  var SCALE = 1.18;          // model -> px (≈58px tall incl. fedora)
  var TRAVEL_PX = 240;       // walk-out / moonwalk-back distance in px

  // ---- skeleton (px, y-up, facing +x) ----
  var THIGH = 10, SHIN = 10, FOOT = 6.0, ANK_DX = 1.3, ANK_DY = 1.8, SOLE = 1.45;
  var TORSO = 12.5, NECK = 2.2, HEAD_R = 4.2, UARM = 7.2, FARM = 6.8;
  var STAND_H = 22.4, HY_MOON = 21.6;

  // ---- math helpers ----
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function smooth(k) { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); }
  function smoother(k) { k = clamp(k, 0, 1); return k * k * k * (k * (k * 6 - 15) + 10); }
  function seg(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }
  function bump(t, a, b) { var k = seg(t, a, b); return Math.sin(Math.PI * k); }
  function rot(v, th) { var c = Math.cos(th), s = Math.sin(th); return { x: v.x * c - v.y * s, y: v.x * s + v.y * c }; }
  function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
  function hash(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  // Two-bone IK. side=+1 bends joint to the "left" of P->Q (forward knee for a downward leg).
  var ikClamps = 0;
  function ik(P, Q, l1, l2, side) {
    var dx = Q.x - P.x, dy = Q.y - P.y, d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
    var max = l1 + l2 - 1e-3, min = Math.abs(l1 - l2) + 1e-3;
    if (d > max) ikClamps++;
    var dc = clamp(d, min, max), ex = dx / d, ey = dy / d;
    var a = (l1 * l1 - l2 * l2 + dc * dc) / (2 * dc), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    var J = { x: P.x + ex * a - ey * h * side, y: P.y + ey * a + ex * h * side };
    var E = { x: P.x + ex * dc, y: P.y + ey * dc };
    return { j: J, e: E };
  }

  // Foot from toe position + heel-lift angle a (0 = flat, + = heel up / on toes, - = toe up).
  function footGeom(f) {
    var toe = { x: f.x, y: f.y + SOLE };
    var heel = add(toe, rot({ x: -FOOT, y: 0 }, -f.a));
    var ank = add(toe, rot({ x: -FOOT + ANK_DX, y: ANK_DY }, -f.a));
    var low = Math.min(toe.y, heel.y);
    if (low < SOLE) { // toe-up / heel-tap: pivot on the heel so the shoe never sinks below the border
      var lift = SOLE - low; toe.y += lift; heel.y += lift; ank.y += lift;
    }
    return { toe: toe, heel: heel, ank: ank };
  }

  // ---------- pose helpers ----------
  function P(o) {
    return {
      X: o.X, dir: o.dir == null ? 1 : o.dir,
      hx: o.hx || 0, hy: o.hy == null ? STAND_H : o.hy, lean: o.lean || 0,
      f0: o.f0, f1: o.f1,
      h0: o.h0, h1: o.h1, e0: o.e0 == null ? 1 : o.e0, e1: o.e1 == null ? 1 : o.e1,
      head: o.head || 0, hat: (o.hat == null ? 0.18 : o.hat) + 0.08, glide: o.glide || 0,
      glint: o.glint || 0, shim: o.shim || 0, sy: o.sy || 0,
      swoosh: o.swoosh || 0, sph: o.sph || 0, toe: o.toe || 0,
      ks0: o.ks0 == null ? 1 : o.ks0, ks1: o.ks1 == null ? 1 : o.ks1,
      hw: o.hw || 0, h0w: o.h0w || H(0, 0), h1w: o.h1w || H(0, 0), flash: o.flash || 0
    };
  }
  function mix(A, B, k) {
    var o = {};
    for (var key in A) {
      var a = A[key], b = B[key];
      if (typeof a === 'number') o[key] = lerp(a, b, k);
      else o[key] = { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), a: a.a != null ? lerp(a.a, b.a, k) : undefined };
    }
    return o;
  }
  var F = function (x, a, y) { return { x: x, y: y || 0, a: a || 0 }; };
  var H = function (x, y) { return { x: x, y: y }; };
  // Common hand targets (torso frame, relative to shoulder)
  var HAND_BRIM = H(6.8, 7.8);     // fingers on the fedora brim
  var HAND_HIP = H(1.5, -9.5);     // hand on hip (elbow out)
  var HAND_DOWN = H(0.5, -13.2);
  var HAND_TUCK = H(3.5, -4.5);

  // ---------- choreography (model units; world x measured from the box's left edge / SCALE) ----------
  // Timeline (12.0s loop):
  //  0.00–2.10 strut right (8 steps) | 2.10–2.80 720° spin | 2.80–3.65 Billie Jean toe-stand hold
  //  3.65–7.49 moonwalk (12 strides x 0.32s) | 7.50–8.55 spin + held high kick
  //  8.55–10.35 Smooth Criminal 42° lean | 10.35–12.0 beat-step groove + hat tip -> loop
  function Choreo(Wm, travel) {
    var mid = Wm * 0.5, D = travel;
    this.X0 = mid - D / 2; this.X1 = mid + D / 2; this.D = D; this.Wm = Wm;
  }

  Choreo.prototype.walk = function (t) {
    var X0 = this.X0, N = 8, STEP = this.D / N, dur = 2.1 / N;
    t = clamp(t, 0, 2.1);
    var p = Math.min(t / dur, N - 1e-4), k = Math.floor(p), u = p - k;
    var hip = X0 + STEP * (t / dur);
    function hs(i) { return X0 + STEP * i; }
    function foot(i) {
      if (k % 2 === i) { // swinging: toe-off, knee lift, land
        var e = smooth(u);
        return F(lerp(hs(k) - STEP * 0.45, hs(k) + STEP * 1.55, e), lerp(0.95, 0, smooth((u - 0.12) / 0.55)), 6.5 * Math.sin(Math.PI * Math.pow(u, 0.85)));
      }
      var lift = ((k + 1) % 2 === i) ? 0.95 * smooth((u - 0.4) / 0.6) : 0;
      return F(hs(k) + STEP * 0.55, lift); // planted
    }
    var f0 = foot(0), f1 = foot(1);
    var bounce = -Math.cos(2 * Math.PI * u) * 1.0;
    var sw = Math.sin(Math.PI * p);
    var flick = bump(t, 0.7, 1.55);
    var h0 = mix({ v: H(-4.5 * sw + 1, -12.3) }, { v: HAND_BRIM }, smooth(flick * 1.7)).v;
    return P({
      X: hip, hy: 20.6 + bounce, lean: 0.08, f0: { x: f0.x - hip, y: f0.y, a: f0.a }, f1: { x: f1.x - hip, y: f1.y, a: f1.a },
      h0: h0, h1: H(5 * sw + 1, -12.0), e0: 1, e1: 1,
      head: 0.07 * Math.sin(2 * Math.PI * p), hat: 0.18 + 0.12 * flick, sy: 1.1 * Math.abs(Math.sin(Math.PI * p)) - 0.3,
      glint: 0.35 + 0.65 * flick
    });
  };

  Choreo.prototype.spin = function (t) {
    var X = this.X1;
    var g = smooth(seg(t, 2.1, 2.22));          // gather feet, arms in
    var sl = seg(t, 2.16, 2.74), sp = lerp(sl, smooth(sl), 0.5); // 720° (two full scaleX flips, ~0.29s per turn)
    var pop = smooth(seg(t, 2.74, 2.88));        // pop into toe-stand
    var dir = Math.cos(4 * Math.PI * sp);
    var tuck = P({ X: X, hy: 22.0, f0: F(3.4, 0.6), f1: F(4.2, 0.6), h0: H(3.0, -3.4), h1: H(3.6, -3.0), hat: 0.2,
      swoosh: bump(t, 2.2, 2.7), sph: sp });
    var stand = P({
      X: X, hx: -0.6, hy: 19.4, lean: -0.1, f0: F(5.8, 1.2), f1: F(3.2, 1.2),
      h0: HAND_BRIM, h1: HAND_HIP, e0: 1, e1: -1, head: -0.14, hat: 0.34, glint: 1, shim: 1, toe: 1
    });
    var o = mix(this.walk(2.1), tuck, g); o.dir = 1;
    if (g >= 1 || t > 2.16) { o = mix(o, tuck, 1); o.dir = dir; o.swoosh = bump(t, 2.2, 2.7); o.sph = sp; }
    if (pop > 0) { var d = o.dir; o = mix(o, stand, pop); o.dir = lerp(d, 1, pop); }
    if (t > 2.88) { // breathing hold + toe twinkle
      o.toe = 0.75 + 0.25 * Math.sin(t * 14); o.hy = 19.4 + 0.25 * Math.sin((t - 2.88) * 7);
    }
    return o;
  };

  Choreo.prototype.moonInfo = function (t) {
    var t0 = 3.65, sd = 0.32, N = 12, s = this.D / (N / 2); // slide length; body moves s/2 per stride
    var p = clamp((t - t0) / sd, 0, N - 1e-4), k = Math.floor(p), u = p - k;
    var Pk = this.X1 - s / 4 + 4 - k * s / 2;
    var SW = 0.76, v = clamp(u / SW, 0, 1);
    var flatX = lerp(Pk + s / 2, Pk - s / 2, smooth(v) * 0.7 + v * 0.3);
    var sw = smooth(seg(u, SW, 1));
    return { k: k, u: u, v: v, SW: SW, s: s, Pk: Pk, flatX: flatX, sw: sw, popped: k % 2, flat: 1 - (k % 2), t0: t0, sd: sd, p: p, N: N };
  };
  Choreo.prototype.moon = function (t) {
    var m = this.moonInfo(t), A = 1.25;
    var hipX = this.X1 - (clamp(t, m.t0, m.t0 + m.N * m.sd) - m.t0) / m.sd * (m.s / 2);
    var fPop = F(m.Pk, lerp(A, 0, m.sw)), fFlat = F(m.flatX, lerp(0, A, m.sw));
    var f = []; f[m.popped] = fPop; f[m.flat] = fFlat;
    var midA = (footGeom(fPop).ank.x + footGeom(fFlat).ank.x) / 2 + 1.0;
    hipX = lerp(hipX, midA, 0.5);
    var beat = Math.sin(Math.PI * m.p);           // one cycle per two strides
    var bob = Math.sin(Math.PI * m.u);
    return P({
      X: hipX, hy: HY_MOON - 0.6 * bob, lean: 0.12, glide: 1.9 * beat,
      f0: { x: f[0].x - hipX, y: 0, a: f[0].a }, f1: { x: f[1].x - hipX, y: 0, a: f[1].a },
      h0: H(5.0 + 3.0 * beat, -8.4 + 1.6 * bob), h1: H(5.0 - 3.0 * beat, -8.1 + 1.6 * bob), e0: 1, e1: 1,
      head: 0.09 * beat - 0.04, hat: 0.24, glint: 0.45 + 0.35 * bob, shim: 0.8, sy: 0.6 * bob
    });
  };

  Choreo.prototype.kick = function (t) {
    var X = this.X0;
    var sp = smoother(seg(t, 7.5, 7.9)), dir = Math.cos(2 * Math.PI * sp);
    var k = smooth(seg(t, 7.92, 8.06)) * (1 - smooth(seg(t, 8.41, 8.6)));
    var spinP = P({ X: X, hy: 21.8, f0: F(3.5, 0.55), f1: F(4.2, 0.55), h0: H(3.2, -3.6), h1: H(3.8, -3.2), hat: 0.2,
      swoosh: bump(t, 7.52, 7.88), sph: sp });
    var ready = P({ X: X, hy: 21.4, f0: F(4.0, 0), f1: F(3.4, 0), h0: H(3, -11), h1: H(2.2, -11.5), hat: 0.22 });
    var kickP = P({
      X: X, hx: -2.4, hy: 22.6, lean: -0.34, f0: { x: 22.0, y: 16.5, a: -0.45 }, f1: F(1.2, 0),
      h0: H(-5.0, 13.0), h1: H(-11.5, -6.5), e0: -1, e1: 1, head: 0.16, hat: 0.42, glint: 1
    });
    var o = mix(spinP, ready, smooth(seg(t, 7.84, 7.94)));
    if (k > 0) o = mix(o, kickP, k);
    o.dir = t < 7.9 ? dir : 1;
    if (t > 8.06 && t < 8.41) o.f0.y += 0.4 * Math.sin((t - 8.06) * 18); // tiny held-kick vibrato
    return o;
  };

  Choreo.prototype.lean = function (t) {
    var X = this.X0;
    var th = 0.733 * smoother(seg(t, 8.7, 9.25)) * (1 - smoother(seg(t, 10.0, 10.38))); // 42°
    var fa = F(4.0, 0), fb = F(3.7, 0);
    var g = footGeom(fa);
    var L = THIGH + SHIN - 0.45;
    var hipx = g.ank.x + Math.sin(th) * L, hipy = g.ank.y + Math.cos(th) * L;
    var straight = smooth(seg(t, 8.55, 8.7));
    return P({
      X: X, hx: hipx, hy: lerp(21.4, hipy, straight), lean: th, f0: fa, f1: fb,
      h0: HAND_BRIM, h1: H(-1.8, -13.0), e0: 1, e1: -1, head: -0.05 * (th / 0.733), hat: 0.3, glint: 0.6, shim: 0.95 * (th / 0.733)
    });
  };

  Choreo.prototype.groove = function (t) {
    var X = this.X0, bt = (t - 10.35) / 0.275;
    var b = Math.floor(clamp(bt, 0, 5.999)), u = bt - b;
    var pop = Math.pow(Math.sin(Math.PI * clamp(u, 0, 1)), 2);
    var side = b % 2 === 0 ? 1 : -1;
    var tip = bump(t, 10.95, 11.6);
    var groove = P({
      X: X, hx: 1.2 * side * pop, hy: 20.6 - 1.2 * pop, lean: 0.05,
      f0: F(5.5, side > 0 ? 0.85 * pop : 0), f1: F(-1.5, side < 0 ? 0.85 * pop : 0),
      h0: mix({ v: H(3.5 + 2.2 * side * pop, -9.5 + 2.8 * pop) }, { v: H(7.4, 8.6) }, smooth(tip * 1.5)).v,
      h1: H(3.0 - 2.2 * side * pop, -9.0 + 2.8 * pop), e0: 1, e1: 1,
      head: 0.12 * side * pop - 0.28 * tip, hat: 0.2 + 0.6 * tip, sy: 2.0 * pop, glint: 0.3 + 0.7 * tip
    });
    var o = mix(this.lean(10.35), groove, smooth(seg(t, 10.33, 10.5)));
    var back = smooth(seg(t, 11.6, 12.0));
    return back > 0 ? mix(o, this.walk(0), back) : o;
  };

  // Keep every grounded foot on the border: lower the hip just enough if a foot would be out of reach.
  function groundLock(o) {
    var R = THIGH + SHIN - 0.3;
    [o.f0, o.f1].forEach(function (ff) {
      if (ff.y > 0.5) return;
      var ga = footGeom(ff), dx = ga.ank.x - o.hx;
      o.hy = Math.min(o.hy, ga.ank.y + Math.sqrt(Math.max(0, R * R - dx * dx)));
    });
    return o;
  }

  Choreo.prototype.pose = function (t) {
    t = ((t % LOOP) + LOOP) % LOOP;
    var o;
    if (t < 2.1) o = this.walk(t);
    else if (t < 3.65) o = this.spin(t);
    else if (t < 7.5) o = t < 3.82 ? mix(this.spin(t), this.moon(t), smooth((t - 3.65) / 0.17)) : this.moon(t);
    else if (t < 8.55) o = t < 7.6 ? mix(this.moon(t), this.kick(t), smooth((t - 7.5) / 0.1)) : this.kick(t);
    else if (t < 10.35) o = t < 8.7 ? mix(this.kick(t), this.lean(t), smooth((t - 8.55) / 0.15)) : this.lean(t);
    else o = this.groove(t);
    return groundLock(o);
  };

  // Gold stardust skimming along the border behind the sliding flat shoe (deterministic).
  Choreo.prototype.sparks = function (t) {
    var out = [], life = 0.7, step = 0.028;
    var i0 = Math.ceil(Math.max(3.72, t - life) / step), i1 = Math.floor(Math.min(t, 7.45) / step);
    for (var i = i0; i <= i1; i++) {
      var ts = i * step, m = this.moonInfo(ts);
      if (m.u > m.SW) continue;
      var age = (t - ts) / life; if (age < 0 || age > 1) continue;
      var heel = m.flatX - FOOT + 0.4;
      out.push({
        x: heel - 1.5 + (hash(i) - 0.5) * 3 + (hash(i + 7) - 0.3) * 6 * age,
        y: 0.7 + age * (1.2 + hash(i + 3) * 3.5),
        r: (0.7 + hash(i + 11) * 0.8) * (1 - 0.7 * age),
        o: (1 - age) * (0.7 + 0.3 * hash(i + 5)),
        star: hash(i + 13) > 0.55
      });
    }
    return out;
  };

  // ---------- SVG rig ----------
  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function pts(arr) { var s = ''; for (var i = 0; i < arr.length; i++) s += arr[i].x.toFixed(2) + ',' + (-arr[i].y).toFixed(2) + ' '; return s; }
  function starPath(r) { var q = r * 0.28; return 'M0,' + (-r) + ' L' + q + ',' + (-q) + ' L' + r + ',0 L' + q + ',' + q + ' L0,' + r + ' L' + (-q) + ',' + q + ' L' + (-r) + ',0 L' + (-q) + ',' + (-q) + ' Z'; }

  var rigN = 0;
  function Rig(svg, groundY, look) {
    this.svg = svg; this.groundY = groundY; look = look || 'fedora';
    var uid = 'mjs' + (rigN++);
    var defs = el('defs', {}, svg);
    var gr = el('radialGradient', { id: uid + 'Shim', cx: '50%', cy: '50%', r: '50%' }, defs);
    el('stop', { offset: '0%', 'stop-color': GOLD_HI, 'stop-opacity': '0.95' }, gr);
    el('stop', { offset: '45%', 'stop-color': GOLD, 'stop-opacity': '0.55' }, gr);
    el('stop', { offset: '100%', 'stop-color': GOLD, 'stop-opacity': '0' }, gr);
    var glow = el('filter', { id: uid + 'Glow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
    el('feGaussianBlur', { stdDeviation: '0.7' }, glow);

    this.fx = el('g', {}, svg);           // ground shimmer + sparks (world space)
    this.shim = [el('ellipse', { fill: 'url(#' + uid + 'Shim)', ry: '1.5' }, this.fx), el('ellipse', { fill: 'url(#' + uid + 'Shim)', ry: '1.5' }, this.fx)];
    this.swooshG = [0, 1].map(function (i) { return el('ellipse', { fill: 'none', stroke: i ? GOLD : GOLD_HI, 'stroke-width': i ? 1.2 : 1.5, 'stroke-linecap': 'round', pathLength: 100, 'stroke-dasharray': i ? '30 70' : '42 58', 'vector-effect': 'non-scaling-stroke' }, this.fx); }, this);
    this.sparkG = el('g', {}, this.fx);
    this.sparkPool = [];

    this.root = el('g', {}, svg);
    var common = { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' };
    function limb(parent, color, w) {
      var o = el('polyline', Object.assign({ stroke: 'rgba(0,0,0,0.78)', 'stroke-width': w + 2.0 }, common), parent);
      var p = el('polyline', Object.assign({ stroke: color, 'stroke-width': w }, common), parent);
      return [o, p];
    }
    function shoe(parent, color) {
      return [el('line', Object.assign({ stroke: 'rgba(0,0,0,0.7)', 'stroke-width': 4.0 }, common), parent),
              el('line', Object.assign({ stroke: color, 'stroke-width': 3.4 }, common), parent)];
    }
    var r = this.root;
    this.armFar = limb(r, BODY_FAR, 2.4);
    this.gloveFar = el('circle', { r: 1.55, fill: BODY_FAR, stroke: 'rgba(0,0,0,0.7)', 'stroke-width': 0.7, opacity: 0 }, r);
    this.legFar = limb(r, BODY_FAR, 2.5); this.shoeFar = shoe(r, BODY_FAR);
    this.torso = limb(r, BODY, 2.8);
    this.legNear = limb(r, BODY, 2.6); this.shoeNear = shoe(r, BODY);
    this.toeG = [el('path', { d: starPath(2.6), fill: GOLD_HI, filter: 'url(#' + uid + 'Glow)' }, r), el('path', { d: starPath(2.6), fill: GOLD_HI, filter: 'url(#' + uid + 'Glow)' }, r)];
    this.headO = el('circle', { r: HEAD_R + 0.85, fill: 'rgba(0,0,0,0.78)' }, r);
    this.head = el('circle', { r: HEAD_R, fill: '#ffffff' }, r);
    this.hat = el('g', {}, r);
    if (look === 'hair') {
      // Bold swept-back spiky pompadour: charcoal mass, dark outer halo, crisp warm off-white rim, two gold streaks
      // (head-local, y-down, facing right; ~16px wide, ~9px above the head at SCALE 1.18)
      var HAIR = 'M4.2,-0.6 Q6.2,-3.2 6.9,-7.2 Q4.6,-6.4 3.4,-6.9 L3.0,-11.6 Q1.6,-8.6 0.6,-7.8 L-1.6,-11.8 Q-2.0,-8.8 -2.8,-7.6 ' +
        'L-6.2,-10.4 Q-5.0,-7.4 -5.2,-6.4 L-8.2,-6.6 Q-6.2,-4.6 -5.6,-3.6 L-7.4,-1.8 Q-5.2,-1.2 -4.3,0.4 Q-3.4,-3.4 0.2,-3.6 Q3.0,-3.4 4.2,-0.6 Z';
      var hg = el('g', { transform: 'scale(0.9,1)' }, this.hat);
      el('path', { d: HAIR, fill: 'none', stroke: 'rgba(0,0,0,0.8)', 'stroke-width': 3.6, 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' }, hg);
      el('path', { d: HAIR, fill: '#161618', stroke: '#f5efe0', 'stroke-width': 1.6, 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' }, hg);
      el('path', { d: 'M1.0,-4.6 Q1.9,-7.8 2.8,-10.6', fill: 'none', stroke: GOLD, 'stroke-width': 1.5, 'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke' }, hg);
      el('path', { d: 'M-2.0,-4.8 Q-3.8,-7.4 -5.5,-9.4', fill: 'none', stroke: GOLD, 'stroke-width': 1.5, 'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke' }, hg);
    } else {
      // Fedora (drawn in head-local coords, y-down, facing right; tilted forward)
      el('path', { d: 'M-6.2,-2.25 Q-5.9,-3.05 -3.6,-3.1 L4.0,-3.1 Q6.5,-3.0 7.7,-1.75 Q5.6,-2.1 4.0,-2.2 L-3.6,-2.2 Q-5.2,-2.1 -6.2,-2.25 Z',
        fill: '#0c0c0c', stroke: GOLD, 'stroke-width': 0.5, 'stroke-linejoin': 'round' }, this.hat);
      el('path', { d: 'M-3.2,-2.7 L-2.9,-7.0 Q-2.6,-7.85 -1.4,-7.65 Q-0.2,-7.05 0.7,-7.65 Q2.3,-7.85 2.65,-7.0 L3.35,-2.7 Z',
        fill: '#0c0c0c', stroke: GOLD, 'stroke-width': 0.5, 'stroke-linejoin': 'round' }, this.hat);
      el('path', { d: 'M-3.15,-3.0 L3.35,-3.0 L3.12,-4.45 L-3.0,-4.45 Z', fill: GOLD }, this.hat);
    }
    this.armNear = limb(r, BODY, 2.5);
    this.glove = el('circle', { r: 1.55, fill: '#ffffff', stroke: 'rgba(0,0,0,0.7)', 'stroke-width': 0.7 }, r);
    this.glint = el('path', { d: starPath(3.2), fill: GOLD_HI, filter: 'url(#' + uid + 'Glow)' }, r);
    this.glintCore = el('path', { d: starPath(2.2), fill: '#ffffff' }, r);
  }
  function setLimb(l, arr) { var s = pts(arr); l[0].setAttribute('points', s); l[1].setAttribute('points', s); }
  function setShoe(l, g) {
    for (var i = 0; i < 2; i++) {
      l[i].setAttribute('x1', g.heel.x.toFixed(2)); l[i].setAttribute('y1', (-g.heel.y).toFixed(2));
      l[i].setAttribute('x2', g.toe.x.toFixed(2)); l[i].setAttribute('y2', (-g.toe.y).toFixed(2));
    }
  }

  Rig.prototype.draw = function (pz, sparks, t, scale) {
    var S = scale || 1;
    this.root.setAttribute('transform', 'translate(0,' + this.groundY + ') scale(' + S + ') translate(' + pz.X.toFixed(3) + ',0) scale(' + pz.dir.toFixed(4) + ',1)');
    this.fx.setAttribute('transform', 'translate(0,' + this.groundY + ') scale(' + S + ')');

    var hip = { x: pz.hx, y: pz.hy };
    var up = { x: Math.sin(pz.lean), y: Math.cos(pz.lean) }, fw = { x: Math.cos(pz.lean), y: -Math.sin(pz.lean) };
    var sh = { x: hip.x + up.x * TORSO, y: hip.y + up.y * TORSO + pz.sy };
    var nk = { x: sh.x + up.x * NECK + fw.x * pz.glide, y: sh.y + up.y * NECK + fw.y * pz.glide };
    var ht = pz.lean + pz.head;
    var hc = { x: nk.x + Math.sin(ht) * HEAD_R, y: nk.y + Math.cos(ht) * HEAD_R };

    var hipL = { x: hip.x - 0.3, y: hip.y }, hipN = { x: hip.x + 0.3, y: hip.y };
    var g0 = footGeom(pz.f0), g1 = footGeom(pz.f1);
    var k0 = ik(hipN, g0.ank, THIGH, SHIN, pz.ks0), k1 = ik(hipL, g1.ank, THIGH, SHIN, pz.ks1);
    setLimb(this.legNear, [hipN, k0.j, k0.e]); setShoe(this.shoeNear, g0);
    setLimb(this.legFar, [hipL, k1.j, k1.e]); setShoe(this.shoeFar, g1);
    setLimb(this.torso, [hip, sh, nk]);

    function hand(h) { return { x: sh.x + fw.x * h.x + up.x * h.y, y: sh.y + fw.y * h.x + up.y * h.y }; }
    function blendW(h, w) { var q = hand(h); return pz.hw > 0 ? { x: lerp(q.x, w.x, pz.hw), y: lerp(q.y, w.y, pz.hw) } : q; }
    var a0 = ik(sh, blendW(pz.h0, pz.h0w), UARM, FARM, -pz.e0), a1 = ik(sh, blendW(pz.h1, pz.h1w), UARM, FARM, -pz.e1);
    this.gloveFar.setAttribute('cx', a1.e.x.toFixed(2)); this.gloveFar.setAttribute('cy', (-a1.e.y).toFixed(2)); this.gloveFar.setAttribute('opacity', pz.hw.toFixed(3));
    setLimb(this.armNear, [sh, a0.j, a0.e]); setLimb(this.armFar, [sh, a1.j, a1.e]);

    this.headO.setAttribute('cx', hc.x.toFixed(2)); this.headO.setAttribute('cy', (-hc.y).toFixed(2));
    this.head.setAttribute('cx', hc.x.toFixed(2)); this.head.setAttribute('cy', (-hc.y).toFixed(2));
    var deg = (ht + pz.hat) * 180 / Math.PI;
    this.hat.setAttribute('transform', 'translate(' + (hc.x + 0.5).toFixed(2) + ',' + (-hc.y + 0.2).toFixed(2) + ') rotate(' + deg.toFixed(2) + ')');

    var gp = a0.e;
    this.glove.setAttribute('cx', gp.x.toFixed(2)); this.glove.setAttribute('cy', (-gp.y).toFixed(2));
    var tw = 0.55 + 0.45 * Math.sin(t * 11.0);
    var gi = clamp(Math.max(pz.glint * tw, pz.flash), 0, 1), gs = (0.35 + 0.75 * gi) * (1 + 1.3 * pz.flash);
    var gt = 'translate(' + (gp.x + 1.1).toFixed(2) + ',' + (-gp.y - 1.1 - 3.2 * pz.hw).toFixed(2) + ') rotate(' + (t * 90 % 90).toFixed(1) + ') scale(' + gs.toFixed(3) + ')';
    this.glint.setAttribute('transform', gt); this.glint.setAttribute('opacity', (gi * 0.9).toFixed(3));
    this.glintCore.setAttribute('transform', gt + ' scale(0.6)'); this.glintCore.setAttribute('opacity', gi.toFixed(3));

    // ground shimmer under contact feet (world coords)
    var gs2 = [g0, g1], fs = [pz.f0, pz.f1];
    for (var i = 0; i < 2; i++) {
      var g = gs2[i], onGround = clamp(1 - Math.max(0, fs[i].y) / 1.5, 0, 1);
      var popped = clamp(fs[i].a / 0.9, 0, 1);
      var cx = popped > 0.5 ? g.toe.x : (g.toe.x + g.heel.x) / 2;
      var wx = pz.X + pz.dir * cx;
      this.toeG[i].setAttribute('transform', 'translate(' + (g.toe.x + 0.6).toFixed(2) + ',' + (-g.toe.y - 2.4).toFixed(2) + ') rotate(' + ((t * 120 + i * 40) % 90).toFixed(1) + ') scale(' + (0.55 + 0.35 * pz.toe).toFixed(3) + ')');
      this.toeG[i].setAttribute('opacity', (pz.toe * (0.6 + 0.4 * Math.sin(t * 19 + i * 1.7)) * clamp(fs[i].a / 0.8, 0, 1)).toFixed(3));
      var flick = 0.75 + 0.25 * Math.sin(t * 17 + i * 2.1);
      this.shim[i].setAttribute('cx', wx.toFixed(2)); this.shim[i].setAttribute('cy', '0.3');
      this.shim[i].setAttribute('rx', (popped > 0.5 ? 4.6 : 7.0).toFixed(2));
      this.shim[i].setAttribute('opacity', (pz.shim * onGround * flick).toFixed(3));
    }
    // spin swoosh arcs around waist + feet
    for (var q = 0; q < 2; q++) {
      var e = this.swooshG[q];
      e.setAttribute('cx', pz.X.toFixed(2)); e.setAttribute('cy', (q ? -2.6 : -(pz.hy + 1.5)).toFixed(2));
      e.setAttribute('rx', q ? 7.5 : 9.5); e.setAttribute('ry', q ? 1.7 : 2.6);
      e.setAttribute('stroke-dashoffset', (-pz.sph * 200 - q * 35).toFixed(1));
      e.setAttribute('opacity', (pz.swoosh * (q ? 0.7 : 0.9)).toFixed(3));
    }
    // sparks
    while (this.sparkPool.length < sparks.length) this.sparkPool.push(el('path', { fill: GOLD_HI }, this.sparkG));
    for (var j = 0; j < this.sparkPool.length; j++) {
      var n = this.sparkPool[j], s = sparks[j];
      if (!s) { n.setAttribute('opacity', '0'); continue; }
      n.setAttribute('d', s.star ? starPath(s.r * 2.2) : 'M' + (-s.r) + ',0 a' + s.r + ',' + s.r + ' 0 1,0 ' + (2 * s.r) + ',0 a' + s.r + ',' + s.r + ' 0 1,0 ' + (-2 * s.r) + ',0');
      n.setAttribute('fill', s.star ? GOLD_HI : GOLD);
      n.setAttribute('transform', 'translate(' + s.x.toFixed(2) + ',' + (-s.y).toFixed(2) + ')');
      n.setAttribute('opacity', s.o.toFixed(3));
    }
  };

  // =====================================================================
  //  DANCE BATTLE (22.4s loop)
  //  0.00–10.35 MJ v2 solo | 10.35–10.80 MJ fedora tip | 10.80–11.80 MJ "your turn!" point -> arms crossed
  //  11.80–12.15 Hair shrug + turn | 12.15–13.60 running-man toprock right | 13.60–15.40 robot / arm-wave
  //  15.40–17.50 kick-up handstand freeze | 17.50–20.40 C-walk heel-toe back left | 20.40–21.40 spin + drop + chest pop
  //  21.40–22.40 Hair points it back -> arms crossed; MJ steps into his 0.0s strut
  // =====================================================================
  var BEAT = 0.56; // watching foot-tap period (divides 22.4 exactly -> seamless)
  var CROSS0 = H(1.2, -2.4), CROSS1 = H(0.8, -7.6); // forearms stacked in an X in front of the chest (elbows forward: e=-1)
  var POINT = H(13.2, 3.6), POINT_BACK = H(5.0, 0.5);

  function tapPulse(t) { return Math.pow(Math.max(0, Math.sin(2 * Math.PI * t / BEAT)), 3); }

  function watchPose(t, X, dir, look, imp) {
    var tap = tapPulse(t), nod = Math.sin(2 * Math.PI * t / (2 * BEAT));
    return P({
      X: X, dir: dir, hx: -0.4, hy: 21.9 - 0.3 * tap, lean: -0.05 - 0.14 * imp,
      f0: F(4.5, -0.42 * tap), f1: F(-2.5, 0),
      h0: CROSS0, h1: CROSS1, e0: -1, e1: -1,
      head: 0.07 * nod - 0.22 * imp, hat: look === 'hair' ? -0.08 + 0.05 * nod : 0.2 + 0.06 * nod, sy: 0.4 * tap
    });
  }

  // ---------------- MJ (IM BUYIN) battle timeline ----------------
  function MJBattle(c) { this.c = c; }
  MJBattle.prototype.solo = function (t) { // identical to v2 Choreo.pose for t < 10.35
    var c = this.c, o;
    if (t < 2.1) o = c.walk(t);
    else if (t < 3.65) o = c.spin(t);
    else if (t < 7.5) o = t < 3.82 ? mix(c.spin(t), c.moon(t), smooth((t - 3.65) / 0.17)) : c.moon(t);
    else if (t < 8.55) o = t < 7.6 ? mix(c.moon(t), c.kick(t), smooth((t - 7.5) / 0.1)) : c.kick(t);
    else o = t < 8.7 ? mix(c.kick(t), c.lean(t), smooth((t - 8.55) / 0.15)) : c.lean(t);
    return o;
  };
  MJBattle.prototype.watch = function (t) {
    var imp = smooth(seg(t, 16.05, 16.35)) * (1 - smooth(seg(t, 16.9, 17.3))); // impressed by the freeze
    return watchPose(t, this.c.X0, 1, 'fedora', imp);
  };
  MJBattle.prototype.tip = function (t) { // quick cheeky fedora tip after the lean
    var tip = bump(t, 10.38, 10.8);
    return P({
      X: this.c.X0, hy: 21.2, lean: 0.03, f0: F(4.5, 0), f1: F(-2.0, 0),
      h0: mix({ v: H(3.5, -9.5) }, { v: H(7.4, 8.6) }, smooth(tip * 1.6)).v, h1: H(2.2, -11.5), e0: 1, e1: 1,
      head: -0.28 * tip, hat: 0.2 + 0.6 * tip, glint: 0.3 + 0.7 * tip
    });
  };
  MJBattle.prototype.point = function (t) { // 10.8–11.8 step toward IM SELLIN, two-beat point, cross arms
    var X = this.c.X0;
    var stepOut = smooth(seg(t, 10.8, 10.98)), stepBack = smooth(seg(t, 11.42, 11.62));
    var st = stepOut * (1 - stepBack);
    var b1 = bump(t, 10.95, 11.2), b2 = bump(t, 11.2, 11.45);
    var ext = Math.max(Math.pow(b1, 0.6), Math.pow(b2, 0.6));
    var armsIn = smooth(seg(t, 10.85, 10.95)) * (1 - smooth(seg(t, 11.45, 11.6)));
    var fx0 = lerp(4.5, 13.5, st), fy0 = 4 * (bump(t, 10.8, 10.98) + bump(t, 11.42, 11.62));
    var o = P({
      X: X, hx: 3.6 * st, hy: 21.0, lean: 0.06 + 0.06 * st, f0: F(fx0, 0, fy0), f1: F(-2.5, 0.3 * st),
      h0: mix({ v: POINT_BACK }, { v: POINT }, ext).v, h1: HAND_HIP, e0: 1, e1: -1,
      head: -0.08 * st, hat: 0.28, glint: 0.6 * armsIn, flash: Math.max(bump(t, 11.02, 11.16), bump(t, 11.27, 11.41))
    });
    var w = this.watch(t);
    var a = mix(this.tip(10.8), o, smooth(seg(t, 10.8, 10.88)));
    return t > 11.45 ? mix(a, w, smooth(seg(t, 11.45, 11.8))) : a;
  };
  MJBattle.prototype.toStrut = function (t) { // 21.55–22.4 uncross and step into the v2 strut start pose
    var w = this.watch(t), w0 = this.c.walk(0);
    var s1 = smooth(seg(t, 21.6, 21.95)), s2 = smooth(seg(t, 21.95, 22.35));
    var o = mix(w, w0, smooth(seg(t, 21.6, 22.35)));
    o.f1 = { x: lerp(w.f1.x, w0.f1.x, s1), y: 4 * bump(t, 21.6, 21.95), a: 0 };
    o.f0 = { x: lerp(w.f0.x, w0.f0.x, s2), y: 2.5 * bump(t, 21.95, 22.35) * (1 - s2) + w0.f0.y * s2, a: lerp(0, w0.f0.a, s2) };
    return o;
  };
  MJBattle.prototype.pose = function (t) {
    t = ((t % BATTLE_LOOP) + BATTLE_LOOP) % BATTLE_LOOP;
    var o;
    if (t < 10.35) o = this.solo(t);
    else if (t < 10.8) o = t < 10.45 ? mix(this.solo(10.35), this.tip(t), smooth((t - 10.35) / 0.1)) : this.tip(t);
    else if (t < 11.8) o = this.point(t);
    else if (t < 21.6) o = this.watch(t);
    else o = this.toStrut(t);
    return groundLock(o);
  };
  MJBattle.prototype.sparks = function (t) {
    t = ((t % BATTLE_LOOP) + BATTLE_LOOP) % BATTLE_LOOP;
    return this.c.sparks(t);
  };

  // ---------------- Hair guy (IM SELLIN) ----------------
  function HairBattle(Xs, Xe) { this.Xs = Xs; this.Xe = Xe; }

  // Generic planted-foot gait along the facing direction (no skating).
  function gait(t, t0, dur, N, Xst, dist, dir, o) {
    var L = dist / N, sd = dur / N, tt = clamp(t - t0, 0, dur);
    var p = Math.min(tt / sd, N - 1e-4), k = Math.floor(p), u = p - k, sh = L * (tt / sd);
    function hs(i) { return L * i; }
    function foot(i) {
      if (k % 2 === i) {
        var e = smooth(u);
        return F(lerp(hs(k) - L * 0.45, hs(k) + L * 1.55, e), lerp(o.toeOff, o.land, smooth((u - 0.12) / 0.7)), o.swingH * Math.sin(Math.PI * Math.pow(u, 0.85)));
      }
      var lift = ((k + 1) % 2 === i) ? o.toeOff * smooth((u - 0.4) / 0.6) : 0;
      var roll = (k > 0 && (k - 1) % 2 === i) ? o.land * (1 - smooth(u / 0.35)) : 0;
      return F(hs(k) + L * 0.55, lift + roll);
    }
    var f0 = foot(0), f1 = foot(1);
    return { X: Xst + dir * sh, f0: { x: f0.x - sh, y: f0.y, a: f0.a }, f1: { x: f1.x - sh, y: f1.y, a: f1.a }, p: p, k: k, u: u, L: L, sd: sd };
  }

  HairBattle.prototype.watch = function (t) {
    var imp = smooth(seg(t, 9.1, 9.4)) * (1 - smooth(seg(t, 10.0, 10.4))); // impressed by MJ's 42° lean
    var o = watchPose(t, this.Xs, -1, 'hair', imp);
    var wow = smooth(seg(t, 2.85, 3.05)) * (1 - smooth(seg(t, 3.5, 3.8)));  // head pop at the toe-stand
    o.head += 0.12 * wow;
    return o;
  };
  HairBattle.prototype.shrug = function (t) { // 11.8–12.15 uncross, hype shrug, turn to face right
    var sp = smooth(seg(t, 11.82, 12.14));
    var o = P({
      X: this.Xs, dir: -Math.cos(Math.PI * sp), hx: 0, hy: 21.4 - 1.2 * bump(t, 11.8, 12.0), lean: 0.02,
      f0: F(4.5, 0), f1: F(-2.5, 0), h0: H(5.5, -6.5), h1: H(4.5, -7.0), e0: 1, e1: 1,
      sy: 2.2 * bump(t, 11.82, 12.02), head: 0.1 * bump(t, 11.82, 12.02), hat: -0.08
    });
    var a = mix(this.watch(t), o, smooth(seg(t, 11.8, 11.9)));
    a.dir = o.dir;
    return a;
  };
  HairBattle.prototype.runman = function (t) { // 12.15–13.6 bouncy running-man toprock moving right
    var g = gait(t, 12.15, 1.45, 8, this.Xs, this.Xe - this.Xs, 1, { swingH: 9.5, toeOff: 0.9, land: 0 });
    var sw = Math.sin(Math.PI * g.p), bounce = -Math.cos(2 * Math.PI * g.u);
    return P({
      X: g.X, hy: 20.4 + 1.0 * bounce, lean: 0.12, f0: g.f0, f1: g.f1,
      h0: H(1 + 6 * sw, -6 + 3 * sw), h1: H(1 - 6 * sw, -6 - 3 * sw), e0: 1, e1: 1,
      head: 0.08 * Math.sin(2 * Math.PI * g.p), hat: -0.08, sy: 0.9 * Math.abs(sw)
    });
  };
  // Robot: snappy ticks then a liquid arm-wave with chest pops
  var ROBOT = [
    { h0: H(0.5, -13), h1: H(0, -13), e0: 1, e1: 1, head: 0, sy: 0 },
    { h0: H(13.4, 0), h1: H(0, -13), e0: 1, e1: 1, head: 0.22, sy: 0 },
    { h0: H(7.0, 6.8), h1: H(0, -13), e0: -1, e1: 1, head: 0.22, sy: 1.6 },
    { h0: H(7.0, 6.8), h1: H(13.4, 0), e0: -1, e1: 1, head: -0.18, sy: 0 },
    { h0: H(7.0, 6.8), h1: H(7.0, 6.8), e0: -1, e1: -1, head: -0.18, sy: 1.6 },
    { h0: H(7.0, -6.8), h1: H(7.0, -6.8), e0: 1, e1: 1, head: 0.0, sy: 0 }
  ];
  HairBattle.prototype.robot = function (t) { // 13.6–15.4
    var X = this.Xe, turn = smooth(seg(t, 13.6, 13.92)), dir = Math.cos(Math.PI * turn);
    var base = { X: X, dir: dir, hy: 21.6, lean: 0, f0: F(4.0, 0), f1: F(-1.0, 0), hat: -0.08 };
    var o;
    if (t < 14.65) {
      var tick = clamp((t - 13.85) / 0.15, 0, 5.999), i = Math.floor(tick), u = tick - i;
      var A = ROBOT[Math.max(0, i - 1)], B = ROBOT[i];
      if (t < 13.85) { A = B = ROBOT[0]; }
      var k = i === 0 ? 1 : smooth(u / 0.4);
      var q = {}; for (var key in base) q[key] = base[key];
      q.h0 = mix({ v: A.h0 }, { v: B.h0 }, k).v; q.h1 = mix({ v: A.h1 }, { v: B.h1 }, k).v;
      q.e0 = k < 0.5 ? A.e0 : B.e0; q.e1 = k < 0.5 ? A.e1 : B.e1;
      q.head = lerp(A.head, B.head, k); q.sy = lerp(A.sy, B.sy, k) * (1 - u * 0.5);
      q.glint = i >= 1 ? 0.5 * (1 - u) : 0;
      o = P(q);
    } else {
      var w = (t - 14.65) / 0.6, ph = 2 * Math.PI * w;
      var pop = Math.pow(Math.max(0, Math.sin(2 * ph)), 4);
      var q2 = {}; for (var k2 in base) q2[k2] = base[k2];
      q2.h0 = H(11.0, 4.5 * Math.sin(ph)); q2.h1 = H(-9.0, 4.5 * Math.sin(ph - 1.6));
      q2.e0 = Math.sin(ph + 0.8) > 0 ? -1 : 1; q2.e1 = 1;
      q2.sy = 1.8 * pop; q2.lean = -0.06 * pop; q2.head = 0.12 * Math.sin(ph - 0.8); q2.glint = 0.4 + 0.6 * pop;
      var settle = smooth(seg(t, 15.22, 15.4));
      o = mix(P(q2), P(Object.assign({}, base, { h0: H(0.5, -13), h1: H(0, -13) })), settle);
      if (t < 14.75) o = mix(P(Object.assign({}, base, { h0: ROBOT[5].h0, h1: ROBOT[5].h1 })), o, smooth((t - 14.65) / 0.1));
    }
    o.dir = dir;
    return o;
  };
  // Kick-up into a bent-leg b-boy handstand freeze, held ~0.75s, then pop back up
  HairBattle.prototype.handKeys = function () {
    if (this._hk) return this._hk;
    var X = this.Xe, hw0 = H(13.0, 1.95), hw1 = H(11.4, 1.95);
    var stand = P({ X: X, dir: -1, hy: 21.6, f0: F(4.0, 0), f1: F(-1.0, 0), h0: H(0.5, -13), h1: H(0, -13), hat: -0.08 });
    var crouch = P({ X: X, dir: -1, hx: 1, hy: 12.5, lean: 1.35, f0: F(4.5, 0), f1: F(1.5, 0.3), h0: H(8, -9), h1: H(8, -9),
      hw: 1, h0w: hw0, h1w: hw1, head: -0.3, hat: -0.08, e0: 1, e1: 1 });
    var kick = P({ X: X, dir: -1, hx: 3.2, hy: 22.0, lean: 2.3, f0: F(-9, -0.6, 17), f1: F(2.5, 1.1), h0: H(8, -9), h1: H(8, -9),
      hw: 1, h0w: hw0, h1w: hw1, head: -0.5, hat: -0.78, ks0: -1, glint: 0.5 }); // hair swept away from the floor
    var freeze = P({ X: X, dir: -1, hx: 12.2, hy: 27.9, lean: Math.PI, f0: F(21.5, -0.25, 32.5), f1: F(3.0, -1.9, 43.0), h0: H(8, -9), h1: H(8, -9),
      hw: 1, h0w: hw0, h1w: hw1, head: -0.9, hat: -0.78, ks0: 1, ks1: 1, glint: 1 });
    this._hk = [[15.4, stand], [15.62, crouch], [15.9, kick], [16.12, freeze], [16.87, freeze], [17.08, kick], [17.3, crouch], [17.5, stand]];
    return this._hk;
  };
  HairBattle.prototype.handstand = function (t) {
    var K = this.handKeys(), i = 0;
    while (i < K.length - 2 && t >= K[i + 1][0]) i++;
    var a = K[i], b = K[i + 1], k = smoother(seg(t, a[0], b[0]));
    var o = mix(a[1], b[1], k);
    if (t > 16.12 && t < 16.87) { // held freeze: tiny balance breathing on the legs
      var br = Math.sin((t - 16.12) * 9);
      o.f0 = { x: o.f0.x + 0.5 * br, y: o.f0.y + 0.4 * br, a: o.f0.a };
      o.f1 = { x: o.f1.x - 0.3 * br, y: o.f1.y, a: o.f1.a };
    }
    return o;
  };
  HairBattle.prototype.cwalk = function (t) { // 17.5–20.4 heel-toe C-walk glide back left (facing left)
    var g = gait(t, 17.5, 2.9, 10, this.Xe, this.Xe - this.Xs, -1, { swingH: 4.8, toeOff: 0.75, land: -0.45 });
    var sw = Math.sin(Math.PI * g.p), bounce = -Math.cos(2 * Math.PI * g.u);
    return P({
      X: g.X, dir: -1, hy: 20.6 + 0.8 * bounce, lean: 0.06, f0: g.f0, f1: g.f1,
      h0: H(3 + 3 * sw, -9 + 1.5 * Math.abs(sw)), h1: H(3 - 3 * sw, -9 + 1.5 * Math.abs(sw)), e0: 1, e1: 1,
      head: 0.1 * Math.sin(2 * Math.PI * g.p), hat: -0.08, sy: 0.8 * Math.abs(sw), shim: 0.6
    });
  };
  HairBattle.prototype.finish = function (t) { // 20.4–21.4 spin + drop-in + hype chest pop
    var X = this.Xs, sp = smoother(seg(t, 20.42, 20.82)), dir = -Math.cos(2 * Math.PI * sp);
    var spinP = P({ X: X, dir: dir, hy: 21.8, f0: F(3.4, 0.55), f1: F(4.2, 0.55), h0: H(3.2, -3.6), h1: H(3.8, -3.2), hat: -0.08,
      swoosh: bump(t, 20.44, 20.8), sph: sp });
    var drop = P({ X: X, dir: -1, hx: -1, hy: 15.5, lean: 0.4, f0: F(6.0, 0), f1: F(-3.0, 0), h0: H(6.5, -9.5), h1: H(6.0, -10), e0: 1, e1: 1, hat: -0.08, head: 0.15 });
    var pop = P({ X: X, dir: -1, hy: 22.2, lean: -0.16, f0: F(5.0, 0), f1: F(-2.5, 0), h0: H(4.0, 5.5), h1: H(3.5, 5.0), e0: -1, e1: -1, sy: 2.0, hat: -0.08, head: -0.2, glint: 1 });
    var o = spinP;
    if (t > 20.8) o = mix(spinP, drop, smooth(seg(t, 20.8, 21.0)));
    if (t > 21.02) o = mix(drop, pop, smooth(seg(t, 21.02, 21.18)));
    o.dir = t < 20.82 ? dir : -1;
    return o;
  };
  HairBattle.prototype.pointBack = function (t) { // 21.4–22.4 throw it back to MJ, cross arms
    var X = this.Xs;
    var b1 = bump(t, 21.5, 21.78), b2 = bump(t, 21.78, 22.06);
    var ext = Math.max(Math.pow(b1, 0.6), Math.pow(b2, 0.6));
    var st = smooth(seg(t, 21.4, 21.55)) * (1 - smooth(seg(t, 21.98, 22.2)));
    var o = P({
      X: X, dir: -1, hx: 3.0 * st, hy: 21.0, lean: 0.1 * st, f0: F(lerp(5.0, 12.5, st), 0, 3.5 * (bump(t, 21.4, 21.55) + bump(t, 21.98, 22.2))), f1: F(-2.5, 0.3 * st),
      h0: mix({ v: POINT_BACK }, { v: POINT }, ext).v, h1: HAND_HIP, e0: 1, e1: -1, hat: -0.08, head: -0.1 * st,
      flash: Math.max(bump(t, 21.58, 21.72), bump(t, 21.86, 22.0)), glint: 0.3
    });
    var a = mix(this.finish(21.4), o, smooth(seg(t, 21.4, 21.5)));
    return mix(a, this.watch(t), smooth(seg(t, 22.02, 22.38)));
  };
  HairBattle.prototype.pose = function (t) {
    t = ((t % BATTLE_LOOP) + BATTLE_LOOP) % BATTLE_LOOP;
    var o, bw = 0.12;
    function bl(prev, cur, t0) { return t < t0 + bw ? mix(prev, cur, smooth((t - t0) / bw)) : cur; }
    if (t < 11.8) o = this.watch(t);
    else if (t < 12.15) o = this.shrug(t);
    else if (t < 13.6) { o = bl(this.shrug(t), this.runman(t), 12.15); }
    else if (t < 15.4) { o = bl(this.runman(t), this.robot(t), 13.6); o.dir = this.robot(t).dir; }
    else if (t < 17.5) o = this.handstand(t);
    else if (t < 20.4) o = bl(this.handstand(t), this.cwalk(t), 17.5);
    else if (t < 21.4) { o = bl(this.cwalk(t), this.finish(t), 20.4); o.dir = this.finish(t).dir; }
    else o = this.pointBack(t);
    return groundLock(o);
  };
  HairBattle.prototype.sparks = function (t) {
    t = ((t % BATTLE_LOOP) + BATTLE_LOOP) % BATTLE_LOOP;
    var out = [], self = this;
    // gold dust kicked up at each C-walk heel landing
    var sd = 0.29;
    for (var k = 0; k < 10; k++) {
      var tl = 17.5 + (k + 1) * sd, age = (t - tl) / 0.55;
      if (age < 0 || age > 1) continue;
      var g = gait(tl - 0.001, 17.5, 2.9, 10, this.Xe, this.Xe - this.Xs, -1, { swingH: 4.8, toeOff: 0.75, land: -0.45 });
      var fl = (k % 2 === 0) ? g.f0 : g.f1, wx = g.X - (fl.x - 2.5);
      for (var j = 0; j < 6; j++) {
        var id = k * 13 + j;
        out.push({ x: wx + (hash(id) - 0.5) * 7 + (hash(id + 3) - 0.5) * 6 * age, y: 0.7 + age * (1.0 + hash(id + 5) * 3.5),
          r: (0.7 + hash(id + 7) * 0.7) * (1 - 0.6 * age), o: (1 - age) * 0.85, star: hash(id + 9) > 0.5 });
      }
    }
    // sparkle burst around the planted hands during the freeze
    if (t > 16.0 && t < 17.15) {
      for (var i = Math.ceil((t - 0.5) / 0.045); i <= Math.floor(t / 0.045); i++) {
        var ts = i * 0.045; if (ts < 16.08 || ts > 16.9) continue;
        var ag = (t - ts) / 0.5; if (ag < 0 || ag > 1) continue;
        var hx = this.Xe - 12.2 + (hash(i) - 0.5) * 9;
        out.push({ x: hx + (hash(i + 2) - 0.5) * 4 * ag, y: 1.0 + ag * (2 + hash(i + 4) * 7), r: (0.7 + hash(i + 6) * 0.9) * (1 - 0.5 * ag), o: (1 - ag), star: hash(i + 8) > 0.4 });
      }
    }
    return out;
  };

  // ---------------- mounting ----------------
  function makeLayer(anchor) {
    var cs = getComputedStyle(anchor);
    if (cs.position === 'static') anchor.style.position = 'relative';
    var bw = parseFloat(cs.borderTopWidth) || 0, bl = parseFloat(cs.borderLeftWidth) || 0;
    var H_ = 92, below = 4;
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'mj-stickman');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;left:' + (-bl) + 'px;bottom:calc(100% + ' + (bw - below) + 'px);height:' + H_ + 'px;' +
      'width:calc(100% + ' + (2 * bl) + 'px);overflow:visible;pointer-events:none;z-index:3;';
    anchor.appendChild(svg);
    return { svg: svg, H: H_, groundY: H_ - below };
  }

  function mountBattle(buyEl, sellEl, opts) {
    opts = opts || {};
    if (!buyEl || !sellEl) return null;
    var minW = opts.minWidth == null ? 900 : opts.minWidth;
    var mqDesk = global.matchMedia ? global.matchMedia('(min-width: ' + minW + 'px)') : null;
    var mqRed = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : null;
    if (!opts.force) {
      if (mqRed && mqRed.matches) return null;
      if (mqDesk && !mqDesk.matches) return null;
    }
    var L1 = makeLayer(buyEl), L2 = makeLayer(sellEl);
    var rigMJ = new Rig(L1.svg, L1.groundY, 'fedora'), rigHair = new Rig(L2.svg, L2.groundY, 'hair');
    var mj = null, hair = null, key = '', dead = false, raf = 0, pausedAt = 0, elapsed = 0, lastNow = performance.now();
    var manual = !!opts.manual;
    function layout() {
      var rb = buyEl.getBoundingClientRect(), rs = sellEl.getBoundingClientRect();
      if (rb.width < 120 || rs.width < 120) return false;
      var av = opts.avoid && document.querySelector(opts.avoid);
      var ra = av ? av.getBoundingClientRect() : null;
      var avKey = ra && ra.width > 0 ? Math.round(ra.left) + 'x' + Math.round(ra.width) : '0';
      var k = Math.round(rb.width) + 'x' + Math.round(rs.width) + 'x' + Math.round(rs.left) + 'x' + avKey;
      if (k === key && mj && hair) return true;
      key = k;
      mj = new MJBattle(new Choreo(rb.width / SCALE, Math.min(TRAVEL_PX, rb.width * 0.5) / SCALE));
      var startPx = opts.hairStartPx == null ? 69 : opts.hairStartPx, travelPx = opts.hairTravelPx == null ? 220 : opts.hairTravelPx;
      var maxRightPx = rs.width - 40;
      if (ra && ra.width > 0 && ra.left > rs.left) maxRightPx = Math.min(maxRightPx, ra.left - rs.left - (opts.avoidMargin == null ? 64 : opts.avoidMargin));
      travelPx = Math.max(80, Math.min(travelPx, maxRightPx - startPx));
      hair = new HairBattle(startPx / SCALE, (startPx + travelPx) / SCALE);
      L1.svg.setAttribute('viewBox', '0 0 ' + rb.width + ' ' + L1.H);
      L2.svg.setAttribute('viewBox', '0 0 ' + rs.width + ' ' + L2.H);
      return true;
    }
    function render(t) {
      if (!layout()) return;
      var tt = ((t % BATTLE_LOOP) + BATTLE_LOOP) % BATTLE_LOOP;
      rigMJ.draw(mj.pose(tt), mj.sparks(tt), tt, SCALE);
      rigHair.draw(hair.pose(tt), hair.sparks(tt), tt, SCALE);
    }
    function stopRaf() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
    function startRaf() { if (dead || raf || document.hidden || manual) return; lastNow = performance.now(); raf = requestAnimationFrame(tick); }
    function destroy() {
      if (dead) return;
      dead = true;
      stopRaf();
      document.removeEventListener('visibilitychange', onVis);
      global.removeEventListener('resize', onResize);
      L1.svg.remove();
      L2.svg.remove();
    }
    function onVis() {
      if (dead) return;
      if (document.hidden) { stopRaf(); } else { startRaf(); }
    }
    function onResize() {
      if (dead) return;
      if (!opts.force && mqDesk && !mqDesk.matches) { destroy(); return; }
      key = '';
      render(elapsed);
    }
    function tick(now) {
      raf = 0;
      if (dead) return;
      if (!buyEl.isConnected || !sellEl.isConnected || (!opts.force && !document.body.classList.contains('is-home'))) { destroy(); return; }
      if (!opts.force && ((mqDesk && !mqDesk.matches) || (mqRed && mqRed.matches))) { destroy(); return; }
      var dt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000));
      lastNow = now;
      if (!manual) { elapsed = (elapsed + dt) % BATTLE_LOOP; render(elapsed); }
      raf = requestAnimationFrame(tick);
    }
    document.addEventListener('visibilitychange', onVis);
    global.addEventListener('resize', onResize);
    render(0);
    if (!document.hidden && !manual) startRaf();
    return {
      svgs: [L1.svg, L2.svg], render: render,
      info: function () { layout(); return mj && hair ? { mjX0: mj.c.X0 * SCALE, mjX1: mj.c.X1 * SCALE, hairXs: hair.Xs * SCALE, hairXe: hair.Xe * SCALE } : null; },
      destroy: destroy
    };
  }

  global.MJBattle = { mount: mountBattle, LOOP: BATTLE_LOOP, SCALE: SCALE };
})(window);

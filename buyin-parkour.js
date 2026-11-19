/*!
 * IMDRIVN — Buyin Parkour (mobile-only easter egg on the #/buyin "Pick your lane" chooser)
 * A spiky-haired stickman free-runs down the four lanes: superhero drop onto DAILY, stands on the
 * category words like ledges, wall-kicks off the card borders, tucked backflips with lane-coloured
 * swooshes, and points squarely AT each category word (DAILY, OFF-ROAD, PERFORMANCE, SUPERCAR).
 * Seamless 16.8s loop.
 *
 * Usage:
 *   BuyinParkour.mount(document.querySelector('.lanes'));
 * Options: { force: true }  -> ignore width / reduced-motion / route guards (testing only)
 *          { manual: true } -> no rAF clock; drive frames with window.__setParkourTime(t)
 * Layout is measured live from the DOM (cards, borders, and the rendered letter tops of each
 * category word) and re-measured after resize / layout changes, once the layout has settled.
 */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var GOLD = '#d9a441', GOLD_HI = '#ffe2a0', BODY = '#f5f5f5', BODY_FAR = '#c9c9c9';
  var LANE = {
    daily: ['#3b82f6', '#93c5fd'], offroad: ['#22c55e', '#86efac'],
    performance: ['#ef4444', '#fca5a5'], supercar: ['#d9a441', '#ffe2a0']
  };
  var HI = {}; for (var lk in LANE) HI[LANE[lk][0]] = LANE[lk][1];
  var COL = { all: '#e9e4d4' };
  var LOOP = 16.8;
  var MAX_W = 768, SETTLE_MS = 450;
  var S = 0.84;                                   // model -> px  (≈37px body + hair ≈ 42px)
  var THIGH = 10, SHIN = 10, FOOT = 5.4, ANK_DX = 1.3, ANK_DY = 1.8, TORSO = 12.5, NECK = 2.2, HEAD_R = 4.2, UARM = 7.2, FARM = 6.8;
  var SHOE_W = 2.3, SH = SHOE_W / 2;              // px; sole half-thickness (sole bottom sits exactly on the ledge)
  var G = 1750;                                   // px/s^2 gravity
  var HS = 19.0, HC = 14.5, HD = 9.0;             // hip height above ground px: stand / contact / deep squash
  var PI = Math.PI, TAU = 2 * PI;
  function extend(a, b) { for (var k in b) a[k] = b[k]; return a; }

  // ---------- math ----------
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function smooth(k) { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); }
  function smoother(k) { k = clamp(k, 0, 1); return k * k * k * (k * (k * 6 - 15) + 10); }
  function seg(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }
  function bump(t, a, b) { return Math.sin(PI * seg(t, a, b)); }
  function V(x, y) { return { x: x, y: y }; }
  function add(a, b) { return V(a.x + b.x, a.y + b.y); }
  function sub(a, b) { return V(a.x - b.x, a.y - b.y); }
  function mul(a, k) { return V(a.x * k, a.y * k); }
  function dot(a, b) { return a.x * b.x + a.y * b.y; }
  function len(a) { return Math.sqrt(a.x * a.x + a.y * a.y); }
  function nrm(a) { var l = len(a) || 1e-6; return V(a.x / l, a.y / l); }
  function lv(a, b, k) { return V(lerp(a.x, b.x, k), lerp(a.y, b.y, k)); }
  function hash(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function wrapA(a) { while (a > PI) a -= TAU; while (a < -PI) a += TAU; return a; }

  // two-bone IK, joint chosen on the side of `pref`
  var ikClamps = 0, ikCount = false;
  function ik(P, Q, l1, l2, pref) {
    var d0 = sub(Q, P), d = len(d0) || 1e-6, max = l1 + l2 - 1e-3, min = Math.abs(l1 - l2) + 1e-3;
    if (ikCount && d > max + 0.35) ikClamps++;
    var dc = clamp(d, min, max), e = mul(d0, 1 / d);
    var a = (l1 * l1 - l2 * l2 + dc * dc) / (2 * dc), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    // pref = { fr: body frame, s: +1 knee (bends forward), -1 elbow (bends back) } -> bend side fixed in the body frame (no flips)
    var ea = dot(e, pref.fr.fw), eb = dot(e, pref.fr.u);
    var perp = nrm(add(mul(pref.fr.fw, -eb * pref.s), mul(pref.fr.u, ea * pref.s)));
    return { j: add(add(P, mul(e, a)), mul(perp, h)), e: add(P, mul(e, dc)) };
  }

  // ---------- body frame ----------
  // phi: body rotation relative to facing (0 upright, + lean forward, - lean back / backflip). y-down world.
  function frame(p) {
    var u = V(p.dir * Math.sin(p.phi), -Math.cos(p.phi)), fw = V(p.dir * Math.cos(p.phi), Math.sin(p.phi));
    return { u: u, fw: fw, hip: p.hip };
  }
  function Lw(fr, a, b) { return add(fr.hip, add(mul(fr.fw, a * S), mul(fr.u, b * S))); }
  function shoulder(fr, curl) { return add(fr.hip, add(mul(fr.u, TORSO * S), mul(fr.fw, (curl || 0) * S))); }
  function armW(fr, curl, a, b) { var s = shoulder(fr, curl); return add(s, add(mul(fr.fw, a * S), mul(fr.u, b * S))); }

  // sole flat on a surface: (cx,cy) contact point on surface, n outward normal, tv toe direction, lift = heel lift (rad)
  function contactFoot(cx, cy, n, tv, lift) {
    var a = lift || 0, F = FOOT * S;
    var c = V(cx + n.x * SH, cy + n.y * SH);
    var toe = add(c, mul(tv, F * 0.62));
    var et = sub(mul(tv, Math.cos(a)), mul(n, Math.sin(a)));
    var en = add(mul(n, Math.cos(a)), mul(tv, Math.sin(a)));
    var heel = sub(toe, mul(et, F));
    var ank = add(heel, add(mul(et, ANK_DX * S), mul(en, ANK_DY * S)));
    return { heel: heel, toe: toe, ank: ank };
  }
  function groundFoot(x, gy, dir, lift) { return contactFoot(x, gy, V(0, -1), V(dir, 0), lift); }
  function airFoot(ank, fdir, upHint) {
    var pp = V(-fdir.y, fdir.x); if (dot(pp, upHint) < 0) pp = mul(pp, -1);
    var base = sub(ank, mul(pp, ANK_DY * S));
    return { ank: ank, heel: sub(base, mul(fdir, ANK_DX * S)), toe: add(base, mul(fdir, (FOOT - ANK_DX) * S)) };
  }
  function localFoot(fr, a, b, pitch) {
    var fdir = sub(mul(fr.fw, Math.cos(pitch)), mul(fr.u, Math.sin(pitch)));
    return airFoot(Lw(fr, a, b), fdir, fr.u);
  }

  function mkPose(o) {
    return { hip: o.hip, phi: o.phi || 0, dir: o.dir, curl: o.curl || 0, F: o.F, W: o.W, head: o.head || 0,
      glint: o.glint || 0, flash: o.flash || 0, col: o.col || COL.all, elbPref: o.elbPref || null, vis: o.vis == null ? 1 : o.vis };
  }
  function mixFoot(a, b, k) { return { heel: lv(a.heel, b.heel, k), toe: lv(a.toe, b.toe, k), ank: lv(a.ank, b.ank, k) }; }
  function mixPose(A, B, k) {
    if (k <= 0) return A; if (k >= 1) return B;
    var thA = A.dir * A.phi, thB = B.dir * B.phi, th = thA + wrapA(thB - thA) * k;
    var dir = k < 0.5 ? A.dir : B.dir;
    var phiM = A.dir === B.dir ? th * dir : lerp(A.phi, B.phi, k) * Math.abs(1 - 2 * k);
    var hipM = lv(A.hip, B.hip, k);
    if (A.dir !== B.dir) { // hop-turn: straighten the legs through the switch so knees don't pop across
      var ankY = (lerp(A.F[0].ank.y, B.F[0].ank.y, k) + lerp(A.F[1].ank.y, B.F[1].ank.y, k)) / 2;
      hipM = V(hipM.x, hipM.y - Math.max(0, (THIGH + SHIN) * S * 0.86 - (ankY - hipM.y)) * (1 - Math.abs(1 - 2 * k)));
    }
    return mkPose({ hip: hipM, phi: phiM, dir: dir, curl: lerp(A.curl, B.curl, k),
      F: [mixFoot(A.F[0], B.F[0], k), mixFoot(A.F[1], B.F[1], k)], W: [lv(A.W[0], B.W[0], k), lv(A.W[1], B.W[1], k)],
      head: lerp(A.head, B.head, k), glint: lerp(A.glint, B.glint, k), flash: lerp(A.flash, B.flash, k), col: k < 0.5 ? A.col : B.col,
      elbPref: k < 0.5 ? A.elbPref : B.elbPref, vis: lerp(A.vis, B.vis, k) });
  }

  // ---------- standing helpers ----------
  function rest(fr, curl, side) { return armW(fr, curl, side ? -0.8 : 1.4, -12.6); }
  function standPose(x, gy, dir, h, o) {
    o = o || {};
    var hip = V(x + (o.hx || 0) * dir, gy - h), p = { hip: hip, phi: o.phi || 0, dir: dir }, fr = frame(p);
    var st = o.stance == null ? 3.2 : o.stance;
    var F = [groundFoot(x + dir * st, gy, dir, o.lift0 || 0), groundFoot(x - dir * st * 0.9, gy, dir, o.lift1 || 0)];
    var W = [o.w0 ? o.w0(fr) : rest(fr, o.curl, 0), o.w1 ? o.w1(fr) : rest(fr, o.curl, 1)];
    return mkPose({ hip: hip, phi: p.phi, dir: dir, curl: o.curl, F: F, W: W, head: o.head, glint: o.glint, flash: o.flash, col: o.col, elbPref: o.elbPref });
  }

  // ---------- moves (each returns f(t) -> pose) ----------
  var APEX_MIN = -1e9;                            // highest hip y allowed (container clips above its top edge)
  function mBallistic(t0, t1, A, B, dir, o) {
    o = o || {};
    var T = t1 - t0, g = G, vy = (B.y - A.y) / T - 0.5 * g * T;
    function apex(gg) { var v = (B.y - A.y) / T - 0.5 * gg * T; return v < 0 ? A.y - v * v / (2 * gg) : Math.min(A.y, B.y); }
    if (!o.noApex && apex(G) < APEX_MIN) { // soften gravity just enough to keep the whole flip inside the lanes box
      var lo = 250, hi = G; for (var it = 0; it < 24; it++) { var mid = (lo + hi) / 2; if (apex(mid) < APEX_MIN) hi = mid; else lo = mid; }
      g = lo; vy = (B.y - A.y) / T - 0.5 * g * T;
    }
    var r0 = o.r0 == null ? 0.06 : o.r0, r1 = o.r1 == null ? 0.86 : o.r1, tuck = o.tuck || 0;
    var f = function (t) {
      var u = clamp(t - t0, 0, T), k = u / T;
      var hip = V(lerp(A.x, B.x, k), A.y + vy * u + 0.5 * g * u * u);
      var re = o.linearRot ? seg(k, r0, r1) : smoother(seg(k, r0, r1));
      var phi = lerp(o.phi0 || 0, o.phi1 || 0, re);
      var tk = tuck * Math.pow(bump(k, r0, r1 + 0.02), 0.55);
      var endK = smooth(seg(k, o.readyAt || 0.78, 1)), startK = 1 - smooth(seg(k, 0, 0.22));
      var p = { hip: hip, phi: phi, dir: dir }, fr = frame(p);
      // legs: extended -> tucked -> ready (land / wall)
      var ext0 = V(2.0, -19.0), ext1 = V(-2.6, -18.2);
      if (o.legs === 'split') { ext0 = V(9.5, -15.5); ext1 = V(-9, -15.5); }
      if (o.legs === 'knee') { ext0 = V(6.0, -13.5); ext1 = V(-2.5, -18.2); }
      var tk0 = V(4.6, -4.2), tk1 = V(2.4, -5.6);
      var rd = o.end === 'wall' ? [V(1.4, -12.5), V(-1.2, -13.4)] : [V(3.5, -15.2), V(-2.6, -15.6)];
      var takeoff = [V(1.0, -19.2), V(-5.0, -17.6)];
      var a0 = lv(lv(lv(ext0, takeoff[0], startK * (o.noTakeoff ? 0 : 1)), tk0, tk), rd[0], endK);
      var a1 = lv(lv(lv(ext1, takeoff[1], startK * (o.noTakeoff ? 0 : 1)), tk1, tk), rd[1], endK);
      var pit0 = lerp(lerp(1.15, 0.55, tk), o.end === 'wall' ? 1.45 : 0.3, endK), pit1 = pit0 + 0.12;
      var F = [localFoot(fr, a0.x, a0.y, pit0), localFoot(fr, a1.x, a1.y, pit1)];
      // arms: swing up at takeoff, grab shins in tuck, spread for landing
      var up0 = V(3.0, 12.5), up1 = V(-1.5, 12.8);
      if (o.arms === 'fwd') { up0 = V(12.5, 3.0); up1 = V(11, 5.5); }
      if (o.arms === 'hero') { up0 = V(2.5, 13.2); up1 = V(-11.5, -3.5); }
      var tkA0 = V(6.0, -12.0), tkA1 = V(4.6, -13.0);
      var land0 = o.end === 'wall' ? V(8.5, 2.5) : V(9.0, -3.5), land1 = o.end === 'wall' ? V(6.5, 5.0) : V(-6.5, -2.0);
      var w0 = lv(lv(up0, tkA0, tk), land0, endK * 0.85), w1 = lv(lv(up1, tkA1, tk), land1, endK * 0.85);
      var curl = 3.2 * tk;
      return mkPose({ hip: hip, phi: phi, dir: dir, curl: curl, F: F, W: [armW(fr, curl, w0.x, w0.y), armW(fr, curl, w1.x, w1.y)],
        head: 0.25 * tk - 0.1 * startK, col: o.col, vis: o.vis ? o.vis(t) : 1 });
    };
    f.hipAt = function (t) { var u = clamp(t - t0, 0, T); return V(lerp(A.x, B.x, u / T), A.y + vy * u + 0.5 * g * u * u); };
    return f;
  }

  function mRun(t0, t1, x0, x1, gy, dir, N, col, dust) {
    var T = t1 - t0, Ts = T / N, v = (x1 - x0) / T;
    function hx(tau) { return x0 + v * tau; }
    function plantX(i) { return hx((i + 0.3) * Ts) + dir * 1.2; }
    for (var i = 0; i < N; i++) dust.push({ t: t0 + i * Ts, x: plantX(i), y: gy, col: col, kind: 'step', n: V(0, -1), seed: i * 7 + t0 * 13 });
    return function (t) {
      var tau = t - t0, p = tau / Ts;
      var hip = V(hx(tau), gy - (HS - 1.6) + 2.0 * Math.pow(Math.cos(PI * (p - 0.3)), 2));
      var phi = 0.44 + 0.04 * Math.sin(TAU * p), pose = { hip: hip, phi: phi, dir: dir }, fr = frame(pose);
      var F = [], W = [];
      for (var j = 0; j < 2; j++) {
        var i = Math.floor(p); if ((((i - j) % 2) + 2) % 2) i -= 1;
        var s = p - i;
        if (s < 0.62) {
          F.push(groundFoot(plantX(i), gy, dir, s > 0.32 ? 1.05 * smooth((s - 0.32) / 0.30) : 0));
        } else {
          var q = (s - 0.62) / 1.38, fx = lerp(plantX(i) + dir * 2.4, plantX(i + 2), smooth(q));
          var h = 9.5 * S * Math.pow(Math.sin(PI * q), 0.9) * (q < 0.5 ? 1.1 : 0.9) + 3.5 * S * bump(q, 0, 0.45);
          var pit = lerp(1.0, 0.15, smooth(q));
          var ank = V(fx - dir * 1.0 * (1 - q), gy - SH - ANK_DY * S - h);
          F.push(airFoot(ank, V(dir * Math.cos(pit), Math.sin(pit)), V(0, -1)));
        }
        var w = -Math.cos(PI * (p - j));
        W.push(armW(fr, 0.8, 1.5 + 7.5 * w, -7.5 + 4.6 * Math.max(0, w) - 0.5 * Math.max(0, -w)));
      }
      return mkPose({ hip: hip, phi: phi, dir: dir, curl: 0.5, F: F, W: W, head: -0.12, col: col });
    };
  }

  // landing squash: contact -> deep dip -> recover (optionally turning around at turnAt)
  function mLand(t0, t1, x, gy, dir, o) {
    o = o || {};
    var T = t1 - t0, dmin = o.depth || HD, hEnd = o.hEnd || HS;
    function at(t, d) {
      var u = clamp(t - t0, 0, T), dipT = 0.09;
      var h = u < dipT ? lerp(HC, dmin, smooth(u / dipT)) : lerp(dmin, hEnd, smoother((u - dipT) / (T - dipT)));
      var sq = 1 - clamp((h - dmin) / (HS - dmin), 0, 1);
      var phi = 0.12 + 0.42 * sq;
      return standPose(x, gy, d, h, { phi: phi, stance: o.perch ? 0.8 : 3.4, lift1: o.perch ? 0.5 : 0, col: o.col, curl: 1.2 * sq, head: 0.15 * sq,
        w0: function (fr) { return armW(fr, 1.2 * sq, lerp(1.4, 9.5, sq), lerp(-12.6, -4.0, sq)); },
        w1: function (fr) { return armW(fr, 1.2 * sq, lerp(-0.8, -7.0, sq), lerp(-12.6, -1.0, sq)); } });
    }
    return function (t) {
      if (!o.dir1) return at(t, dir);
      var k = smooth(seg(t, t0 + o.turnAt - 0.05, t0 + o.turnAt + 0.05));
      return mixPose(at(t, dir), at(t, o.dir1), k);
    };
  }

  // superhero landing: one knee down, fist on the box, other arm flung back, then rise
  function mHero(t0, t1, x, gy, dir, col) {
    var T = t1 - t0;
    return function (t) {
      var u = clamp(t - t0, 0, T);
      var dn = u < 0.1 ? smooth(u / 0.1) : 1 - smoother(seg(u, 0.5, T));
      var h = lerp(HC, 5.6, dn), pre = 1 - smooth(seg(u, 0, 0.1));
      if (u >= 0.1) h = lerp(5.6, HS, smoother(seg(u, 0.5, T)));
      var phi = lerp(0.15, 0.62, dn), hip = V(x, gy - h), p = { hip: hip, phi: phi, dir: dir }, fr = frame(p);
      var F = [groundFoot(x + dir * lerp(3.2, 5.2, dn), gy, dir, 0), groundFoot(x - dir * lerp(3.0, 6.2, dn), gy, dir, lerp(0, 1.15, dn))];
      var fist = V(x + dir * 8.2, gy - 1.2);
      var w0 = lv(armW(fr, 2, 5, 6), fist, smooth(seg(u, 0.03, 0.12)) * (1 - smooth(seg(u, 0.5, 0.62))));
      var w1 = armW(fr, 2 * dn, lerp(-0.8, -11.5, dn), lerp(-12.6, 2.5, dn));
      if (u < 0.1) w0 = lv(w0, armW(fr, 0, 3, 12), pre);
      return mkPose({ hip: hip, phi: phi, dir: dir, curl: 2 * dn, F: F, W: [w0, w1], head: -0.25 * dn - 0.2 * bump(u, 0.25, 0.6), col: col });
    };
  }

  // enthusiastic point at a world target (two pumps), other hand on hip

  // point AT a word: lively double-tap toward `target`; optional squat/lean (pointing down onto the letters)
  var TAP0 = 0.25, TAP_P = 0.36;                  // tap peaks at t0+0.25 and t0+0.61
  function mPointAt(t0, t1, x, gy, dir, target, col, o) {
    o = o || {};
    var T = t1 - t0, sq = o.squat || 0;
    return function (t) {
      var u = clamp(t - t0, 0, T);
      var raise = smooth(seg(u, 0, 0.16)) * (1 - smooth(seg(u, T - 0.14, T)));
      var bt = u - 0.16, pump = bt > 0 && bt < 0.72 ? Math.pow(Math.max(0, Math.sin(TAU * bt / TAP_P)), 2) : 0;
      var s = sq * smooth(seg(u, 0, 0.2)) * (1 - smooth(seg(u, T - 0.12, T)) * (o.keepSquat ? 0 : 1));
      var h = lerp(HS, 9.6, s) - 0.9 * pump * (1 - s) - 0.8 * pump * s;
      var hip = V(x, gy - h), phi = lerp(0.08, 0.5, s) * Math.max(raise, s) + 0.07 * pump, p = { hip: hip, phi: phi, dir: dir }, fr = frame(p);
      var curl = 0.6 + 1.2 * s, sh = shoulder(fr, curl), aim = nrm(sub(target, sh)), reach = (UARM + FARM) * S * (0.99 - 0.08 * pump);
      var pointW = add(sh, mul(aim, reach));
      var w0 = lv(rest(fr, curl, 0), pointW, raise);
      var w1 = lv(rest(fr, curl, 1), armW(fr, curl, lerp(-3.4, -5.5, s), lerp(-8.6, -6.0, s)), raise);
      var F = o.perch ? [groundFoot(x + dir * 0.9, gy, dir, 0.12), groundFoot(x - dir * 0.6, gy, dir, 0.55)]
                      : [groundFoot(x + dir * 3.8, gy, dir, 0), groundFoot(x - dir * 3.0, gy, dir, lerp(0.25 * raise, 0.6, s))];
      return mkPose({ hip: hip, phi: phi, dir: dir, curl: curl, F: F, W: [w0, w1], head: lerp(-0.18, 0.25, s) * raise, glint: raise, flash: pump * raise, col: col });
    };
  }

  // anticipation crouch (optional turn first) arms swinging back
  function mWind(t0, t1, x, gy, dir, o) {
    o = o || {};
    var T = t1 - t0;
    function at(t, d) {
      var u = clamp(t - t0, 0, T), k = smooth(seg(u, o.turnAt ? o.turnAt : 0, T));
      var h = lerp(HS, 11.5, k);
      return standPose(x, gy, d, h, { phi: 0.45 * k, stance: o.perch ? 0.8 : 3.4, curl: 1.5 * k, head: -0.25 * k, col: o.col, lift1: o.perch ? 0.5 : 0.3 * k,
        w0: function (fr) { return armW(fr, 1.5 * k, lerp(1.4, -9.5, k), lerp(-12.6, -6.5, k)); },
        w1: function (fr) { return armW(fr, 1.5 * k, lerp(-0.8, -10.5, k), lerp(-12.6, -5.0, k)); } });
    }
    return function (t) {
      if (!o.dir1) return at(t, dir);
      var kk = smooth(seg(t, t0 + o.turnAt * 0.5 - 0.05, t0 + o.turnAt * 0.5 + 0.05));
      return mixPose(at(t, dir), at(t, o.dir1), kk);
    };
  }

  // wall plant: body perpendicular to the wall, both soles flat on the vertical border, compress then spring
  function mPlant(t0, t1, wallX, y, side, dir, col) {
    var T = t1 - t0;
    return function (t) {
      var u = clamp(t - t0, 0, T), k = u / T;
      var d = k < 0.45 ? lerp(11.0, 8.6, smooth(k / 0.45)) : lerp(8.6, 13.2, smooth((k - 0.45) / 0.55));
      var hip = V(wallX - side * d, y - 2.0 * k), p = { hip: hip, phi: -PI / 2, dir: dir }, fr = frame(p);
      var n = V(-side, 0), tv = V(0, -1), lift = 0.55 * smooth(seg(k, 0.6, 1));
      var F = [contactFoot(wallX, y - 1.6, n, tv, lift), contactFoot(wallX, y + 4.6, n, tv, lift * 0.8)];
      var W = [armW(fr, 2.0, lerp(8.5, 11, k), lerp(2.5, 6, k)), armW(fr, 2.0, lerp(6.5, 9.5, k), lerp(5.0, 8.5, k))];
      return mkPose({ hip: hip, phi: -PI / 2, dir: dir, curl: 2.0, F: F, W: W, head: 0.2, col: col });
    };
  }


  // ---------- choreography from the live layout ----------
  function build(L) {
    APEX_MIN = 27;
    var M = [], fx = [], c = L.cards, sp = L.spots, ic = L.icons, WL = L.wallL, WR = L.wallR;
    function add_(t0, t1, f, blend) { M.push({ t0: t0, t1: t1, f: f, blend: blend == null ? 0.06 : blend }); }
    function burst(t, x, y, col, n, kind, big) { fx.push({ t: t, x: x, y: y, col: col, kind: kind || 'land', n: n || V(0, -1), big: big || 1, seed: Math.round(t * 1000) }); }
    function ping(t0, tgt, col) { for (var i = 0; i < 2; i++) fx.push({ t: t0 + TAP0 + i * TAP_P, x: tgt.x, y: tgt.y, col: col, kind: 'ping', n: V(0, -1), big: 1, seed: Math.round(t0 * 1000) + i }); }
    function wallY(cd, above) { return clamp(Math.round((above + cd.bottom) / 2), cd.top + 22, cd.bottom - 24); }
    var cd = LANE.daily[0], co = LANE.offroad[0], cp = LANE.performance[0], cs = LANE.supercar[0];
    var sD = sp.daily, sO = sp.offroad, sP = sp.performance, sS = sp.supercar;

    // A — drop in from the top, superhero landing on the DAILY box, run, hop onto the spot beside/on DAILY, point at the word
    var gA = c[0].top, xA = Math.min(WR - 88, L.avoidLeft - 22);
    add_(0.00, 0.40, mBallistic(0.00, 0.40, V(xA + 14, gA - 160), V(xA, gA - HC), -1, { phi0: -0.05, phi1: 0.12, legs: 'knee', arms: 'hero', r0: 0, r1: 1, col: cd, noTakeoff: true, readyAt: 0.7, noApex: true }), 0);
    burst(0.40, xA, gA, cd, null, 'land', 1.5);
    add_(0.40, 1.05, mHero(0.40, 1.05, xA, gA, -1, cd), 0.03);
    var xA2 = xA - 42;
    add_(1.05, 1.41, mRun(1.05, 1.41, xA, xA2, gA, -1, 3, cd, fx), 0.1);
    add_(1.41, 1.95, mBallistic(1.41, 1.95, V(xA2 - 3, gA - HS + 1), V(sD.x, sD.y - HC), -1, { phi0: 0.35, phi1: 0.15, r0: 0, r1: 1, col: cd, arms: 'up', legs: 'split', readyAt: 0.72 }), 0.05);
    burst(1.95, sD.x, sD.y, cd);
    add_(1.95, 2.24, mLand(1.95, 2.24, sD.x, sD.y, -1, { dir1: sD.dir === -1 ? null : sD.dir, turnAt: 0.23, col: cd, perch: sD.perch, hEnd: sD.squat ? 12 : HS }), 0.03);
    add_(2.24, 3.10, mPointAt(2.24, 3.10, sD.x, sD.y, sD.dir, sD.aim, cd, { perch: sD.perch, squat: sD.squat }), 0.06); ping(2.24, sD.ping, cd);
    add_(3.10, 3.30, mWind(3.10, 3.30, sD.x, sD.y, sD.dir, { dir1: sD.dir === 1 ? null : 1, turnAt: 0.1, col: cd, perch: sD.perch }), 0.05);

    // B — 360° backflip into a wall-plant on the right border, wall-flip onto the 4x4 box top, hop onto OFF-ROAD, point at it
    var yW1 = wallY(c[0], L.tagBottom[0]);
    add_(3.30, 4.02, mBallistic(3.30, 4.02, V(sD.x, sD.y - 11.5), V(WR - 11.0, yW1), 1, { phi0: 0.4, phi1: -PI / 2 - TAU, tuck: 1, r0: 0.08, r1: 0.9, end: 'wall', col: cd, readyAt: 0.8 }), 0.06);
    burst(4.02, WR, yW1 + 1.5, cd, V(-1, 0), 'wall');
    add_(4.02, 4.16, mPlant(4.02, 4.16, WR, yW1, 1, 1, cd), 0.035);
    var x4t = WR - 72, g4t = c[1].top;
    add_(4.16, 4.70, mBallistic(4.16, 4.70, V(WR - 13.2, yW1 - 2), V(x4t, g4t - HC), 1, { phi0: -PI / 2, phi1: -TAU + 0.35, tuck: 1, r0: 0.0, r1: 0.82, col: co, noTakeoff: true }), 0.03);
    burst(4.70, x4t, g4t, co);
    add_(4.70, 5.04, mLand(4.70, 5.04, x4t, g4t, 1, { dir1: -1, turnAt: 0.27, col: co }), 0.03);
    var x4r = Math.max(sO.x + 22, Math.min(x4t - 16, sO.x + 34));
    add_(5.04, 5.40, mRun(5.04, 5.40, x4t, x4r, g4t, -1, 3, co, fx), 0.1);
    add_(5.40, 5.86, mBallistic(5.40, 5.86, V(x4r - 3, g4t - HS + 1), V(sO.x, sO.y - HC), -1, { phi0: 0.35, phi1: 0.15, r0: 0, r1: 1, col: co, arms: 'up', legs: 'split', readyAt: 0.72 }), 0.05);
    burst(5.86, sO.x, sO.y, co);
    add_(5.86, 6.14, mLand(5.86, 6.14, sO.x, sO.y, -1, { dir1: sO.dir === -1 ? null : sO.dir, turnAt: 0.23, col: co, perch: sO.perch, hEnd: 12 }), 0.03);
    add_(6.14, 7.02, mPointAt(6.14, 7.02, sO.x, sO.y, sO.dir, sO.aim, co, { perch: sO.perch, squat: sO.squat }), 0.06); ping(6.14, sO.ping, co);

    // C — spring to the right border, wall-flip down onto the end of PERFORMANCE, point down at the word
    add_(7.02, 7.24, mWind(7.02, 7.24, sO.x, sO.y, sO.dir, { dir1: sO.dir === 1 ? null : 1, turnAt: 0.1, col: co, perch: sO.perch }), 0.05);
    var yW2 = wallY(c[1], L.tagBottom[1]);
    add_(7.24, 7.64, mBallistic(7.24, 7.64, V(sO.x, sO.y - 11.5), V(WR - 11.0, yW2), 1, { phi0: 0.4, phi1: -PI / 2, r0: 0.2, r1: 0.92, end: 'wall', arms: 'fwd', legs: 'split', col: co, readyAt: 0.7 }), 0.06);
    burst(7.64, WR, yW2 + 1.5, co, V(-1, 0), 'wall');
    add_(7.64, 7.78, mPlant(7.64, 7.78, WR, yW2, 1, 1, co), 0.035);
    add_(7.78, 8.40, mBallistic(7.78, 8.40, V(WR - 13.2, yW2 - 2), V(sP.x, sP.y - HC), 1, { phi0: -PI / 2, phi1: -TAU + 0.35, tuck: 1, r0: 0.0, r1: 0.84, col: cp, noTakeoff: true }), 0.03);
    burst(8.40, sP.x, sP.y, cp, null, 'land', 1.2);
    add_(8.40, 8.70, mLand(8.40, 8.70, sP.x, sP.y, 1, { dir1: sP.dir === 1 ? null : sP.dir, turnAt: 0.24, col: cp, perch: sP.perch, hEnd: 12 }), 0.03);
    add_(8.70, 9.58, mPointAt(8.70, 9.58, sP.x, sP.y, sP.dir, sP.aim, cp, { perch: sP.perch, squat: sP.squat }), 0.06); ping(8.70, sP.ping, cp);

    // D — sprint the PERFORMANCE letters (hop clean over the gauge icon), leap to the LEFT border, double backflip onto SUPERCAR
    var gP = L.perfRun.y, ico = ic[2], xa = Math.min(sP.x - 8, ico.right + 15), xb = Math.max(L.perfRun.x0 + 8, ico.left - 15), xc = L.perfRun.x0 + 9;
    add_(9.58, 9.90, mRun(9.58, 9.90, sP.x, xa, gP, -1, Math.max(3, Math.round(Math.abs(sP.x - xa) / 20)), cp, fx), 0.1);
    add_(9.90, 10.36, mBallistic(9.90, 10.36, V(xa - 3, gP - HS + 1), V(xb, gP - HC), -1, { phi0: 0.35, phi1: 0.2, r0: 0, r1: 1, col: cp, arms: 'up', legs: 'split', readyAt: 0.74 }), 0.05);
    burst(10.36, xb, gP, cp, null, 'step');
    add_(10.36, 10.68, mRun(10.36, 10.68, xb, xc, gP, -1, Math.max(3, Math.round(Math.abs(xb - xc) / 20)), cp, fx), 0.08);
    var yW3 = wallY(c[2], L.tagBottom[2]);
    add_(10.68, 11.12, mBallistic(10.68, 11.12, V(xc - 3, gP - HS + 1), V(WL + 11.0, yW3), -1, { phi0: 0.3, phi1: -PI / 2, r0: 0.25, r1: 0.92, end: 'wall', arms: 'fwd', legs: 'split', col: cp, readyAt: 0.7 }), 0.05);
    burst(11.12, WL, yW3 + 1.5, cp, V(1, 0), 'wall');
    add_(11.12, 11.27, mPlant(11.12, 11.27, WL, yW3, -1, -1, cp), 0.035);
    add_(11.27, 12.07, mBallistic(11.27, 12.07, V(WL + 13.2, yW3 - 2), V(sS.x, sS.y - HC), -1, { phi0: -PI / 2, phi1: -2 * TAU + 0.35, tuck: 1, r0: 0.02, r1: 0.86, col: cs, noTakeoff: true }), 0.03);
    burst(12.07, sS.x, sS.y, cs, null, 'land', 1.6);
    add_(12.07, 12.39, mLand(12.07, 12.39, sS.x, sS.y, -1, { dir1: sS.dir === -1 ? null : sS.dir, turnAt: 0.25, col: cs, depth: 8.0, perch: sS.perch, hEnd: 12 }), 0.03);
    add_(12.39, 13.27, mPointAt(12.39, 13.27, sS.x, sS.y, sS.dir, sS.aim, cs, { perch: sS.perch, squat: sS.squat }), 0.06); ping(12.39, sS.ping, cs);

    // E — exit: leap to the left border, wall-flip onto VIEW ALL, sprint right and dive out (seamless loop)
    add_(13.27, 13.49, mWind(13.27, 13.49, sS.x, sS.y, sS.dir, { dir1: sS.dir === -1 ? null : -1, turnAt: 0.1, col: cs, perch: sS.perch }), 0.05);
    var yW4 = wallY(c[3], L.tagBottom[3]);
    add_(13.49, 13.89, mBallistic(13.49, 13.89, V(sS.x, sS.y - 11.5), V(WL + 11.0, yW4), -1, { phi0: 0.4, phi1: -PI / 2, r0: 0.2, r1: 0.9, end: 'wall', arms: 'fwd', legs: 'split', col: cs, readyAt: 0.7 }), 0.06);
    burst(13.89, WL, yW4 + 1.5, cs, V(1, 0), 'wall');
    add_(13.89, 14.04, mPlant(13.89, 14.04, WL, yW4, -1, -1, cs), 0.035);
    var gV = L.viewAll.top, xV0 = L.viewAll.left + 78;
    add_(14.04, 14.60, mBallistic(14.04, 14.60, V(WL + 13.2, yW4 - 2), V(xV0, gV - HC), -1, { phi0: -PI / 2, phi1: -TAU + 0.35, tuck: 1, r0: 0.0, r1: 0.84, col: cs, noTakeoff: true }), 0.03);
    burst(14.60, xV0, gV, GOLD_HI);
    add_(14.60, 14.90, mLand(14.60, 14.90, xV0, gV, -1, { dir1: 1, turnAt: 0.23, col: cs, hEnd: HS - 1 }), 0.03);
    var xV1 = L.viewAll.right - 52;
    add_(14.90, 15.75, mRun(14.90, 15.75, xV0, xV1, gV, 1, Math.max(8, Math.round((xV1 - xV0) / 21)), cs, fx), 0.12);
    add_(15.75, 16.40, mBallistic(15.75, 16.40, V(xV1 + 4, gV - HS + 1), V(L.width + 80, gV - 70), 1, { noApex: true, phi0: 0.3, phi1: 1.4, r0: 0.1, r1: 1, arms: 'fwd', legs: 'split', col: cs }), 0.05);
    return { moves: M, fx: fx, LOOP: LOOP };
  }

  // ---------- rig / renderer ----------
  function el(name, attrs, parent) { var n = document.createElementNS(NS, name); for (var k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; }
  function f2(v) { return v.toFixed(2); }
  function ptsS(arr) { var s = ''; for (var i = 0; i < arr.length; i++) s += f2(arr[i].x) + ',' + f2(arr[i].y) + ' '; return s; }
  function starPath(r) { var q = r * 0.28; return 'M0,' + (-r) + ' L' + q + ',' + (-q) + ' L' + r + ',0 L' + q + ',' + q + ' L0,' + r + ' L' + (-q) + ',' + q + ' L' + (-r) + ',0 L' + (-q) + ',' + (-q) + ' Z'; }
  var HAIR = 'M4.2,-0.6 Q6.2,-3.2 6.9,-7.2 Q4.6,-6.4 3.4,-6.9 L3.0,-11.6 Q1.6,-8.6 0.6,-7.8 L-1.6,-11.8 Q-2.0,-8.8 -2.8,-7.6 ' +
    'L-6.2,-10.4 Q-5.0,-7.4 -5.2,-6.4 L-8.2,-6.6 Q-6.2,-4.6 -5.6,-3.6 L-7.4,-1.8 Q-5.2,-1.2 -4.3,0.4 Q-3.4,-3.4 0.2,-3.6 Q3.0,-3.4 4.2,-0.6 Z';

  function Rig(svg, uid) {
    var defs = el('defs', {}, svg);
    var glow = el('filter', { id: uid + 'Glow', x: '-80%', y: '-80%', width: '260%', height: '260%' }, defs);
    el('feGaussianBlur', { stdDeviation: '1.1' }, glow);
    var soft = el('filter', { id: uid + 'Soft', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
    el('feGaussianBlur', { stdDeviation: '1.6' }, soft);
    this.fxG = el('g', {}, svg);
    this.trail = [el('polyline', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': 6.5, filter: 'url(#' + uid + 'Soft)' }, this.fxG),
                  el('polyline', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': 2.8 }, this.fxG),
                  el('polyline', { fill: 'none', stroke: '#ffffff', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': 1.3 }, this.fxG)];
    this.ftrail = [el('polyline', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': 1.6 }, this.fxG)];
    this.rings = el('g', {}, this.fxG); this.ringPool = [];
    this.sparkG = el('g', {}, this.fxG); this.pool = [];
    var r = this.root = el('g', {}, svg);
    var common = { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    function limb(color, w) { return [el('polyline', extend({ stroke: 'rgba(0,0,0,0.88)', 'stroke-width': w + 2.0 }, common), r), el('polyline', extend({ stroke: color, 'stroke-width': w }, common), r)]; }
    function shoe(color) { return [el('line', extend({ stroke: 'rgba(0,0,0,0.85)', 'stroke-width': SHOE_W + 1.5 }, common), r), el('line', extend({ stroke: color, 'stroke-width': SHOE_W }, common), r)]; }
    this.armFar = limb(BODY_FAR, 2.0); this.legFar = limb(BODY_FAR, 2.15); this.shoeFar = shoe(BODY_FAR);
    this.torso = limb(BODY, 2.45);
    this.legNear = limb(BODY, 2.25); this.shoeNear = shoe(BODY);
    this.headO = el('circle', { r: HEAD_R * S + 1.0, fill: 'rgba(0,0,0,0.88)' }, r);
    this.head = el('circle', { r: HEAD_R * S, fill: '#ffffff' }, r);
    this.hair = el('g', {}, r);
    var hg = el('g', { transform: 'scale(0.9,1)' }, this.hair);
    var ns = { 'vector-effect': 'non-scaling-stroke', 'stroke-linejoin': 'round' };
    el('path', extend({ d: HAIR, fill: 'none', stroke: 'rgba(0,0,0,0.85)', 'stroke-width': 2.9 }, ns), hg);
    el('path', extend({ d: HAIR, fill: '#161618', stroke: '#f5efe0', 'stroke-width': 1.2 }, ns), hg);
    el('path', extend({ d: 'M1.0,-4.6 Q1.9,-7.8 2.8,-10.6', fill: 'none', stroke: GOLD, 'stroke-width': 1.2, 'stroke-linecap': 'round' }, ns), hg);
    el('path', extend({ d: 'M-2.0,-4.8 Q-3.8,-7.4 -5.5,-9.4', fill: 'none', stroke: GOLD, 'stroke-width': 1.2, 'stroke-linecap': 'round' }, ns), hg);
    this.armNear = limb(BODY, 2.15);
    this.glove = el('circle', { r: 1.35, fill: '#ffffff', stroke: 'rgba(0,0,0,0.8)', 'stroke-width': 0.7 }, r);
    this.glint = el('path', { d: starPath(4.3), filter: 'url(#' + uid + 'Glow)' }, r);
    this.glintCore = el('path', { d: starPath(2.6), fill: '#ffffff' }, r);
  }
  function setLimb(l, arr) { var s = ptsS(arr); l[0].setAttribute('points', s); l[1].setAttribute('points', s); }
  function setShoe(l, f) { for (var i = 0; i < 2; i++) { l[i].setAttribute('x1', f2(f.heel.x)); l[i].setAttribute('y1', f2(f.heel.y)); l[i].setAttribute('x2', f2(f.toe.x)); l[i].setAttribute('y2', f2(f.toe.y)); } }

  Rig.prototype.skeleton = function (pz) {
    var fr = frame(pz), hip = pz.hip, sh = shoulder(fr, pz.curl);
    var nk = add(sh, mul(fr.u, NECK * S));
    var th = pz.dir * pz.phi + pz.dir * pz.head, uh = V(Math.sin(th), -Math.cos(th));
    var hc = add(nk, mul(uh, HEAD_R * S));
    var hipN = add(hip, mul(fr.fw, 0.3 * S)), hipF = sub(hip, mul(fr.fw, 0.3 * S));
    var KN = { fr: fr, s: 1 }, EL = { fr: fr, s: -1 };
    var k0 = ik(hipN, pz.F[0].ank, THIGH * S, SHIN * S, KN), k1 = ik(hipF, pz.F[1].ank, THIGH * S, SHIN * S, KN);
    var a0 = ik(sh, pz.W[0], UARM * S, FARM * S, EL), a1 = ik(sh, pz.W[1], UARM * S, FARM * S, EL);
    return { fr: fr, sh: sh, nk: nk, hc: hc, th: th, hipN: hipN, hipF: hipF, k0: k0, k1: k1, a0: a0, a1: a1 };
  };
  Rig.prototype.draw = function (pz, t, sparks, trail) {
    var k = this.skeleton(pz);
    this.root.setAttribute('opacity', pz.vis.toFixed(3));
    setLimb(this.legNear, [k.hipN, k.k0.j, k.k0.e]); setShoe(this.shoeNear, pz.F[0]);
    setLimb(this.legFar, [k.hipF, k.k1.j, k.k1.e]); setShoe(this.shoeFar, pz.F[1]);
    setLimb(this.torso, [pz.hip, k.sh, k.nk]);
    setLimb(this.armNear, [k.sh, k.a0.j, k.a0.e]); setLimb(this.armFar, [k.sh, k.a1.j, k.a1.e]);
    this.headO.setAttribute('cx', f2(k.hc.x)); this.headO.setAttribute('cy', f2(k.hc.y));
    this.head.setAttribute('cx', f2(k.hc.x)); this.head.setAttribute('cy', f2(k.hc.y));
    this.hair.setAttribute('transform', 'translate(' + f2(k.hc.x) + ',' + f2(k.hc.y) + ') rotate(' + (k.th * 180 / PI).toFixed(2) + ') scale(' + (pz.dir * S).toFixed(3) + ',' + S.toFixed(3) + ')');
    var gp = k.a0.e;
    this.glove.setAttribute('cx', f2(gp.x)); this.glove.setAttribute('cy', f2(gp.y));
    var tw = 0.6 + 0.4 * Math.sin(t * 13.0), gi = clamp(Math.max(pz.glint * tw, pz.flash), 0, 1), gs = (0.45 + 0.7 * gi) * (1 + 0.9 * pz.flash);
    var aim = nrm(sub(gp, k.sh)), gpos = add(gp, mul(aim, 2.6));
    var gt = 'translate(' + f2(gpos.x) + ',' + f2(gpos.y) + ') rotate(' + ((t * 140) % 90).toFixed(1) + ') scale(' + gs.toFixed(3) + ')';
    this.glint.setAttribute('transform', gt); this.glint.setAttribute('fill', pz.col); this.glint.setAttribute('opacity', (gi * pz.glint > 0.01 ? gi : 0).toFixed(3));
    this.glintCore.setAttribute('fill', HI[pz.col] || '#ffffff'); this.glintCore.setAttribute('transform', gt + ' scale(0.6)'); this.glintCore.setAttribute('opacity', (pz.glint > 0.01 ? gi : 0).toFixed(3));
    // flip trail (head + toe motion arcs)
    var ts = ptsS(trail.arc), tsc = ptsS(trail.arc.slice(0, Math.ceil(trail.arc.length * 0.6)));
    this.trail[0].setAttribute('points', ts); this.trail[1].setAttribute('points', ts); this.trail[2].setAttribute('points', tsc);
    this.trail[0].setAttribute('stroke', pz.col); this.trail[0].setAttribute('opacity', (0.55 * trail.o).toFixed(3));
    this.trail[1].setAttribute('stroke', pz.col); this.trail[1].setAttribute('opacity', (0.85 * trail.o).toFixed(3));
    this.trail[2].setAttribute('stroke', HI[pz.col] || '#ffffff'); this.trail[2].setAttribute('opacity', (0.95 * trail.o).toFixed(3));
    var ts2 = ptsS(trail.arc2); this.ftrail[0].setAttribute('points', ts2); this.ftrail[0].setAttribute('stroke', HI[pz.col] || GOLD_HI); this.ftrail[0].setAttribute('opacity', (0.6 * trail.o).toFixed(3));
    // sparks
    while (this.pool.length < sparks.p.length) this.pool.push(el('path', {}, this.sparkG));
    for (var j = 0; j < this.pool.length; j++) {
      var n = this.pool[j], s = sparks.p[j];
      if (!s) { n.setAttribute('opacity', '0'); continue; }
      n.setAttribute('d', s.star ? starPath(s.r * 2.3) : 'M' + (-s.r) + ',0 a' + s.r + ',' + s.r + ' 0 1,0 ' + (2 * s.r) + ',0 a' + s.r + ',' + s.r + ' 0 1,0 ' + (-2 * s.r) + ',0');
      n.setAttribute('fill', s.c); n.setAttribute('transform', 'translate(' + f2(s.x) + ',' + f2(s.y) + ')'); n.setAttribute('opacity', s.o.toFixed(3));
    }
    while (this.ringPool.length < sparks.r.length) this.ringPool.push(el('ellipse', { fill: 'none', 'stroke-width': 1.3 }, this.rings));
    for (var q = 0; q < this.ringPool.length; q++) {
      var e = this.ringPool[q], rr = sparks.r[q];
      if (!rr) { e.setAttribute('opacity', '0'); continue; }
      e.setAttribute('cx', f2(rr.x)); e.setAttribute('cy', f2(rr.y)); e.setAttribute('rx', f2(rr.rx)); e.setAttribute('ry', f2(rr.ry));
      e.setAttribute('stroke', rr.c); e.setAttribute('opacity', rr.o.toFixed(3));
    }
  };

  function sparksAt(fx, t) {
    var out = { p: [], r: [] };
    for (var i = 0; i < fx.length; i++) {
      var e = fx[i], tau = t - e.t;
      if (tau < 0 || tau > 0.7) continue;
      if (e.kind === 'ping') { // word-tap glint right on the letters
        if (tau > 0.42) continue;
        var kp = tau / 0.42, hiC = HI[e.col] || '#ffffff';
        out.p.push({ x: e.x, y: e.y, r: 1.9 * (1.25 - kp) + 0.4, star: true, c: hiC, o: Math.pow(1 - kp, 1.2) });
        out.p.push({ x: e.x, y: e.y, r: 0.9 * (1.2 - kp), star: true, c: '#ffffff', o: Math.pow(1 - kp, 1.5) });
        for (var pj = 0; pj < 4; pj++) { var pa = pj * PI / 2 + PI / 4, pd = 3 + 11 * Math.sqrt(kp); out.p.push({ x: e.x + Math.cos(pa) * pd, y: e.y + Math.sin(pa) * pd * 0.8, r: 0.75, star: false, c: hiC, o: 0.9 * (1 - kp) }); }
        out.r.push({ x: e.x, y: e.y, rx: lerp(2, 13, Math.sqrt(kp)), ry: lerp(1.5, 7, Math.sqrt(kp)), c: e.col, o: 0.9 * Math.pow(1 - kp, 1.3) });
        continue;
      }
      var step = e.kind === 'step', wall = e.kind === 'wall';
      var N = step ? 3 : Math.round((wall ? 12 : 14) * e.big), base = Math.atan2(e.n.y, e.n.x);
      for (var j = 0; j < N; j++) {
        var h1 = hash(e.seed * 3.1 + j * 1.7), h2 = hash(e.seed * 5.3 + j * 2.9), h3 = hash(e.seed + j * 4.1);
        var life = step ? 0.28 + 0.12 * h3 : 0.38 + 0.3 * h3; if (tau > life) continue;
        var spread = step ? 1.0 : 1.35, ang = base + (h1 - 0.5) * 2 * spread;
        if (!wall && !step && j % 2) ang = base + (j % 4 === 1 ? -1 : 1) * (1.1 + 0.35 * h1); // low skimming sparks along the ledge
        var sp = step ? 18 + 22 * h2 : (70 + 150 * h2) * (e.big > 1 ? 1.15 : 1);
        var gk = step ? 60 : 520, x = e.x + Math.cos(ang) * sp * tau, y = e.y + Math.sin(ang) * sp * tau + 0.5 * gk * tau * tau;
        var o = Math.pow(1 - tau / life, 1.4);
        out.p.push({ x: x, y: y - (step ? 1 : 0), r: step ? 0.9 + 0.6 * h2 : 0.65 + 0.75 * h3, star: !step && j % 3 === 0,
          c: step ? 'rgba(225,225,235,0.75)' : (j % 4 === 2 ? '#ffffff' : (j % 4 === 0 ? (HI[e.col] || GOLD_HI) : e.col)), o: o * (step ? 0.65 : 1) });
      }
      if (!step && tau < 0.3) {
        var k = tau / 0.3, R = lerp(3, 17 * e.big, Math.sqrt(k));
        out.r.push({ x: e.x, y: e.y, rx: wall ? R * 0.28 : R, ry: wall ? R : R * 0.26, c: e.col, o: 0.85 * Math.pow(1 - k, 1.5) });
      }
    }
    return out;
  }


  // ---------- live layout measurement ----------
  // Ink profile of a text node: each glyph is re-drawn into a canvas at its exact DOM position with the
  // element's computed font, then scanned for the first opaque row per column -> real letter tops.
  var SC = 4, cnv = null;
  function inkProfile(node, ox, oy) {
    var el0 = node.parentElement, cs = getComputedStyle(el0), txt = node.textContent;
    var up = cs.textTransform === 'uppercase', low = cs.textTransform === 'lowercase';
    var font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    var rg = document.createRange(), glyphs = [], x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, i;
    for (i = 0; i < txt.length; i++) {
      if (/\s/.test(txt.charAt(i))) continue;
      rg.setStart(node, i); rg.setEnd(node, i + 1);
      var rs = rg.getClientRects(); if (!rs.length) continue;
      var r = rs[0]; if (!(r.width > 0)) continue;
      var ch = txt.charAt(i); ch = up ? ch.toUpperCase() : low ? ch.toLowerCase() : ch;
      glyphs.push({ ch: ch, l: r.left - ox, t: r.top - oy, h: r.height });
      x0 = Math.min(x0, r.left - ox); x1 = Math.max(x1, r.right - ox); y0 = Math.min(y0, r.top - oy); y1 = Math.max(y1, r.bottom - oy);
    }
    if (!glyphs.length) return null;
    cnv = cnv || document.createElement('canvas');
    var pad = 6, Wc = Math.ceil((x1 - x0 + 2 * pad) * SC), Hc = Math.ceil((y1 - y0 + 2 * pad) * SC);
    cnv.width = Wc; cnv.height = Hc;
    var ctx = cnv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, Wc, Hc);
    ctx.setTransform(SC, 0, 0, SC, 0, 0); ctx.font = font; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#000';
    var m = ctx.measureText('H'), asc = m.fontBoundingBoxAscent, desc = m.fontBoundingBoxDescent;
    if (!(asc > 0)) { asc = parseFloat(cs.fontSize) * 0.92; desc = parseFloat(cs.fontSize) * 0.25; }
    var base = 0;
    for (i = 0; i < glyphs.length; i++) {
      var g = glyphs[i], bl = g.t + (g.h - (asc + desc)) / 2 + asc;
      base += bl; ctx.fillText(g.ch, g.l - x0 + pad, bl - y0 + pad);
    }
    base /= glyphs.length;
    var data = ctx.getImageData(0, 0, Wc, Hc).data, cols = [], top = 1e9;
    for (var cx = 0; cx < Wc; cx++) {
      var ty = Infinity;
      for (var cy = 0; cy < Hc; cy++) if (data[(cy * Wc + cx) * 4 + 3] >= 128) { ty = cy / SC + y0 - pad; break; }
      cols.push(ty); if (ty < top) top = ty;
    }
    if (top > 1e8) return null;
    return { x0: x0, x1: x1, top: top, cap: base - top, mid: top + (base - top) / 2, base: base, cols: cols, cx0: x0 - pad, step: 1 / SC };
  }
  // flat runs of letter tops (within tol of the word's cap line)
  function runs(p, tol) {
    var out = [], cur = null, lim = p.top + (tol == null ? 1.2 : tol);
    for (var i = 0; i < p.cols.length; i++) {
      var x = p.cx0 + i * p.step, ty = p.cols[i];
      if (ty <= lim) { if (!cur) { cur = { x0: x, x1: x, y: ty }; out.push(cur); } cur.x1 = x; cur.y = Math.min(cur.y, ty); }
      else cur = null;
    }
    for (var j = 0; j < out.length; j++) { out[j].w = out[j].x1 - out[j].x0 + p.step; out[j].c = (out[j].x0 + out[j].x1) / 2; }
    return out;
  }
  // pick a standing spot near one end of a word. side: -1 = left end, +1 = right end. minX: keep right of this x.
  function pickSpot(p, side, minX) {
    var rr = runs(p, 1.2).filter(function (r) { return r.w >= 3 && (minX == null || r.x0 > minX); });
    if (!rr.length) rr = runs(p, 2.5);
    if (!rr.length) return { x: side < 0 ? p.x0 + 10 : p.x1 - 10, y: p.top, perch: false };
    rr.sort(function (a, b) { return side < 0 ? a.c - b.c : b.c - a.c; });
    var best = null;
    for (var i = 0; i < Math.min(rr.length, 3); i++) if (rr[i].w >= 11.5) { best = rr[i]; break; }
    var perch = !best; if (!best) best = rr[0];
    var dir = -side;                                     // face into the word
    var x = best.c - dir * (perch ? 0.7 : 0.95);
    return { x: x, y: best.y, perch: perch, dir: dir };
  }
  function onWord(p, side, minX, ico) {
    var s = pickSpot(p, side, minX), w = p.x1 - p.x0;
    if (ico && minX == null && s.x + 16 > ico.left - 2 && s.x - 16 < ico.right + 2 && ico.bottom > p.top - 46) { side = -side; s = pickSpot(p, side); }
    var tx = clamp(s.x + s.dir * Math.min(36, w * 0.32), p.x0 + 6, p.x1 - 6);
    s.squat = 1; s.aim = V(tx, p.top + p.cap * 0.55); s.ping = V(tx, p.top + p.cap * 0.45);
    return s;
  }
  function textNodesOf(el) { var out = []; for (var i = 0; i < el.childNodes.length; i++) { var n = el.childNodes[i]; if (n.nodeType === 3 && n.textContent.trim()) out.push(n); } return out; }
  function measure(root) {
    var rb = root.getBoundingClientRect(), ox = rb.left, oy = rb.top;
    function R(e) { var r = e.getBoundingClientRect(); return { left: r.left - ox, top: r.top - oy, right: r.right - ox, bottom: r.bottom - oy, width: r.width, height: r.height }; }
    var keys = ['daily', '4x4', 'performance', 'supercar'], cards = [], icons = [], tags = [], words = [];
    for (var i = 0; i < 4; i++) {
      var a = root.querySelector('.pick-' + keys[i]); if (!a) return null;
      var r = R(a); if (r.width < 120 || r.height < 40) return null;
      var cs = getComputedStyle(a);
      r.bl = parseFloat(cs.borderLeftWidth) || 0; r.br = parseFloat(cs.borderRightWidth) || 0;
      cards.push(r);
      var ico = a.querySelector('.ico') || a.querySelector('svg'); icons.push(ico ? R(ico) : { left: r.left + r.width / 2 - 16, right: r.left + r.width / 2 + 16, top: r.top, bottom: r.top });
      var tg = a.querySelector('.tag'); tags.push(tg ? tg : null);
      var wd = a.querySelector('.wide'); if (!wd) return null;
      var tn = textNodesOf(wd), pr = [];
      for (var k = 0; k < tn.length; k++) { var pf = inkProfile(tn[k], ox, oy); if (pf) pr.push(pf); }
      if (!pr.length) return null;
      words.push(pr);
    }
    var va = root.querySelector('.view-all');
    var L = { width: rb.width, height: rb.height, cards: cards, icons: icons, words: words,
      viewAll: va ? R(va) : { left: cards[3].left, right: cards[3].right, top: cards[3].bottom + 4 } };
    L.wallL = cards[0].left + cards[0].bl / 2; L.wallR = cards[0].right - cards[0].br / 2;
    var cl = document.querySelector('.page-close'), clr = cl ? cl.getBoundingClientRect() : null;
    L.avoidLeft = clr && clr.width > 0 && clr.bottom - oy > -20 && clr.top - oy < cards[0].top + 10 ? clr.left - ox : L.width;
    L.tagBottom = tags.map(function (t, j) { return t ? R(t).bottom : words[j][words[j].length - 1].base + 6; });
    // DAILY: stand on the left end of the tagline beside the word and point across at it (fallback: on the word)
    var dW = words[0][0], dTag = tags[0] && textNodesOf(tags[0])[0] ? inkProfile(textNodesOf(tags[0])[0], ox, oy) : null, sD = null;
    if (dTag) {
      var s0 = pickSpot(dTag, -1);
      if (s0.x + 14 < dW.x0 - 4) {
        sD = s0; sD.dir = 1; sD.squat = 0;
        sD.aim = V(dW.x0 + 4, dW.top + dW.cap * 0.5); sD.ping = V(dW.x0 - 1.5, dW.top + dW.cap * 0.5);
      }
    }
    if (!sD) sD = onWord(dW, -1, null, icons[0]);
    var oW = words[1][words[1].length - 1], l1 = words[1][0];
    var sO = onWord(oW, 1, words[1].length > 1 ? l1.x1 + 7 : null);
    var pW = words[2][0], sP = onWord(pW, 1, null, icons[2]), sW = words[3][0], sS = onWord(sW, -1, null, icons[3]);
    L.spots = { daily: sD, offroad: sO, performance: sP, supercar: sS };
    L.perfRun = { y: pW.top, x0: pW.x0, x1: pW.x1 };
    L.ledges = { daily: dW.top, '4x4': l1.top, offroad: oW.top, performance: pW.top, supercar: sW.top, dailyTag: dTag ? dTag.top : null };
    return L;
  }

  // ---------- mount / lifecycle ----------
  var mountN = 0;
  function mount(root, opts) {
    opts = opts || {};
    var noop = { destroy: function () {}, render: function () {}, LOOP: LOOP };
    if (!root) return noop;
    var maxW = opts.maxWidth || MAX_W;
    var mqRed = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : null;
    if (!opts.force) {
      if (global.innerWidth > maxW) return noop;
      if (mqRed && mqRed.matches) return noop;
    }
    if (getComputedStyle(root).position === 'static') root.style.position = 'relative';
    var svg = el('svg', { 'aria-hidden': 'true', 'class': 'buyin-parkour', focusable: 'false' });
    svg.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:12;visibility:hidden';
    root.appendChild(svg);
    var rig = new Rig(svg, 'bpk' + (mountN++)), plan = null, L = null;
    var dead = false, raf = 0, manual = !!opts.manual, elapsed = 0, lastNow = 0;
    var seenKey = '', stableSince = 0, builtKey = '', fontsOk = !document.fonts || document.fonts.status === 'loaded';
    if (!fontsOk) { document.fonts.ready.then(function () { fontsOk = true; builtKey = ''; }); setTimeout(function () { fontsOk = true; }, 3000); }
    function keyNow() {
      var s = '', rr = root.getBoundingClientRect();
      s += Math.round(rr.width * 4) + ',' + Math.round(rr.height * 4);
      var q = root.querySelectorAll('.pick-daily,.pick-4x4,.pick-performance,.pick-supercar,.view-all,.wide');
      for (var i = 0; i < q.length; i++) { var r = q[i].getBoundingClientRect(); s += '|' + Math.round((r.left - rr.left) * 4) + ',' + Math.round((r.top - rr.top) * 4) + ',' + Math.round(r.width * 4); }
      return s;
    }
    function rebuild(k) {
      var m = measure(root);
      if (!m) { plan = null; svg.style.visibility = 'hidden'; return false; }
      L = m; plan = build(L); builtKey = k;
      svg.setAttribute('viewBox', '0 0 ' + L.width.toFixed(2) + ' ' + L.height.toFixed(2));
      svg.style.visibility = 'visible';
      return true;
    }
    // re-measure only once the layout has been still for SETTLE_MS (lane cards animate in)
    function checkLayout(now, immediate) {
      var k = keyNow();
      if (k !== seenKey) { seenKey = k; stableSince = now; if (!immediate) return !!plan && builtKey === k; }
      if (builtKey !== k && fontsOk && (immediate || now - stableSince >= SETTLE_MS)) {
        var first = !plan;
        if (rebuild(k) && first) elapsed = 0;            // start the routine fresh from the drop-in
      }
      return !!plan;
    }
    function poseAt(t) {
      var Mv = plan.moves, i;
      for (i = 0; i < Mv.length - 1; i++) if (t < Mv[i].t1) break;
      var mv = Mv[i], p = mv.f(t);
      if (i > 0 && mv.blend > 0 && t < mv.t0 + mv.blend) p = mixPose(Mv[i - 1].f(mv.t0), p, smooth((t - mv.t0) / mv.blend));
      return p;
    }
    function render(t) {
      if (!plan) return null;
      var tt = ((t % LOOP) + LOOP) % LOOP, pz = poseAt(tt);
      // flip swoosh: crescent trailing the head around the torso centre, sized by angular velocity
      var pq = poseAt(Math.max(0, tt - 0.025)), om = pq.dir === pz.dir ? wrapA(pz.dir * pz.phi - pq.dir * pq.phi) / 0.025 : 0;
      var fr = frame(pz), cen = add(pz.hip, mul(fr.u, 6.0 * S)), sk = rig.skeleton(pz);
      var a0 = Math.atan2(sk.hc.y - cen.y, sk.hc.x - cen.x), span = clamp(Math.abs(om) * 0.17, 0, 2.7), sg = om >= 0 ? -1 : 1;
      var arc = [], arc2 = [], R1 = 17.5, R2 = 13.0, i;
      for (i = 0; i <= 16; i++) { var aa = a0 + sg * span * i / 16; arc.push(V(cen.x + Math.cos(aa) * R1, cen.y + Math.sin(aa) * R1)); }
      for (i = 0; i <= 12; i++) { var ab = a0 + PI + sg * span * 0.8 * i / 12; arc2.push(V(cen.x + Math.cos(ab) * R2, cen.y + Math.sin(ab) * R2)); }
      var o = clamp((Math.abs(om) - 8.5) / 6, 0, 1);
      rig.draw(pz, tt, sparksAt(plan.fx, tt), { arc: arc, arc2: arc2, o: o });
      return pz;
    }
    function stopRaf() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
    function startRaf() { if (dead || raf || document.hidden || manual) return; lastNow = performance.now(); raf = requestAnimationFrame(tick); }
    function guardsFail() {
      if (!root.isConnected) return true;
      if (opts.force) return false;
      if (!document.body.classList.contains('is-lanes')) return true;
      if (global.innerWidth > maxW) return true;
      if (mqRed && mqRed.matches) return true;
      return false;
    }
    function destroy() {
      if (dead) return;
      dead = true; stopRaf();
      document.removeEventListener('visibilitychange', onVis);
      global.removeEventListener('resize', onResize);
      global.removeEventListener('orientationchange', onResize);
      if (svg.parentNode) svg.parentNode.removeChild(svg);
      if (global.__setParkourTime === setTime) { try { delete global.__setParkourTime; } catch (e) { global.__setParkourTime = undefined; } }
    }
    function onVis() { if (dead) return; if (document.hidden) stopRaf(); else startRaf(); }
    function onResize() { if (dead) return; if (guardsFail()) { destroy(); return; } seenKey = ''; }
    function tick(now) {
      raf = 0;
      if (dead) return;
      if (guardsFail()) { destroy(); return; }
      var dt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000)); lastNow = now;
      if (checkLayout(now, false)) { elapsed = (elapsed + dt) % LOOP; render(elapsed); }
      raf = requestAnimationFrame(tick);
    }
    function setTime(t) { if (dead) return null; manual = true; stopRaf(); checkLayout(performance.now(), true); return render(t); }
    if (manual) global.__setParkourTime = setTime;
    document.addEventListener('visibilitychange', onVis);
    global.addEventListener('resize', onResize);
    global.addEventListener('orientationchange', onResize);
    if (manual) checkLayout(performance.now(), true); else startRaf();
    var api = { svg: svg, LOOP: LOOP, render: render, destroy: destroy, layout: function () { return L; } };
    if (manual) {
      api.probe = function (t) { if (!plan) return null; var p = poseAt(t), sk = rig.skeleton(p); return { hip: p.hip, phi: p.phi, dir: p.dir, F: p.F, W: p.W, hc: sk.hc, a0: sk.a0, k0: sk.k0, k1: sk.k1 }; };
      api.audit = function (fps) {
        ikCount = true; ikClamps = 0; var bad = [], prev = null, jumps = [], nan = 0;
        for (var f = 0; f <= LOOP * fps; f++) {
          var t = f / fps, p = poseAt(t), c0 = ikClamps, sk = rig.skeleton(p);
          if (ikClamps > c0) bad.push(+t.toFixed(3));
          var pts = [p.hip, sk.hc, p.F[0].toe, p.F[1].toe, sk.a0.e, sk.a1.e, sk.k0.j, sk.k1.j, sk.a0.j, sk.a1.j];
          for (var q = 0; q < pts.length; q++) if (!isFinite(pts[q].x) || !isFinite(pts[q].y)) nan++;
          if (prev) { var mx = 0; for (q = 0; q < pts.length; q++) mx = Math.max(mx, len(sub(pts[q], prev[q]))); if (mx > 6) jumps.push([+t.toFixed(3), +mx.toFixed(1)]); }
          prev = pts;
        }
        ikCount = false; return { ikClamp: bad, jumps: jumps, nan: nan };
      };
    }
    return api;
  }

  global.BuyinParkour = { mount: mount, LOOP: LOOP };
})(window);

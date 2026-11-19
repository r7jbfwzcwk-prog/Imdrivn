/*!
 * IMDRIVN — Sell Chase (mobile-only easter egg on the #/sell "How do you want to sell?" chooser)
 * Two stickmen chase each other over the real page: the MJ fedora Runner and the spiky-haired Chaser.
 * Text parkour on LIST FREE / LIST YOUR CAR FREE, a diving near-miss, a Tarzan rope rappel down past
 * WHOLESALE onto GET A VALUATION and GO TO MY GARAGE, a hand-over-hand wall climb up the WHOLESALE card,
 * a swipe at the Runner's trailing shoe, then a grapple rope thrown back up to WANT TO SELL? that both
 * scramble up. They never catch each other. Plays ONCE per visit to #/sell (~16.6s): the fedora Runner
 * lounges on top of the M across the D of the header IM DRIVN logo, and the spiky Chaser leans with a
 * straight arm on the N. A tiny idle fades out after ~6s, then rAF stops (still final pose, no restart).
 *
 * Usage:  SellChase.mount();                      (auto-mounts on #/sell when loaded; replays on re-entering the route)
 * Options: { force: true }  -> ignore width / reduced-motion / route guards (testing only)
 *          { manual: true } -> no rAF clock; drive frames with window.__sellChaseRenderAt(t)
 * Layout is measured live from the DOM (card borders, button borders, and the cap tops of the
 * rendered heading / title glyphs) and re-measured on resize, orientation change and font load.
 * The overlay is a pointer-events:none absolutely positioned SVG; it never changes page layout.
 */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var GOLD = '#d9a441', GOLD_HI = '#ffe2a0', BODY = '#f4f4f6', BODY_FAR = '#cfcfd6', ROPE = '#e5b95c', ROPE_DK = '#8a6423';
  var CYCLE = 16.0, RUN_T = 16.6, IDLE_T = 8.0, MAX_W = 768, SETTLE_MS = 300;   // one-shot: ~16.6s chase, then rest (idle fades out, rAF stops)
  var PI = Math.PI, TAU = 2 * PI;
  // body dims in px at 430px width (scaled by S)
  var TH = 8.6, SH = 8.6, TO = 11.5, NK = 2.0, HR = 3.9, UA = 7.3, FA = 6.9;
  var HS = 16.2, HRUN = 15.0, HC = 11.0, HD = 8.0, SOLE = 1.2, LW = 2.4;
  var GAIT = 3.25;                       // strides/s  (3.25 * 16 = 52 -> seamless)
  var REACH = 24.5;                      // hip -> hands when hanging (arms overhead)

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
  function wrapA(a) { while (a > PI) a -= TAU; while (a < -PI) a += TAU; return a; }
  function qbez(a, c, b, k) { var i = 1 - k; return V(i * i * a.x + 2 * i * k * c.x + k * k * b.x, i * i * a.y + 2 * i * k * c.y + k * k * b.y); }
  function easeOut(k) { k = clamp(k, 0, 1); return 1 - (1 - k) * (1 - k); }
  function easeIn(k) { k = clamp(k, 0, 1); return k * k; }

  function ik(P, Q, l1, l2, bend) {
    var d0 = sub(Q, P), d = len(d0) || 1e-6, dc = clamp(d, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3), e = mul(d0, 1 / d);
    var a = (l1 * l1 - l2 * l2 + dc * dc) / (2 * dc), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    var perp = V(-e.y, e.x); if (dot(perp, bend) < 0) perp = mul(perp, -1);
    return { j: add(add(P, mul(e, a)), mul(perp, h)), e: add(P, mul(e, dc)) };
  }

  // ---------- DOM measurement ----------
  var cvs = null;
  function capInfo(el, text) {
    // baseline + cap height of the element's rendered font (italic Michroma), measured with canvas metrics
    var cs = getComputedStyle(el);
    cvs = cvs || document.createElement('canvas');
    var cx = cvs.getContext('2d');
    cx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    var m = cx.measureText('H'), mt = cx.measureText(text || 'H');
    var fs = parseFloat(cs.fontSize) || 16;
    return { asc: m.fontBoundingBoxAscent || fs * 0.92, desc: m.fontBoundingBoxDescent || fs * 0.25, cap: m.actualBoundingBoxAscent || fs * 0.72 };
  }
  function textBox(el, ox, oy) {
    // union of the text node client rects + glyph cap top
    var rg = document.createRange(); rg.selectNodeContents(el);
    var rs = [].slice.call(rg.getClientRects()).filter(function (r) { return r.width > 1; });
    if (!rs.length) { var b = el.getBoundingClientRect(); rs = [b]; }
    var l = 1e9, r = -1e9, t = 1e9, bt = -1e9;
    rs.forEach(function (q) { l = Math.min(l, q.left); r = Math.max(r, q.right); t = Math.min(t, q.top); bt = Math.max(bt, q.bottom); });
    var ci = capInfo(el);
    var contentH = ci.asc + ci.desc, top = t + Math.max(0, (bt - t - contentH) / 2);
    var base = top + ci.asc;
    return { l: l - ox, r: r - ox, top: base - ci.cap - oy, base: base - oy };
  }
  function rect(el, ox, oy) { var r = el.getBoundingClientRect(); return { l: r.left - ox, t: r.top - oy, r: r.right - ox, b: r.bottom - oy, w: r.width, h: r.height }; }
  // per-column ink top + per-row right edge of the logo image (same-origin SVG), in root px
  function inkProfile(img, lg) {
    try {
      if (!img.complete || !img.naturalWidth) return null;
      var k = 2, w = Math.max(2, Math.round(lg.w * k)), h = Math.max(2, Math.round(lg.h * k));
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
      var d = x.getImageData(0, 0, w, h).data, tops = [], rights = [];
      for (var i = 0; i < w; i++) { var tp = -1; for (var j = 0; j < h; j++) if (d[(j * w + i) * 4 + 3] > 110) { tp = j; break; } tops.push(tp < 0 ? null : lg.t + tp / k); }
      for (j = 0; j < h; j++) { var rt = -1; for (i = w - 1; i >= 0; i--) if (d[(j * w + i) * 4 + 3] > 110) { rt = i; break; } rights.push(rt < 0 ? null : lg.l + rt / k); }
      return { k: k, tops: tops, rights: rights, l: lg.l, t: lg.t };
    } catch (e) { return null; }
  }
  function measure(root) {
    var rr = root.getBoundingClientRect(), ox = rr.left, oy = rr.top;
    var paths = root.querySelectorAll('a.path');
    var h1 = root.querySelector('h1'), grey = h1 && (h1.querySelector('.grey') || h1);
    var garage = document.querySelector('.sell-garage-mob') || root.querySelector('.view-all');
    var exitB = document.querySelector('.page-close, .menu-close');
    if (!h1 || paths.length < 2 || !garage) return null;
    var A = {}, c1 = rect(paths[0], ox, oy), c2 = rect(paths[1], ox, oy);
    var w1 = paths[0].querySelector('.wide'), w2 = paths[1].querySelector('.wide');
    var b1 = rect(paths[0].querySelector('.btn'), ox, oy), b2 = rect(paths[1].querySelector('.btn'), ox, oy), g = rect(garage, ox, oy);
    if (!w1 || !w2 || g.w < 10 || b1.w < 10 || b2.w < 10) return null;
    var H = textBox(grey, ox, oy), LF = textBox(w1, ox, oy), WS = textBox(w2, ox, oy);
    var ex = exitB ? rect(exitB, ox, oy) : null;
    A.W = rr.width; A.H = rr.height;
    A.exitL = ex && ex.w > 0 ? ex.l : rr.width - 58;
    A.hT = H.top; A.hL = H.l; A.hR = Math.min(H.r, A.exitL - 40);
    A.c1T = c1.t + 0.5; A.c1L = c1.l + 0.5; A.c1R = c1.r - 0.5; A.c1B = c1.b - 0.5;
    A.lfT = LF.top; A.lfL = LF.l; A.lfR = LF.r;
    A.b1T = b1.t + 0.5; A.b1L = b1.l; A.b1R = b1.r; A.b1B = b1.b - 0.5;
    A.c2T = c2.t + 0.5; A.c2L = c2.l + 0.5; A.c2R = c2.r - 0.5; A.c2B = c2.b - 0.5;
    A.wsT = WS.top; A.wsL = WS.l; A.wsR = WS.r;
    A.b2T = b2.t + 0.5; A.b2L = b2.l; A.b2R = b2.r; A.b2B = b2.b - 0.5;
    A.gT = g.t + 0.5; A.gL = g.l; A.gR = g.r;
    A.ox = ox; A.oy = oy;
    // top header IM DRIVN wordmark (finale perch) — live rect + ink profile of the logo image
    var hdr = document.querySelector('header.top') || document.querySelector('header');
    var logoImg = hdr && hdr.querySelector('.logo-mark img, .logo img');
    var logoEl = logoImg || (hdr && hdr.querySelector('.logo-mark, .logo'));
    var hd = hdr ? rect(hdr, ox, oy) : { l: 0, t: -oy, r: rr.width, b: 0, w: rr.width, h: oy };
    var lg = logoEl ? rect(logoEl, ox, oy) : { l: 10, t: hd.t + 21, r: 203, b: hd.t + 43, w: 193, h: 22 };
    A.hdrB = hd.b; A.lgL = lg.l; A.lgT = lg.t; A.lgR = lg.r; A.lgB = lg.b; A.lgW = lg.w; A.lgH = lg.h;
    var ic = hdr && hdr.querySelector('.bar-end, .ic, .bellwrap');
    A.iconsL = ic ? rect(ic, ox, oy).l : rr.width - 150;
    A.ink = logoImg ? inkProfile(logoImg, lg) : null;
    return A;
  }

  // ---------- choreography ----------
  function build(A, S) {
    function frame(hip, rot, dir) {
      var c = Math.cos(rot), s = Math.sin(rot);
      return { fwd: V(dir * c, dir * s), dn: V(-s, c), up: V(s, -c) };
    }
    function upLean(fr, lean) { return add(mul(fr.up, Math.cos(lean)), mul(fr.fwd, Math.sin(lean))); }
    function shoulderOf(hip, fr, lean) { return add(hip, mul(upLean(fr, lean), TO * S)); }
    function Lw(o, fr, x, y) { return add(o, add(mul(fr.fwd, x * S), mul(fr.dn, y * S))); }
    // P(hip, rot, dir, lean, feetLocal|world, handsLocal(rel shoulder)|world, extra)
    function P(hip, rot, dir, lean, f, h, x) {
      var fr = frame(hip, rot, dir), sh = shoulderOf(hip, fr, lean);
      function cf(v) { return v.length ? Lw(hip, fr, v[0], v[1]) : v; }
      function ch(v) { return v.length ? Lw(sh, fr, v[0], v[1]) : v; }
      var o = { hip: hip, rot: rot, dir: dir, lean: lean, f: [cf(f[0]), cf(f[1])], h: [ch(h[0]), ch(h[1])], g: [false, false], hd: 0 };
      if (x) for (var k in x) o[k] = x[k];
      return o;
    }
    function lerpPose(a, b, k) {
      if (k <= 0) return a; if (k >= 1) return b;
      return { hip: lv(a.hip, b.hip, k), rot: a.rot + wrapA(b.rot - a.rot) * k, dir: k < 0.5 ? a.dir : b.dir, lean: lerp(a.lean, b.lean, k),
        f: [lv(a.f[0], b.f[0], k), lv(a.f[1], b.f[1], k)], h: [lv(a.h[0], b.h[0], k), lv(a.h[1], b.h[1], k)],
        g: k < 0.5 ? a.g : b.g, hd: lerp(a.hd || 0, b.hd || 0, k), grip: b.grip, lw: lerp(a.lw || 1, b.lw || 1, k), ab: k < 0.5 ? a.ab : b.ab };
    }
    var GY = function (y) { return y - SOLE; };   // ankle line for a surface

    // ----- local pose library: {f: feet rel hip, h: hands rel shoulder, lean, hh: hip height} -----
    function L_crouch(k) { var hh = lerp(HS, HD, k); return { f: [[2.6, hh], [-2.2, hh]], h: [[4 + 2 * k, 5 - 2 * k], [2.5 + 2 * k, 6 - 2 * k]], lean: 0.12 + 0.42 * k, hh: hh }; }
    var L_takeoff = { f: [[-1.0, 15.9], [1.2, 15.6]], h: [[2.0, -11.2], [0.5, -11.6]], lean: 0.12 };
    var L_tuck = { f: [[3.4, 7.2], [2.2, 7.8]], h: [[4.6, 6.4], [3.8, 7.2]], lean: 0.55 };
    var L_tuckS = { f: [[1.6, 7.2], [1.0, 7.6]], h: [[2.6, 6.6], [1.8, 7.0]], lean: 0.5 };
    var L_leap = { f: [[7.6, 11.6], [-7.4, 11.2]], h: [[6.4, -5.5], [-5.0, 3.6]], lean: 0.22 };
    var L_drop = { f: [[3.0, 13.6], [-2.0, 14.6]], h: [[5.5, -7.5], [-4.0, -6.0]], lean: 0.05 };
    var L_landprep = { f: [[3.0, 14.8], [-1.6, 15.3]], h: [[5.4, -1.0], [-4.6, 1.0]], lean: 0.16 };
    var L_reach = { f: [[1.2, 15.6], [-1.4, 15.2]], h: [[1.6, -11.6], [-0.8, -11.6]], lean: 0.02 };
    var L_dive = { f: [[-1.6, 16.3], [0.8, 16.0]], h: [[0.6, -12.6], [2.4, 3.4]], lean: 0.0 };
    var L_superman = { f: [[-2.6, 15.8], [1.6, 15.2]], h: [[1.2, -12.6], [-0.8, -12.4]], lean: 0.0 };
    function mixL(a, b, k) {
      k = clamp(k, 0, 1);
      function m2(p, q) { return [lerp(p[0], q[0], k), lerp(p[1], q[1], k)]; }
      return { f: [m2(a.f[0], b.f[0]), m2(a.f[1], b.f[1])], h: [m2(a.h[0], b.h[0]), m2(a.h[1], b.h[1])], lean: lerp(a.lean, b.lean, k) };
    }
    function keysL(u, keys) { // keys: [[u, L], ...]
      if (u <= keys[0][0]) return keys[0][1];
      for (var i = 1; i < keys.length; i++) if (u <= keys[i][0]) return mixL(keys[i - 1][1], keys[i][1], smooth((u - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0])));
      return keys[keys.length - 1][1];
    }
    function fromL(hip, rot, dir, l, x) { return P(hip, rot, dir, l.lean, l.f, l.h, x); }

    // ----- segment kinds (each returns function(u, t) -> pose) -----
    function RUN(x0, x1, y, dir, ease, lean, phOff) {
      return function (u, t) {
        var e = ease === 'in' ? easeIn(u) * 0.55 + u * 0.45 : ease === 'out' ? easeOut(u) * 0.55 + u * 0.45 : u;
        var x = lerp(x0, x1, e), ph = TAU * GAIT * t + (phOff || 0);
        var hh = HRUN - 0.9 * Math.cos(2 * ph);
        var spd = Math.abs(x1 - x0) / Math.max(0.05, this.dur);
        var amp = clamp(spd / (4 * GAIT) / S, 3, 8.4);
        var feet = [], g = [];
        for (var k = 0; k < 2; k++) {
          var s = ((ph + k * PI) % TAU + TAU) % TAU, fx, fy, gg;
          if (s < PI) { fx = amp * (1 - 2 * s / PI); fy = hh; gg = true; }
          else { var v = (s - PI) / PI; fx = -amp + 2 * amp * smooth(v); fy = hh - 6.5 * Math.sin(PI * v); gg = false; }
          feet.push([fx + 0.8, fy]); g.push(gg);
        }
        var a0 = feet[1][0] / amp, a1 = feet[0][0] / amp;
        var hip = V(x, GY(y) - hh * S);
        var o = P(hip, 0, dir, lean, feet, [[1.5 + 4.6 * a0, 6.4 - 2.2 * Math.max(0, a0)], [1.5 + 4.6 * a1, 6.4 - 2.2 * Math.max(0, a1)]]);
        o.g = g; o.hd = 0.05 * Math.sin(2 * ph);
        for (k = 0; k < 2; k++) if (o.g[k]) o.f[k].y = GY(y);
        return o;
      };
    }
    function CROUCH(x0, x1, y, dir0, dir1, depth, flipAt) {   // land / absorb / pivot; feet planted
      return function (u) {
        var k = depth * Math.sin(PI * clamp(u * 1.15, 0, 1)) + (u < 0.1 ? depth * (1 - u / 0.1) * 0 : 0);
        var dir = u < (flipAt == null ? 0.5 : flipAt) ? dir0 : dir1;
        var x = lerp(x0, x1, smooth(u)), l = L_crouch(k);
        var o = fromL(V(x, GY(y) - l.hh * S), 0, dir, l);
        o.f = [V(x + 2.6 * S * dir, GY(y)), V(x - 2.2 * S * dir, GY(y))]; o.g = [true, true];
        return o;
      };
    }
    // generic airborne move between hip points. keys = limb keyframes.  rot0->rot1 over [ra, rb]
    function AIR(h0, h1, arc, rot0, rot1, dir0, dir1, keys, opt) {
      opt = opt || {};
      return function (u) {
        var hip = add(lv(h0, h1, u), V(0, -4 * arc * u * (1 - u)));
        if (opt.ctrl) hip = qbez(h0, opt.ctrl, h1, u);
        var ru = smoother(seg(u, opt.ra == null ? 0.08 : opt.ra, opt.rb == null ? 0.88 : opt.rb));
        var rot = lerp(rot0, rot1, ru);
        var dir = u < (opt.flip == null ? 0.5 : opt.flip) ? dir0 : dir1;
        var o = fromL(hip, rot, dir, keysL(u, keys));
        if (opt.g0 != null && u < 0.25) for (var k = 0; k < 2; k++) o.f[k].y = Math.min(o.f[k].y, GY(opt.g0));
        if (opt.g1 != null && u > 0.7) for (k = 0; k < 2; k++) o.f[k].y = Math.min(o.f[k].y, GY(opt.g1));
        if (opt.g0 != null && u === 0) { o.g = [true, true]; }
        return o;
      };
    }
    function JUMP(x0, y0, x1, y1, arc, style, dir0, dir1, rot1, opt) {
      opt = opt || {};
      var h0 = V(x0, GY(y0) - HC * S), h1 = V(x1, GY(y1) - HC * S);
      var c0 = L_crouch(0.55), c1 = L_crouch(0.55);
      var air = style === 'flip' ? L_tuck : style === 'leap' ? L_leap : style === 'tuckS' ? L_tuckS : L_drop;
      var keys = [[0, c0], [0.13, L_takeoff], [0.32, air], [0.72, air], [0.88, L_landprep], [1, c1]];
      if (style === 'drop') keys = [[0, c0], [0.15, L_takeoff], [0.35, L_drop], [0.8, L_landprep], [1, c1]];
      opt.g0 = y0; opt.g1 = y1;
      return AIR(h0, h1, arc, 0, rot1 || 0, dir0, dir1 == null ? dir0 : dir1, keys, opt);
    }
    function SWING(Ax, Ay, th0, thEnd, w1, r0, rMid, rEnd, dir) {
      return function (u) {
        var w = u * w1, th = th0 * Math.cos(PI * w);
        var r = w <= 0.5 ? lerp(r0, rMid, smoother(w / 0.5)) : lerp(rMid, rEnd, smooth((w - 0.5) / (w1 - 0.5)));
        var d = V(Math.sin(th), Math.cos(th)), hip = add(V(Ax, Ay), mul(d, r));
        var fw = V(dir * Math.cos(-th), dir * Math.sin(-th));            // hands in front of the face, clear of the hat
        var hand = add(add(V(Ax, Ay), mul(d, r - 16.5 * S)), mul(fw, 8.5 * S)), hand2 = add(hand, mul(d, 3.2 * S));
        var kick = smooth(seg(u, 0.55, 1));
        var o = P(hip, -th, dir, 0, [[1.5 + 4.5 * kick, 15.4 - 1.5 * kick], [-1.2 + 3 * kick, 15.8 - 0.8 * kick]], [hand, hand2]);
        o.grip = hand; return o;
      };
    }
    // climb along a line (wall or rope). line(t)->{o,d}; side: +1 body right of line, -1 left. off: hip offset px.
    function CLIMB(line, side, off, handOff, D0, D1, step, opt) {
      opt = opt || {};
      return function (u, t) {
        var ln = line(t), d = ln.d, nR = V(d.y, -d.x), n = side > 0 ? nR : mul(nR, -1);
        var nH = Math.max(1, Math.round((D0 - D1) / step)), dl = (D0 - D1) / nH;
        var s = u * nH, i = Math.min(nH - 1, Math.floor(s)), fr = s - i;
        var dh = D0 - (i + 0.45 * fr + 0.55 * smooth(fr)) * dl;
        var reachT = 21 * S, E = function (j) { return D0 - (j + 1) * dl - reachT; };
        var hd = [0, 0], hx = [0, 0];
        var km = i % 2;
        hd[km] = lerp(E(i - 2), E(i), smooth(fr)); hx[km] = 2.6 * Math.sin(PI * fr);
        hd[1 - km] = E(i - 1); hx[1 - km] = 0;
        var F = function (j) { return D0 - (j + 2) * dl + (opt.foot || 16) * S; };
        var fd = [0, 0], fx = [0, 0], kf = (i + 1) % 2;
        var fs = smooth(clamp((fr - 0.15) / 0.85, 0, 1));
        fd[kf] = lerp(F(i - 2), F(i), fs); fx[kf] = 2.2 * Math.sin(PI * fs);
        fd[1 - kf] = F(i - 1);
        var hip = add(add(ln.o, mul(d, dh)), mul(n, off * S));
        var rot = Math.atan2(-d.x, d.y), dir = side > 0 ? -1 : 1;
        var hands = [0, 1].map(function (k) { return add(add(ln.o, mul(d, hd[k])), mul(n, (handOff + hx[k]) * S)); });
        var feet = [0, 1].map(function (k) { return add(add(ln.o, mul(d, fd[k])), mul(n, ((opt.footOff == null ? handOff + 0.8 : opt.footOff) + fx[k]) * S)); });
        var o = P(hip, rot, dir, -0.08, feet, hands);
        o.grip = d; o.gripD = Math.max(hd[0], hd[1]); o.topD = Math.min(hd[0], hd[1]);
        return o;
      };
    }
    function STATIC2(pa, pb, ease) { return function (u) { return lerpPose(pa(u), pb(u), ease ? ease(u) : smooth(u)); }; }
    function prone(x, y, dir, slide) { // lying on belly sliding along surface y
      var hip = V(x, GY(y) - 3.4 * S);
      var o = fromL(hip, dir * PI / 2, dir, L_dive);
      return o;
    }
    function crouchAt(x, y, dir, k) { var l = L_crouch(k); var o = fromL(V(x, GY(y) - l.hh * S), 0, dir, l); o.f = [V(x + 2.6 * S * dir, GY(y)), V(x - 2.2 * S * dir, GY(y))]; o.g = [true, true]; return o; }

    // ------------- geometry -------------
    var RX = clamp(A.hR - 14 * S, A.hL + 70, A.exitL - 60);         // rope #2 anchor x on WANT TO SELL?
    var hT = A.hT, c1T = A.c1T, lfT = A.lfT, b1T = A.b1T, wsT = A.wsT, b2T = A.b2T, gT = A.gT;
    var xH0 = RX - 40 * S, xH1 = A.hL + 30 * S;
    var xC1 = A.c1L + 24 * S;
    var xLF0 = A.lfL + 14 * S, xLFv = A.lfL + 0.45 * (A.lfR - A.lfL);
    var xB1 = A.b1L + 0.72 * (A.b1R - A.b1L), xB1e = A.b1R - 8 * S;
    var SA = V(A.b1R - 12 * S, A.b1B);                                  // rope #1 anchor (bottom edge of LIST YOUR CAR FREE)
    var TH0 = 58 * PI / 180;
    var xLand2 = A.b2R - 50 * S;
    var hipLand = V(xLand2, GY(b2T) - 15 * S);
    var rEnd = len(sub(hipLand, SA)), thEnd = Math.atan2(hipLand.x - SA.x, hipLand.y - SA.y);
    var rMid = Math.min(rEnd - 2, (b2T - SA.y) - 19.5 * S);
    var W1 = Math.acos(clamp(thEnd / TH0, -1, 1)) / PI, R0 = 46 * S;
    var swingStart = add(SA, mul(V(Math.sin(TH0), Math.cos(TH0)), R0));
    var xB2e = A.b2L + 8 * S, xG0 = A.b2L - 38 * S, xWall = A.c2L + 0.5, xGw = A.c2L + 34 * S;
    var wallLine = function () { return { o: V(xWall, 0), d: V(0, 1) }; };
    var yW0 = gT - 34 * S, yW1 = wsT + 30 * S;                        // hip y range on the wall
    var xWS0 = A.wsL + 14 * S, xWSv = A.wsL + 0.45 * (A.wsR - A.wsL), xWSv2 = xWSv + 50 * S, xT = A.wsR - 14 * S;
    var P2 = V(RX, hT + 0.6);
    // rope #2 pendulum
    var tLatch = 11.55, tSwing = 11.75;
    var handStand = V(xT - 3 * S, GY(wsT) - 28 * S);
    var PHI0 = Math.atan2(handStand.x - P2.x, handStand.y - P2.y);
    var L2 = len(sub(handStand, P2)) + 26 * S;
    function phiAt(t) {
      if (t < tSwing) return PHI0;
      var tau = t - tSwing; return PHI0 * Math.cos(2.2 * tau) * Math.exp(-0.75 * tau);
    }
    var rope2Line = function (t) { var p = phiAt(t); return { o: P2, d: V(Math.sin(p), Math.cos(p)) }; };
    var dR0 = len(sub(handStand, P2)) - 30 * S, dR1 = 18 * S;          // runner hand distance along rope
    var dC0 = dR0, dC1 = 30 * S;

    // ------------- RUNNER -------------
    var R = [], C = [];
    function add_(arr, t0, t1, f) { arr.push({ t0: t0, t1: t1, dur: t1 - t0, f: f }); }
    // offscreen entry: leap in from beyond the left edge of the screen onto the top of the LIST FREE card
    var offX = -34 * S, entryKeys = [[0, L_leap], [0.55, L_leap], [0.82, L_landprep], [1, L_crouch(0.55)]];
    add_(R, 0.25, 1.22, AIR(V(offX, GY(c1T) - 46 * S), V(xC1, GY(c1T) - HC * S), 26, 0, 0, 1, 1, entryKeys, { g1: c1T }));
    add_(R, 1.22, 1.32, CROUCH(xC1, xC1 + 2 * S, c1T, 1, 1, 0.6));
    add_(R, 1.32, 2.02, JUMP(xC1 + 2 * S, c1T, xLF0, lfT, 12, 'leap', 1));
    add_(R, 2.02, 2.15, CROUCH(xLF0, xLF0 + 3, lfT, 1, 1, 0.5));
    add_(R, 2.15, 2.65, RUN(xLF0 + 3, xLFv, lfT, 1, 'in', 0.22, 0));
    add_(R, 2.65, 3.05, JUMP(xLFv, lfT, xB1, b1T, 12, 'leap', 1));
    add_(R, 3.05, 3.13, CROUCH(xB1, xB1 + 5, b1T, 1, 1, 0.35));
    add_(R, 3.13, 3.35, RUN(xB1 + 5, xB1e, b1T, 1, '', 0.24, 0));
    add_(R, 3.35, 3.85, AIR(V(xB1e, GY(b1T) - HC * S), swingStart, 44, 0, TAU - TH0, 1, -1,
      [[0, L_crouch(0.5)], [0.12, L_takeoff], [0.3, L_tuckS], [0.62, L_tuckS], [0.9, L_reach], [1, L_reach]], { flip: 0.5, ra: 0.08, rb: 0.95, g0: b1T }));
    add_(R, 3.85, 5.00, SWING(SA.x, SA.y, TH0, thEnd, W1, R0, rMid, rEnd, -1));
    add_(R, 5.00, 5.18, CROUCH(xLand2, xLand2 - 6 * S, b2T, -1, -1, 0.6));
    add_(R, 5.18, 5.60, RUN(xLand2 - 6 * S, xB2e, b2T, -1, '', 0.22, 0));
    add_(R, 5.60, 6.10, JUMP(xB2e, b2T, xG0, gT, 8, 'drop', -1));
    add_(R, 6.10, 6.28, CROUCH(xG0, xG0 - 6 * S, gT, -1, -1, 0.75));
    add_(R, 6.28, 6.90, RUN(xG0 - 6 * S, xGw, gT, -1, '', 0.22, 0));
    var wallStartHip = V(xWall + 8.5 * S, yW0);
    add_(R, 6.90, 7.20, AIR(V(xGw, GY(gT) - HC * S), wallStartHip, 10, 0, 0, -1, -1, [[0, L_crouch(0.5)], [0.2, L_takeoff], [1, L_reach]], { g0: gT }));
    add_(R, 7.20, 8.85, CLIMB(wallLine, 1, 8.5, 0.6, yW0, yW1, 12 * S, { footOff: 1.4, foot: 16 }));
    add_(R, 8.85, 9.45, AIR(V(xWall + 8.5 * S, yW1), V(xWS0, GY(wsT) - HC * S), 30, 0, TAU, -1, 1,
      [[0, L_reach], [0.12, L_drop], [0.3, L_tuck], [0.7, L_tuck], [0.86, L_landprep], [1, L_crouch(0.55)]], { flip: 0.1, ra: 0.15, rb: 0.88, g1: wsT }));
    add_(R, 9.45, 9.60, CROUCH(xWS0, xWS0 + 4 * S, wsT, 1, 1, 0.5));
    add_(R, 9.60, 10.0, RUN(xWS0 + 4 * S, xWSv, wsT, 1, 'in', 0.24, 0));
    add_(R, 10.0, 10.38, JUMP(xWSv, wsT, xWSv2, wsT, 16, 'leap', 1));
    add_(R, 10.38, 10.62, RUN(xWSv2, xT, wsT, 1, 'out', 0.2, 0));
    // turn, wind up, throw the grapple straight up at WANT TO SELL?
    add_(R, 10.62, 11.05, function (u) {
      var o = crouchAt(xT, wsT, u < 0.4 ? 1 : -1, 0.35 * Math.sin(PI * u));
      o.h[0] = lv(o.h[0], add(o.hip, V(6 * S, -6 * S)), smooth(seg(u, 0.4, 1))); o.hd = -0.25 * smooth(seg(u, 0.3, 0.8)); return o;
    });
    add_(R, 11.05, 11.55, function (u) {
      var o = crouchAt(xT, wsT, -1, 0.3 * (1 - u));
      var fr = frame(o.hip, 0, -1), sh = shoulderOf(o.hip, fr, o.lean);
      var k = smooth(seg(u, 0.0, 0.38));                                          // arm whips from low-back to straight up
      var ang = lerp(PI * 0.15, PI * 0.98, k);                                       // angle from straight down, swinging back-up-over
      o.h[0] = add(sh, V(-Math.sin(ang) * 11.6 * S * -1 * 0.35, Math.cos(ang) * 11.6 * S));
      o.h[1] = add(sh, V(-2 * S, 6 * S)); o.hd = -0.35; o.throwU = u; return o;
    });
    add_(R, 11.55, 11.75, function (u) {   // tug: both hands on the rope at full stretch
      var o = crouchAt(xT, wsT, -1, 0.45 * Math.sin(PI * u));
      var ln = rope2Line(11.55), dd = len(sub(handStand, P2));
      var hpt = add(P2, mul(ln.d, dd - 8 * S * Math.sin(PI * u)));
      o.h = [hpt, add(hpt, mul(ln.d, 3.5 * S))]; o.hd = -0.3; return o;
    });
    add_(R, 11.75, 14.55, CLIMB(rope2Line, -1, 6.0, 0, dR0, dR1, 14 * S, { footOff: 0.8 }));
    var landH2 = V(xH0, GY(hT) - HC * S);
    add_(R, 14.55, 15.35, function (u) {
      return null;                                   // replaced below once the rope-top pose is known
    });
    // ----- finale geometry: IM DRIVN logo in the top header -----
    var ink = A.ink;
    function inkTop(x) {
      if (ink) { var i = Math.round((x - ink.l) * ink.k); for (var q = 0; q < 6; q++) { var a = ink.tops[i + q], b = ink.tops[i - q]; if (a != null) return a; if (b != null) return b; } }
      return A.lgT + 0.5;
    }
    function inkRight(y) {
      if (ink) { var j = clamp(Math.round((y - ink.t) * ink.k), 0, ink.rights.length - 1); if (ink.rights[j] != null) return ink.rights[j]; }
      return A.lgR - 0.2 * (y - A.lgT);
    }
    // sit in the notch of the M (deepest letter top in the first quarter of the wordmark) so the fedora clears the top of the screen
    var sitX = A.lgL + 0.155 * A.lgW, sitY = A.lgT + 0.66 * A.lgH;
    if (ink) {
      var best = -1e9;
      for (var sx = A.lgL + 0.1 * A.lgW; sx <= A.lgL + 0.26 * A.lgW; sx += 0.5) {
        var tt0 = ink.tops[Math.round((sx - ink.l) * ink.k)];
        if (tt0 != null && tt0 > best) { best = tt0; sitX = sx; }
      }
      sitY = best;
    }
    var hangHip = V(sitX + 3 * S, sitY + 22.5 * S);
    var xRunEnd = Math.min(xH0 - 3 * S - 30, sitX + 62 * S);
    var hdrY = A.hdrB;                                                   // header bottom line: the leaner's floor
    // find the right end of the M and the left edge of the D from the logo ink (gap between the two words)
    var mRight = A.lgL + 0.30 * A.lgW, dL = A.lgL + 0.34 * A.lgW, flatTop = A.lgT + 0.5;
    if (ink) {
      var notchX = null, deep = -1e9;
      for (var gx = sitX + 15 * S; gx <= sitX + 50 * S; gx += 0.5) { var tg = inkTop(gx); if (tg > deep) { deep = tg; notchX = gx; } }
      flatTop = 1e9;
      for (gx = sitX; gx <= sitX + 70 * S; gx += 0.5) flatTop = Math.min(flatTop, inkTop(gx));
      for (gx = notchX; gx > sitX && inkTop(gx) > flatTop + 1; gx -= 0.5); mRight = gx;
      for (gx = notchX; gx < notchX + 25 && inkTop(gx) > flatTop + 1; gx += 0.5); dL = gx;
    }
    var LWF = 0.8;                                                       // thinner strokes for the finale: don't take away from the logo
    // LOUNGER (fedora): perched on the M, lying back along the top of the D, hands behind his head
    var topD = inkTop(dL + 6 * S), topM = inkTop(mRight - 4 * S);
    var lRot = PI / 2 - 0.09;                                            // lying back, head propped a touch on his hands
    var lUp = V(Math.sin(lRot), -Math.cos(lRot));
    var loungeHip = V(mRight - 3.0 * S, topM - 1.9 * S);                 // butt on the M, torso out across the D
    var mPerch = V(loungeHip.x - 1 * S, topM - 1.6 * S);
    function loungePose(t) {
      var a = idleAmp(t), sw = Math.sin(TAU * (t - END) / 2.6) * a, br = Math.sin(TAU * (t - END) / 3.6) * a;
      var o = P(loungeHip, lRot, -1, 0.01 * br, [[0, 0], [0, 0]], [[0, 0], [0, 0]]);
      var hc = add(loungeHip, mul(lUp, (TO + NK + HR) * S));
      var kneeFoot = V(loungeHip.x - 9.0 * S, inkTop(loungeHip.x - 9.0 * S) - SOLE);              // near leg: knee up, foot flat on the M
      // knee of the near leg (2-bone, bends upward)
      var d = len(sub(kneeFoot, loungeHip)), hl = Math.sqrt(Math.max(0, (TH * S) * (TH * S) - d * d / 4));
      var knee = V((loungeHip.x + kneeFoot.x) / 2, (loungeHip.y + kneeFoot.y) / 2 - hl);
      var lx = loungeHip.x - 16.2 * S + 0.8 * sw;                       // far leg stretched out, draped down the M's shoulder
      o.f = [kneeFoot, V(lx, inkTop(lx) - SOLE - 0.4 * Math.abs(sw))];
      o.g = [true, true];
      o.h = [V(hc.x - 0.2 * S, hc.y + 3.6 * S), V(hc.x - 0.2 * S, hc.y + 3.6 * S)];          // hands tucked behind his head
      o.ab = 1; o.hd = 0.1 + 0.02 * br; o.lw = LWF; return o;
    }
    // LEANER (spiky): standing on the header line right of the N, arm out straight, palm planted on the N
    var leanRot = -0.22;
    var upL0 = V(Math.sin(leanRot), -Math.cos(leanRot));
    var leanHip0y = GY(hdrY) - 16.0 * S;
    var shY = leanHip0y + upL0.y * TO * S;
    var handY = shY - 1.2 * S;
    var palm = V(Math.max(inkRight(handY), inkRight(handY - 1.5 * S), inkRight(handY + 1.5 * S)) + 0.6 * S, handY);
    var armReach = (UA + FA - 0.5) * S;
    var shX = palm.x + Math.sqrt(Math.max(0, armReach * armReach - (shY - handY) * (shY - handY)));
    var leanHip = V(shX - upL0.x * TO * S, leanHip0y);
    var leanFootX = leanHip.x + 1.0 * S;
    var END = 16.6;
    function idleAmp(t) { return t <= END ? 0 : smooth(seg(t, END, END + 0.6)) * (1 - smooth(seg(t, END + 5.5, END + 7.5))); }
    function leanPose(t) {
      var a = idleAmp(t), br = Math.sin(TAU * (t - END - 0.7) / 3.6) * a;
      var o = P(leanHip, leanRot, -1, 0.012 * br, [[0, 0], [0, 0]], [[0, 0], [0, 0]]);
      var gy = GY(hdrY);
      o.f = [V(leanHip.x + 4.6 * S, gy - 0.4 * S), V(leanFootX, gy)]; o.g = [false, true];   // near foot crossed over, resting on its toe
      o.h = [palm, V(leanHip.x + 2.2 * S, leanHip.y - 2.4 * S)];                              // arm out to the N, other hand on hip
      o.hd = 0.06 + 0.03 * br; o.lw = LWF; return o;
    }
    add_(R, 15.35, 15.45, CROUCH(xH0, xH0 - 3 * S, hT, -1, -1, 0.6));
    add_(R, 15.45, 15.75, RUN(xH0 - 3 * S, xRunEnd, hT, -1, 'in', 0.24, 0));
    // backflip off the rope top (needs the rope-top hip)
    (function () {
      var climb = R[R.length - 4].f, topPose = climb.call({ dur: 1 }, 1, 14.55);
      var h0 = topPose.hip, ctrl = V(lerp(h0.x, landH2.x, 0.35), Math.min(h0.y, landH2.y) - 30 * S);
      R[R.length - 3].f = AIR(h0, landH2, 0, topPose.rot, topPose.rot - TAU, 1, -1,
        [[0, L_reach], [0.15, L_takeoff], [0.32, L_tuckS], [0.68, L_tuckS], [0.86, L_landprep], [1, L_crouch(0.55)]], { ctrl: ctrl, flip: 0.5, ra: 0.12, rb: 0.9, g1: hT });
    })();

    // leap up and grab the lip of the M, pull up, swing round and sit in the notch
    add_(R, 15.75, 16.12, function (u) {
      var h0 = V(xRunEnd, GY(hT) - HC * S);
      var o = AIR(h0, hangHip, 16, 0, 0, -1, -1, [[0, L_crouch(0.5)], [0.2, L_takeoff], [0.7, L_reach], [1, L_reach]], { g0: hT }).call(this, u);
      var k = smooth(seg(u, 0.72, 1));
      o.h = [lv(o.h[0], V(sitX - 1 * S, inkTop(sitX - 1 * S) + 0.4), k), lv(o.h[1], V(sitX + 3.5 * S, inkTop(sitX + 3.5 * S) + 0.4), k)];
      return o;
    });
    add_(R, 16.12, 16.34, function (u, t) {   // pull up over the lip of the M (still facing left)
      var hip = qbez(hangHip, V(mPerch.x - 1 * S, mPerch.y + 4 * S), V(mPerch.x, mPerch.y), smooth(u));
      var o = fromL(hip, 1.35 * smooth(seg(u, 0.1, 0.7)), -1, keysL(u, [[0, L_reach], [0.6, L_tuckS], [1, L_tuckS]]));
      var lipA = V(sitX - 1 * S, inkTop(sitX - 1 * S) + 0.4), lipB = V(sitX + 3.5 * S, inkTop(sitX + 3.5 * S) + 0.4);
      var k = smooth(seg(u, 0.55, 1));
      o.h = [lv(lipA, add(o.hip, V(-3 * S, 4 * S)), k), lv(lipB, add(o.hip, V(3 * S, 4 * S)), k)];
      for (var q = 0; q < 2; q++) o.f[q].y = Math.min(o.f[q].y, inkTop(o.f[q].x) - SOLE);
      return o;
    });
    add_(R, 16.34, END - 0.05, function (u, t) {   // sit on the peak of the M, then lie back across the D
      var sit = P(mPerch, 1.35, -1, 0.1, [[0, 0], [0, 0]], [[3, 6], [2, 6.5]]);
      sit.f = [V(mPerch.x - 6 * S, mPerch.y + 12 * S), V(mPerch.x - 4.5 * S, mPerch.y + 13 * S)];
      sit.lw = lerp(1, LWF, 0.5);
      var k = smoother(u);
      return lerpPose(sit, loungePose(END), k);
    });
    add_(R, END - 0.05, 1e6, function (u, t) { return loungePose(t); });

    // ------------- CHASER -------------
    var CL = 0.34, cph = PI * 0.5;
    var xC1c = A.c1L + 26 * S;
    add_(C, 0.62, 1.56, AIR(V(offX, GY(c1T) - 40 * S), V(xC1c, GY(c1T) - HC * S), 24, 0, 0, 1, 1, entryKeys, { g1: c1T }));
    add_(C, 1.56, 1.68, CROUCH(xC1c, xC1c, c1T, 1, 1, 0.6));
    add_(C, 1.68, 2.42, JUMP(xC1c, c1T, xLF0 - 10 * S, lfT, 12, 'leap', 1));
    add_(C, 2.42, 2.52, CROUCH(xLF0 - 10 * S, xLF0 - 7 * S, lfT, 1, 1, 0.45));
    add_(C, 2.52, 2.86, RUN(xLF0 - 7 * S, xLFv - 6 * S, lfT, 1, '', CL, cph));
    var xB1c = xB1 - 16 * S;
    add_(C, 2.86, 3.14, JUMP(xLFv - 6 * S, lfT, xB1c, b1T, 10, 'leap', 1));
    add_(C, 3.14, 3.36, RUN(xB1c, xB1c + 14 * S, b1T, 1, '', CL + 0.08, cph));
    // full horizontal diving lunge sliding along the top of LIST YOUR CAR FREE
    var xDiveEnd = A.b1R - 14 * S;
    add_(C, 3.36, 3.82, function (u) {
      var k = smooth(seg(u, 0, 0.22));
      var x = lerp(xB1c + 14 * S, xDiveEnd, easeOut(u));
      var yHip = lerp(GY(b1T) - HRUN * S, GY(b1T) - 3.4 * S - 2.0 * S * bump(u, 0, 0.3), smooth(seg(u, 0, 0.24)));
      var o = fromL(V(x, yHip), k * PI / 2, 1, mixL(L_crouch(0.3), L_dive, k));
      for (var q = 0; q < 2; q++) o.f[q].y = Math.min(o.f[q].y, GY(b1T));
      o.h[1].y = Math.min(o.h[1].y, GY(b1T)); o.reach = k; return o;
    });
    add_(C, 3.82, 4.12, STATIC2(function () { return prone(xDiveEnd, b1T, 1); }, function () { return crouchAt(xDiveEnd + 6 * S, b1T, 1, 0.6); }));
    var xC1B = A.b1R + 16 * S, c1B = A.c1B;
    add_(C, 4.12, 4.42, JUMP(xDiveEnd + 6 * S, b1T, xC1B, c1B, 8, 'drop', 1));
    add_(C, 4.42, 4.55, CROUCH(xC1B, xC1B, c1B, 1, -1, 0.75, 0.3));
    // leap off the LIST FREE bottom border: superman lunge at the swinging runner, grabs empty air
    var lungeHip = V(SA.x + 30 * S, SA.y + rMid - 16 * S), lungeAim = V(lungeHip.x - 26 * S, lungeHip.y + 20 * S);
    var landB2c = V(A.b2R - 12 * S, GY(b2T) - HC * S);
    add_(C, 4.55, 4.86, function (u) {
      var h0 = V(xC1B, GY(c1B) - HC * S);
      var hip = qbez(h0, V(h0.x + 6 * S, h0.y - 6 * S), lungeHip, u);
      var aim = nrm(sub(lungeAim, hip));
      var rotT = Math.atan2(-aim.x, -aim.y) * -1;     // body up-vector toward the target (dir -1)
      rotT = Math.atan2(aim.x, -aim.y);
      var k = smooth(seg(u, 0.05, 0.5));
      var o = fromL(hip, lerp(0, rotT, k), -1, keysL(u, [[0, L_crouch(0.6)], [0.25, L_takeoff], [0.6, L_superman], [1, L_superman]]));
      o.reach = k; return o;
    });
    add_(C, 4.86, 5.28, function (u) {
      var hip = qbez(lungeHip, V(lungeHip.x - 4 * S, lungeHip.y + 4 * S), landB2c, u);
      var aim = nrm(sub(lungeAim, lungeHip));
      var r0 = Math.atan2(aim.x, -aim.y);
      var o = fromL(hip, lerp(r0, 0, smoother(seg(u, 0, 0.75))), -1, keysL(u, [[0, L_superman], [0.45, L_tuck], [0.8, L_landprep], [1, L_crouch(0.6)]]));
      if (u > 0.7) for (var q = 0; q < 2; q++) o.f[q].y = Math.min(o.f[q].y, GY(b2T));
      return o;
    });
    add_(C, 5.28, 5.42, CROUCH(landB2c.x, landB2c.x - 4 * S, b2T, -1, -1, 0.6));
    add_(C, 5.42, 6.00, RUN(landB2c.x - 4 * S, xB2e, b2T, -1, '', CL, cph));
    var xG0c = A.b2L - 24 * S;
    add_(C, 6.00, 6.48, JUMP(xB2e, b2T, xG0c, gT, 8, 'drop', -1));
    add_(C, 6.48, 6.62, CROUCH(xG0c, xG0c - 5 * S, gT, -1, -1, 0.65));
    add_(C, 6.62, 7.45, RUN(xG0c - 5 * S, xGw + 4 * S, gT, -1, '', CL, cph));
    var yC0 = gT - 30 * S, yC1 = yW1 + 16 * S;
    add_(C, 7.45, 7.75, AIR(V(xGw + 4 * S, GY(gT) - HC * S), V(xWall + 8.5 * S, yC0), 8, 0, 0, -1, -1, [[0, L_crouch(0.5)], [0.2, L_takeoff], [1, L_reach]], { g0: gT }));
    add_(C, 7.75, 9.30, CLIMB(wallLine, 1, 8.5, 0.6, yC0, yC1, 12 * S, { footOff: 1.4, foot: 16 }));
    add_(C, 9.30, 9.80, AIR(V(xWall + 8.5 * S, yC1), V(xWS0 - 4 * S, GY(wsT) - HC * S), 30, 0, TAU, -1, 1,
      [[0, L_reach], [0.12, L_drop], [0.3, L_tuck], [0.7, L_tuck], [0.86, L_landprep], [1, L_crouch(0.55)]], { flip: 0.1, ra: 0.15, rb: 0.88, g1: wsT }));
    add_(C, 9.80, 9.88, CROUCH(xWS0 - 4 * S, xWS0, wsT, 1, 1, 0.4));
    var xSw0 = xWSv - 24 * S, xSw1 = xWSv2 - 25 * S;
    add_(C, 9.88, 10.12, RUN(xWS0, xSw0, wsT, 1, '', CL + 0.06, cph));
    // swipe dive at the runner's trailing shoe during his vault
    add_(C, 10.12, 10.50, function (u) {
      var k = smooth(seg(u, 0, 0.25));
      var x = lerp(xSw0, xSw1, smooth(u) * 0.6 + u * 0.4);
      var yHip = lerp(GY(wsT) - HRUN * S, GY(wsT) - 3.4 * S - 4 * S * bump(u, 0, 0.4), smooth(seg(u, 0, 0.26)));
      var o = fromL(V(x, yHip), k * PI / 2 * 0.92, 1, mixL(L_crouch(0.3), L_dive, k));
      for (var q = 0; q < 2; q++) o.f[q].y = Math.min(o.f[q].y, GY(wsT));
      o.h[1].y = Math.min(o.h[1].y, GY(wsT)); o.reach = k; return o;
    });
    add_(C, 10.50, 10.95, STATIC2(function () { return prone(xSw1, wsT, 1); }, function () { return crouchAt(xSw1 + 6 * S, wsT, 1, 0.75); }));
    // duck as the runner swings over, then jump and grab the dangling rope
    add_(C, 10.95, 12.30, function (u, t) {
      var o = crouchAt(xSw1 + 6 * S, wsT, 1, 0.75 + 0.15 * bump(u, 0.35, 0.75));
      o.hd = -0.3 * smooth(seg(u, 0.1, 0.4)); return o;
    });
    add_(C, 12.30, 14.85, CLIMB(rope2Line, -1, 6.0, 0, dC0, dC1, 14 * S, { footOff: 0.8 }));
    // mantle over the lip of WANT TO SELL? and turn to run
    var mantleEnd = V(RX - 6 * S, GY(hT) - HC * S);
    (function () {
      var climb = C[C.length - 1].f, topPose = climb.call({ dur: 1 }, 1, 14.85);
      add_(C, 14.85, 15.50, function (u) {
        var lipA = V(RX - 3 * S, hT), lipB = V(RX + 2.5 * S, hT);
        var mid = V(RX - 2 * S, hT - 3 * S);
        var hip = u < 0.55 ? lv(topPose.hip, mid, smooth(u / 0.55)) : lv(mid, mantleEnd, smooth((u - 0.55) / 0.45));
        var dir = u < 0.7 ? 1 : -1;
        var o = fromL(hip, lerp(topPose.rot, 0, smooth(u * 2)), dir, keysL(u, [[0, L_reach], [0.55, L_tuck], [1, L_crouch(0.55)]]));
        var hk = 1 - smooth(seg(u, 0.75, 1));
        o.h = [lv(o.h[0], lipA, hk), lv(o.h[1], lipB, hk)];
        if (u > 0.55) for (var q = 0; q < 2; q++) o.f[q].y = Math.min(o.f[q].y, GY(hT));
        return o;
      });
    })();
    // hop up onto the header line and lean back against the end of IM DRIVN
    var jd = leanFootX >= mantleEnd.x ? 1 : -1;
    add_(C, 15.50, 15.60, CROUCH(mantleEnd.x, mantleEnd.x, hT, -1, jd, 0.6, 0.3));
    add_(C, 15.60, 15.95, JUMP(mantleEnd.x, hT, leanFootX, hdrY, 12, 'leap', jd));
    add_(C, 15.95, 16.08, CROUCH(leanFootX, leanFootX, hdrY, jd, -1, 0.6, 0.4));
    add_(C, 16.08, END, STATIC2(function () { return crouchAt(leanFootX, hdrY, -1, 0.5); }, function () { return leanPose(END); }));
    add_(C, END, 1e6, function (u, t) { return leanPose(t); });

    // ------------- ROPES -------------
    function ropes(t, rp, cp) {
      var out = [];
      // rope #1: thrown during the front flip, latches under LIST YOUR CAR FREE, rappel, released & reeled in
      if (t >= 3.5 && t < 5.4) {
        var hand = rp.h[0];
        if (t < 3.72) {
          var u = seg(t, 3.5, 3.72), hook = qbez(hand, V(lerp(hand.x, SA.x, 0.5) + 14 * S, Math.min(hand.y, SA.y) - 4 * S), SA, smooth(u));
          out.push({ a: hook, b: hand, sag: 10 * S * (1 - u), hook: hook, hookA: 0, latched: false });
        } else if (t < 5.0) {
          var sg = t < 3.85 ? 5 * S * (1 - seg(t, 3.72, 3.85)) : 0;
          out.push({ a: SA, b: rp.grip || hand, sag: sg, hook: SA, latched: true, tail: t >= 3.85 ? 9 * S : 0 });
        } else {
          var v = seg(t, 5.0, 5.4), hk = qbez(SA, V(lerp(SA.x, hand.x, 0.5) + 10 * S, lerp(SA.y, hand.y, 0.5) - 20 * S), hand, smoother(v));
          out.push({ a: hk, b: hand, sag: 18 * S * Math.sin(PI * v), hook: hk, latched: false, fade: 1 - seg(t, 5.3, 5.4) });
        }
      }
      // rope #2: grapple thrown straight up to WANT TO SELL?, both climb it, reeled up after the mantle
      if (t >= 11.05 && t < 15.95) {
        if (t < tLatch) {
          var w = seg(t, 11.05, tLatch), hd = rp.h[0];
          if (w < 0.38) {
            var sp = 18 * t, hk2 = add(hd, V(6 * S * Math.cos(sp), 6 * S * Math.sin(sp)));
            out.push({ a: hk2, b: hd, sag: 1, hook: hk2, latched: false });
          } else {
            var ww = (w - 0.38) / 0.62, hk3 = qbez(hd, V(lerp(hd.x, P2.x, 0.3) + 18 * S, lerp(hd.y, P2.y, 0.55)), P2, easeOut(ww));
            out.push({ a: hk3, b: hd, sag: 16 * S * (1 - ww), hook: hk3, latched: false });
          }
        } else {
          var ln = rope2Line(t), lowD = 0;
          if (t < tSwing) {
            var hpt = rp.h[0]; out.push({ a: P2, b: hpt, sag: 3 * S * (1 - seg(t, tLatch, tLatch + 0.1)), hook: P2, latched: true,
              tail: Math.max(0, L2 - len(sub(hpt, P2))), tailEndY: GY(wsT) });
          } else {
            if (rp.gripD && t < 14.55) lowD = Math.max(lowD, rp.gripD);
            if (cp.gripD && t >= 12.3 && t < 14.85) lowD = Math.max(lowD, cp.gripD);
            var reel = seg(t, 15.4, 15.95), Lc = L2 * (1 - reel);
            lowD = Math.min(lowD, Lc);
            var endA = add(P2, mul(ln.d, lowD));
            out.push({ a: P2, b: endA, sag: 0, hook: P2, latched: true, tail: Math.max(0, Lc - lowD), tailEndY: GY(wsT), dirD: ln.d, fade: 1 - seg(t, 15.85, 15.95) });
          }
        }
      }
      return out;
    }
    return { R: R, C: C, ropes: ropes, P2: P2, SA: SA, RX: RX, lerp: lerpPose, END: END, flatTop: flatTop, loungeHip: loungeHip, leanHip: leanHip, topM: topM, topD: topD, oy: A.oy, inkTop: inkTop, palm: palm, mRight: mRight, dL: dL };
  }

  function evalTrack(tr, t) {
    var i = 0; while (i < tr.length - 1 && t >= tr[i].t1) i++;
    var sgm = tr[i], u = clamp((t - sgm.t0) / sgm.dur, 0, 1);
    var p = sgm.f.call(sgm, u, t);
    var BL = 0.09;
    if (i > 0 && t >= sgm.t0 && t - sgm.t0 < BL) {
      var ps = tr[i - 1], pp = ps.f.call(ps, 1, ps.t1);
      p = tr.lerpPose(pp, p, smooth((t - sgm.t0) / BL));
    }
    return p;
  }

  // ---------- renderer ----------
  function el(name, attrs, parent) { var n = document.createElementNS(NS, name); for (var k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; }
  function f2(v) { return (Math.round(v * 100) / 100).toString(); }
  function pts(arr) { var s = ''; for (var i = 0; i < arr.length; i++) s += f2(arr[i].x) + ',' + f2(arr[i].y) + ' '; return s; }
  var HAIR = 'M4.2,-0.6 Q6.2,-3.2 6.9,-7.2 Q4.6,-6.4 3.4,-6.9 L3.0,-11.6 Q1.6,-8.6 0.6,-7.8 L-1.6,-11.8 Q-2.0,-8.8 -2.8,-7.6 ' +
    'L-6.2,-10.4 Q-5.0,-7.4 -5.2,-6.4 L-8.2,-6.6 Q-6.2,-4.6 -5.6,-3.6 L-7.4,-1.8 Q-5.2,-1.2 -4.3,0.4 Q-3.4,-3.4 0.2,-3.6 Q3.0,-3.4 4.2,-0.6 Z';

  function Rig(parent, look, uid) {
    var g = el('g', { filter: 'url(#' + uid + 'Shadow)' }, parent);
    var common = { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    function limb(color, w) {
      return [el('polyline', Object.assign({ stroke: 'rgba(0,0,0,0.82)', 'stroke-width': w + 1.9 }, common), g),
              el('polyline', Object.assign({ stroke: color, 'stroke-width': w }, common), g)];
    }
    this.look = look; this.g = g;
    this.legFar = limb(BODY_FAR, LW); this.armFar = limb(BODY_FAR, LW * 0.92);
    this.torso = limb(BODY, LW + 0.25);
    this.legNear = limb(BODY, LW); 
    this.headO = el('circle', { fill: 'rgba(0,0,0,0.82)' }, g);
    this.head = el('circle', { fill: BODY }, g);
    this.hat = el('g', {}, g);
    var hg = el('g', {}, this.hat);
    if (look === 'hair') {
      el('path', { d: HAIR, fill: 'none', stroke: 'rgba(0,0,0,0.85)', 'stroke-width': 3.4, 'stroke-linejoin': 'round' }, hg);
      el('path', { d: HAIR, fill: '#161618', stroke: '#f5efe0', 'stroke-width': 1.3, 'stroke-linejoin': 'round' }, hg);
      el('path', { d: 'M1.0,-4.6 Q1.9,-7.8 2.8,-10.6', fill: 'none', stroke: GOLD, 'stroke-width': 1.3, 'stroke-linecap': 'round' }, hg);
      el('path', { d: 'M-2.0,-4.8 Q-3.8,-7.4 -5.5,-9.4', fill: 'none', stroke: GOLD, 'stroke-width': 1.3, 'stroke-linecap': 'round' }, hg);
      // gold sweatband across the forehead
      el('path', { d: 'M-4.4,-1.2 Q0,-2.9 4.5,-1.1', fill: 'none', stroke: 'rgba(0,0,0,0.85)', 'stroke-width': 2.6, 'stroke-linecap': 'round' }, hg);
      el('path', { d: 'M-4.4,-1.2 Q0,-2.9 4.5,-1.1', fill: 'none', stroke: GOLD, 'stroke-width': 1.4, 'stroke-linecap': 'round' }, hg);
    } else {
      el('path', { d: 'M-6.2,-2.25 Q-5.9,-3.05 -3.6,-3.1 L4.0,-3.1 Q6.5,-3.0 7.7,-1.75 Q5.6,-2.1 4.0,-2.2 L-3.6,-2.2 Q-5.2,-2.1 -6.2,-2.25 Z',
        fill: '#0c0c0c', stroke: GOLD, 'stroke-width': 0.5, 'stroke-linejoin': 'round' }, hg);
      el('path', { d: 'M-3.2,-2.7 L-2.9,-7.0 Q-2.6,-7.85 -1.4,-7.65 Q-0.2,-7.05 0.7,-7.65 Q2.3,-7.85 2.65,-7.0 L3.35,-2.7 Z',
        fill: '#0c0c0c', stroke: GOLD, 'stroke-width': 0.5, 'stroke-linejoin': 'round' }, hg);
      el('path', { d: 'M-3.15,-3.0 L3.35,-3.0 L3.12,-4.45 L-3.0,-4.45 Z', fill: GOLD }, hg);
    }
    this.armNear = limb(BODY, LW * 0.95);
    this.shoeGl = el('circle', { r: 0.9, fill: look === 'hair' ? GOLD : 'none' }, g);
  }
  Rig.prototype.skel = function (p, S) {
    var c = Math.cos(p.rot), s = Math.sin(p.rot);
    var fwd = V(p.dir * c, p.dir * s), up = V(s, -c);
    var upL = add(mul(up, Math.cos(p.lean)), mul(fwd, Math.sin(p.lean)));
    var sh = add(p.hip, mul(upL, TO * S));
    var ht = p.hd || 0, upH = add(mul(upL, Math.cos(ht)), mul(fwd, Math.sin(ht) * 1));
    var hc = add(sh, mul(upH, (NK + HR) * S));
    var k = [0, 1].map(function (i) { return ik(p.hip, p.f[i], TH * S, SH * S, fwd); });
    var a = [0, 1].map(function (i) { return ik(sh, p.h[i], UA * S, FA * S, mul(fwd, p.ab ? p.ab : -1)); });
    var toes = [0, 1].map(function (i) {
      if (p.g[i]) return add(k[i].e, V(p.dir * 3.3 * S, 0));
      var sd = nrm(sub(k[i].e, k[i].j)), pp = V(-sd.y, sd.x); if (dot(pp, fwd) < 0) pp = mul(pp, -1);
      return add(k[i].e, mul(pp, 3.3 * S));
    });
    return { sh: sh, hc: hc, upH: upH, k: k, a: a, toes: toes, fwd: fwd };
  };
  Rig.prototype.draw = function (p, S) {
    var sk = this.skel(p, S);
    function set(l, arr) { var s = pts(arr); l[0].setAttribute('points', s); l[1].setAttribute('points', s); }
    set(this.legFar, [p.hip, sk.k[1].j, sk.k[1].e, sk.toes[1]]);
    set(this.armFar, [sk.sh, sk.a[1].j, sk.a[1].e]);
    var neck = add(sk.sh, mul(sk.upH, NK * S * 0.6));
    set(this.torso, [p.hip, sk.sh, neck]);
    set(this.legNear, [p.hip, sk.k[0].j, sk.k[0].e, sk.toes[0]]);
    set(this.armNear, [sk.sh, sk.a[0].j, sk.a[0].e]);
    var lwk = p.lw || 1;
    [this.legFar, this.armFar, this.torso, this.legNear, this.armNear].forEach(function (l) {
      l[0].setAttribute('stroke-width', f2((LW + 1.9) * S * lwk)); l[1].setAttribute('stroke-width', f2(LW * S * lwk));
    });
    this.head.setAttribute('cx', f2(sk.hc.x)); this.head.setAttribute('cy', f2(sk.hc.y)); this.head.setAttribute('r', f2(HR * S));
    this.headO.setAttribute('cx', f2(sk.hc.x)); this.headO.setAttribute('cy', f2(sk.hc.y)); this.headO.setAttribute('r', f2((HR + 0.95 * (p.lw || 1)) * S));
    var ang = Math.atan2(sk.upH.x, -sk.upH.y) * 180 / PI + (this.look === 'hair' ? -0.06 : 0.2) * p.dir * 180 / PI;
    var hs = 0.93 * S;
    this.hat.setAttribute('transform', 'translate(' + f2(sk.hc.x) + ',' + f2(sk.hc.y) + ') rotate(' + f2(ang) + ') scale(' + f2(p.dir * hs) + ',' + f2(hs) + ')');
    this.shoeGl.setAttribute('cx', f2(sk.toes[0].x)); this.shoeGl.setAttribute('cy', f2(sk.toes[0].y)); this.shoeGl.setAttribute('r', f2(0.95 * S));
    return sk;
  };

  function RopeView(parent) {
    var g = el('g', {}, parent);
    this.g = g;
    var c = { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    this.o = el('path', Object.assign({ stroke: 'rgba(0,0,0,0.8)', 'stroke-width': 3.3 }, c), g);
    this.m = el('path', Object.assign({ stroke: ROPE, 'stroke-width': 1.9 }, c), g);
    this.b = el('path', Object.assign({ stroke: ROPE_DK, 'stroke-width': 1.9, 'stroke-dasharray': '1.1 2.1', 'stroke-linecap': 'butt' }, c), g);
    this.t = el('path', Object.assign({ stroke: 'rgba(0,0,0,0.8)', 'stroke-width': 3.3 }, c), g);
    this.tm = el('path', Object.assign({ stroke: ROPE, 'stroke-width': 1.9 }, c), g);
    this.tb = el('path', Object.assign({ stroke: ROPE_DK, 'stroke-width': 1.9, 'stroke-dasharray': '1.1 2.1', 'stroke-linecap': 'butt' }, c), g);
    this.hook = el('g', {}, g);
    var hc = { fill: 'none', 'stroke-linecap': 'round' };
    el('path', Object.assign({ d: 'M0,0 L0,-4.2 M0,-4.2 Q-3.6,-4.4 -3.4,-1.0 M0,-4.2 Q3.6,-4.4 3.4,-1.0', stroke: 'rgba(0,0,0,0.85)', 'stroke-width': 2.8 }, hc), this.hook);
    el('path', Object.assign({ d: 'M0,0 L0,-4.2 M0,-4.2 Q-3.6,-4.4 -3.4,-1.0 M0,-4.2 Q3.6,-4.4 3.4,-1.0', stroke: GOLD, 'stroke-width': 1.4 }, hc), this.hook);
    el('circle', { cx: 0, cy: 0, r: 1.6, fill: GOLD_HI, stroke: 'rgba(0,0,0,0.85)', 'stroke-width': 0.7 }, this.hook);
  }
  RopeView.prototype.draw = function (r, S) {
    if (!r) { this.g.setAttribute('display', 'none'); return; }
    this.g.removeAttribute('display');
    this.g.setAttribute('opacity', f2(r.fade == null ? 1 : r.fade));
    var a = r.a, b = r.b, m = lv(a, b, 0.5), d = sub(b, a), n = nrm(V(-d.y, d.x)); if (n.y < 0) n = mul(n, -1);
    var c = add(m, mul(n, r.sag || 0));
    var path = 'M' + f2(a.x) + ',' + f2(a.y) + ' Q' + f2(c.x) + ',' + f2(c.y) + ' ' + f2(b.x) + ',' + f2(b.y);
    [this.o, this.m, this.b].forEach(function (p) { p.setAttribute('d', path); });
    var sw = [3.3, 1.9, 1.9];
    [this.o, this.m, this.b].forEach(function (p, i) { p.setAttribute('stroke-width', f2(sw[i] * Math.max(0.85, S))); });
    var tp = '';
    if (r.tail && r.tail > 1) {
      var dd = r.dirD || nrm(sub(b, a)), e = add(b, mul(dd, r.tail));
      var cc = add(b, mul(dd, r.tail * 0.5));
      if (r.tailEndY != null && e.y > r.tailEndY) {         // rope tail lies on the letters
        var over = e.y - r.tailEndY; e = V(e.x + over * 0.8 * (dd.x >= 0 ? 1 : -1) + over * 0.3, r.tailEndY);
        cc = V(lerp(b.x, e.x, 0.3), lerp(b.y, e.y, 0.85));
      } else { cc = add(cc, V(2.5 * S * Math.sin(b.y * 0.05), 0)); }
      tp = 'M' + f2(b.x) + ',' + f2(b.y) + ' Q' + f2(cc.x) + ',' + f2(cc.y) + ' ' + f2(e.x) + ',' + f2(e.y);
    }
    [this.t, this.tm, this.tb].forEach(function (p, i) { p.setAttribute('d', tp || 'M0,0'); if (tp) p.removeAttribute('display'); else p.setAttribute('display', 'none'); p.setAttribute('stroke-width', f2(sw[i] * Math.max(0.85, S))); });
    var h = r.hook, ang = r.latched ? 0 : Math.atan2(h.x - b.x, -(h.y - b.y)) * 180 / PI;
    if (r.latched) ang = 180;   // hook prongs curl over the edge, shank pointing down the rope
    this.hook.setAttribute('transform', 'translate(' + f2(h.x) + ',' + f2(h.y) + ') rotate(' + f2(ang) + ') scale(' + f2(Math.max(0.9, S)) + ')');
  };

  // ---------- mount ----------
  var current = null;
  function mount(root, opts) {
    opts = opts || {};
    root = root || document.querySelector('.sell-lanes');
    var noop = { destroy: function () {}, render: function () {}, CYCLE: CYCLE };
    if (!root || !document.body) return noop;
    var mq = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : null;
    function guardsFail() {
      if (opts.force) return false;
      if (global.innerWidth > MAX_W) return true;
      if (mq && mq.matches) return true;
      if (!document.body.contains(root)) return true;
      if (!(document.body.classList.contains('is-sell') || root.classList.contains('sell-lanes'))) return true;
      return false;
    }
    if (guardsFail()) return noop;
    if (current) current.destroy();
    var manual = !!opts.manual;
    var uid = 'sc' + Math.floor(Math.random() * 1e6);
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    svg.setAttribute('class', 'sell-chase-overlay');
    svg.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;overflow:visible;z-index:25;contain:layout style;visibility:hidden';
    var defs = el('defs', {}, svg);
    var sh = el('filter', { id: uid + 'Shadow', x: '-60%', y: '-60%', width: '220%', height: '220%' }, defs);
    el('feDropShadow', { dx: '0', dy: '0.8', stdDeviation: '1.1', 'flood-color': '#000', 'flood-opacity': '0.85' }, sh);
    var ropeG = el('g', {}, svg);
    var ropeViews = [new RopeView(ropeG), new RopeView(ropeG)];
    var chaser = new Rig(svg, 'hair', uid), runner = new Rig(svg, 'fedora', uid);
    document.body.appendChild(svg);

    var plan = null, A = null, S = 1, key = '', lastCheck = 0, dead = false, raf = 0, elapsed = 0, finished = false, lastNow = performance.now(), lastT = 0;
    var fontsOk = !document.fonts || document.fonts.status === 'loaded';
    if (!fontsOk) { document.fonts.ready.then(function () { fontsOk = true; key = ''; }); setTimeout(function () { fontsOk = true; }, 3000); }
    function keyNow() {
      var r = root.getBoundingClientRect();
      return [global.innerWidth, global.innerHeight, Math.round(r.width), Math.round(r.height), Math.round(r.left + global.scrollX), Math.round(r.top + global.scrollY), Math.round(global.scrollY), fontsOk ? 1 : 0].join('|');
    }
    function layout(force) {
      var k = keyNow();
      if (!force && k === key && plan) return true;
      var m = measure(root);
      if (!m) { plan = null; return false; }
      A = m; key = k;
      S = clamp(A.W / 430, 0.86, 1.0);
      plan = build(A, S); plan.R.lerpPose = plan.C.lerpPose = plan.lerp;
      var r = root.getBoundingClientRect();
      svg.style.left = (r.left + global.scrollX) + 'px'; svg.style.top = (r.top + global.scrollY) + 'px';
      svg.style.width = r.width + 'px'; svg.style.height = r.height + 'px';
      svg.setAttribute('viewBox', '0 0 ' + r.width + ' ' + r.height);
      return true;
    }
    function render(t) {
      t = Math.max(0, t); lastT = t;
      if (!plan && !layout(true)) { svg.style.visibility = 'hidden'; return null; }
      var rp = evalTrack(plan.R, t), cp = evalTrack(plan.C, t);
      var rs = runner.draw(rp, S), cs = chaser.draw(cp, S);
      var rr = plan.ropes(t, rp, cp);
      ropeViews[0].draw(rr[0], S); ropeViews[1].draw(rr[1], S);
      svg.style.visibility = 'visible';
      return { R: rp, C: cp, rs: rs, cs: cs, ropes: rr };
    }
    function stopRaf() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    function tick(now) {
      raf = 0; if (dead) return;
      if (guardsFail()) { destroy(); return; }
      var dt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000)); lastNow = now;
      if (now - lastCheck > SETTLE_MS) { lastCheck = now; layout(false); }
      elapsed += dt; render(elapsed);
      if (elapsed > RUN_T + IDLE_T) { finished = true; raf = 0; return; }   // settled: final still pose, no restart
      raf = requestAnimationFrame(tick);
    }
    function onResize() { key = ''; if ((finished || manual) && !dead) { layout(true); render(lastT); } }
    function onVis() { if (document.hidden) stopRaf(); else if (!manual && !raf && !finished) { lastNow = performance.now(); raf = requestAnimationFrame(tick); } }
    function destroy() {
      dead = true; stopRaf();
      document.removeEventListener('visibilitychange', onVis);
      global.removeEventListener('resize', onResize); global.removeEventListener('orientationchange', onResize);
      global.removeEventListener('scroll', onResize);
      global.removeEventListener('hashchange', onHash);
      if (svg.parentNode) svg.parentNode.removeChild(svg);
      if (current === api) current = null;
    }
    function onHash() { setTimeout(function () { if (guardsFail()) destroy(); }, 0); }
    document.addEventListener('visibilitychange', onVis);
    global.addEventListener('resize', onResize); global.addEventListener('orientationchange', onResize);
    global.addEventListener('scroll', onResize, { passive: true });
    global.addEventListener('hashchange', onHash);
    var api = {
      svg: svg, CYCLE: CYCLE, RUN_T: RUN_T, destroy: destroy, state: function () { return { elapsed: elapsed, finished: finished, raf: !!raf, lastT: lastT }; },
      renderAt: function (t) { if (dead) return null; manual = true; stopRaf(); layout(false); return render(t); },
      layout: function () { layout(true); return A; }
    };
    if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (mq.matches && !opts.force) destroy(); });
    layout(true);
    if (!manual) raf = requestAnimationFrame(tick); else render(0);
    current = api;
    return api;
  }

  // frame-perfect hook for the preview renderer: pauses rAF and renders exactly tSec
  global.__sellChaseRenderAt = function (tSec) {
    if (!current) mount(null, { manual: true });
    return current ? current.renderAt(tSec) : null;
  };
  global.SellChase = { mount: mount, CYCLE: CYCLE, RUN_T: RUN_T, current: function () { return current; } };

  function auto() {
    if (current) return;
    var root = document.querySelector('.sell-lanes');
    if (root && document.body.classList.contains('is-sell')) mount(root);
  }
  if (!global.__sellChaseNoAuto) {
    global.addEventListener('hashchange', function () { setTimeout(auto, 120); });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else setTimeout(auto, 0);
  }
})(window);

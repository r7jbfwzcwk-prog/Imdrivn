/*!
 * IMDRIVN burnout celebration
 * window.playBurnout(lane, buttonEl, onDone)
 *
 * Plays the approved 3.5s, once-only lane burnout as a full-width fixed
 * overlay near `buttonEl`, morphs that button to a tick + "You're live!",
 * removes the overlay (the live label stays), then calls onDone.
 *
 * Lane keys: daily | 4x4 | performance | supercar  (anything else → daily)
 * Prefers-reduced-motion: skip the car, still morph the button (~240ms).
 * A second call cancels the first (previous onDone still runs).
 *
 * Optional: playBurnout.setAssetBase('https://…/assets/burnout/')
 * if the script is bundled and its src cannot be inferred.
 */
(function (root) {
  'use strict';

  var TRIGGER = 300, ENTER_END = 1000, BURN_END = 2900, EXIT_END = 3450;
  var DURATION = 3500, LIVE_AT = 2920, HIDE_AT = 2800;
  var syncRun = false;
  function armClock(sync) {
    syncRun = !!sync;
    if (syncRun) {
      /* Needle 0→8 over 3200ms. Centred at 3 (1200ms). Launch at 6.5 (2600ms). */
      TRIGGER = 0; ENTER_END = 1200; BURN_END = 2600; EXIT_END = 3500; DURATION = 3720; HIDE_AT = 3600;
    } else {
      TRIGGER = 300; ENTER_END = 1000; BURN_END = 2900; EXIT_END = 3450; DURATION = 3500; HIDE_AT = 2800;
    }
  }
  var PREVIEW_CAR_W = 318;
  var STYLE_ID = 'imdrivn-burnout-styles';
  var OVERLAY_ID = 'imdrivn-burnout-overlay';
  var TICK_PATH = 'M5 12.5l5 5 9-10';

  var LANES = {
    daily: {"lane":"daily","color":"#2F7BFF","awd":false,"dust":false,"squatDeg":-4.6,"squatBob":2.2,"squatWobble":0.7,"srcW":800,"srcH":280,"origin":{"x":391.193,"y":272.294},"rear":{"cx":136.881,"cy":210.532,"r":61.761,"sw":145.321,"sh":145.321,"scx":72.294,"scy":72.55},"front":{"cx":645.505,"cy":208.661,"r":63.633,"sw":148.257,"sh":148.257,"scx":74.495,"scy":74.349}},
    "4x4": {"lane":"4x4","color":"#1F5A32","awd":true,"dust":true,"squatDeg":-3.4,"squatBob":1.6,"squatWobble":0.45,"srcW":800,"srcH":300,"origin":{"x":428.772,"y":291.228},"rear":{"cx":189.825,"cy":229.193,"r":62.035,"sw":144.561,"sh":144.561,"scx":71.93,"scy":72},"front":{"cx":667.719,"cy":228.456,"r":62.772,"sw":145.965,"sh":145.965,"scx":72.632,"scy":72.667},"farRear":{"cx":228.772,"cy":217.263,"r":54.596,"scale":0.8800904977375564,"brightness":0.82},"farFront":{"cx":627.018,"cy":214.421,"r":60.491,"scale":0.9636668529904976,"brightness":0.82}},
    performance: {"lane":"performance","color":"#E5242B","awd":false,"dust":false,"squatDeg":-4.6,"squatBob":2.2,"squatWobble":0.7,"srcW":800,"srcH":241,"origin":{"x":406.411,"y":232.947},"rear":{"cx":171.327,"cy":173.606,"r":59.341,"sw":139.626,"sh":139.626,"scx":70.169,"scy":69.599},"front":{"cx":641.496,"cy":173.001,"r":59.947,"sw":141.051,"sh":141.051,"scx":70.169,"scy":70.419}},
    supercar: {"lane":"supercar","color":"#D9A441","awd":false,"dust":false,"squatDeg":-4.6,"squatBob":2.2,"squatWobble":0.7,"srcW":800,"srcH":217,"origin":{"x":379.983,"y":209.836},"rear":{"cx":141.156,"cy":149.991,"r":59.845,"sw":139.431,"sh":139.431,"scx":69.37,"scy":69.922},"front":{"cx":618.809,"cy":149.991,"r":59.845,"sw":139.431,"sh":139.431,"scx":69.37,"scy":69.922}}
  };

  var assetBaseOverride = null;
  var active = null;
  var smokeSprites = null;
  var dustSprites = null;

  function setAssetBase(url) {
    if (!url) { assetBaseOverride = null; return; }
    assetBaseOverride = String(url).replace(/\/?$/, '/');
  }

  function resolveLane(lane) {
    var key = String(lane || 'daily').toLowerCase();
    return LANES[key] ? key : 'daily';
  }

  function assetBase() {
    if (assetBaseOverride) return assetBaseOverride;
    try {
      if (typeof document !== 'undefined') {
        var scripts = document.getElementsByTagName('script');
        for (var i = scripts.length - 1; i >= 0; i--) {
          var src = scripts[i].src || '';
          if (/\/burnout\.js(\?|#|$)/i.test(src)) {
            return src.replace(/[^\/]+(\?.*)?$/, '');
          }
        }
      }
    } catch (e) {}
    return 'assets/burnout/';
  }

  function prefersReducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  function seeded(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInCubic(t) { return t * t * t; }
  function easeLaunch(t) {
    t = clamp(t, 0, 1);
    return 0.35 * t + 0.65 * t * t * t;
  }
  function easeOutQuad(t) { return 1 - (1 - t) * (1 - t); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rotatePt(px, py, ang) {
    var c = Math.cos(ang), s = Math.sin(ang);
    return { x: px * c - py * s, y: px * s + py * c };
  }
  function loadImg(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('Failed to load ' + src)); };
      img.src = src;
    });
  }

  function ensureStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;
    var css = document.createElement('style');
    css.id = STYLE_ID;
    css.textContent = [
      '#' + OVERLAY_ID + '{position:fixed;inset:0;width:100%;height:100%;z-index:9999;pointer-events:none;overflow:hidden;}',
      '#' + OVERLAY_ID + ' canvas{position:absolute;left:0;top:0;width:100%;height:100%;display:block;}',
      '#' + OVERLAY_ID + ' .imdrivn-burnout-car{position:absolute;left:0;top:0;will-change:transform;visibility:hidden;}',
      '#' + OVERLAY_ID + ' .imdrivn-burnout-car img{position:absolute;display:block;max-width:none;pointer-events:none;user-select:none;}',
      '#' + OVERLAY_ID + ' .imdrivn-wheel{position:absolute;overflow:visible;}',
      '#' + OVERLAY_ID + ' .imdrivn-wheel img{left:0;top:0;width:100%;height:100%;transform-origin:50% 50%;}',
      '#' + OVERLAY_ID + ' .imdrivn-wheel.far{z-index:1;}',
      '#' + OVERLAY_ID + ' .imdrivn-wheel.near{z-index:2;}',
      '#' + OVERLAY_ID + ' .imdrivn-body{z-index:5;left:0;top:0;}',
      '.imdrivn-burnout-btn-inner{display:inline-flex;align-items:center;justify-content:center;gap:8px;line-height:1;}',
      '.imdrivn-burnout-btn-inner svg{display:block;flex:0 0 auto;}'
    ].join('\n');
    document.head.appendChild(css);
  }

  function makeCloudSprite(seed, kind) {
    var size = 128;
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var ctx = c.getContext('2d');
    var rand = seeded(seed);
    var cx = size / 2, cy = size / 2;
    var i, ang, dist, x, y, r, g, a, R, G, B;
    for (i = 0; i < 14; i++) {
      ang = rand() * Math.PI * 2;
      dist = rand() * 28;
      x = cx + Math.cos(ang) * dist;
      y = cy + Math.sin(ang) * dist * 0.85;
      r = 18 + rand() * 28;
      a = 0.18 + rand() * 0.28;
      if (kind === 'dust') {
        R = 150 + (rand() * 40) | 0;
        G = 110 + (rand() * 30) | 0;
        B = 70 + (rand() * 25) | 0;
      } else {
        var v = 170 + (rand() * 50) | 0;
        R = v; G = v; B = v;
      }
      g = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
      g.addColorStop(0, 'rgba(' + R + ',' + G + ',' + B + ',' + a + ')');
      g.addColorStop(0.55, 'rgba(' + R + ',' + G + ',' + B + ',' + (a * 0.45) + ')');
      g.addColorStop(1, 'rgba(' + R + ',' + G + ',' + B + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    var img = ctx.getImageData(0, 0, size, size);
    var d = img.data;
    var mid = size / 2;
    var px, py, dx, dy, rr, fade, idx;
    for (py = 0; py < size; py++) {
      for (px = 0; px < size; px++) {
        dx = (px - mid) / (mid - 1);
        dy = (py - mid) / (mid - 1);
        rr = Math.sqrt(dx * dx + dy * dy);
        if (rr > 0.92) {
          fade = rr >= 1 ? 0 : 1 - (rr - 0.92) / 0.08;
          idx = (py * size + px) * 4 + 3;
          d[idx] = Math.round(d[idx] * Math.max(0, fade));
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function getSprites() {
    if (!smokeSprites) {
      smokeSprites = [0xA1, 0xA2, 0xA3, 0xA4].map(function (s) { return makeCloudSprite(0xB04CA1 + s, 'smoke'); });
      dustSprites = [0xC1, 0xC2, 0xC3, 0xC4].map(function (s) { return makeCloudSprite(0xD05B02 + s, 'dust'); });
    }
    return { smoke: smokeSprites, dust: dustSprites };
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'className') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    }
    return node;
  }

  function makeWheelGroup(cls) {
    var wrap = el('div', { className: 'imdrivn-wheel ' + cls });
    var sharp = el('img', { alt: '' });
    var blur = el('img', { alt: '' });
    var hot = el('img', { alt: '' });
    wrap.appendChild(sharp);
    wrap.appendChild(blur);
    wrap.appendChild(hot);
    return { el: wrap, sharp: sharp, blur: blur, hot: hot };
  }

  function setWheelLook(group, angle, vel) {
    var rot = 'rotate(' + angle.toFixed(1) + 'deg)';
    group.sharp.style.transform = rot;
    group.blur.style.transform = rot;
    group.hot.style.transform = rot;
    var s = 0, b = 0, h = 0;
    if (vel < 0.28) {
      s = 1 - vel / 0.28;
      b = vel / 0.28;
    } else {
      var u = (vel - 0.28) / 0.72;
      b = 1 - u;
      h = u;
    }
    group.sharp.style.opacity = s.toFixed(3);
    group.blur.style.opacity = b.toFixed(3);
    group.hot.style.opacity = h.toFixed(3);
  }

  function placeNearWheel(group, metaW, scale) {
    group.el.style.width = (metaW.sw * scale) + 'px';
    group.el.style.height = (metaW.sh * scale) + 'px';
    group.el.style.left = ((metaW.cx - metaW.scx) * scale) + 'px';
    group.el.style.top = ((metaW.cy - metaW.scy) * scale) + 'px';
  }

  function placeFarWheel(group, far, near, scale) {
    var size = near.sw * far.scale * scale;
    group.el.style.width = size + 'px';
    group.el.style.height = size + 'px';
    group.el.style.left = (far.cx * scale - size / 2) + 'px';
    group.el.style.top = (far.cy * scale - size / 2) + 'px';
    group.el.style.filter = 'brightness(' + far.brightness + ')';
  }

  function morphButton(buttonEl) {
    if (!buttonEl) return { tick: null, tickLen: 24 };
    if (!buttonEl.getAttribute('data-imdrivn-burnout-prev')) {
      buttonEl.setAttribute('data-imdrivn-burnout-prev', '1');
      buttonEl.setAttribute('data-imdrivn-burnout-html', buttonEl.innerHTML);
    }
    var inner = el('span', { className: 'imdrivn-burnout-btn-inner' });
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', TICK_PATH);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '2.4');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
    var label = el('span', { text: "You're live!" });
    inner.appendChild(svg);
    inner.appendChild(label);
    buttonEl.innerHTML = '';
    buttonEl.appendChild(inner);
    buttonEl.classList.add('is-live');
    buttonEl.classList.remove('is-out');
    buttonEl.setAttribute('aria-label', "You're live!");
    var tickLen = 24;
    try { tickLen = path.getTotalLength() || 24; } catch (e) {}
    path.style.strokeDasharray = String(tickLen);
    path.style.strokeDashoffset = String(tickLen);
    return { tick: path, tickLen: tickLen };
  }

  function applyButton(buttonEl, tick, tickLen, t, shortMorph) {
    if (!buttonEl) return;
    var liveAt = shortMorph ? 0 : LIVE_AT;
    var scale = 1;
    if (!shortMorph) {
      if (t >= TRIGGER && t < TRIGGER + 90) {
        scale = 1 - 0.06 * easeOutQuad((t - TRIGGER) / 90);
      } else if (t >= TRIGGER + 90 && t < TRIGGER + 280) {
        scale = 0.94 + 0.06 * easeOutCubic((t - TRIGGER - 90) / 190);
      }
    }
    var live = clamp((t - liveAt) / 240, 0, 1);
    var pop = live > 0 ? 1 + 0.04 * Math.sin(Math.min(live, 1) * Math.PI) * (1 - live) : 1;
    var s = live > 0.05 ? pop : scale;
    buttonEl.style.transform = 'scale(' + s.toFixed(3) + ')';
    var glow = live * 0.45;
    buttonEl.style.boxShadow = glow > 0.02 ? ('0 0 ' + (18 + live * 16) + 'px rgba(212,175,55,' + glow + ')') : '';
    var draw = clamp((t - liveAt + 40) / 200, 0, 1);
    if (tick) tick.style.strokeDashoffset = String(tickLen * (1 - easeOutCubic(draw)));
  }

  function finishButton(buttonEl) {
    if (!buttonEl) return;
    buttonEl.style.transform = '';
    // Keep a soft gold glow on the live state; empty string restores stylesheet.
    buttonEl.style.boxShadow = '0 0 18px rgba(212,175,55,0.35)';
  }

  function callDone(fn) {
    if (typeof fn === 'function') {
      try { fn(); } catch (e) { setTimeout(function () { throw e; }, 0); }
    }
  }

  function playReduced(buttonEl, onDone) {
    ensureStyles();
    var morph = morphButton(buttonEl);
    var start = performance.now();
    var raf = 0;
    var finished = false;
    function frame(now) {
      if (finished) return;
      var t = now - start;
      applyButton(buttonEl, morph.tick, morph.tickLen, t, true);
      if (t >= 240) {
        finished = true;
        finishButton(buttonEl);
        if (active && active.id === sessionId) active = null;
        callDone(onDone);
        return;
      }
      raf = requestAnimationFrame(frame);
    }
    var sessionId = {};
    var session = {
      id: sessionId,
      cancel: function (invokeDone) {
        if (finished) return;
        finished = true;
        if (raf) cancelAnimationFrame(raf);
        finishButton(buttonEl);
        if (active && active.id === sessionId) active = null;
        if (invokeDone !== false) callDone(onDone);
      }
    };
    active = session;
    raf = requestAnimationFrame(frame);
    return session.cancel;
  }

  function playBurnout(lane, buttonEl, onDone) {
    var key = resolveLane(lane);
    var meta = LANES[key];
    armClock(!!(buttonEl && buttonEl.dataset && buttonEl.dataset.revSync === '1'));

    if (active) {
      try { active.cancel(true); } catch (e) {}
    }

    if (typeof document === 'undefined') {
      callDone(onDone);
      return function () {};
    }

    if (prefersReducedMotion()) {
      return playReduced(buttonEl, onDone);
    }

    ensureStyles();
    var existing = document.getElementById(OVERLAY_ID);
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

    var overlay = el('div', { id: OVERLAY_ID, 'aria-hidden': 'true' });
    var skidsCv = el('canvas');
    var backCv = el('canvas');
    var frontCv = el('canvas');
    var carEl = el('div', { className: 'imdrivn-burnout-car' });
    var wheels = {
      rear: makeWheelGroup('near rear'),
      front: makeWheelGroup('near front')
    };
    if (meta.awd) {
      wheels.farRear = makeWheelGroup('far rear');
      wheels.farFront = makeWheelGroup('far front');
      carEl.appendChild(wheels.farRear.el);
      carEl.appendChild(wheels.farFront.el);
    }
    carEl.appendChild(wheels.rear.el);
    carEl.appendChild(wheels.front.el);
    var bodyImg = el('img', { className: 'imdrivn-body', alt: '' });
    carEl.appendChild(bodyImg);
    overlay.appendChild(skidsCv);
    overlay.appendChild(backCv);
    overlay.appendChild(carEl);
    overlay.appendChild(frontCv);
    document.body.appendChild(overlay);

    var kctx, bctx, fctx;
    var cssW = 0, cssH = 0;
    function fitCanvas(c) {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      cssW = window.innerWidth;
      cssH = window.innerHeight;
      c.width = Math.max(1, Math.round(cssW * dpr));
      c.height = Math.max(1, Math.round(cssH * dpr));
      c.style.width = cssW + 'px';
      c.style.height = cssH + 'px';
      var ctx = c.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return ctx;
    }
    function fitAll() {
      kctx = fitCanvas(skidsCv);
      bctx = fitCanvas(backCv);
      fctx = fitCanvas(frontCv);
    }
    fitAll();

    var displayWidth, displayScale, ORIGIN, REAR, FRONT, CAR_TOP, startX, midX, endX, FX, WHEEL_R;
    function layout() {
      var vw = window.innerWidth;
      var vh = window.innerHeight;
      var road = document.getElementById('post-road');
      var roadBox = road && road.getBoundingClientRect ? road.getBoundingClientRect() : null;
      if (roadBox && roadBox.width > 40 && roadBox.height > 40) {
        var fitW = roadBox.width * 0.78;
        var fitH = roadBox.height * 0.86;
        displayWidth = Math.min(fitW, fitH * meta.srcW / meta.srcH);
        displayScale = displayWidth / meta.srcW;
        FX = displayWidth / PREVIEW_CAR_W;
        ORIGIN = { x: meta.origin.x * displayScale, y: meta.origin.y * displayScale };
        REAR = { x: meta.rear.cx * displayScale, y: meta.rear.cy * displayScale, r: meta.rear.r * displayScale };
        FRONT = { x: meta.front.cx * displayScale, y: meta.front.cy * displayScale, r: meta.front.r * displayScale };
        WHEEL_R = REAR.r;
        midX = roadBox.left + roadBox.width / 2;
        var roadY = roadBox.top + roadBox.height * 0.84;
        startX = -displayWidth * 0.95;
        endX = vw + displayWidth * 0.8;
        CAR_TOP = roadY - ORIGIN.y;
      } else {
      displayWidth = Math.min(Math.max(260, vw * 0.72), 420);
      displayScale = displayWidth / meta.srcW;
      FX = displayWidth / PREVIEW_CAR_W;
      ORIGIN = { x: meta.origin.x * displayScale, y: meta.origin.y * displayScale };
      REAR = { x: meta.rear.cx * displayScale, y: meta.rear.cy * displayScale, r: meta.rear.r * displayScale };
      FRONT = { x: meta.front.cx * displayScale, y: meta.front.cy * displayScale, r: meta.front.r * displayScale };
      WHEEL_R = REAR.r;
      var rect = buttonEl && buttonEl.getBoundingClientRect ? buttonEl.getBoundingClientRect() : null;
      midX = rect ? rect.left + rect.width / 2 : vw / 2;
      var roadY = rect ? (rect.top - 8) : (vh * 0.62);
      startX = -displayWidth * 0.95;
      endX = vw + displayWidth * 0.8;
      CAR_TOP = roadY - ORIGIN.y;
      }
      carEl.style.width = displayWidth + 'px';
      carEl.style.height = (meta.srcH * displayScale) + 'px';
      carEl.style.top = CAR_TOP + 'px';
      carEl.style.transformOrigin = ORIGIN.x + 'px ' + ORIGIN.y + 'px';
      bodyImg.style.width = displayWidth + 'px';
      bodyImg.style.height = (meta.srcH * displayScale) + 'px';
      placeNearWheel(wheels.rear, meta.rear, displayScale);
      placeNearWheel(wheels.front, meta.front, displayScale);
      if (meta.awd) {
        placeFarWheel(wheels.farRear, meta.farRear, meta.rear, displayScale);
        placeFarWheel(wheels.farFront, meta.farFront, meta.front, displayScale);
      }
    }
    layout();

    function leftForMid(m) { return m - ORIGIN.x; }

    function carPose(t) {
      var mid = startX, rot = 0, bob = 0, shakeX = 0, shakeY = 0;
      var rearVel = 0, frontVel = 0, phase = 'idle';
      var awd = meta.awd;
      var squatDeg = meta.squatDeg;
      var squatBob = meta.squatBob;
      var squatWobble = meta.squatWobble;

      if (t < TRIGGER) { phase = 'idle'; mid = startX; }
      else if (t < ENTER_END) {
        phase = 'enter';
        var spanIn = Math.max(1, ENTER_END - TRIGGER);
        var pin = clamp((t - TRIGGER) / spanIn, 0, 1);
        var ke = syncRun ? (pin * pin * (3 - 2 * pin)) : easeOutCubic(pin);
        mid = lerp(startX, midX, ke);
        rot = lerp(1.2, 0, ke);
        bob = Math.sin(ke * Math.PI) * -1.1 * FX;
        rearVel = frontVel = syncRun ? (0.22 + (1 - ke) * 0.2) : ((1 - ke) * 0.85 + 0.2);
      } else if (t < BURN_END) {
        phase = 'burn';
        var u = (t - ENTER_END) / (BURN_END - ENTER_END);
        var squatIn = easeOutCubic(clamp(u / 0.16, 0, 1));
        mid = syncRun ? midX : (midX + u * 10 * FX);
        rot = lerp(0, squatDeg, squatIn) - squatWobble * squatIn * Math.sin(u * Math.PI * 7.5);
        shakeX = squatIn * (1.45 * Math.sin(t * 0.072) + 0.65 * Math.sin(t * 0.11)) * FX;
        shakeY = squatIn * 0.7 * Math.sin(t * 0.093) * FX;
        var bobWobble = awd ? 0.4 : 0.55;
        bob = (lerp(0, squatBob, squatIn) + bobWobble * squatIn * Math.sin(u * Math.PI * 6)) * FX;
        rearVel = 0.25 + 0.75 * squatIn;
        frontVel = awd ? rearVel : 0.08;
      } else if (t < EXIT_END) {
        phase = 'exit';
        var spanOut = Math.max(1, EXIT_END - BURN_END);
        var pOut = clamp((t - BURN_END) / spanOut, 0, 1);
        var kx = syncRun ? easeLaunch(pOut) : easeInCubic(pOut);
        var exitFrom = syncRun ? midX : (midX + 10 * FX);
        mid = lerp(exitFrom, endX, kx);
        var hop = kx < 0.18
          ? lerp(-3.4, -4.2, kx / 0.18)
          : lerp(-4.2, 2.0, easeOutQuad(Math.min(1, (kx - 0.18) / 0.45)));
        rot = hop * (1 - Math.max(0, kx - 0.7) / 0.3);
        bob = lerp(1.6, -1.2, kx) * FX;
        if (syncRun) {
          rearVel = frontVel = 1.05 + kx * 0.95;
        } else if (awd) {
          rearVel = frontVel = 0.85 + kx * 0.9;
        } else {
          rearVel = 0.75 + kx * 0.9;
          frontVel = 0.55 + kx * 0.9;
        }
      } else { phase = 'gone'; mid = endX; }

      var rearAng = 0, frontAng = 0;
      var enterDur = ENTER_END - TRIGGER, burnDur = BURN_END - ENTER_END, exitDur = EXIT_END - BURN_END;
      if (t >= TRIGGER) {
        var ke2 = easeOutCubic(Math.min((Math.min(t, ENTER_END) - TRIGGER) / enterDur, 1));
        var d = lerp(0, midX - startX, ke2);
        frontAng += d * 1.15; rearAng += d * 1.15;
      }
      if (t >= ENTER_END) {
        var tb = Math.min(t, BURN_END) - ENTER_END;
        rearAng += tb * 2.35;
        frontAng += awd ? (tb * 2.35) : (tb * 0.045 + 10 * (tb / burnDur));
      }
      if (t >= BURN_END) {
        var tx = Math.min(t, EXIT_END) - BURN_END;
        var pAng = Math.min(tx / exitDur, 1);
        var kxe = syncRun ? easeLaunch(pAng) : easeInCubic(pAng);
        var dx = lerp(0, endX - (syncRun ? midX : (midX + 10 * FX)), kxe);
        if (awd) {
          frontAng += dx * 1.25 + tx * 0.4;
          rearAng += dx * 1.25 + tx * 0.4;
        } else {
          frontAng += dx * 1.15;
          rearAng += dx * 1.25 + tx * 0.4;
        }
      }
      return { mid: mid, rot: rot, bob: bob, shakeX: shakeX, shakeY: shakeY, rearAng: rearAng, frontAng: frontAng, rearVel: rearVel, frontVel: frontVel, phase: phase };
    }

    function wheelWorld(pose, which) {
      var left = leftForMid(pose.mid) + pose.shakeX;
      var top = CAR_TOP + pose.bob + pose.shakeY;
      var originWorld = { x: left + ORIGIN.x, y: top + ORIGIN.y };
      var local = which === 'rear'
        ? { x: REAR.x - ORIGIN.x, y: REAR.y - ORIGIN.y }
        : { x: FRONT.x - ORIGIN.x, y: FRONT.y - ORIGIN.y };
      var r = rotatePt(local.x, local.y, pose.rot * Math.PI / 180);
      return { x: originWorld.x + r.x, y: originWorld.y + r.y };
    }
    function rearAt(t) { return wheelWorld(carPose(t), 'rear'); }

    function applyCar(t) {
      var pose = carPose(t);
      var x = leftForMid(pose.mid) + pose.shakeX;
      var y = pose.bob + pose.shakeY;
      if (t < TRIGGER) carEl.style.visibility = 'hidden';
      else if (pose.phase === 'gone' && t > EXIT_END) carEl.style.visibility = 'hidden';
      else carEl.style.visibility = 'visible';
      carEl.style.opacity = (t < TRIGGER) ? '0' : '1';
      carEl.style.transform = 'translate(' + x.toFixed(2) + 'px, ' + y.toFixed(2) + 'px) rotate(' + pose.rot.toFixed(2) + 'deg)';
      setWheelLook(wheels.rear, pose.rearAng, pose.rearVel);
      setWheelLook(wheels.front, pose.frontAng, pose.frontVel);
      if (meta.awd) {
        setWheelLook(wheels.farRear, pose.rearAng, pose.rearVel);
        setWheelLook(wheels.farFront, pose.frontAng, pose.frontVel);
      }
    }

    function endFade(t) {
      var at = syncRun ? EXIT_END + 80 : 3380;
      return t > at ? clamp(1 - (t - at) / (syncRun ? 220 : 120), 0, 1) : 1;
    }

    function makeSkidStrokes() {
      var rand = seeded(0x5C1D01);
      function pack(n, heavy) {
        var arr = [], i, s;
        for (i = 0; i < n; i++) {
          s = heavy
            ? { ox: -22 + rand() * 40, oy: -1.8 + rand() * 4.2, len: 18 + rand() * 36, w: 1.4 + rand() * 3.2, a: 0.28 + rand() * 0.42, wobble: (rand() - 0.5) * 2.2, col: rand() > 0.45 ? '#6a6560' : (rand() > 0.5 ? '#4a4744' : '#7a746c') }
            : { ox: -8 + rand() * 16, oy: -1.2 + rand() * 2.6, len: 10 + rand() * 16, w: 1.1 + rand() * 2.0, a: 0.16 + rand() * 0.2, wobble: (rand() - 0.5) * 1.4, col: rand() > 0.5 ? '#5c5854' : '#6e6a66' };
          arr.push(s);
        }
        return arr;
      }
      return { rear: pack(16, true), front: pack(meta.awd ? 16 : 6, !!meta.awd) };
    }
    var skidStrokes = makeSkidStrokes();

    function drawStrokeSet(ctx, strokes, origin, gy, grow, fade, heavy) {
      var n = heavy
        ? Math.max(1, Math.min(strokes.length, 2 + Math.floor((strokes.length - 2) * grow)))
        : Math.floor(strokes.length * grow);
      var i, s, x0, y0;
      for (i = 0; i < n; i++) {
        s = strokes[i];
        x0 = origin.x + s.ox * (heavy ? (0.45 + 0.55 * grow) : 1) * FX;
        y0 = gy + s.oy * FX;
        ctx.strokeStyle = s.col;
        ctx.lineWidth = s.w * FX;
        ctx.globalAlpha = (heavy ? s.a * (0.55 + 0.45 * grow) : s.a * grow) * fade;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        if (heavy) {
          ctx.quadraticCurveTo(x0 + s.len * 0.5 * FX, y0 + s.wobble * FX, x0 + s.len * (0.55 + 0.45 * grow) * FX, y0 + s.wobble * 0.4 * FX);
        } else {
          ctx.lineTo(x0 + s.len * grow * FX, y0 + s.wobble * FX);
        }
        ctx.stroke();
      }
    }

    function drawSkids(t) {
      kctx.clearRect(0, 0, cssW, cssH);
      if (t < ENTER_END) return;
      var skidAt = syncRun ? (EXIT_END - 80) : 3360;
      var fade = t > skidAt ? clamp(1 - (t - skidAt) / 160, 0, 1) : 1;
      if (fade <= 0) return;
      var u = clamp((t - ENTER_END) / (BURN_END - ENTER_END), 0, 1);
      var hold = Math.min(Math.max(t, ENTER_END), BURN_END);
      var rear = rearAt(hold);
      var front = wheelWorld(carPose(hold), 'front');
      var gyR = rear.y + WHEEL_R - 1;
      var gyF = front.y + (meta.front.r * displayScale) - 1;
      var grow = easeOutCubic(u);
      kctx.save();
      kctx.lineCap = 'round';
      kctx.lineJoin = 'round';
      kctx.globalAlpha = 0.22 * grow * fade;
      kctx.fillStyle = '#2c2a28';
      kctx.beginPath();
      kctx.ellipse(rear.x - 2 * FX, gyR, (28 + 10 * grow) * FX, 4.2 * FX, 0, 0, Math.PI * 2);
      kctx.fill();
      drawStrokeSet(kctx, skidStrokes.rear, rear, gyR, grow, fade, true);
      if (meta.awd) {
        kctx.globalAlpha = 0.22 * grow * fade;
        kctx.fillStyle = '#2c2a28';
        kctx.beginPath();
        kctx.ellipse(front.x - 2 * FX, gyF, (28 + 10 * grow) * FX, 4.2 * FX, 0, 0, Math.PI * 2);
        kctx.fill();
        drawStrokeSet(kctx, skidStrokes.front, front, gyF, grow, fade, true);
      } else {
        kctx.globalAlpha = 0.12 * grow * fade;
        kctx.fillStyle = '#2a2826';
        kctx.beginPath();
        kctx.ellipse(front.x, gyF, (12 + 6 * grow) * FX, 2.6 * FX, 0, 0, Math.PI * 2);
        kctx.fill();
        drawStrokeSet(kctx, skidStrokes.front, front, gyF, grow, fade, false);
      }
      kctx.restore();
    }

    function makeSmoke() {
      var rand = seeded(0xB04CA1);
      var puffs = [];
      var i, u;
      for (i = 0; i < 28; i++) {
        u = rand();
        puffs.push({ spawn: ENTER_END - 20 + u * (BURN_END - ENTER_END + 80), life: 420 + rand() * 280, ox: -4 - rand() * 10, oy: 8 + rand() * 8, vx: -(8 + rand() * 28), vy: -(6 + rand() * 22), s0: 0.10 + rand() * 0.10, s1: 0.28 + rand() * 0.18, a0: 0.22 + rand() * 0.18, rot0: rand() * Math.PI * 2, vr: (rand() - 0.5) * 0.9, sprite: (rand() * 4) | 0, layer: rand() > 0.35 ? 'back' : 'front' });
      }
      for (i = 0; i < 62; i++) {
        u = rand();
        puffs.push({ spawn: ENTER_END + u * (BURN_END - ENTER_END), life: 680 + rand() * 400, ox: -6 - rand() * 20, oy: 0 + rand() * 10, vx: -(14 + rand() * 48), vy: -(22 + rand() * 64), s0: 0.16 + rand() * 0.14, s1: 0.52 + rand() * 0.42, a0: 0.14 + rand() * 0.15, rot0: rand() * Math.PI * 2, vr: (rand() - 0.5) * 0.7, sprite: (rand() * 4) | 0, layer: rand() > 0.45 ? 'back' : 'front' });
      }
      for (i = 0; i < 14; i++) {
        u = rand();
        puffs.push({ spawn: BURN_END + u * 260, life: 480 + rand() * 260, ox: -4 - rand() * 12, oy: 2 + rand() * 8, vx: -(8 + rand() * 24), vy: -(8 + rand() * 28), s0: 0.16 + rand() * 0.10, s1: 0.42 + rand() * 0.28, a0: 0.12 + rand() * 0.10, rot0: rand() * Math.PI * 2, vr: (rand() - 0.5) * 0.5, sprite: (rand() * 4) | 0, layer: rand() > 0.5 ? 'back' : 'front' });
      }
      if (syncRun) {
        var span = Math.max(1, EXIT_END - BURN_END);
        for (i = 0; i < 26; i++) {
          u = Math.pow(rand(), 1.25);
          puffs.push({ spawn: BURN_END + u * span * 0.82, life: 640 + rand() * 280, ox: -6 - rand() * 16, oy: 6 + rand() * 8, vx: -(28 + rand() * 72), vy: -(10 + rand() * 36), s0: 0.14 + rand() * 0.10, s1: 0.48 + rand() * 0.30, a0: 0.18 + rand() * 0.14, rot0: rand() * Math.PI * 2, vr: (rand() - 0.5) * 0.6, sprite: (rand() * 4) | 0, layer: rand() > 0.4 ? 'back' : 'front' });
        }
      }
      if (meta.dust) {
        for (i = 0; i < 36; i++) {
          u = rand();
          puffs.push({ spawn: ENTER_END + u * (BURN_END - ENTER_END), life: 700 + rand() * 420, ox: -8 - rand() * 22, oy: 10 + rand() * 10, vx: -(18 + rand() * 56), vy: -(8 + rand() * 28), s0: 0.18 + rand() * 0.14, s1: 0.55 + rand() * 0.45, a0: 0.16 + rand() * 0.16, rot0: rand() * Math.PI * 2, vr: (rand() - 0.5) * 0.7, sprite: (rand() * 4) | 0, layer: rand() > 0.35 ? 'back' : 'front', dust: true });
        }
      }
      if (meta.awd) {
        var extras = [];
        for (i = 0; i < puffs.length; i++) {
          extras.push(Object.assign({}, puffs[i], { axle: 'front', spawn: puffs[i].spawn + 30 + (puffs[i].ox || 0) }));
        }
        for (i = 0; i < extras.length; i++) puffs.push(extras[i]);
      }
      return puffs;
    }
    function makeSparks() {
      var rand = seeded(0x5A4B17);
      var sparks = [];
      var i;
      for (i = 0; i < 34; i++) {
        sparks.push({ spawn: ENTER_END + 40 + rand() * (BURN_END - ENTER_END + 80), life: 180 + rand() * 220, vx: -(90 + rand() * 300), vy: -(30 + rand() * 170) + (rand() - 0.4) * 36, size: 0.8 + rand() * 1.2, color: rand() > 0.3 ? '#F3E5AB' : '#D4AF37', hot: rand() > 0.55 });
      }
      if (meta.awd) {
        for (i = 0; i < sparks.length; i++) {
          if (i % 3 === 0) sparks[i].axle = 'front';
        }
      }
      return sparks;
    }
    var puffs = makeSmoke();
    var sparks = makeSparks();
    var sprites = getSprites();

    function drawPuffs(ctx, layer, t) {
      ctx.clearRect(0, 0, cssW, cssH);
      if (t < ENTER_END - 50) return;
      var releaseAt = syncRun ? EXIT_END : BURN_END;
      var dissipate = t > releaseAt ? clamp(1 - (t - releaseAt) / (syncRun ? 480 : 560), 0, 1) : 1;
      var fadeAll = endFade(t) * dissipate;
      if (fadeAll <= 0.01) return;
      var i, p, age, origin, k, grow, sc, x, y, fade, alpha, bank, img, w, h;
      for (i = 0; i < puffs.length; i++) {
        p = puffs[i];
        if (p.layer !== layer) continue;
        age = t - p.spawn;
        if (age <= 0 || age > p.life) continue;
        origin = (p.axle === 'front')
          ? wheelWorld(carPose(clamp(p.spawn, TRIGGER, EXIT_END)), 'front')
          : rearAt(clamp(p.spawn, TRIGGER, EXIT_END));
        k = age / p.life;
        grow = easeOutCubic(k);
        sc = p.s0 + (p.s1 - p.s0) * grow;
        x = origin.x + (p.ox + p.vx * (age / 1000)) * FX;
        y = origin.y + (p.oy + 16 + p.vy * (age / 1000) - 6 * k * k) * FX;
        fade = k < 0.10 ? k / 0.10 : k > 0.42 ? 1 - (k - 0.42) / 0.58 : 1;
        alpha = p.a0 * Math.max(0, fade) * fadeAll;
        if (alpha < 0.015) continue;
        bank = (p.dust && sprites.dust) ? sprites.dust : sprites.smoke;
        img = bank[p.sprite % bank.length];
        w = 150 * sc * FX;
        h = 150 * sc * FX;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.rot0 + p.vr * k);
        ctx.globalAlpha = alpha;
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();
      }
    }

    function drawSparks(t) {
      if (t < ENTER_END) return;
      var fadeAll = endFade(t);
      var i, p, age, life, origin, x, y, k, alpha, ang, len;
      for (i = 0; i < sparks.length; i++) {
        p = sparks[i];
        age = (t - p.spawn) / 1000;
        if (age <= 0) continue;
        life = p.life / 1000;
        if (age > life) continue;
        origin = (p.axle === 'front')
          ? wheelWorld(carPose(p.spawn), 'front')
          : rearAt(p.spawn);
        x = origin.x + p.vx * age * FX;
        y = origin.y + (16 + p.vy * age + 0.5 * 900 * age * age) * FX;
        k = age / life;
        alpha = (1 - k) * (k < 0.08 ? k / 0.08 : 1) * fadeAll;
        ang = Math.atan2(p.vy + 900 * age, p.vx);
        len = p.size * (3.2 + 4.5 * (1 - k)) * FX;
        fctx.save();
        fctx.translate(x, y);
        fctx.rotate(ang);
        fctx.globalAlpha = Math.max(0, alpha);
        fctx.strokeStyle = p.hot ? '#fff6d2' : p.color;
        fctx.shadowColor = '#D4AF37';
        fctx.shadowBlur = 6 * FX;
        fctx.lineWidth = p.size * FX;
        fctx.lineCap = 'round';
        fctx.beginPath();
        fctx.moveTo(-len, 0);
        fctx.lineTo(len * 0.35, 0);
        fctx.stroke();
        fctx.fillStyle = '#fff';
        fctx.beginPath();
        fctx.arc(len * 0.2, 0, p.size * 0.5 * FX, 0, Math.PI * 2);
        fctx.fill();
        fctx.restore();
      }
    }

    function renderAt(t) {
      var tt = Math.max(0, Math.min(t, DURATION - 1));
      applyCar(tt);
      applyButton(buttonEl, morph.tick, morph.tickLen, tt, false);
      drawSkids(tt);
      drawPuffs(bctx, 'back', tt);
      fctx.clearRect(0, 0, cssW, cssH);
      drawPuffs(fctx, 'front', tt);
      drawSparks(tt);
    }

    var morph = { tick: null, tickLen: 24 };
    var raf = 0;
    var startTime = 0;
    var finished = false;
    var sessionId = {};
    var onResize = function () { fitAll(); layout(); };

    function cleanupOverlay() {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
      var node = document.getElementById(OVERLAY_ID);
      if (node && node.parentNode) node.parentNode.removeChild(node);
      finishButton(buttonEl);
    }

    function finish(invokeDone) {
      if (finished) return;
      finished = true;
      cleanupOverlay();
      if (active && active.id === sessionId) active = null;
      if (invokeDone !== false) callDone(onDone);
    }

    var session = {
      id: sessionId,
      cancel: function (invokeDone) { finish(invokeDone !== false); }
    };
    active = session;

    var base = assetBase();
    var folder = base + key + '/';
    var jobs = [
      loadImg(folder + 'body.webp'),
      loadImg(folder + 'wheel-rear.webp'),
      loadImg(folder + 'wheel-rear-blur.webp'),
      loadImg(folder + 'wheel-rear-hot.webp'),
      loadImg(folder + 'wheel-front.webp'),
      loadImg(folder + 'wheel-front-blur.webp'),
      loadImg(folder + 'wheel-front-hot.webp')
    ];

    Promise.all(jobs).then(function (imgs) {
      if (finished) return;
      bodyImg.src = imgs[0].src;
      wheels.rear.sharp.src = imgs[1].src;
      wheels.rear.blur.src = imgs[2].src;
      wheels.rear.hot.src = imgs[3].src;
      wheels.front.sharp.src = imgs[4].src;
      wheels.front.blur.src = imgs[5].src;
      wheels.front.hot.src = imgs[6].src;
      if (meta.awd) {
        wheels.farRear.sharp.src = imgs[1].src;
        wheels.farRear.blur.src = imgs[2].src;
        wheels.farRear.hot.src = imgs[3].src;
        wheels.farFront.sharp.src = imgs[4].src;
        wheels.farFront.blur.src = imgs[5].src;
        wheels.farFront.hot.src = imgs[6].src;
      }
      var deferLive = !!(buttonEl && buttonEl.dataset && buttonEl.dataset.revDefer === '1');
      if (deferLive && !syncRun) buttonEl.classList.add('is-out');
      else if (!deferLive) morph = morphButton(buttonEl);
      layout();
      window.addEventListener('resize', onResize);
      window.addEventListener('scroll', onResize, true);
      startTime = performance.now();
      if (syncRun && buttonEl) buttonEl.dataset.revStamp = String(startTime);
      var liveHeld = 0;
      function drawScene(t) {
        var tt = Math.max(0, Math.min(t, DURATION - 1));
        applyCar(tt);
        drawSkids(tt);
        drawPuffs(bctx, 'back', tt);
        fctx.clearRect(0, 0, cssW, cssH);
        drawPuffs(fctx, 'front', tt);
        drawSparks(tt);
      }
      function tick(now) {
        if (finished) return;
        var t = now - startTime;
        if (deferLive) {
          drawScene(t);
          if (syncRun && t >= HIDE_AT && t < DURATION && buttonEl) buttonEl.classList.add('is-out');
          if (t >= DURATION && !liveHeld) {
            morph = morphButton(buttonEl);
            applyButton(buttonEl, morph.tick, morph.tickLen, DURATION, false);
            liveHeld = now + 700;
          } else if (liveHeld) {
            applyButton(buttonEl, morph.tick, morph.tickLen, DURATION, false);
            if (now >= liveHeld) { finish(true); return; }
          }
          raf = requestAnimationFrame(tick);
          return;
        }
        renderAt(t);
        if (t >= DURATION) {
          finish(true);
          return;
        }
        raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
    }).catch(function () {
      // Assets failed: still morph the button so the poster is not left hanging.
      if (finished) return;
      morph = morphButton(buttonEl);
      var t0 = performance.now();
      function tick(now) {
        if (finished) return;
        applyButton(buttonEl, morph.tick, morph.tickLen, now - t0, true);
        if (now - t0 >= 240) { finish(true); return; }
        raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
    });

    return session.cancel;
  }

  function mountParked(lane, host) {
    if (!host || typeof document === 'undefined') return;
    var key = resolveLane(lane);
    var meta = LANES[key];
    var old = host.querySelector('.post-park');
    if (old) old.remove();
    var car = el('div', { className: 'post-park' });
    var wheels = {
      rear: makeWheelGroup('near rear'),
      front: makeWheelGroup('near front')
    };
    if (meta.awd) {
      wheels.farRear = makeWheelGroup('far rear');
      wheels.farFront = makeWheelGroup('far front');
      car.appendChild(wheels.farRear.el);
      car.appendChild(wheels.farFront.el);
    }
    car.appendChild(wheels.rear.el);
    car.appendChild(wheels.front.el);
    var bodyImg = el('img', { className: 'imdrivn-body', alt: '' });
    car.appendChild(bodyImg);
    host.appendChild(car);
    var base = assetBase() + key + '/';
    var imgs = {};
    function place() {
      var boxW = host.clientWidth || 320;
      var boxH = host.clientHeight || 180;
      var w = boxW * 0.78;
      var h = meta.srcH * (w / meta.srcW);
      var maxH = boxH * 0.88;
      if (h > maxH) { h = maxH; w = h * meta.srcW / meta.srcH; }
      var scale = w / meta.srcW;
      car.style.width = w + 'px';
      car.style.height = h + 'px';
      car.style.left = ((boxW - w) / 2) + 'px';
      var roadY = boxH * 0.84;
      car.style.top = (roadY - meta.origin.y * scale) + 'px';
      bodyImg.style.width = w + 'px';
      bodyImg.style.height = h + 'px';
      placeNearWheel(wheels.rear, meta.rear, scale);
      placeNearWheel(wheels.front, meta.front, scale);
      if (meta.awd) {
        placeFarWheel(wheels.farRear, meta.farRear, meta.rear, scale);
        placeFarWheel(wheels.farFront, meta.farFront, meta.front, scale);
      }
      setWheelLook(wheels.rear, 0, 0);
      setWheelLook(wheels.front, 0, 0);
      if (meta.awd) {
        setWheelLook(wheels.farRear, 0, 0);
        setWheelLook(wheels.farFront, 0, 0);
      }
    }
    Promise.all([
      loadImg(base + 'body.webp'),
      loadImg(base + 'wheel-rear.webp'),
      loadImg(base + 'wheel-front.webp')
    ]).then(function (loaded) {
      if (!car.isConnected) return;
      bodyImg.src = loaded[0].src;
      wheels.rear.sharp.src = loaded[1].src;
      wheels.front.sharp.src = loaded[2].src;
      if (meta.awd) {
        wheels.farRear.sharp.src = loaded[1].src;
        wheels.farFront.sharp.src = loaded[2].src;
      }
      imgs.ready = true;
      place();
    }).catch(function () {});
    host._postPlace = place;
    if (typeof ResizeObserver !== 'undefined') {
      var ro = new ResizeObserver(function () { if (imgs.ready) place(); });
      ro.observe(host);
      car._ro = ro;
    }
    return car;
  }

  function warm(lane) {
    var key = resolveLane(lane);
    var base = assetBase() + key + '/';
    ['body.webp', 'wheel-rear.webp', 'wheel-rear-blur.webp', 'wheel-rear-hot.webp', 'wheel-front.webp', 'wheel-front-blur.webp', 'wheel-front-hot.webp'].forEach(function (name) {
      loadImg(base + name).catch(function () {});
    });
  }
  playBurnout.warm = warm;
  playBurnout.mountParked = mountParked;
  playBurnout.setAssetBase = setAssetBase;
  playBurnout.LANES = ['daily', '4x4', 'performance', 'supercar'];
  playBurnout.cancel = function () {
    if (active) active.cancel(true);
  };

  if (typeof exports === 'object') {
    exports.playBurnout = playBurnout;
    exports.setAssetBase = setAssetBase;
  }
  if (root) root.playBurnout = playBurnout;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

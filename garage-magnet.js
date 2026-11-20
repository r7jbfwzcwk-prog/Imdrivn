/* Desktop magnetic GO TO MY GARAGE on #/sell.
   Mounts arrow C if needed, then pulls the button toward the cursor.
   Desktop + fine pointer + hover only. Touch / mobile / reduced-motion: no movement.
   Pulse (sell-garage-heart) is left at 1× so it stays in sync with the text. */
(function (global) {
  var RANGE = 150;
  var MAX = 18;
  var LERP = 0.18;
  var STIFF = 0.22;
  var DAMP = 0.76;
  var SETTLE = 0.12;
  var TEXT_PAR = 0.65;
  var ARROW_SLIDE = 7;
  var ARROW_LEAN = 7;
  var FLOW_RATE = 2.2;

  var SVG_C =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 106 36" aria-hidden="true" focusable="false" fill="currentColor" color="#d9a441" overflow="visible">' +
      '<path d="M 0 2 L 24 18 L 0 34 L 14 34 L 38 18 L 14 2 Z"/>' +
      '<path d="M 32 2 L 56 18 L 32 34 L 46 34 L 70 18 L 46 2 Z"/>' +
      '<path d="M 64 2 L 88 18 L 64 34 L 78 34 L 102 18 L 78 2 Z"/>' +
    '</svg>';

  var state = null;

  function mq() {
    return {
      desk: global.matchMedia('(min-width: 769px)').matches,
      fine: global.matchMedia('(hover: hover) and (pointer: fine)').matches,
      reduce: global.matchMedia('(prefers-reduced-motion: reduce)').matches,
      sell: document.body.classList.contains('is-sell') || (global.location.hash || '') === '#/sell'
    };
  }

  function isSellDesktop() { var m = mq(); return m.desk && m.sell; }
  function magnetOk() { var m = mq(); return m.desk && m.fine && !m.reduce && m.sell; }

  function syncGlow(svg, text) {
    if (!svg || !text || !text.getAnimations) return;
    var ta = text.getAnimations().filter(function (a) { return a.playState !== 'idle'; });
    var aa = svg.getAnimations ? svg.getAnimations() : [];
    if (!ta.length || !aa.length || ta[0].currentTime == null) return;
    aa.forEach(function (a) { try { a.currentTime = ta[0].currentTime; } catch (e) {} });
  }

  function mountArrow() {
    if (!isSellDesktop()) return null;
    var host = document.querySelector('.sell-garage-desk');
    if (!host) return null;
    var existing = host.querySelector('.sell-garage-arrow');
    if (existing) return existing;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    var wrap = document.createElement('span');
    wrap.className = 'sell-garage-arrow';
    wrap.setAttribute('aria-hidden', 'true');
    var nudge = document.createElement('span');
    nudge.className = 'sell-garage-arrow-nudge';
    nudge.innerHTML = SVG_C;
    wrap.appendChild(nudge);
    host.appendChild(wrap);
    var svg = wrap.querySelector('svg');
    var cta = host.querySelector('.sell-garage-cta');
    requestAnimationFrame(function () { syncGlow(svg, cta); });
    return wrap;
  }

  function layoutBox(el, ox, oy) {
    var r = el.getBoundingClientRect();
    return { left: r.left - ox, top: r.top - oy, right: r.right - ox, bottom: r.bottom - oy, width: r.width, height: r.height };
  }

  function distToRect(px, py, r) {
    var dx = 0, dy = 0;
    if (px < r.left) dx = r.left - px;
    else if (px > r.right) dx = px - r.right;
    if (py < r.top) dy = r.top - py;
    else if (py > r.bottom) dy = py - r.bottom;
    return Math.hypot(dx, dy);
  }

  function setFlow(el, rate) {
    if (!el || !el.getAnimations) return;
    el.getAnimations().forEach(function (a) { try { a.playbackRate = rate; } catch (e) {} });
  }


  function clampToEdges(s) {
    var desk = s.desk, cta = s.cta, arrow = s.arrow;
    var box = layoutBox(desk, s.x, s.y);
    var ctaOffX = s.x * (1 + TEXT_PAR), ctaOffY = s.y * (1 + TEXT_PAR);
    var ctaBox = cta ? layoutBox(cta, ctaOffX, ctaOffY) : box;
    var arrowBox = arrow ? layoutBox(arrow, s.x, s.y) : null;
    var PAD = 8;
    var maxRight = global.innerWidth - PAD;
    var maxBottom = global.innerHeight - PAD;
    var topEl = document.querySelector('.top');
    var minTop = PAD;
    if (topEl) minTop = Math.max(minTop, topEl.getBoundingClientRect().bottom + 4);
    var h1 = document.querySelector('.sell-intro h1');
    var minLeft = PAD;
    if (h1) minLeft = Math.max(minLeft, h1.getBoundingClientRect().right + 12);
    var par = 1 + TEXT_PAR;
    // Text is the rightmost and can overshoot the desk by TEXT_PAR.
    var roomRight = (maxRight - ctaBox.right) / par;
    var roomLeftDesk = box.left - minLeft;
    var roomLeftArrow = arrowBox ? (arrowBox.left - minLeft) : roomLeftDesk;
    var roomLeft = Math.min(roomLeftDesk, roomLeftArrow);
    var roomDown = Math.min((maxBottom - box.bottom), (maxBottom - ctaBox.bottom) / par);
    var roomUpDesk = box.top - minTop;
    var roomUpCta = (ctaBox.top - minTop) / par;
    var roomUp = Math.min(roomUpDesk, roomUpCta);
    if (s.tx > roomRight) s.tx = Math.max(0, roomRight);
    if (s.tx < -roomLeft) s.tx = -Math.max(0, roomLeft);
    if (s.ty > roomDown) s.ty = Math.max(0, roomDown);
    if (s.ty < -roomUp) s.ty = -Math.max(0, roomUp);
  }

  function start() {
    stop();
    mountArrow();
    var desk = document.querySelector('.sell-garage-desk');
    if (!desk) return;
    var cta = desk.querySelector('.sell-garage-cta');
    var arrow = desk.querySelector('.sell-garage-arrow');
    var nudge = desk.querySelector('.sell-garage-arrow-nudge');
    var s = {
      desk: desk, cta: cta, arrow: arrow, nudge: nudge,
      x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0,
      engaged: false, mx: 0, my: 0, hasPtr: false, raf: 0
    };
    state = s;

    function apply() {
      desk.style.transform = 'translate3d(' + s.x.toFixed(2) + 'px,' + s.y.toFixed(2) + 'px,0)';
      if (cta) {
        cta.style.transform = 'translate3d(' + (s.x * TEXT_PAR).toFixed(2) + 'px,' + (s.y * TEXT_PAR).toFixed(2) + 'px,0)';
      }
      if (arrow) {
        var on = s.engaged ? 1 : Math.min(1, Math.hypot(s.x, s.y) / 2);
        var ax = ARROW_SLIDE * on + s.x * 0.15;
        var ay = s.y * 0.15;
        var lean = (s.engaged ? (s.tx / MAX) : (s.x / MAX)) * ARROW_LEAN;
        arrow.style.transform = 'translateY(-50%) translate3d(' + ax.toFixed(2) + 'px,' + ay.toFixed(2) + 'px,0) skewX(' + (-lean).toFixed(2) + 'deg)';
      }
    }

    function tick() {
      s.raf = 0;
      if (!state || state !== s) return;
      if (!magnetOk()) { springToRest(true); return; }
      var moving;
      if (s.engaged) {
        s.x += (s.tx - s.x) * LERP;
        s.y += (s.ty - s.y) * LERP;
        s.vx = s.tx - s.x;
        s.vy = s.ty - s.y;
        moving = Math.abs(s.tx - s.x) > 0.05 || Math.abs(s.ty - s.y) > 0.05;
      } else {
        s.vx += (0 - s.x) * STIFF;
        s.vy += (0 - s.y) * STIFF;
        s.vx *= DAMP;
        s.vy *= DAMP;
        s.x += s.vx;
        s.y += s.vy;
        moving = Math.abs(s.x) > SETTLE || Math.abs(s.y) > SETTLE || Math.abs(s.vx) > 0.05 || Math.abs(s.vy) > 0.05;
        if (!moving) { s.x = 0; s.y = 0; s.vx = 0; s.vy = 0; }
      }
      apply();
      if (moving || s.engaged) s.raf = requestAnimationFrame(tick);
    }

    function arm() { if (!s.raf) s.raf = requestAnimationFrame(tick); }

    function targetFromPointer(px, py) {
      var box = layoutBox(desk, s.x, s.y);
      var dist = distToRect(px, py, box);
      if (dist > RANGE) return false;
      var cx = box.left + box.width / 2;
      var cy = box.top + box.height / 2;
      var strength = 1 - dist / RANGE;
      strength = strength * strength * (3 - 2 * strength);
      s.tx = Math.max(-MAX, Math.min(MAX, (px - cx) / RANGE * MAX * (0.55 + 0.45 * strength) * 1.15));
      s.ty = Math.max(-MAX, Math.min(MAX, (py - cy) / RANGE * MAX * (0.55 + 0.45 * strength) * 1.15));
      clampToEdges(s);
      return true;
    }

    function setEngaged(on) {
      if (s.engaged === on) return;
      s.engaged = on;
      desk.classList.toggle('is-magnet', on);
      setFlow(nudge, on ? FLOW_RATE : 1);
    }

    function onMove(e) {
      if (!magnetOk()) return;
      if (e.pointerType && e.pointerType !== 'mouse') return;
      s.hasPtr = true;
      s.mx = e.clientX;
      s.my = e.clientY;
      var on = targetFromPointer(s.mx, s.my);
      setEngaged(on);
      if (!on) { s.tx = 0; s.ty = 0; }
      arm();
    }

    function onLeave() {
      s.hasPtr = false;
      setEngaged(false);
      s.tx = 0;
      s.ty = 0;
      arm();
    }

    function springToRest(clear) {
      setEngaged(false);
      s.tx = 0; s.ty = 0; s.x = 0; s.y = 0; s.vx = 0; s.vy = 0;
      if (clear) {
        desk.style.transform = '';
        if (cta) cta.style.transform = '';
        if (arrow) arrow.style.transform = '';
      } else apply();
    }

    s.onMove = onMove;
    s.onLeave = onLeave;
    s.onBlur = onLeave;
    global.addEventListener('pointermove', onMove, { passive: true });
    global.addEventListener('pointerleave', onLeave, { passive: true });
    global.addEventListener('blur', s.onBlur);
    apply();
  }

  function stop() {
    if (!state) return;
    var s = state;
    state = null;
    if (s.raf) cancelAnimationFrame(s.raf);
    global.removeEventListener('pointermove', s.onMove);
    global.removeEventListener('pointerleave', s.onLeave);
    global.removeEventListener('blur', s.onBlur);
    s.desk.classList.remove('is-magnet');
    setFlow(s.nudge, 1);
    s.desk.style.transform = '';
    if (s.cta) s.cta.style.transform = '';
    if (s.arrow) s.arrow.style.transform = '';
  }

  function unmountArrow() {
    document.querySelectorAll('.sell-garage-arrow').forEach(function (el) { el.remove(); });
  }

  function refresh() {
    var m = mq();
    if (!m.sell || !m.desk) { stop(); unmountArrow(); return; }
    mountArrow();
    if (m.fine && !m.reduce) start();
    else stop();
  }

  var ro;
  function init() {
    refresh();
    if (!init._bound) {
      init._bound = 1;
      global.addEventListener('hashchange', refresh);
      global.addEventListener('resize', refresh);
    }
  }

  global.SellGarageMagnet = { mount: init, unmount: function () { stop(); unmountArrow(); }, refresh: refresh };
  if (!global.__sellGarageMagnetNoAuto) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
})(typeof window !== 'undefined' ? window : this);

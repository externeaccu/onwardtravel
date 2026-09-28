/* overview.js — Magic Beyond Himalaya V2
 * The home-page hero map: all eight routes drawn as amber threads across
 * central and eastern Nepal. Each route is a link to its trek page; hover or
 * keyboard focus lifts it and names it in the caption underneath.
 *
 *   MBH.OverviewMap(container, treks) → { destroy(), el }
 *
 * Pure inline SVG built with DOM APIs, colours only through CSS classes that
 * read theme tokens (styles.css, "Overview map"). Rebuilds on resize so text
 * stays at real pixel sizes. The resting state is complete: a faint copy of
 * every route is visible from the first frame and the bright line draws over
 * it once, on mount (skipped under reduced motion).
 */
(function () {
  'use strict';

  var MBH = window.MBH = window.MBH || {};
  var NS = 'http://www.w3.org/2000/svg';

  // Reference points that are not trek waypoints. Names only, no heights:
  // every altitude on the site comes from the itinerary data.
  var PLACES = [
    { name: 'Kathmandu', lat: 27.717, lng: 85.324, kind: 'city', dx: 8, dy: 4, anchor: 'start' },
    { name: 'Pokhara', lat: 28.209, lng: 83.986, kind: 'city', dx: 8, dy: 12, anchor: 'start' }
  ];
  var PEAKS = [
    { name: 'Annapurna I', lat: 28.596, lng: 83.82, dx: 0, dy: -9, anchor: 'middle' },
    { name: 'Manaslu', lat: 28.55, lng: 84.559, dx: 0, dy: -9, anchor: 'middle' },
    { name: 'Langtang Lirung', lat: 28.256, lng: 85.519, dx: 0, dy: -9, anchor: 'middle' },
    { name: 'Everest', lat: 27.988, lng: 86.925, dx: 8, dy: 4, anchor: 'start' }
  ];

  function media(q) { try { return !!(window.matchMedia && window.matchMedia(q).matches); } catch (e) { return false; } }
  function reducedMotion() { return media('(prefers-reduced-motion: reduce)'); }
  function num(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function r1(v) { return Math.round(v * 10) / 10; }
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, str, attrs) {
    var t = el('text', attrs, parent);
    t.setAttribute('x', r1(x));
    t.setAttribute('y', r1(y));
    t.textContent = str;
    return t;
  }
  function regionOf(trek) { return String(trek.region || '').split('·')[0].trim(); }
  function maxElev(trek) {
    if (typeof trek.maxElev === 'number') return trek.maxElev;
    var m = 0;
    (trek.days_data || []).forEach(function (d) { m = Math.max(m, d.alt || 0); });
    return m;
  }

  function OverviewMap(container, treks) {
    treks = (treks || []).filter(function (t) { return t && Array.isArray(t.route) && t.route.length > 1; });
    var root = document.createElement('figure');
    root.className = 'hmap';
    var stage = document.createElement('div');
    stage.className = 'hmap__stage';
    root.appendChild(stage);
    var cap = document.createElement('figcaption');
    cap.className = 'hmap__caption';
    var capMain = document.createElement('span');
    capMain.className = 'hmap__caption-main';
    var capNote = document.createElement('span');
    capNote.className = 'hmap__caption-note';
    capNote.textContent = 'Sketch map, not for navigation';
    cap.appendChild(capMain);
    cap.appendChild(capNote);
    root.appendChild(cap);
    container.appendChild(root);

    var regions = [];
    treks.forEach(function (t) { var r = regionOf(t); if (r && regions.indexOf(r) < 0) regions.push(r); });
    var idle = treks.length + ' routes across ' + regions.length + ' regions. Pick one to open it.';
    var active = null;
    var drawn = false;
    var dead = false;
    var lastW = 0;
    var raf = 0;

    function setCaption(t) {
      capMain.textContent = '';
      if (!t) { capMain.textContent = idle; return; }
      var name = document.createElement('strong');
      name.textContent = t.name;
      capMain.appendChild(name);
      capMain.appendChild(document.createTextNode(' · ' + t.days + ' days · up to ' + num(maxElev(t)) + ' m · from $' + t.fromPrice));
    }
    function activate(id) {
      active = id;
      var svg = stage.querySelector('svg');
      if (!svg) return;
      svg.classList.toggle('has-active', !!id);
      Array.prototype.forEach.call(svg.querySelectorAll('.hmap__route'), function (g) {
        var on = g.getAttribute('data-trek') === id;
        g.classList.toggle('is-active', on);     // never re-parent: that would drop keyboard focus
      });
      setCaption(id ? treks.filter(function (t) { return t.id === id; })[0] : null);
    }

    function build() {
      var W = Math.round(stage.clientWidth || container.clientWidth || 0);
      if (!W || dead) return;
      lastW = W;
      var narrow = W < 560;
      var H = Math.round(Math.max(narrow ? 190 : 240, Math.min(W / 2.35, 420)));

      // Bounding box over every waypoint plus the reference points.
      var lat0 = 90, lat1 = -90, lng0 = 180, lng1 = -180;
      function grow(p) { lat0 = Math.min(lat0, p.lat); lat1 = Math.max(lat1, p.lat); lng0 = Math.min(lng0, p.lng); lng1 = Math.max(lng1, p.lng); }
      treks.forEach(function (t) { t.route.forEach(grow); });
      PLACES.forEach(grow);
      PEAKS.forEach(grow);
      var kx = Math.cos(((lat0 + lat1) / 2) * Math.PI / 180);
      var padX = narrow ? 18 : 40, padT = narrow ? 30 : 40, padB = narrow ? 18 : 26;
      var spanX = (lng1 - lng0) * kx, spanY = lat1 - lat0;
      var k = Math.min((W - 2 * padX) / spanX, (H - padT - padB) / spanY);
      var offX = (W - spanX * k) / 2, offY = padT + ((H - padT - padB) - spanY * k) / 2;
      function X(lng) { return offX + (lng - lng0) * kx * k; }
      function Y(lat) { return offY + (lat1 - lat) * k; }

      stage.textContent = '';
      var svg = el('svg', {
        viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, 'class': 'hmap__svg',
        role: 'group', 'aria-label': 'Map of the eight trekking routes in Nepal'
      }, stage);
      el('rect', { x: 0, y: 0, width: W, height: H, 'class': 'hmap__paper' }, svg);

      // Graticule every half degree.
      var grid = el('g', { 'class': 'hmap__grid', 'aria-hidden': 'true' }, svg);
      for (var g = Math.ceil(lng0 * 2) / 2; g <= lng1 + 0.5; g += 0.5) { var gx = r1(X(g)); if (gx > 0 && gx < W) el('line', { x1: gx, y1: 0, x2: gx, y2: H }, grid); }
      for (var h = Math.ceil((lat0 - 0.5) * 2) / 2; h <= lat1 + 0.5; h += 0.5) { var gy = r1(Y(h)); if (gy > 0 && gy < H) el('line', { x1: 0, y1: gy, x2: W, y2: gy }, grid); }

      // Label boxes placed so far; peak names try four spots and skip any that collide.
      var taken = [];
      function hits(b) { for (var q = 0; q < taken.length; q++) { var o = taken[q]; if (b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0) return true; } return false; }
      function box(x, y, w, hgt, anchor) {
        var x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
        return { x0: x0 - 2, x1: x0 + w + 2, y0: y - hgt, y1: y + 3 };
      }
      var regionPos = regions.map(function (r) {
        var xs = [], ys = [];
        treks.forEach(function (t) { if (regionOf(t) === r) t.route.forEach(function (p) { xs.push(X(p.lng)); ys.push(Y(p.lat)); }); });
        var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs), top = Math.min.apply(null, ys);
        // A peak just above the cluster pushes the region name above its triangle.
        PEAKS.forEach(function (p) {
          var px = X(p.lng), py = Y(p.lat);
          if (px > minX - 20 && px < maxX + 20 && py < top + 12 && py > top - 40) top = Math.min(top, py - 8);
        });
        var cx = Math.min(Math.max((minX + maxX) / 2, 40), W - 40);
        var ty = Math.max(narrow ? 14 : 18, top - (narrow ? 10 : 14));
        taken.push(box(cx, ty, r.length * 7.6, 10, 'middle'));
        return { name: r, x: cx, y: ty };
      });
      PLACES.forEach(function (p) { taken.push(box(X(p.lng) + p.dx, Y(p.lat) + p.dy, p.name.length * 6.8, 12, p.anchor)); });
      // Route legs count as taken too, so peak names never sit on a line.
      treks.forEach(function (t) {
        for (var j = 1; j < t.route.length; j++) {
          var ax = X(t.route[j - 1].lng), ay = Y(t.route[j - 1].lat), bx2 = X(t.route[j].lng), by = Y(t.route[j].lat);
          taken.push({ x0: Math.min(ax, bx2) - 2, x1: Math.max(ax, bx2) + 2, y0: Math.min(ay, by) - 2, y1: Math.max(ay, by) + 2 });
        }
      });

      var peaks = el('g', { 'class': 'hmap__peaks', 'aria-hidden': 'true' }, svg);
      PEAKS.forEach(function (p) {
        var x = X(p.lng), y = Y(p.lat), s = narrow ? 7 : 9;
        el('polygon', { points: r1(x) + ',' + r1(y - s * 0.55) + ' ' + r1(x + s / 2) + ',' + r1(y + s * 0.4) + ' ' + r1(x - s / 2) + ',' + r1(y + s * 0.4), 'class': 'hmap__peak' }, peaks);
        if (narrow) return;
        var w = p.name.length * 6.2;
        var spots = [[p.dx, p.dy, p.anchor], [0, -9, 'middle'], [0, 18, 'middle'], [9, 4, 'start'], [-9, 4, 'end']];
        for (var q = 0; q < spots.length; q++) {
          var bx = box(x + spots[q][0], y + spots[q][1], w, 12, spots[q][2]);
          if (bx.x0 < 2 || bx.x1 > W - 2 || hits(bx)) continue;
          taken.push(bx);
          text(peaks, x + spots[q][0], y + spots[q][1], p.name, { 'class': 'hmap__peak-label', 'text-anchor': spots[q][2] });
          break;
        }
      });

      // Routes. Each is a link; a wide transparent stroke is the hit area.
      var routes = el('g', null, svg);
      var ordered = treks.slice().sort(function (a, b) { return b.days - a.days; });   // long ones underneath
      ordered.forEach(function (t, i) {
        var d = '', travel = '';
        t.route.forEach(function (p, j) {
          var cmd = r1(X(p.lng)) + ',' + r1(Y(p.lat));
          if (j === 0) { d += 'M' + cmd; return; }
          var mode = p.mode || 'walk';
          if (mode === 'walk') d += 'L' + cmd;
          else { var q = t.route[j - 1]; travel += 'M' + r1(X(q.lng)) + ',' + r1(Y(q.lat)) + 'L' + cmd; d += 'M' + cmd; }
        });
        var a = el('a', { href: '#trek-' + t.id, 'class': 'hmap__route', 'data-trek': t.id, 'aria-label': t.name + ', ' + t.days + ' days' }, routes);
        el('path', { d: d, 'class': 'hmap__hit' }, a);
        if (travel) el('path', { d: travel, 'class': 'hmap__travel' }, a);
        el('path', { d: d, 'class': 'hmap__base' }, a);
        var line = el('path', { d: d, 'class': 'hmap__line' }, a);
        line.style.setProperty('--i', String(i));
        var s = t.route[0];
        el('circle', { cx: r1(X(s.lng)), cy: r1(Y(s.lat)), r: narrow ? 2.5 : 3, 'class': 'hmap__start' }, a);
      });

      // Region labels above each cluster.
      var labels = el('g', { 'class': 'hmap__regions', 'aria-hidden': 'true' }, svg);
      regionPos.forEach(function (r) { text(labels, r.x, r.y, r.name.toUpperCase(), { 'class': 'hmap__region', 'text-anchor': 'middle' }); });

      // Cities.
      var cities = el('g', { 'class': 'hmap__cities', 'aria-hidden': 'true' }, svg);
      PLACES.forEach(function (p) {
        var x = X(p.lng), y = Y(p.lat);
        el('circle', { cx: r1(x), cy: r1(y), r: 3.5, 'class': 'hmap__city' }, cities);
        text(cities, x + p.dx, y + p.dy, p.name, { 'class': 'hmap__city-label', 'text-anchor': p.anchor });
      });

      // Scale bar, 50 km.
      var km = 50;
      var bar = r1(km * k / 111.32);                  // k px per degree of latitude; 1° ≈ 111 km
      var sb = el('g', { 'class': 'hmap__scale', 'aria-hidden': 'true', transform: 'translate(' + (narrow ? 12 : 20) + ',' + (H - (narrow ? 12 : 16)) + ')' }, svg);
      el('path', { d: 'M0,-4V0H' + bar + 'V-4' }, sb);
      text(sb, 0, -8, km + ' km', {});

      // Draw-in once per mount. The faint base copy is always visible.
      var lines = svg.querySelectorAll('.hmap__line');
      if (!drawn && !reducedMotion()) {
        Array.prototype.forEach.call(lines, function (p) {
          var L = 0;
          try { L = p.getTotalLength(); } catch (e) { L = 0; }
          if (!L) return;
          p.style.strokeDasharray = r1(L) + ' ' + r1(L);
          p.style.strokeDashoffset = r1(L);
        });
        raf = requestAnimationFrame(function () {
          raf = requestAnimationFrame(function () {
            if (dead) return;
            svg.classList.add('is-drawn');
            drawn = true;
          });
        });
      } else {
        svg.classList.add('is-drawn');
        drawn = true;
      }

      svg.addEventListener('pointerover', onOver);
      svg.addEventListener('pointerleave', onLeave);
      svg.addEventListener('focusin', onOver);
      svg.addEventListener('focusout', onLeave);
      if (active) activate(active);
    }

    function routeFrom(e) {
      var n = e.target;
      while (n && n !== stage) { if (n.getAttribute && n.getAttribute('data-trek')) return n.getAttribute('data-trek'); n = n.parentNode; }
      return null;
    }
    function onOver(e) { var id = routeFrom(e); if (id && id !== active) activate(id); }
    function onLeave(e) {
      if (e.type === 'focusout' && e.relatedTarget && stage.contains(e.relatedTarget)) return;
      activate(null);
    }

    var t = null;
    function onResize() {
      clearTimeout(t);
      t = setTimeout(function () {
        var w = Math.round(stage.clientWidth || 0);
        if (w && Math.abs(w - lastW) > 2) build();
      }, 120);
    }
    window.addEventListener('resize', onResize);
    setCaption(null);
    build();
    if (!lastW) requestAnimationFrame(function () { if (!dead) build(); });

    return {
      el: root,
      destroy: function () {
        dead = true;
        clearTimeout(t);
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', onResize);
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  MBH.OverviewMap = OverviewMap;
})();

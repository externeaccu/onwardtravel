/* maps.js — Magic Beyond Himalaya V2
 * Pure inline-SVG sketch maps, elevation profiles and sparklines (FINAL-SPEC §5).
 *
 *   MBH.RouteMap(container, trek, opts)         → { highlightDay(n), destroy(), el }
 *   MBH.ElevationProfile(container, trek, opts) → { highlightDay(n), destroy(), el }
 *   MBH.Sparkline(trek)                         → '<svg class="trek-card__spark" …>'
 *
 * No tiles, no libraries, no capability access. Everything is built with DOM
 * APIs; the only hand-assembled path strings are the computed route legs.
 * Colours are never literal: every fill/stroke is a var(--token) presentation
 * attribute, so styles.css can override by class and theme switches re-colour
 * live without a rebuild.
 */
(function () {
  'use strict';

  var MBH = window.MBH = window.MBH || {};
  var NS = 'http://www.w3.org/2000/svg';

  var NIGHT = { start: true, stop: true, end: true };   // kinds that can be "the night"
  var SPIKE = { pass: true, peak: true };                // kinds drawn as triangles
  var LABEL_PRIORITY = { start: 0, end: 1, pass: 2, peak: 3, stop: 4, via: 5 };
  var WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var LEGEND = 'Sketch map, not for navigation · coordinates approximate';
  var GUIDE_M = 4000;

  /* ---------------------------------------------------------------- helpers */

  // HTML escaper: every string that ends up inside markup passes through here.
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function r1(v) { return Math.round(v * 10) / 10; }
  function toInt(v) { var n = parseInt(v, 10); return isNaN(n) ? null : n; }

  function parseISO(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  // Calendar date of itinerary day d (1-based) for a departure starting on `start`.
  function dayDate(start, d) {
    var dt = parseISO(start);
    if (!dt) return null;
    dt.setDate(dt.getDate() + (d - 1));
    return dt;
  }
  function fmtShort(dt) { return WD[dt.getDay()] + ' ' + dt.getDate() + ' ' + MON[dt.getMonth()]; }
  function fmtDayMon(dt) { return dt.getDate() + ' ' + MON[dt.getMonth()]; }

  function media(q) { try { return !!(window.matchMedia && window.matchMedia(q).matches); } catch (e) { return false; } }
  function reducedMotion() { return media('(prefers-reduced-motion: reduce)'); }
  function canHover() { return media('(hover: hover)'); }

  function svg(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function html(tag, cls, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }
  function svgText(parent, x, y, str, attrs) {
    var t = svg('text', attrs, parent);
    t.setAttribute('x', r1(x));
    t.setAttribute('y', r1(y));
    t.textContent = str;
    return t;
  }
  function daysLabel(days) {
    return days.length > 1 ? days[0] + '–' + days[days.length - 1] : String(days[0]);
  }
  function boxesHit(a, b) {
    return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  }
  // Equilateral-ish triangle, `size` px wide, tip up, centred on (x, y).
  function triPoints(x, y, size) {
    var h = size * 0.9;
    return r1(x) + ',' + r1(y - h * 0.6) + ' ' + r1(x + size / 2) + ',' + r1(y + h * 0.4) + ' ' + r1(x - size / 2) + ',' + r1(y + h * 0.4);
  }
  function debounce(fn, ms) {
    var t = null;
    var d = function () { clearTimeout(t); t = setTimeout(fn, ms); };
    d.cancel = function () { clearTimeout(t); };
    return d;
  }

  /* ------------------------------------------------- route model (shared) */

  // Turns trek.route into "visits" (one per marker) and resolves which visit is
  // the night for every itinerary day. Consecutive night waypoints at the same
  // lat/lng merge into one visit; a day with no waypoint of its own (rest day)
  // is covered by the previous night. Later non-consecutive returns to a place
  // get an occurrence index so the map can offset them.
  function buildModel(trek) {
    var pts = trek.route || [];
    var nDays = trek.days || (trek.days_data || []).length;
    var visits = [];
    var keyOf = function (p) { return Number(p.lat).toFixed(3) + ',' + Number(p.lng).toFixed(3); };

    var lastNight = null;
    pts.forEach(function (p, i) {
      var v = {
        index: i, key: keyOf(p), kind: p.kind, name: String(p.name || ''), elev: Number(p.elev) || 0,
        lat: Number(p.lat), lng: Number(p.lng), mode: p.mode || 'walk',
        days: [p.day], pts: [p], occurrence: 0, nights: [], mergedInto: null
      };
      visits.push(v);
      if (!NIGHT[p.kind]) return;
      // Two nights in a row at the same place (rest day, or a day trip to a peak
      // and back) share one marker. The visit stays in the path so the line
      // still walks out and back; it just draws no marker of its own.
      if (lastNight && lastNight.key === v.key) {
        v.mergedInto = lastNight;
        if (lastNight.days.indexOf(p.day) < 0) lastNight.days.push(p.day);
        return;
      }
      lastNight = v;
    });

    // Occurrence index per place (out-and-back repeats); merged visits share their target's.
    var seen = {};
    visits.forEach(function (v) {
      if (v.mergedInto) { v.occurrence = v.mergedInto.occurrence; return; }
      v.occurrence = seen[v.key] || 0;
      seen[v.key] = v.occurrence + 1;
    });

    // Night for day d = the last night-kind visit that includes d. A day with no night
    // waypoint stays where it slept ONLY when the itinerary calls it a rest/acclimatisation
    // day; any other day ends at its own last waypoint (EBC day 11 ends at Base Camp, it does
    // not spend a second night at Lobuche).
    var daysData = trek.days_data || [];
    var isRestDay = function (d) {
      var info = daysData[d - 1];
      return !!info && (/acclimati[sz]ation|rest day/i.test(String(info.route || '')) || /rest day/i.test(String(info.time || '')));
    };
    var minDay = Infinity, maxDay = -Infinity;
    visits.forEach(function (v) {
      v.days.forEach(function (d) { minDay = Math.min(minDay, d); maxDay = Math.max(maxDay, d); });
    });
    var nightFor = {};
    for (var d = 1; d <= nDays; d++) {
      var found = null, lastOfDay = null;
      visits.forEach(function (v) {
        if (v.mergedInto || v.days.indexOf(d) < 0) return;
        if (NIGHT[v.kind]) found = v;
        if (v.pts[0].day === d) lastOfDay = v;
      });
      if (!found && d > minDay && d <= maxDay) {
        if (!isRestDay(d) && lastOfDay) {
          found = lastOfDay;                     // walking day without a stop: its last point
        } else if (nightFor[d - 1]) {
          found = nightFor[d - 1];               // rest day: stays where it slept
          if (found.days.indexOf(d) < 0) found.days.push(d);
        }
      }
      if (found) { nightFor[d] = found; found.nights.push(d); }
    }
    visits.forEach(function (v) { v.isNight = v.nights.length > 0; v.days.sort(function (a, b) { return a - b; }); v.nights.sort(function (a, b) { return a - b; }); });

    return { visits: visits, nightFor: nightFor, days: nDays };
  }

  // Marker footprint: shape, half-width of the disc/pill, ring allowance, and the radius the
  // separation pass keeps clear. Nights are always discs (EBC's Base Camp night included).
  function markerGeom(v) {
    if (!v.isNight && SPIKE[v.kind]) return { shape: 'tri', hw: 7, ring: 0, r: 7, label: '' };
    if (!v.isNight && v.kind === 'via') return { shape: 'via', hw: 5, ring: 0, r: 5, label: '' };
    var label = v.isNight ? daysLabel(v.nights) : '';
    var hw = label.length > 2 ? Math.max(11, Math.ceil((label.length * 6.4 + 10) / 2)) : 11;
    var ring = v.nights.length > 1 ? 3.5 : 0;
    return { shape: 'disc', hw: hw, ring: ring, r: hw + ring, label: label };
  }

  // Push overlapping markers apart until their boxes (disc/pill + ring, 2px gap) no longer
  // touch, moving each pair along its axis of least overlap; a weak pull back to the true
  // position first keeps every marker as close to its place as the crowd allows. The route
  // line keeps the true positions; maps draw a leader tick where a marker had to move.
  function separate(nodes, W, H) {
    var n = nodes.length;
    if (n < 2) return;
    var GAP = 2, minY = 14, maxY = H - 44;               // keep clear of the scale bar row
    var hwOf = function (v) { return v.geom.hw + v.geom.ring; };
    var hhOf = function (v) { return (v.geom.shape === 'disc' ? 11 : v.geom.hw) + v.geom.ring; };
    var clampNode = function (v) {
      v.x = Math.min(W - hwOf(v) - 4, Math.max(hwOf(v) + 4, v.x));
      v.y = Math.min(maxY - hhOf(v), Math.max(minY + hhOf(v), v.y));
    };
    var settle = 90, limit = 400;
    for (var iter = 0; iter < limit; iter++) {
      var moved = false;
      for (var i = 0; i < n; i++) {
        for (var j = i + 1; j < n; j++) {
          var a = nodes[i], b = nodes[j];
          var dx = b.x - a.x, dy = b.y - a.y;
          var ox = hwOf(a) + hwOf(b) + GAP - Math.abs(dx), oy = hhOf(a) + hhOf(b) + GAP - Math.abs(dy);
          if (ox <= 0 || oy <= 0) continue;
          if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) { dx = ((i + j) % 2 ? 1 : -1) * 0.5; dy = 0.5; }
          // Resolve along the cheaper axis; ties go to whichever the pair is already split on.
          if (ox / (hwOf(a) + hwOf(b)) < oy / (hhOf(a) + hhOf(b))) {
            var sx = (dx >= 0 ? 1 : -1) * (ox / 2 + 0.05);
            a.x -= sx; b.x += sx;
          } else {
            var sy = (dy >= 0 ? 1 : -1) * (oy / 2 + 0.05);
            a.y -= sy; b.y += sy;
          }
          moved = true;
        }
      }
      var pull = iter < settle ? 0.03 : 0;
      nodes.forEach(function (v) { v.x += (v.rx - v.x) * pull; v.y += (v.ry - v.y) * pull; clampNode(v); });
      if (!moved && iter >= settle) break;
    }
    nodes.forEach(function (v) { v.x = r1(v.x); v.y = r1(v.y); });
  }

  function maxElevOf(trek) {
    if (typeof trek.maxElev === 'number') return trek.maxElev;
    var m = 0;
    (trek.days_data || []).forEach(function (d) { m = Math.max(m, d.alt || 0); });
    (trek.route || []).forEach(function (p) { if (SPIKE[p.kind]) m = Math.max(m, p.elev || 0); });
    return m;
  }

  /* ========================================================= RouteMap */

  function RouteMap(container, trek, opts) {
    opts = opts || {};
    var isStatic = !!opts.static;
    var wantProfile = opts.profile !== false && !isStatic;
    var dates = opts.dates && opts.dates.start ? opts.dates : null;
    var onDaySelect = typeof opts.onDaySelect === 'function' ? opts.onDaySelect : null;
    var daysData = trek.days_data || [];

    var root = html('div', 'rmap' + (isStatic ? ' rmap--static' : ''));
    container.appendChild(root);

    var state = {
      activeDay: null, visible: false, destroyed: false, animated: false,
      model: null, legs: [], markers: {}, donePath: null, daycard: null, profile: null,
      io: null, ro: null, lastW: 0
    };

    /* ----------------------------------------------------------- build */
    function build() {
      root.innerHTML = '';
      state.profile = null;

      var W = container.clientWidth || 358;
      state.lastW = W;

      var model = buildModel(trek);
      state.model = model;
      var visits = model.visits;

      // Projection: equirectangular with cos(mid-lat) correction (§5.3).
      var minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
      visits.forEach(function (v) {
        minLat = Math.min(minLat, v.lat); maxLat = Math.max(maxLat, v.lat);
        minLng = Math.min(minLng, v.lng); maxLng = Math.max(maxLng, v.lng);
      });
      if (!visits.length) { minLat = maxLat = 28; minLng = maxLng = 84; }
      var rangeLat = Math.max(maxLat - minLat, 0.01), rangeLng = Math.max(maxLng - minLng, 0.01);
      var k = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
      // Height follows the route's own shape (§5.2's 0.72 / 0.6 are the floors): a north-south
      // route like EBC gets a taller map instead of squeezing 18 markers into a thin strip.
      var phone = W < 720;
      var fill = (rangeLat / (rangeLng * k)) * (0.76 / 0.72);
      var H = Math.round(W * Math.min(phone ? 1.2 : 0.85, Math.max(phone ? 0.72 : 0.6, fill)));
      var inner = { x: W * 0.12, y: H * 0.10, w: W * 0.76, h: H * 0.72 };
      var s = Math.min(inner.w / (rangeLng * k), inner.h / rangeLat);
      var offX = inner.x + (inner.w - rangeLng * k * s) / 2;
      var offY = inner.y + (inner.h - rangeLat * s) / 2;
      var px = function (lng) { return offX + (lng - minLng) * k * s; };
      var py = function (lat) { return offY + (maxLat - lat) * s; };
      var kmPerPx = 111.32 / s;

      // (rx, ry) is where the route passes; (x, y) is where the marker is drawn after the
      // separation pass pushes overlapping markers apart (joined back by a leader tick).
      visits.forEach(function (v) {
        v.rx = r1(px(v.lng) + 8 * v.occurrence);
        v.ry = r1(py(v.lat) + 8 * v.occurrence);
        v.x = v.rx; v.y = v.ry;
        v.geom = markerGeom(v);
      });
      separate(visits.filter(function (v) { return !v.mergedInto; }), W, H);

      var stage = html('div', 'rmap__stage', root);
      var el = svg('svg', {
        'class': 'rmap__svg', viewBox: '0 0 ' + W + ' ' + H,
        role: 'img', 'aria-label': 'Sketch map of the ' + trek.name + ' route',
        style: 'aspect-ratio:' + W + '/' + H
      }, stage);

      svg('rect', { 'class': 'rmap__paper', x: 0, y: 0, width: W, height: H, fill: 'var(--map-paper)' }, el);

      // Graticule every 0.05°, bbox extended by one step each side.
      var grid = svg('g', { 'class': 'rmap__grid' }, el);
      var step = 0.05, gi;
      for (gi = Math.floor(minLng / step) - 1; gi <= Math.ceil(maxLng / step) + 1; gi++) {
        var gx = r1(px(gi * step));
        if (gx < 0 || gx > W) continue;
        svg('line', { 'class': 'rmap__graticule', x1: gx, y1: 0, x2: gx, y2: H, stroke: 'var(--map-grid)', 'stroke-width': 1 }, grid);
      }
      for (gi = Math.floor(minLat / step) - 1; gi <= Math.ceil(maxLat / step) + 1; gi++) {
        var gy = r1(py(gi * step));
        if (gy < 0 || gy > H) continue;
        svg('line', { 'class': 'rmap__graticule', x1: 0, y1: gy, x2: W, y2: gy, stroke: 'var(--map-grid)', 'stroke-width': 1 }, grid);
      }

      // Route legs (§5.5): walk = amber thread with halo; drive/fly = dashed green.
      var legs = [];
      for (var i = 0; i + 1 < visits.length; i++) {
        var to = visits[i + 1];
        legs.push({ from: visits[i], to: to, mode: to.mode === 'drive' || to.mode === 'fly' ? 'travel' : 'walk', day: to.days[0] });
      }
      state.legs = legs;
      var routeG = svg('g', { 'class': 'rmap__route', fill: 'none' }, el);
      var walkD = pathFor(legs, 'walk'), travelD = pathFor(legs, 'travel');
      var halo = svg('path', { 'class': 'rmap__halo', d: walkD, stroke: 'var(--thread-halo)', 'stroke-width': 8, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, routeG);
      svg('path', { 'class': 'rmap__line rmap__line--travel', d: travelD, stroke: 'var(--map-travel)', 'stroke-width': 2, 'stroke-dasharray': '6 6', 'stroke-linecap': 'round' }, routeG);
      var walk = svg('path', { 'class': 'rmap__line rmap__line--walk', d: walkD, stroke: 'var(--thread)', 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, routeG);
      state.donePath = svg('path', { 'class': 'rmap__line rmap__line--done', d: '', stroke: 'var(--thread)', 'stroke-width': 3.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, routeG);

      // Markers (§5.4). Leader ticks first, so they sit under the discs.
      var leadersG = svg('g', { 'class': 'rmap__leaders' }, el);
      visits.forEach(function (v) {
        if (v.mergedInto || Math.hypot(v.x - v.rx, v.y - v.ry) < 3) return;
        svg('line', { 'class': 'rmap__leader', x1: v.rx, y1: v.ry, x2: v.x, y2: v.y, stroke: 'var(--map-ink)', 'stroke-width': 1, 'stroke-linecap': 'round' }, leadersG);
        svg('circle', { 'class': 'rmap__leader-dot', cx: v.rx, cy: v.ry, r: 2, fill: 'var(--map-ink)' }, leadersG);
      });
      var markersG = svg('g', { 'class': 'rmap__markers' }, el);
      var obstacles = [];
      state.markers = {};
      var mi = 0;
      var live = visits.filter(function (v) { return !v.mergedInto; });
      var glyphs = [];
      visits.forEach(function (v) { if (!v.mergedInto) drawMarker(markersG, v, mi++, obstacles, live, glyphs, W, H); });

      // Scale bar and north mark (§5.3) — registered as label obstacles.
      var scaleG = svg('g', { 'class': 'rmap__scale' }, el);
      var km = 1;
      [1, 2, 5, 10, 20, 50].forEach(function (c) { if (c / kmPerPx <= W * 0.25) km = c; });
      var scalePx = r1(km / kmPerPx), sy = H - 28;
      svg('path', { 'class': 'rmap__scale-line', d: 'M16 ' + (sy - 4) + ' V' + sy + ' H' + r1(16 + scalePx) + ' V' + (sy - 4), fill: 'none', stroke: 'var(--text-3)', 'stroke-width': 1.5, 'stroke-linecap': 'round' }, scaleG);
      svgText(scaleG, 16, sy - 9, km + ' km', { 'class': 'rmap__scale-text tnum', 'font-size': 11, fill: 'var(--text-3)' });
      obstacles.push({ x0: 12, y0: sy - 22, x1: 16 + Math.max(scalePx, 36) + 4, y1: sy + 4 });

      var northG = svg('g', { 'class': 'rmap__north' }, el);
      var nx = W - 24;
      svg('path', { d: 'M' + nx + ' 16 L' + (nx + 4.5) + ' 30 L' + nx + ' 26.5 L' + (nx - 4.5) + ' 30 Z', fill: 'var(--text-3)' }, northG);
      svgText(northG, nx, 43, 'N', { 'font-size': 11, 'text-anchor': 'middle', fill: 'var(--text-3)' });
      obstacles.push({ x0: nx - 12, y0: 10, x1: nx + 12, y1: 46 });

      // Labels (§5.6) with greedy collision hiding.
      var labelsG = svg('g', { 'class': 'rmap__labels' }, el);
      placeLabels(labelsG, visits, obstacles, W, H);

      // Legend, docked profile, day card.
      var legend = html('p', 'rmap__legend', root);
      legend.textContent = LEGEND;

      if (wantProfile && typeof MBH.ElevationProfile === 'function') {
        state.profile = MBH.ElevationProfile(root, trek, { hero: false, docked: true });
      }
      if (!isStatic) {
        var card = html('div', 'rmap__daycard', root);
        card.hidden = true;
        html('p', 'rmap__daycard-title', card);
        html('p', 'rmap__daycard-facts tnum', card);
        state.daycard = card;
      }

      // Draw-in (§5.9): dasharray set as attributes so the CSS class rule can
      // transition the offset to 0. Skipped under reduced motion, after the
      // first animation, and in static mode.
      var animate = !isStatic && !state.visible && !state.animated && !reducedMotion();
      if (animate) {
        var L = 0;
        try { L = walk.getTotalLength(); } catch (e) { L = 0; }
        if (L > 0) {
          var dur = Math.min(900 + 60 * model.days, 1800) + 'ms';
          [walk, halo].forEach(function (p) {
            p.setAttribute('stroke-dasharray', r1(L));
            p.setAttribute('stroke-dashoffset', r1(L));
            p.style.transitionDuration = dur;
          });
        }
      }
      if (state.visible || isStatic || reducedMotion()) {
        root.classList.add('is-visible');
        if (state.profile) state.profile.el.classList.add('is-drawn');
      }
      if (state.activeDay != null) applyHighlight(state.activeDay);
    }

    // One "M x y L x y …" subpath per run of consecutive legs of `mode` (through the true
    // route points, not the separated marker positions).
    function pathFor(legs, mode) {
      var d = '', open = false;
      legs.forEach(function (leg) {
        if (leg.mode !== mode) { open = false; return; }
        if (!open) { d += 'M' + leg.from.rx + ' ' + leg.from.ry; open = true; }
        d += ' L' + leg.to.rx + ' ' + leg.to.ry;
      });
      return d;
    }

    // A disc box (x ± hw, y ± 11) or a circle of radius r against an axis-aligned box.
    function circleHitsBox(cx, cy, r, b) {
      var dx = Math.max(b.x0 - cx, 0, cx - b.x1), dy = Math.max(b.y0 - cy, 0, cy - b.y1);
      return dx * dx + dy * dy < r * r;
    }
    // House / flag go on whichever side of the disc is clear (left first): an end that
    // returns to the trailhead must not sit on the start disc.
    function glyphSpot(v, live, glyphs, W, H) {
      var g = v.geom, off = g.hw + g.ring + 10;
      var cands = [[-off, 0], [off, 0], [0, -(11 + g.ring + 10)], [0, 11 + g.ring + 10]];
      for (var i = 0; i < cands.length; i++) {
        var gx = v.x + cands[i][0], gy = v.y + cands[i][1];
        var box = { x0: gx - 6, y0: gy - 6, x1: gx + 6, y1: gy + 6 };
        if (box.x0 < 2 || box.x1 > W - 2 || box.y0 < 2 || box.y1 > H - 2) continue;
        var clash = live.some(function (o) { return o !== v && circleHitsBox(o.x, o.y, o.geom.r + 1, box); }) ||
          glyphs.some(function (b) { return boxesHit(b, box); });
        if (!clash) return { x: gx, y: gy, box: box };
      }
      var fx = v.x + cands[0][0];
      return { x: fx, y: v.y, box: { x0: fx - 6, y0: v.y - 6, x1: fx + 6, y1: v.y + 6 } };
    }

    function drawMarker(parent, v, idx, obstacles, live, glyphs, W, H) {
      var x = v.x, y = v.y, geo = v.geom;
      var elevM = num(v.elev) + ' m';
      var ariaLabel, dataDay = v.isNight ? v.nights[0] : v.days[0];
      if (v.isNight) {
        var sleepAlt = daysData[v.nights[0] - 1] ? daysData[v.nights[0] - 1].alt : v.elev;
        ariaLabel = (v.nights.length > 1 ? 'Days ' : 'Day ') + daysLabel(v.nights) + ', ' + v.name + ', ' + num(sleepAlt) + ' m';
      } else {
        ariaLabel = v.name + ', ' + (v.kind === 'via' ? 'via' : v.kind === 'start' ? 'start' : v.kind === 'end' ? 'end' : v.kind) + ', ' + elevM;
      }
      var cls = 'rmap__marker rmap__marker--' + v.kind + (v.isNight && !NIGHT[v.kind] ? ' rmap__marker--night' : '');
      var g = svg('g', { 'class': cls, 'data-day': dataDay, 'aria-label': ariaLabel }, parent);
      g.style.setProperty('--i', idx);
      g.style.transformBox = 'fill-box';
      g.style.transformOrigin = 'center';
      if (!isStatic) { g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); }
      var title = svg('title', null, g);
      title.textContent = ariaLabel;
      // Invisible 44px hit area so a thumb can find a 22px disc.
      svg('circle', { 'class': 'rmap__hit', cx: x, cy: y, r: 22, fill: 'transparent', 'pointer-events': isStatic ? 'none' : 'all' }, g);

      if (geo.shape === 'tri') {
        svg('polygon', { 'class': 'rmap__tri', points: triPoints(x, y, 12), fill: 'var(--accent)', stroke: 'var(--surface)', 'stroke-width': 1, 'stroke-linejoin': 'round' }, g);
        obstacles.push({ x0: x - 8, y0: y - 8, x1: x + 8, y1: y + 8 });
      } else if (geo.shape === 'via') {
        svg('circle', { 'class': 'rmap__via', cx: x, cy: y, r: 5, fill: 'var(--map-paper)', stroke: 'var(--map-ink)', 'stroke-width': 1.5 }, g);
        obstacles.push({ x0: x - 7, y0: y - 7, x1: x + 7, y1: y + 7 });
      } else {
        // A disc; a multi-day label ("6–7", "10–11") gets a pill wide enough for its text.
        var hw = geo.hw;
        if (v.nights.length > 1) {
          svg('rect', { 'class': 'rmap__ring2', x: r1(x - hw - 3.5), y: r1(y - 14.5), width: r1(2 * hw + 7), height: 29, rx: 14.5, fill: 'none', stroke: 'var(--map-ink)', 'stroke-width': 1 }, g);
        }
        svg('rect', { 'class': 'rmap__dot', x: r1(x - hw), y: r1(y - 11), width: 2 * hw, height: 22, rx: 11, fill: 'var(--surface)', stroke: 'var(--map-ink)', 'stroke-width': 2 }, g);
        var glyph = null;
        if (v.isNight) {
          svgText(g, x, y, geo.label, {
            'class': 'rmap__num tnum', 'font-size': 11, 'font-weight': 500,
            'text-anchor': 'middle', 'dominant-baseline': 'central', fill: 'var(--text)'
          });
          if (v.kind === 'start' || v.kind === 'end') glyph = glyphSpot(v, live, glyphs, W, H);
        } else if (v.kind === 'start' || v.kind === 'end') {
          glyph = { x: x, y: y, box: null };         // trailhead that is not a night: glyph inside the disc
        }
        if (glyph && v.kind === 'start') {
          svg('path', { 'class': 'rmap__glyph', d: houseD(glyph.x, glyph.y), fill: 'var(--map-ink)' }, g);
        } else if (glyph && v.kind === 'end') {
          svg('path', { 'class': 'rmap__glyph', d: flagD(glyph.x, glyph.y), fill: 'var(--map-ink)', stroke: 'var(--map-ink)', 'stroke-width': 1.2, 'stroke-linecap': 'round' }, g);
        }
        var rr = geo.ring + 1;
        obstacles.push({ x0: x - hw - rr, y0: y - 11 - rr, x1: x + hw + rr, y1: y + 11 + rr });
        if (glyph && glyph.box) { obstacles.push(glyph.box); glyphs.push(glyph.box); }
      }
      state.markers[idx] = g;
      v.el = g;
    }

    // 10px house: roof + walls, centred on (x, y).
    function houseD(x, y) {
      return 'M' + r1(x - 5) + ' ' + r1(y) + ' L' + r1(x) + ' ' + r1(y - 5) + ' L' + r1(x + 5) + ' ' + r1(y) +
        ' L' + r1(x + 3.5) + ' ' + r1(y) + ' L' + r1(x + 3.5) + ' ' + r1(y + 5) + ' L' + r1(x - 3.5) + ' ' + r1(y + 5) + ' L' + r1(x - 3.5) + ' ' + r1(y) + ' Z';
    }
    // 10px flag: pole + pennant, centred on (x, y).
    function flagD(x, y) {
      return 'M' + r1(x - 3.5) + ' ' + r1(y + 5) + ' L' + r1(x - 3.5) + ' ' + r1(y - 5) +
        ' M' + r1(x - 3.5) + ' ' + r1(y - 5) + ' L' + r1(x + 4.5) + ' ' + r1(y - 2.5) + ' L' + r1(x - 3.5) + ' ' + r1(y) + ' Z';
    }

    function labelTextFor(v, W) {
      if (dates && v.isNight) {
        var dt = dayDate(dates.start, v.nights[0]);
        if (dt) {
          return W < 720 ? 'D' + daysLabel(v.nights) + ' · ' + fmtDayMon(dt) : v.name + ' · ' + fmtDayMon(dt);
        }
      }
      return v.name;
    }

    function placeLabels(parent, visits, obstacles, W, H) {
      var fs = 11, lh = 13;
      var cands = visits.filter(function (v) {
        if (v.mergedInto) return false;                           // drawn as part of an earlier marker
        if (v.occurrence > 0) return false;                       // repeat of a labelled place
        if (W < 480 && v.kind === 'via' && !v.isNight) return false;
        if (W < 480 && v.kind === 'stop' && state.model.days > 8) return false;
        return true;
      }).sort(function (a, b) {
        // Dated labels ("D4 · 16 Oct") go strictly in day order, so a label that can't fit
        // is simply omitted and never takes a neighbour's slot.
        if (dates && a.isNight !== b.isNight) return a.isNight ? -1 : 1;
        if (dates && a.isNight && b.isNight) return a.nights[0] - b.nights[0];
        var pa = LABEL_PRIORITY[a.kind], pb = LABEL_PRIORITY[b.kind];
        return pa !== pb ? pa - pb : a.days[0] - b.days[0];
      });
      var accepted = [];                      // label boxes; obstacles (markers, scale, north) stay separate
      // Markers a reader could attach a label to (vias are too small to be mistaken).
      var anchors = visits.filter(function (o) { return !o.mergedInto && o.geom && o.geom.shape !== 'via'; });
      var edgeDist = function (o, b) {
        var dx = Math.max(b.x0 - o.x, 0, o.x - b.x1), dy = Math.max(b.y0 - o.y, 0, o.y - b.y1);
        return Math.max(0, Math.hypot(dx, dy) - o.geom.r);
      };

      cands.forEach(function (v) {
        var lines = [labelTextFor(v, W)];
        if (SPIKE[v.kind]) lines.push(num(v.elev) + ' m');
        var chars = Math.max.apply(null, lines.map(function (l) { return l.length; }));
        var w = 0.58 * fs * chars, h = lh * lines.length;
        // The estimate is tuned for DM Sans; when a wider fallback face is in
        // use, measure the real advance so an estimate never hides a collision.
        var probe = svgText(parent, 0, 0, lines[0], { 'font-size': fs, visibility: 'hidden' });
        try { w = Math.max(w, probe.getComputedTextLength() * (chars / Math.max(lines[0].length, 1))); } catch (e) { /* not rendered */ }
        parent.removeChild(probe);
        var x = v.x, y = v.y;
        var side = (v.geom ? v.geom.hw + v.geom.ring : 11) + 5, vert = (v.geom ? v.geom.ring : 0) + 16;
        var up = y - vert - lh * (lines.length - 1);
        // The four spec positions first, then four diagonals before giving up.
        var tries = [
          { x: x + side, y: y + 4, anchor: 'start' },
          { x: x - side, y: y + 4, anchor: 'end' },
          { x: x, y: up, anchor: 'middle' },
          { x: x, y: y + vert + 6, anchor: 'middle' },
          { x: x + 12, y: up, anchor: 'start' },
          { x: x - 12, y: up, anchor: 'end' },
          { x: x + 12, y: y + vert + 8, anchor: 'start' },
          { x: x - 12, y: y + vert + 8, anchor: 'end' }
        ];
        for (var i = 0; i < tries.length; i++) {
          var t = tries[i];
          var x0 = t.anchor === 'start' ? t.x : t.anchor === 'end' ? t.x - w : t.x - w / 2;
          var box = { x0: x0, x1: x0 + w, y0: t.y - 10, y1: t.y - 10 + h };
          // 6px inset: the width estimate is for DM Sans; fallback faces run wider.
          if (box.x0 < 6 || box.x1 > W - 6 || box.y0 < 2 || box.y1 > H - 2) continue;
          if (obstacles.some(function (b) { return boxesHit(box, b); })) continue;
          // The label must read as its own marker's: no other marker may sit closer to it.
          var own = edgeDist(v, box);
          if (anchors.some(function (o) { return o !== v && edgeDist(o, box) < own; })) continue;
          // Label-vs-label gets a 3px gutter so estimate error never turns into a touch.
          var padded = { x0: box.x0 - 3, x1: box.x1 + 3, y0: box.y0 - 3, y1: box.y1 + 3 };
          if (accepted.some(function (b) { return boxesHit(padded, b); })) continue;
          accepted.push(box);
          lines.forEach(function (line, li) {
            svgText(parent, t.x, t.y + li * lh, line, {
              'class': 'rmap__label' + (li ? ' rmap__label--elev tnum' : ''), 'font-size': fs, 'text-anchor': t.anchor,
              'paint-order': 'stroke', stroke: 'var(--map-paper)', 'stroke-width': 3, 'stroke-linejoin': 'round',
              fill: li ? 'var(--text-2)' : 'var(--text)'
            });
          });
          break;
        }
      });
    }

    /* ------------------------------------------------------- highlight */
    function applyHighlight(d) {
      var model = state.model;
      if (!model) return;
      var night = d == null ? null : model.nightFor[d];
      model.visits.forEach(function (v) {
        if (!v.el) return;
        var isNightKind = NIGHT[v.kind] || v.isNight;
        v.el.classList.toggle('is-active', night === v);
        v.el.classList.toggle('is-dim', night != null && night !== v && isNightKind);
        var dot = v.el.querySelector('.rmap__dot');
        if (dot) dot.setAttribute('stroke', night === v ? 'var(--accent)' : 'var(--map-ink)');
      });
      state.donePath.setAttribute('d', d == null ? '' : pathFor(state.legs.filter(function (l) { return l.day <= d; }), 'walk'));

      if (state.daycard) {
        if (d == null || !daysData[d - 1]) {
          state.daycard.hidden = true;
        } else {
          var info = daysData[d - 1];
          var facts = ['sleep ' + num(info.alt) + ' m'];
          if (info.time) facts.push(info.time);
          if (dates) { var dt = dayDate(dates.start, d); if (dt) facts.push(fmtShort(dt)); }
          state.daycard.querySelector('.rmap__daycard-title').textContent = 'Day ' + d + ' · ' + info.route;
          state.daycard.querySelector('.rmap__daycard-facts').textContent = facts.join(' · ');
          state.daycard.hidden = false;
        }
      }
      if (state.profile) state.profile.highlightDay(d);
    }

    function highlightDay(n) {
      if (state.destroyed || isStatic) return;
      var d = n == null ? null : toInt(n);
      if (d != null && (d < 1 || d > state.model.days)) d = null;
      state.activeDay = d;
      applyHighlight(d);
    }

    /* ----------------------------------------------------- interaction */
    function dayFromEvent(e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-day]') : null;
      if (!t || !root.contains(t)) return null;
      return { day: toInt(t.getAttribute('data-day')), source: t.closest('.elev') ? 'profile' : 'map' };
    }
    function onClick(e) {
      var hit = dayFromEvent(e);
      if (!hit || hit.day == null) return;
      highlightDay(hit.day);
      if (onDaySelect) onDaySelect(hit.day, hit.source);
    }
    function onKey(e) {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      var hit = dayFromEvent(e);
      if (!hit || hit.day == null) return;
      e.preventDefault();
      highlightDay(hit.day);
      if (onDaySelect) onDaySelect(hit.day, hit.source);
    }
    function onOver(e) {
      var m = e.target && e.target.closest ? e.target.closest('.rmap__marker') : null;
      if (m) m.classList.add('is-hover');
    }
    function onOut(e) {
      var m = e.target && e.target.closest ? e.target.closest('.rmap__marker') : null;
      if (m && !(e.relatedTarget && m.contains(e.relatedTarget))) m.classList.remove('is-hover');
    }
    var hoverBound = false;
    if (!isStatic) {
      root.addEventListener('click', onClick);
      root.addEventListener('keydown', onKey);
      if (canHover()) {
        hoverBound = true;
        root.addEventListener('pointerover', onOver);
        root.addEventListener('pointerout', onOut);
      }
    }

    /* ----------------------------------------------------- observers */
    function reveal() {
      if (state.destroyed || state.visible) return;
      state.visible = true;
      state.animated = true;
      var go = function () {
        if (state.destroyed) return;
        root.classList.add('is-visible');
        if (state.profile) state.profile.el.classList.add('is-drawn');
      };
      if (reducedMotion()) go(); else requestAnimationFrame(go);
    }
    build();
    if (isStatic || reducedMotion() || typeof IntersectionObserver !== 'function') {
      reveal();
    } else {
      state.io = new IntersectionObserver(function (entries) {
        if (entries.some(function (en) { return en.isIntersecting; })) {
          reveal();
          if (state.io) { state.io.disconnect(); state.io = null; }
        }
      }, { threshold: 0.2 });
      state.io.observe(root);
      // Complete at rest: never leave the route undrawn waiting for a scroll.
      state.restTimer = setTimeout(function () {
        reveal();
        if (state.io) { state.io.disconnect(); state.io = null; }
      }, 2500);
    }
    var rebuild = debounce(function () {
      if (state.destroyed) return;
      var w = container.clientWidth || 358;
      if (w !== state.lastW) build();
    }, 120);
    if (typeof ResizeObserver === 'function') {
      state.ro = new ResizeObserver(rebuild);
      state.ro.observe(container);
    }
    if (opts.initialDay != null) highlightDay(opts.initialDay);

    /* -------------------------------------------------------- destroy */
    function destroy() {
      if (state.destroyed) return;
      state.destroyed = true;
      rebuild.cancel();
      if (state.io) { state.io.disconnect(); state.io = null; }
      clearTimeout(state.restTimer);
      if (state.ro) { state.ro.disconnect(); state.ro = null; }
      if (!isStatic) {
        root.removeEventListener('click', onClick);
        root.removeEventListener('keydown', onKey);
        if (hoverBound) {
          root.removeEventListener('pointerover', onOver);
          root.removeEventListener('pointerout', onOut);
        }
      }
      if (state.profile) { state.profile.destroy(); state.profile = null; }
      if (root.parentNode === container) container.removeChild(root);
      container.innerHTML = '';
      state.model = null; state.legs = []; state.markers = {}; state.donePath = null; state.daycard = null;
    }

    return { highlightDay: highlightDay, destroy: destroy, el: root };
  }

  /* ================================================ ElevationProfile */

  function ElevationProfile(container, trek, opts) {
    opts = opts || {};
    var hero = !!opts.hero;
    var docked = !!opts.docked;                 // inside a RouteMap: it owns observers and clicks
    var onDaySelect = typeof opts.onDaySelect === 'function' ? opts.onDaySelect : null;
    var daysData = trek.days_data || [];
    var n = trek.days || daysData.length;
    var route = trek.route || [];
    var H = hero ? 160 : 120;
    // Hero: 0/0/12/0 per spec, except a dot-sized inset on the right and bottom so the
    // last night's dot and any lowest-altitude dot are not cut in half by .phero's clip.
    var pad = hero ? { l: 0, r: 7, t: 12, b: 7 } : { l: 36, r: 12, t: 14, b: 22 };

    var root = html('div', 'elev' + (hero ? ' elev--hero' : ''));
    container.appendChild(root);
    var state = { activeDay: null, drawn: false, destroyed: false, dots: {}, hair: null, xs: {}, io: null, ro: null, lastW: 0 };

    function build() {
      root.innerHTML = '';
      var W = container.clientWidth || 358;
      state.lastW = W;
      var dx = (W - pad.l - pad.r) / Math.max(n, 1);
      var xOf = function (d) { return pad.l + d * dx; };

      // Points: optional trailhead, spikes at x_d − ½dx, one sleep point per day.
      var pts = [], spikes = [], alts = [];
      if (route.length && route[0].day === 1) { pts.push({ x: pad.l, v: route[0].elev }); alts.push(route[0].elev); }
      for (var d = 1; d <= n; d++) {
        var spk = route.filter(function (p) { return SPIKE[p.kind] && p.day === d; });
        spk.forEach(function (p, i) {
          var pt = { x: xOf(d) - dx * (i + 1) / (spk.length + 1), v: p.elev, name: p.name };
          pts.push(pt); spikes.push(pt); alts.push(p.elev);
        });
        var alt = daysData[d - 1] ? daysData[d - 1].alt : (alts.length ? alts[alts.length - 1] : 0);
        pts.push({ x: xOf(d), v: alt, day: d });
        alts.push(alt);
      }
      var lo = Math.floor(Math.min.apply(null, alts) / 500) * 500;
      var hi = Math.ceil(Math.max.apply(null, alts) / 500) * 500;
      if (hi === lo) hi = lo + 500;
      var plotH = H - pad.t - pad.b;
      var yOf = function (v) { return pad.t + (hi - v) / (hi - lo) * plotH; };
      var baseY = r1(yOf(lo));
      var floorY = hero ? H : baseY;          // the hero silhouette still sits on the bottom rule

      var el = svg('svg', {
        'class': 'elev__svg', viewBox: '0 0 ' + W + ' ' + H, role: 'img',
        'aria-label': 'Elevation profile, ' + n + ' days, ' + num(Math.min.apply(null, alts)) + ' m to ' + num(Math.max.apply(null, alts)) + ' m',
        preserveAspectRatio: hero ? 'none' : 'xMidYMid meet'
      }, root);

      var linePts = pts.map(function (p) { return r1(p.x) + ',' + r1(yOf(p.v)); });
      var areaPts = linePts.concat([r1(pts[pts.length - 1].x) + ',' + floorY, r1(pts[0].x) + ',' + floorY]);
      svg('polygon', { 'class': 'elev__area', points: areaPts.join(' '), fill: 'var(--thread)', opacity: 0.12 }, el);

      if (!hero) {
        var guide = maxElevOf(trek) > GUIDE_M && GUIDE_M > lo && GUIDE_M < hi;
        // y labels every 1000 m inside the range (2000 m if crowded); the guide
        // label already says "4,000 m", so that tick is skipped when the guide shows.
        var yStep = (1000 / (hi - lo)) * plotH < 30 ? 2000 : 1000;
        for (var v = Math.ceil(lo / yStep) * yStep; v <= hi; v += yStep) {
          if (v < lo || (guide && v === GUIDE_M)) continue;
          svgText(el, pad.l - 6, yOf(v), num(v), { 'class': 'elev__ylabel tnum', 'font-size': 11, 'text-anchor': 'end', 'dominant-baseline': 'middle', fill: 'var(--text-3)' });
        }
        if (guide) {
          var gy = r1(yOf(GUIDE_M));
          svg('line', { 'class': 'elev__guide', x1: pad.l, y1: gy, x2: W - pad.r, y2: gy, stroke: 'var(--text-3)', 'stroke-width': 1, 'stroke-dasharray': '2 4' }, el);
          placeGuideLabel(el, pts.map(function (p) { return { x: p.x, y: yOf(p.v) }; }), W, gy);
        }
      }

      var line = svg('polyline', {
        'class': 'elev__line thread__line', points: linePts.join(' '), fill: 'none', stroke: 'var(--thread)',
        'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
      }, el);
      if (hero) line.setAttribute('vector-effect', 'non-scaling-stroke');

      spikes.forEach(function (p) {
        svg('polygon', { 'class': 'elev__spike', points: triPoints(p.x, yOf(p.v) - 1, 8), fill: 'var(--accent)', stroke: 'var(--surface)', 'stroke-width': 1 }, el);
      });

      state.hair = null;
      if (!hero) {
        state.hair = svg('line', { 'class': 'elev__hair', x1: 0, y1: pad.t, x2: 0, y2: baseY, stroke: 'var(--accent)', 'stroke-width': 1, visibility: 'hidden' }, el);
      }

      state.dots = {}; state.xs = {};
      pts.forEach(function (p) {
        if (!p.day) return;
        state.xs[p.day] = p.x;
        state.dots[p.day] = svg('circle', { 'class': 'elev__dot', cx: r1(p.x), cy: r1(yOf(p.v)), r: 5, fill: 'var(--surface)', stroke: 'var(--map-ink)', 'stroke-width': 1.5 }, el);
      });

      if (!hero) {
        var every = (n > 12 && W < 480) ? 2 : 1;
        for (var t = 1; t <= n; t++) {
          if ((t - 1) % every === 0 || t === n) {
            svgText(el, xOf(t), H - 6, String(t), { 'class': 'elev__tick tnum', 'font-size': 11, 'text-anchor': 'middle', fill: 'var(--text-3)' });
          }
        }
        var hits = svg('g', null, el);
        for (var h = 1; h <= n; h++) {
          var rect = svg('rect', {
            'class': 'elev__hit', 'data-day': h, x: r1(xOf(h) - dx / 2), y: 0, width: r1(dx), height: H,
            fill: 'transparent', style: 'cursor:pointer'
          }, hits);
          var tt = svg('title', null, rect);
          tt.textContent = 'Day ' + h + (daysData[h - 1] ? ' · ' + num(daysData[h - 1].alt) + ' m' : '');
        }
      }

      // Hero thread draws itself once when it scrolls into view.
      if (hero && !state.drawn && !reducedMotion()) {
        var L = 0;
        try { L = line.getTotalLength(); } catch (e) { L = 0; }
        if (L > 0) {
          line.setAttribute('stroke-dasharray', r1(L));
          line.setAttribute('stroke-dashoffset', r1(L));
          line.style.transitionDuration = Math.min(900 + 60 * n, 1800) + 'ms';
        }
      }
      if (state.drawn || reducedMotion()) root.classList.add('is-drawn');
      if (state.activeDay != null) applyHighlight(state.activeDay);
    }

    // The guide label goes wherever the profile line is not: left/right, above/
    // below the rule, full text first and the short "4,000 m" as a fallback.
    function placeGuideLabel(el, line, W, gy) {
      var texts = [num(GUIDE_M) + ' m · acclimatisation days above this', num(GUIDE_M) + ' m'];
      var cands = [
        { x: pad.l + 4, y: gy - 4, anchor: 'start' }, { x: W - pad.r - 4, y: gy - 4, anchor: 'end' },
        { x: pad.l + 4, y: gy + 13, anchor: 'start' }, { x: W - pad.r - 4, y: gy + 13, anchor: 'end' }
      ];
      var hits = function (box) {
        for (var i = 0; i + 1 < line.length; i++) {
          var a = line[i], b = line[i + 1], len = Math.hypot(b.x - a.x, b.y - a.y), steps = Math.max(1, Math.ceil(len / 4));
          for (var s = 0; s <= steps; s++) {
            var x = a.x + (b.x - a.x) * s / steps, y = a.y + (b.y - a.y) * s / steps;
            if (x >= box.x0 - 6 && x <= box.x1 + 6 && y >= box.y0 - 6 && y <= box.y1 + 6) return true;
          }
        }
        return false;
      };
      var pick = null;
      texts.some(function (t) {
        var w = 0.58 * 11 * t.length;
        return cands.some(function (c) {
          var x0 = c.anchor === 'start' ? c.x : c.x - w;
          var box = { x0: x0, x1: x0 + w, y0: c.y - 10, y1: c.y + 3 };
          if (box.x0 < pad.l || box.x1 > W - pad.r || box.y0 < pad.t - 4 || box.y1 > H - pad.b) return false;
          if (hits(box)) return false;
          pick = { text: t, c: c };
          return true;
        });
      });
      if (!pick) pick = { text: texts[0], c: cands[0] };
      svgText(el, pick.c.x, pick.c.y, pick.text, {
        'class': 'elev__guide-label', 'font-size': 11, 'text-anchor': pick.c.anchor, fill: 'var(--text-3)',
        'paint-order': 'stroke', stroke: 'var(--bg)', 'stroke-width': 3, 'stroke-linejoin': 'round'
      });
    }

    function applyHighlight(d) {
      Object.keys(state.dots).forEach(function (k) {
        var dot = state.dots[k], on = +k === d;
        dot.classList.toggle('elev__dot--active', on);
        dot.setAttribute('r', on ? 6.5 : 5);
        dot.setAttribute('stroke', on ? 'var(--accent)' : 'var(--map-ink)');
      });
      if (state.hair) {
        if (d != null && state.xs[d] != null) {
          state.hair.setAttribute('x1', r1(state.xs[d]));
          state.hair.setAttribute('x2', r1(state.xs[d]));
          state.hair.setAttribute('visibility', 'visible');
        } else {
          state.hair.setAttribute('visibility', 'hidden');
        }
      }
    }
    function highlightDay(m) {
      if (state.destroyed) return;
      var d = m == null ? null : toInt(m);
      if (d != null && (d < 1 || d > n)) d = null;
      state.activeDay = d;
      applyHighlight(d);
    }

    function onClick(e) {
      var t = e.target && e.target.closest ? e.target.closest('.elev__hit[data-day]') : null;
      if (!t || !root.contains(t)) return;
      var d = toInt(t.getAttribute('data-day'));
      highlightDay(d);
      if (onDaySelect) onDaySelect(d, 'profile');
    }
    var clickBound = !hero && !docked;
    if (clickBound) root.addEventListener('click', onClick);

    function reveal() {
      if (state.destroyed || state.drawn) return;
      state.drawn = true;
      var go = function () { if (!state.destroyed) root.classList.add('is-drawn'); };
      if (reducedMotion()) go(); else requestAnimationFrame(go);
    }
    build();
    if (!docked) {
      if (reducedMotion() || typeof IntersectionObserver !== 'function') {
        reveal();
      } else {
        state.io = new IntersectionObserver(function (entries) {
          if (entries.some(function (en) { return en.isIntersecting; })) {
            reveal();
            if (state.io) { state.io.disconnect(); state.io = null; }
          }
        }, { threshold: 0.2 });
        state.io.observe(root);
        // Complete at rest: never leave the profile undrawn waiting for a scroll.
        state.restTimer = setTimeout(function () {
          reveal();
          if (state.io) { state.io.disconnect(); state.io = null; }
        }, 2500);
      }
      var rebuild = debounce(function () {
        if (state.destroyed) return;
        if ((container.clientWidth || 358) !== state.lastW) build();
      }, 120);
      if (typeof ResizeObserver === 'function') {
        state.ro = new ResizeObserver(rebuild);
        state.ro.observe(container);
      }
    }

    function destroy() {
      if (state.destroyed) return;
      state.destroyed = true;
      if (state.io) { state.io.disconnect(); state.io = null; }
      clearTimeout(state.restTimer);
      if (state.ro) { state.ro.disconnect(); state.ro = null; }
      if (clickBound) root.removeEventListener('click', onClick);
      if (root.parentNode) root.parentNode.removeChild(root);
      if (!docked) container.innerHTML = '';
      state.dots = {}; state.hair = null; state.xs = {};
    }

    return { highlightDay: highlightDay, destroy: destroy, el: root };
  }

  /* ======================================================== Sparkline */

  // Decorative 100×28 polyline of the trek's sleep altitudes, y-normalised to
  // MBH.SPARK_RANGE so eight cards read against one scale. Returns markup.
  function Sparkline(trek) {
    var vals = (trek.sparkline || (trek.days_data || []).map(function (d) { return d.alt; })).map(Number);
    var range = MBH.SPARK_RANGE || [800, 5600];
    var lo = range[0], hi = range[1];
    var n = vals.length;
    var pts = vals.map(function (v, i) {
      var x = n > 1 ? 1.5 + (i / (n - 1)) * 97 : 50;
      var t = Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
      return r1(x) + ',' + r1(26 - t * 24);
    }).join(' ');
    return '<svg class="trek-card__spark" viewBox="0 0 100 28" width="100" height="28" aria-hidden="true" focusable="false">' +
      '<polyline class="thread__line" points="' + esc(pts) + '" fill="none" stroke="var(--thread)" stroke-width="2.5" ' +
      'stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"></polyline></svg>';
  }

  MBH.RouteMap = RouteMap;
  MBH.ElevationProfile = ElevationProfile;
  MBH.Sparkline = Sparkline;
})();

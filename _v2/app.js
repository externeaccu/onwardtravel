/* app.js -- Magic Beyond Himalaya V2 public app (FINAL-SPEC section 6 + ADDENDUM 1)
 *
 * Owns: storage guards, theme, CapabilityHub (caps), store + cache, the
 * exactly-once snapshot subscriptions, write helpers and the booking write
 * path, the hash router, every public view, the sheet / toast / copy /
 * inline-confirm primitives, the WhatsApp builder and formatting.
 * Exports window.MBH.app, which admin.js (MBH.mountAdmin) builds on.
 *
 * Capability rule: the whole page renders before window.claude.use() is
 * called; db/user light features up when (and if) they resolve. This file
 * never reads window.claude.db.
 *
 * Escaping rule: every string that came from a user or the database goes
 * through esc() before it is interpolated into markup.
 */
(function () {
  'use strict';

  var MBH = window.MBH = window.MBH || {};
  var SITE = MBH.SITE || {};
  var SITE_NAME = SITE.name || 'Magic Beyond Himalaya';

  /* =================================================================== utils */

  var ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC_MAP[c]; }); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function media(q) { try { return !!(window.matchMedia && window.matchMedia(q).matches); } catch (e) { return false; } }
  function reduced() { return media('(prefers-reduced-motion: reduce)'); }
  function isDesktop() { return media('(min-width:1024px)'); }
  function nextFrame(fn) { if (window.requestAnimationFrame) window.requestAnimationFrame(function () { fn(); }); else setTimeout(fn, 16); }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function plural(n, one, many) { return n === 1 ? one : many; }
  function cap1(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function toNum(v, fallback) { var n = Number(v); return v === null || v === '' || v === undefined || !isFinite(n) ? fallback : n; }
  // Resolve a possibly-throwing, possibly-async call to a value or null. Never rejects.
  function safeCall(fn) { try { return Promise.resolve(fn()).catch(function () { return null; }); } catch (e) { return Promise.resolve(null); } }
  function withTimeout(p, ms) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(new Error('timeout')); }, ms);
      Promise.resolve(p).then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
    });
  }
  function treks() { return Array.isArray(MBH.TREKS) ? MBH.TREKS : []; }
  function trekById(id) {
    if (typeof MBH.trekById === 'function') return MBH.trekById(id);
    return treks().find(function (t) { return t.id === id; });
  }
  function scrollTop() {
    try { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, 0); }
  }

  /* ------------------------------------------------------------------ icons */
  function svgIcon(cls, inner) { return '<svg class="' + cls + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + inner + '</svg>'; }
  var PATHS = {
    chat: '<path d="M20.5 11.5a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.6-4.3A8.5 8.5 0 1 1 20.5 11.5z"/><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z"/>',
    system: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none"/>',
    home: '<path d="M3.5 10.5 12 4l8.5 6.5V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z"/>',
    dates: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    treks: '<path d="M2.5 20 9 8.5l4 6.5 2.5-3.5 6 8.5z"/>',
    trips: '<path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    back: '<path d="M15 5l-7 7 7 7"/>'
  };
  var ICON = {
    wa: svgIcon('btn__icon', PATHS.chat),
    chat: svgIcon('', PATHS.chat),
    close: svgIcon('', PATHS.close),
    back: svgIcon('', PATHS.back),
    theme: { system: svgIcon('', PATHS.system), light: svgIcon('', PATHS.sun), dark: svgIcon('', PATHS.moon) },
    tab: function (name) { return svgIcon('tabbar__icon', PATHS[name]); }
  };

  /* ======================================================== spec 6.1 storage */

  // JSON-encoded, try/catch-wrapped access; never throws (private mode, blocked storage).
  function makeArea(name) {
    return {
      get: function (key, fallback) {
        try { var raw = window[name].getItem(key); return raw == null ? fallback : JSON.parse(raw); } catch (e) { return fallback; }
      },
      set: function (key, value) {
        try { window[name].setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
      },
      remove: function (key) { try { window[name].removeItem(key); } catch (e) { /* ignore */ } }
    };
  }
  var local = makeArea('localStorage');
  var storage = { get: local.get, set: local.set, remove: local.remove, session: makeArea('sessionStorage') };

  /* ========================================================== spec 6.14 fmt */

  var WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  var fmt = {
    parse: function (iso) {
      var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
      return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
    },
    iso: function (date) {
      if (!(date instanceof Date) || isNaN(date.getTime())) return '';
      return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
    },
    todayISO: function () { return fmt.iso(new Date()); },
    addDays: function (iso, n) {
      var d = fmt.parse(iso); if (!d) return '';
      d.setDate(d.getDate() + (parseInt(n, 10) || 0));
      return fmt.iso(d);
    },
    endDate: function (start, days) { return fmt.addDays(start, Math.max(1, parseInt(days, 10) || 1) - 1); },
    short: function (iso) { var d = fmt.parse(iso); return d ? WD[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] : ''; },
    long: function (iso) { var d = fmt.parse(iso); return d ? d.getDate() + ' ' + MONTH[d.getMonth()] + ' ' + d.getFullYear() : ''; },
    monthKey: function (iso) { return String(iso || '').slice(0, 7); },
    monthLabel: function (key) { var m = /^(\d{4})-(\d{2})$/.exec(String(key || '')); return m ? MONTH[+m[2] - 1] + ' ' + m[1] : ''; },
    daysBetween: function (a, b) {
      var x = fmt.parse(a), y = fmt.parse(b);
      return x && y ? Math.round((y.getTime() - x.getTime()) / 864e5) : 0;   // round absorbs DST hours
    },
    rel: function (ms) {
      var s = Math.max(0, (Date.now() - Number(ms || 0)) / 1000);
      if (s < 60) return 'just now';
      var m = Math.floor(s / 60); if (m < 60) return m + ' min ago';
      var h = Math.floor(m / 60); if (h < 24) return h + ' h ago';
      var d = Math.floor(h / 24); return d + ' ' + plural(d, 'day', 'days') + ' ago';
    },
    money: function (n) { var v = toNum(n, null); return v === null ? '' : (v < 0 ? '-' : '') + '$' + fmt.num(Math.abs(v)); },
    num: function (n) {
      var v = Math.round(Number(n));
      if (!isFinite(v)) return '';
      return (v < 0 ? '-' : '') + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },
    esc: esc
  };
  // Private formatting helpers (not part of the fmt contract).
  function wdMon(iso) { var d = fmt.parse(iso); return d ? WD[d.getDay()] + ' \u00b7 ' + MON[d.getMonth()] : ''; }
  function signedM(n) { return (n > 0 ? '+' : '\u2212') + fmt.num(Math.abs(n)) + ' m'; }

  /* ============================================================ spec 6.2 theme */

  var THEMES = ['system', 'light', 'dark'];
  var currentTheme = (function () {
    var t = storage.get('mbh.theme', null);
    if (THEMES.indexOf(t) >= 0) return t;
    var attr = document.documentElement.getAttribute('data-theme');
    return attr === 'light' || attr === 'dark' ? attr : 'system';
  })();
  var theme = {
    get: function () { return currentTheme; },
    set: function (mode) {
      if (THEMES.indexOf(mode) < 0) mode = 'system';
      currentTheme = mode;
      var el = document.documentElement;
      if (mode === 'system') el.removeAttribute('data-theme'); else el.setAttribute('data-theme', mode);
      storage.set('mbh.theme', mode);
      paintThemeButton();
      return mode;
    },
    cycle: function () { return theme.set(THEMES[(THEMES.indexOf(currentTheme) + 1) % THEMES.length]); }
  };
  function paintThemeButton() {
    var b = $('.iconbtn--theme'); if (!b) return;
    var next = THEMES[(THEMES.indexOf(currentTheme) + 1) % THEMES.length];
    b.innerHTML = ICON.theme[currentTheme];
    b.setAttribute('aria-label', 'Theme: ' + currentTheme + '. Switch to ' + next);
    b.setAttribute('title', 'Theme: ' + currentTheme);
  }

  /* ============================================================ spec 6.4 store */

  var storeListeners = new Map();
  var store = {
    departures: null,
    departuresTimeout: false,
    departuresSource: 'none',
    departuresCachedAt: null,     // ms of the cache we booted from (for the "cached ... ago" note)
    settings: null,
    myBookings: null,
    adminBookings: null,
    adminBookingsRaw: null,
    set: function (key, value) { store[key] = value; store.emit(key); return value; },
    get: function (key) { return store[key]; },
    on: function (key, fn) {
      if (!storeListeners.has(key)) storeListeners.set(key, new Set());
      storeListeners.get(key).add(fn);
      return function off() { var s = storeListeners.get(key); if (s) s.delete(fn); };
    },
    // Notifies listeners of `key`, then wildcard ('*') listeners (the router uses '*').
    emit: function (key) {
      [key, '*'].forEach(function (k, i) {
        if (i === 1 && key === '*') return;
        var s = storeListeners.get(k); if (!s) return;
        Array.from(s).forEach(function (fn) { try { fn(key, store[key]); } catch (e) { console.error(e); } });
      });
    }
  };

  /* ================================================ spec 6.5 snapshot helpers */

  function snapData(snap) {
    if (!snap) return null;
    var ex = snap.exists;
    if (typeof ex === 'function') { try { if (!ex.call(snap)) return null; } catch (e) { return null; } }
    else if (ex === false) return null;
    var d;
    if (typeof snap.data === 'function') d = snap.data();
    else if (snap.data !== undefined) d = snap.data;
    else d = 'exists' in snap ? null : snap;             // a plain data object
    return d && typeof d === 'object' ? d : null;
  }
  function snapExists(snap) {
    if (!snap) return false;
    if (typeof snap.exists === 'function') { try { return !!snap.exists.call(snap); } catch (e) { return false; } }
    if (typeof snap.exists === 'boolean') return snap.exists;
    return snapData(snap) !== null;
  }
  function docsOf(snap) {
    if (!snap) return [];
    var list = [];
    if (Array.isArray(snap)) list = snap;
    else if (Array.isArray(snap.docs)) list = snap.docs;
    else if (typeof snap.forEach === 'function') snap.forEach(function (d) { list.push(d); });
    var out = [];
    list.forEach(function (d) {
      var data = snapData(d); if (!data) return;
      var row = Object.assign({}, data);
      if (d && d.id != null && d !== data) row.id = d.id;      // the document id is the truth
      out.push(row);
    });
    return out;
  }

  /* ====================================================== spec 6.3 CapabilityHub */

  var resolveDbReady, resolveUserReady, capsInited = false, canEditMemo = null;
  var profileMemo = {};
  var caps = {
    status: { db: 'pending', user: 'pending' },
    db: null,
    user: null,
    me: null,
    canWrite: null,
    // Created up front so admin.js can chain on them even before init() runs.
    dbReady: new Promise(function (r) { resolveDbReady = r; }),
    userReady: new Promise(function (r) { resolveUserReady = r; }),
    canEdit: function () {
      if (!canEditMemo) {
        canEditMemo = caps.userReady
          .then(function (u) { return u ? safeCall(function () { return u.canEdit(); }) : false; })
          .then(function (v) { return v === true; }, function () { return false; });
      }
      return canEditMemo;
    },
    // Map<id, {name, avatarUrl}>; memoised per id for the session.
    profiles: function (ids) {
      var want = Array.from(new Set((ids || []).filter(Boolean)));
      var cache = Object.assign({}, storage.session.get('mbh.profiles', {}) || {}, profileMemo);
      var out = new Map();
      var missing = want.filter(function (id) { if (cache[id]) { out.set(id, cache[id]); return false; } return true; });
      if (!missing.length) return Promise.resolve(out);
      return caps.userReady.then(function (u) {
        if (!u || typeof u.profiles !== 'function') return out;
        return safeCall(function () { return u.profiles(missing); }).then(function (res) {
          missing.forEach(function (id) {
            var p = res instanceof Map ? res.get(id) : (res && res[id]);
            if (!p) return;
            var v = { name: p.name || '', avatarUrl: p.avatarUrl || null };
            profileMemo[id] = v; cache[id] = v; out.set(id, v);
          });
          storage.session.set('mbh.profiles', cache);
          return out;
        });
      }).catch(function () { return out; });
    },
    init: function () {
      if (capsInited) return;
      capsInited = true;
      var use = function (n) {
        try {
          var p = window.claude && typeof window.claude.use === 'function' ? window.claude.use(n) : null;
          return Promise.resolve(p).catch(function () { return null; });
        } catch (e) { return Promise.resolve(null); }
      };
      use('db').then(function (db) {
        db = db || null;
        caps.db = db;
        caps.status.db = db ? 'ready' : 'null';
        if (db) subscribePublic(db);
        store.emit('status');
        return db;
      }).catch(function () {
        caps.status.db = 'null'; store.emit('status'); return null;
      }).then(resolveDbReady);

      use('user').then(async function (u) {
        u = u || null;
        caps.user = u;
        if (u) {
          var me = await safeCall(function () { return u.me(); });
          caps.me = me && typeof me === 'object' ? me : null;
          var cw = await safeCall(function () { return u.can('data.write'); });
          caps.canWrite = cw === true ? true : cw === false ? false : null;
        }
        caps.status.user = u ? 'ready' : 'null';
        store.emit('status');
        return u;
      }).catch(function () {
        caps.status.user = 'null'; store.emit('status'); return null;
      }).then(resolveUserReady);

      Promise.all([caps.dbReady, caps.userReady]).then(subscribeMine);
      // Live regions show a skeleton for at most 4s.
      setTimeout(function () { if (store.departures === null) store.set('departuresTimeout', true); }, 4000);
    }
  };

  /* ================================================= spec 6.5 subscriptions */

  var publicSubscribed = false, mineSubscribed = false;
  function subscribePublic(db) {
    if (publicSubscribed) return;
    publicSubscribed = true;
    try {
      db.collection('departures').onSnapshot(function (snap) {
        var docs = docsOf(snap);
        store.departuresSource = 'live';      // set quietly first so the departures emit already sees "live"
        store.set('departures', docs);
        store.set('departuresSource', 'live');
        storage.set('mbh.cache.departures', { at: Date.now(), docs: docs });
      }, function () { store.set('departuresTimeout', true); });
    } catch (e) { store.set('departuresTimeout', true); }
    try {
      db.doc('settings/site').onSnapshot(function (snap) { store.set('settings', snapData(snap)); }, function () {});
    } catch (e) { /* settings fall back to MBH.SITE */ }
  }
  function subscribeMine() {
    if (mineSubscribed) return;
    if (!(caps.db && caps.me && caps.me.id)) return;
    mineSubscribed = true;
    try {
      caps.db.doc('bookings/' + caps.me.id).onSnapshot(function (snap) {
        store.set('myBookings', snapData(snap) || { items: [] });
      }, function () {});
    } catch (e) { /* my-trips falls back to its timeout state */ }
  }

  /* ======================================================== selectors */

  var ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
  // A departure whose start is before today is under way or over: never bookable from the site.
  function isPastStart(iso) { return ISO_RE.test(String(iso || '')) && iso < fmt.todayISO(); }
  function byStart(a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : String(a.id).localeCompare(String(b.id)); }
  var departures = {
    // open/full, not in the past, for a trek we know, sorted by start.
    public: function () {
      var today = fmt.todayISO();
      return (store.departures || []).filter(function (d) {
        return d && ISO_RE.test(d.start) && (d.status === 'open' || d.status === 'full') && d.start >= today && !!trekById(d.trekId);
      }).sort(byStart);
    },
    open: function () { return departures.public().filter(function (d) { return d.status === 'open'; }); },
    forTrek: function (trekId) { return departures.public().filter(function (d) { return d.trekId === trekId; }); },
    byId: function (id) { return (store.departures || []).find(function (d) { return d && d.id === id; }) || null; }
  };
  function settings() {
    var s = store.settings || {};
    return Object.assign({}, s, { whatsapp: s.whatsapp || SITE.whatsapp, email: s.email || SITE.email });
  }

  /* ===================================================== spec 6.6 write helpers */

  var writeChains = new Map();   // path -> tail promise of the per-path chain
  var inflightCount = new Map(); // path -> number of queued/running writes
  function writeQueue(path, fn) {
    var prev = writeChains.get(path) || Promise.resolve();
    inflightCount.set(path, (inflightCount.get(path) || 0) + 1);
    store.emit('inflight');
    var run = prev.catch(function () {}).then(function () { return fn(); });
    var tail = run.catch(function () {}).then(function () {
      var n = (inflightCount.get(path) || 1) - 1;
      if (n <= 0) inflightCount.delete(path); else inflightCount.set(path, n);
      if (writeChains.get(path) === tail) writeChains.delete(path);
      store.emit('inflight');
    });
    writeChains.set(path, tail);
    return run;
  }
  function inFlight(path) { return inflightCount.has(path); }
  function newBookingId() { return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
  function slug(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9-]/g, ''); }

  // Union by item.id; when both sides hold an id the higher updatedAt wins (tie -> stored).
  function mergeItems(stored, incoming) {
    var out = [], index = new Map();
    (stored || []).forEach(function (it) {
      if (it && it.id != null) { index.set(it.id, out.length); }
      out.push(it);
    });
    (incoming || []).forEach(function (it) {
      if (!it || it.id == null) return;
      if (index.has(it.id)) {
        var i = index.get(it.id), s = out[i];
        if ((Number(it.updatedAt) || 0) > (Number(s && s.updatedAt) || 0)) out[i] = it;
      } else { index.set(it.id, out.length); out.push(it); }
    });
    return out;
  }

  /* ================================================ spec 6.7 booking write path */

  function canSaveBooking() { return !!(caps.me && caps.me.id && caps.canWrite === true && caps.db); }

  function saveBooking(item) {
    var path = 'bookings/' + caps.me.id, ref = caps.db.doc(path);
    return writeQueue(path, async function () {
      var snap = await ref.get();
      var cur = snapData(snap);
      var items = mergeItems(cur ? cur.items || [] : [], [item]);
      if (snapExists(snap)) await ref.update({ items: items }); else await ref.set({ items: items });
    });
  }

  // Bookers only ever move their own item requested -> cancelled, after a fresh read.
  function withdrawBooking(itemId) {
    var path = 'bookings/' + caps.me.id, ref = caps.db.doc(path);
    return writeQueue(path, async function () {
      var snap = await ref.get();
      var cur = snapData(snap);
      var items = (cur && Array.isArray(cur.items) ? cur.items : []).slice();
      var i = items.findIndex(function (x) { return x && x.id === itemId; });
      if (i < 0) throw new Error('missing');
      if (items[i].status !== 'requested') return { stale: items[i].status };
      items[i] = Object.assign({}, items[i], { status: 'cancelled', updatedAt: Date.now() });
      await ref.update({ items: items });
      return { ok: true };
    });
  }

  /* ================================================ spec 6.13 WhatsApp builder */

  var wa = {
    digits: function () { return String(settings().whatsapp || SITE.whatsapp || '').replace(/\D/g, ''); },
    link: function (text) { return 'https://wa.me/' + wa.digits() + '?text=' + encodeURIComponent(text || ''); },
    open: function (text) { try { return window.open(wa.link(text), '_blank', 'noopener'); } catch (e) { return null; } },
    msg: {
      ask: function () { return "Hi Sandip, I'm planning a trek in Nepal and would like to ask about dates."; },
      askTrek: function (trek) { return "Hi Sandip, I'm interested in " + trek.name + ' (' + trek.days + ' days). Could you tell me about upcoming dates?'; },
      askDeparture: function (trek, dep) { return "Hi Sandip, I'm interested in the " + trek.name + ' departure starting ' + fmt.long(dep.start) + ' (ref ' + dep.id + '). Is there space?'; },
      waitlist: function (trek, dep) { return 'Hi Sandip, the ' + trek.name + ' departure on ' + fmt.short(dep.start) + ' (ref ' + dep.id + ') shows full. Could you add me to the waitlist?'; },
      request: function (trek, dep, f) {
        return ["Hi Sandip, I'd like to request a spot.",
          'Trek: ' + trek.name + ' (' + trek.days + ' days)',
          'Departure: ' + fmt.short(dep.start) + ' to ' + fmt.short(fmt.endDate(dep.start, dep.days)) + ' (ref ' + dep.id + ')',
          'Group: ' + f.pax,
          'Name: ' + f.name,
          'Email: ' + f.email,
          'WhatsApp: ' + f.whatsapp,
          'Notes: ' + (f.note || '-')].join('\n');
      },
      changeBooking: function (trek, item) { return 'Hi Sandip, about my confirmed booking ' + String(item.id).toUpperCase() + ' for ' + trek.name + ' on ' + fmt.short(item.start) + " \u2014 I'd like to ask about a change."; },
      adminChat: function (item, trek, dep) { return 'Hi ' + item.name + ', this is Sandip from Magic Beyond Himalaya about your ' + trek.name + ' request for ' + fmt.short(dep ? dep.start : item.start) + ' (ref ' + String(item.id).toUpperCase() + ').'; }
    }
  };
  function waDisplay() {
    var d = wa.digits();
    return d === String(SITE.whatsapp || '') ? (SITE.whatsappDisplay || '+' + d) : '+' + d;
  }

  /* ========================================================== spec 6.11 toast */

  function toast(message, opts) {
    opts = opts || {};
    var root = document.getElementById('toast-root'); if (!root) return;
    var el = document.createElement('div');
    el.className = 'toast' + (opts.kind === 'ok' ? ' toast--ok' : opts.kind === 'error' ? ' toast--error' : '');
    el.textContent = String(message == null ? '' : message);
    root.appendChild(el);
    while (root.children.length > 2) root.removeChild(root.firstChild);   // max 2 visible
    nextFrame(function () { el.classList.add('is-in'); });
    setTimeout(function () {
      el.classList.remove('is-in');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
    }, opts.ms || 2600);
  }

  /* =========================================================== spec 6.12 copy */

  async function copy(text, btn) {
    text = String(text == null ? '' : text);
    var ok = false;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await withTimeout(navigator.clipboard.writeText(text), 1500);
        ok = true;
      }
    } catch (e) { ok = false; }
    if (!ok) {
      var active = document.activeElement;
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, text.length);
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (e) { ok = false; }
      if (active && active.focus) { try { active.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    }
    if (ok) {
      if (btn) {
        if (btn._copyTimer) clearTimeout(btn._copyTimer);
        else btn._copyLabel = btn.innerHTML;
        btn.classList.add('is-copied');
        btn.textContent = 'Copied';
        btn._copyTimer = setTimeout(function () {
          btn.classList.remove('is-copied');
          btn.innerHTML = btn._copyLabel;
          btn._copyTimer = null;
        }, 1500);
      }
    } else {
      toast("Couldn't copy \u2014 the text is selectable", { kind: 'error' });
    }
    return ok;
  }

  /* ==================================================== InlineConfirm */

  // Replaces `btn` in place with "question? [yes] [no]"; auto-reverts after 6s.
  function inlineConfirm(btn, o) {
    o = o || {};
    if (!btn || !btn.parentNode) return null;
    var danger = o.danger !== false;
    var wrap = document.createElement('span');
    wrap.className = 'inline-confirm';
    wrap.setAttribute('role', 'group');
    wrap.innerHTML = '<span class="inline-confirm__q">' + esc(o.question || 'Are you sure?') + '</span>' +
      '<button type="button" class="btn btn--sm ' + (danger ? 'btn--danger' : 'btn--primary') + ' inline-confirm__yes">' + esc(o.yesLabel || 'Yes') + '</button>' +
      '<button type="button" class="btn btn--ghost btn--sm inline-confirm__no">' + esc(o.noLabel || 'Not now') + '</button>';
    var yes = wrap.querySelector('.inline-confirm__yes'), no = wrap.querySelector('.inline-confirm__no');
    var done = false, busy = false;
    btn.parentNode.replaceChild(wrap, btn);
    var timer = setTimeout(revert, 6000);
    function revert() {
      if (done) return;
      done = true;
      clearTimeout(timer);
      var refocus = wrap.contains(document.activeElement);
      if (wrap.parentNode) wrap.parentNode.replaceChild(btn, wrap);
      if (refocus && btn.isConnected) { try { btn.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    }
    no.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); revert(); });
    yes.addEventListener('click', async function (e) {
      e.preventDefault(); e.stopPropagation();
      if (done || busy) return;
      busy = true;
      clearTimeout(timer);
      yes.disabled = true; no.disabled = true;
      yes.classList.add('is-busy');
      try { if (typeof o.onYes === 'function') await o.onYes(); }
      catch (err) { console.error(err); }
      finally { revert(); }
    });
    try { no.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    return { el: wrap, revert: revert };
  }

  /* =========================================================== spec 6.10 sheet */

  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  function focusables(el) {
    return $$(FOCUSABLE, el).filter(function (x) { return x.offsetParent !== null || x === document.activeElement; });
  }

  var sheet = (function () {
    var cur = null, teardownTimer = null;
    function rootEl() { return document.getElementById('sheet-root'); }

    function open(o) {
      o = o || {};
      close({ silent: true });
      var root = rootEl();
      if (!root) return { close: function () {}, el: null };
      clearTimeout(teardownTimer);
      var desk = isDesktop();
      var back = o.closeLabel === 'Back';
      var cls = 'sheet' + (o.full && !desk ? ' sheet--full' : '') + (o.panel && desk ? ' sheet--panel' : '');
      root.innerHTML =
        '<div class="sheet__backdrop" data-sheet-dismiss aria-hidden="true"></div>' +
        '<div class="' + cls + '" role="dialog" aria-modal="true" aria-labelledby="sheet-title">' +
          '<div class="sheet__handle" data-sheet-dismiss aria-hidden="true"></div>' +
          '<div class="sheet__head"><h2 class="sheet__title" id="sheet-title">' + esc(o.title || '') + '</h2>' +
            '<button type="button" class="iconbtn sheet__close" data-sheet-dismiss aria-label="' + (back ? 'Back' : 'Close') + '">' + (back ? ICON.back : ICON.close) + '</button></div>' +
          '<div class="sheet__body"></div>' +
          (o.foot ? '<div class="sheet__foot"></div>' : '') +
        '</div>';
      var sheetEl = root.querySelector('.sheet');
      var bodyEl = root.querySelector('.sheet__body');
      if (typeof o.body === 'string') bodyEl.innerHTML = o.body; else if (o.body) bodyEl.appendChild(o.body);
      var footEl = root.querySelector('.sheet__foot');
      if (footEl) { if (typeof o.foot === 'string') footEl.innerHTML = o.foot; else footEl.appendChild(o.foot); }

      var entry = { sheetEl: sheetEl, onClose: o.onClose, prevFocus: document.activeElement };
      var handle = { el: sheetEl, close: function (opts) { if (cur === entry) close(opts); } };
      entry.handle = handle;
      cur = entry;
      state.sheet = handle;

      root.hidden = false;
      root.classList.add('is-open');
      var appEl = document.getElementById('app');
      if (appEl) appEl.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = 'hidden';
      nextFrame(function () { if (cur === entry) sheetEl.classList.add('is-in'); });
      var first = focusables(sheetEl)[0];
      if (first) { try { first.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
      return handle;
    }

    function close(opts) {
      opts = opts || {};
      var entry = cur;
      if (!entry) return;
      cur = null;
      state.sheet = null;
      var root = rootEl();
      entry.sheetEl.classList.remove('is-in');
      if (root) root.classList.remove('is-open');
      var appEl = document.getElementById('app');
      if (appEl) appEl.removeAttribute('aria-hidden');
      document.body.style.overflow = '';
      var finish = function () { if (cur || !root) return; root.innerHTML = ''; root.hidden = true; };
      if (opts.silent || reduced()) finish(); else teardownTimer = setTimeout(finish, 260);
      if (!opts.silent) {
        var pf = entry.prevFocus;
        if (pf && pf.isConnected && pf.focus) { try { pf.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
        if (typeof entry.onClose === 'function') { try { entry.onClose(); } catch (e) { console.error(e); } }
      }
    }

    // Escape closes; Tab wraps inside the open sheet.
    function onKey(e) {
      if (!cur) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      var f = focusables(cur.sheetEl);
      if (!f.length) { e.preventDefault(); return; }
      var first = f[0], last = f[f.length - 1], a = document.activeElement, inside = cur.sheetEl.contains(a);
      if (e.shiftKey && (a === first || !inside)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (a === last || !inside)) { e.preventDefault(); first.focus(); }
    }

    return { open: open, close: close, onKey: onKey, isOpen: function () { return !!cur; } };
  })();

  /* ======================================================= shared markup */

  function waBtn(text, label, cls) {
    return '<a class="btn btn--dark ' + (cls || '') + '" href="' + esc(wa.link(text)) + '" target="_blank" rel="noopener">' + ICON.wa + '<span>' + esc(label) + '</span></a>';
  }
  // Opens the editable Ask sheet (prefilled) instead of jumping straight to WhatsApp.
  function askBtn(text, label, cls, withIcon) {
    return '<button type="button" class="btn ' + (cls || 'btn--ghost') + '" data-ask="' + esc(text) + '">' + (withIcon ? ICON.wa : '') + '<span>' + esc(label) + '</span></button>';
  }
  function copyField(text, label) {
    return '<div class="copyfield"><span class="copyfield__text tnum"><span class="sr-only">' + esc(label) + ': </span>' + esc(text) + '</span>' +
      '<button type="button" class="btn btn--ghost btn--sm copyfield__btn" data-copy="' + esc(text) + '">Copy<span class="sr-only"> ' + esc(label) + '</span></button></div>';
  }
  function contactStrip() {
    var s = settings();
    return '<div class="contact">' + copyField(waDisplay(), 'WhatsApp number') + copyField(s.email, 'Email address') +
      waBtn(wa.msg.ask(), 'Message Sandip on WhatsApp', 'btn--block') + '</div>';
  }
  function footer() {
    return '<footer class="footer"><div class="container">' +
      '<div><p class="footer__wordmark">' + esc(SITE_NAME) + '</p>' +
        '<p class="eyebrow" style="margin-top:8px">' + esc(SITE.tagline || '') + '</p>' +
        '<p style="margin-top:12px;color:var(--on-brand-2)">Guided by ' + esc(SITE.guide || '') + '. Pokhara and Kathmandu, Nepal.</p></div>' +
      '<div><p class="eyebrow" style="margin-bottom:8px">Contact Sandip</p><div data-live="settings" data-part="contact">' + contactStrip() + '</div></div>' +
      '<p class="footer__proto">' + esc(SITE.prototypeLine || '') + '</p>' +
      '</div></footer>';
  }
  function sectionHead(title, o) {
    o = o || {};
    return '<div class="section__head">' +
      (o.eyebrow ? '<p class="section__eyebrow">' + esc(o.eyebrow) + '</p>' : '') +
      '<h2 class="section__title"' + (o.id ? ' id="' + o.id + '"' : '') + '>' + esc(title) + '</h2>' +
      (o.more ? '<a class="section__more" href="' + esc(o.more) + '">' + esc(o.moreLabel) + '</a>' : '') +
      '</div>';
  }
  function skelRows(n) {
    var h = '';
    for (var i = 0; i < n; i++) h += '<div class="skel skel--row"></div>';
    return '<div class="skel-group" data-timeout="4000" aria-hidden="true">' + h + '</div>';
  }
  var LIVE_OFF = '<p class="note note--live-off">Live availability unavailable \u2014 dates may be out of date</p>';

  // Which state the departures data is in, for every live region.
  function depState() {
    if (store.departuresSource === 'live') return 'live';
    if (store.departuresSource === 'cache' && Array.isArray(store.departures)) return 'cache';
    if (caps.status.db === 'null') return 'none';
    if (store.departuresTimeout) return 'timeout';
    return 'pending';
  }
  function staleNote() {
    if (depState() !== 'cache') return '';
    var when = store.departuresCachedAt ? fmt.rel(store.departuresCachedAt) : 'earlier';
    var settled = caps.status.db === 'null' || store.departuresTimeout;
    return '<p class="note note--stale">Showing dates cached ' + esc(when) + ' \u2014 ' +
      (settled ? 'live availability unavailable' : 'checking live availability\u2026') + '</p>';
  }
  function emptyDates(st) {
    return '<div class="empty"><p class="empty__title">Dates are set by Sandip and posted here.</p>' +
      '<p class="empty__body">Ask on WhatsApp for the next one.</p>' +
      '<div class="empty__actions">' + waBtn(wa.msg.ask(), 'Ask on WhatsApp') + '</div></div>' +
      (st === 'timeout' ? LIVE_OFF : '');
  }

  // SpotsPill: status wins over the number; the number is always written.
  function spotsInfo(dep) {
    var cap = Math.max(0, Math.floor(toNum(dep.capacity, 0)));
    var left = Math.max(0, Math.floor(toNum(dep.spotsLeft, cap)));
    if (cap > 0) left = Math.min(left, cap);             // never "46 of 8": the counter can't exceed capacity
    if (dep.status === 'closed') return { cls: 'spots--closed', text: 'Closed', cap: cap, left: left, closed: true };
    if (dep.status === 'full' || left <= 0) return { cls: 'spots--full', text: 'Full', cap: cap, left: 0, full: true };
    if (left <= 2) return { cls: 'spots--few', text: left + ' left', cap: cap, left: left };
    return { cls: 'spots--plenty', text: left + ' of ' + cap + ' spots left', cap: cap, left: left };
  }
  function spotsPill(dep) { var s = spotsInfo(dep); return '<span class="pill spots ' + s.cls + ' tnum">' + esc(s.text) + '</span>'; }
  function depDays(dep, trek) { return Math.max(1, toNum(dep.days, trek ? trek.days : 1)); }
  function hasPrice(dep) { return toNum(dep.price, null) !== null && Number(dep.price) > 0; }

  /* ------------------------------------------------- DepartureRow (shared) */
  function renderDepartureRow(dep, opts) {
    opts = opts || {};
    var showTrek = opts.showTrek !== false;
    var trek = trekById(dep.trekId);
    var id = slug(dep.id);
    var days = depDays(dep, trek);
    var end = fmt.endDate(dep.start, days);
    var s = spotsInfo(dep);
    var pct = s.full ? 100 : (s.cap > 0 ? Math.round(clamp((s.cap - s.left) / s.cap, 0, 1) * 100) : 0);
    var price = hasPrice(dep) ? fmt.money(dep.price) + ' pp' : (trek ? 'from ' + fmt.money(trek.fromPrice) + ' pp' : '');
    var d = fmt.parse(dep.start);
    var title = showTrek ? (trek ? trek.name : dep.trekId) : fmt.short(dep.start) + ' \u2192 ' + fmt.short(end);
    var cls = 'dep' + (s.full ? ' dep--full' : '') + (opts.dim ? ' dep--dim' : '');
    return '<a class="' + cls + '" href="#departure-' + id + '" data-dep="' + esc(id) + '">' +
      '<div class="dep__date" aria-hidden="true"><span class="dep__day tnum">' + (d ? d.getDate() : '') + '</span><span class="dep__wd">' + esc(wdMon(dep.start)) + '</span></div>' +
      '<div class="dep__body">' +
        '<div class="dep__trek"><span class="sr-only">' + esc(fmt.short(dep.start)) + ': </span>' + esc(title) + '</div>' +
        '<div class="dep__meta tnum">' + days + ' days' + (showTrek ? ' \u00b7 <span class="dep__end">ends ' + esc(fmt.short(end)) + '</span>' : '') + '</div>' +
        '<div class="dep__cap" aria-hidden="true"><div class="dep__cap-fill" style="width:' + pct + '%"></div></div>' +
        (opts.fit ? '<div class="dep__fit">' + esc(opts.fit) + '</div>' : '') +
        (dep.note && opts.showNote !== false ? '<div class="dep__note">' + esc(dep.note) + '</div>' : '') +
      '</div>' +
      '<div class="dep__right"><span class="dep__price tnum">' + esc(price) + '</span>' + spotsPill(dep) + '</div>' +
      '</a>';
  }

  /* --------------------------------------------------------- trek cards */
  function sortedTreks(sort) {
    return treks().slice().sort(function (a, b) {
      if (sort === 'price') return (a.fromPrice - b.fromPrice) || (a.days - b.days);
      return (a.days - b.days) || (a.fromPrice - b.fromPrice);
    });
  }
  // The .diff dot doubles as the separator before the difficulty, so no trailing "·"
  // is left dangling when the difficulty wraps to its own line.
  function trekCard(t) {
    return '<a class="trek-card" href="#trek-' + esc(slug(t.id)) + '" data-trek="' + esc(t.id) + '">' +
      '<div class="trek-card__num tnum">' + t.days + '<span class="trek-card__num-key">days</span></div>' +
      '<div class="trek-card__body">' +
        '<h3 class="trek-card__name">' + esc(t.name) + '</h3>' +
        '<p class="trek-card__meta">' + esc(t.region) + ' \u00b7 ' + esc(fmt.num(t.maxElev)) + ' m <span class="diff diff--' + esc(t.diffKey) + '">' + esc(t.difficulty) + '</span></p>' +
        '<p class="trek-card__next tnum" data-next="' + esc(t.id) + '" hidden></p>' +
      '</div>' +
      (typeof MBH.Sparkline === 'function' ? MBH.Sparkline(t) : '') +
      '<div class="trek-card__price tnum"><span class="trek-card__price-key">from</span><span class="trek-card__price-val">' + esc(fmt.money(t.fromPrice)) + '</span></div>' +
      '<img class="trek-card__thumb" src="' + esc(t.image) + '" alt="' + esc(t.imageAlt || '') + '" width="72" height="72" loading="lazy">' +
      '</a>';
  }
  // "Next: Thu 16 Oct . 3 spots" -- only when live departures exist.
  function fillTrekNext(root) {
    var live = store.departuresSource === 'live';
    $$('.trek-card__next[data-next]', root).forEach(function (el) {
      var d = live ? departures.forTrek(el.getAttribute('data-next'))[0] : null;
      if (!d) { el.hidden = true; el.textContent = ''; return; }
      var s = spotsInfo(d);
      el.textContent = 'Next: ' + fmt.short(d.start) + ' \u00b7 ' + (s.full ? 'full' : s.left + ' ' + plural(s.left, 'spot', 'spots'));
      el.hidden = false;
    });
  }

  /* ------------------------------------------------ guide, quotes, faq */
  function guideQuote() {
    return (SITE.guideQuotes || []).map(function (q) { return cap1(String(q).trim()); }).join(' ');
  }
  function guideBlock(withName) {
    var img = (SITE.images && SITE.images.sandip) || 'images/sandip.jpg';
    return '<div class="intro" style="padding:0">' +
      '<figure class="intro__photo"><img src="' + esc(img) + '" alt="' + esc(SITE.guide || 'Your guide') + ', trekking guide" width="600" height="600" loading="lazy"></figure>' +
      '<div class="intro__text">' +
        (withName ? '<p class="eyebrow">Your guide</p><h2 class="section__title" style="margin:4px 0 12px">' + esc(SITE.guide || '') + '</h2>' : '<p class="eyebrow" style="margin-bottom:8px">' + esc(SITE.guide || '') + '</p>') +
        '<p class="prose">\u201c' + esc(guideQuote()) + '\u201d</p>' +
      '</div></div>';
  }
  function quotesList(list) {
    return '<ul class="quotes">' + (list || []).map(function (r) {
      return '<li><blockquote class="quote"><p class="quote__text">\u201c' + esc(r.quote) + '\u201d</p>' +
        '<p class="quote__who tnum">' + esc(r.name) + ' \u00b7 ' + esc(r.meta) + '</p></blockquote></li>';
    }).join('') + '</ul>';
  }
  function faqList(items) {
    return '<div class="faq">' + (items || []).map(function (qa) {
      return '<details class="faq__item"><summary class="faq__q">' + esc(qa[0]) + '</summary><div class="faq__a prose"><p>' + esc(qa[1]) + '</p></div></details>';
    }).join('') + '</div>';
  }
  function colsBlock() {
    var h3 = function (t) { return '<h3 class="cols__title" style="font-family:var(--font-body)">' + esc(t) + '</h3>'; };
    var li = function (x) { return '<li>' + esc(x) + '</li>'; };
    return '<div class="cols">' +
      '<div class="cols__col">' + h3('Included') + '<ul class="cols__list">' + (MBH.INCLUDED || []).map(li).join('') + '</ul></div>' +
      '<div class="cols__col">' + h3('Not included') + '<ul class="cols__list">' + (MBH.NOT_INCLUDED || []).map(li).join('') + '</ul></div>' +
      '<div class="cols__col">' + h3('Add-ons') + '<ul class="cols__list">' + (MBH.ADDONS || []).map(function (a) {
        return '<li class="addon"><span class="addon__name">' + esc(a[0]) + '</span><span class="addon__price tnum">' + esc(a[1]) + '</span><span class="addon__note">' + esc(a[2]) + '</span></li>';
      }).join('') + '</ul></div>' +
      '</div>';
  }

  /* ------------------------------------------------------------ stepper */
  function stepperHTML(name, val, min, max, labelId) {
    return '<div class="stepper" role="group" aria-labelledby="' + labelId + '" data-stepper="' + name + '" data-min="' + min + '" data-max="' + max + '">' +
      '<button type="button" class="stepper__btn" data-step="-1" aria-label="One fewer person"' + (val <= min ? ' disabled' : '') + '>\u2212</button>' +
      '<output class="stepper__val tnum" aria-live="polite">' + val + '</output>' +
      '<button type="button" class="stepper__btn" data-step="1" aria-label="One more person"' + (val >= max ? ' disabled' : '') + '>+</button>' +
      '</div>';
  }
  function paintStepper(el, val) {
    if (!el) return;
    var min = +el.getAttribute('data-min'), max = +el.getAttribute('data-max');
    el.querySelector('.stepper__val').textContent = val;
    el.querySelector('[data-step="-1"]').disabled = val <= min;
    el.querySelector('[data-step="1"]').disabled = val >= max;
  }
  function stepFrom(btn, val) {
    var el = btn.closest('.stepper');
    return clamp(val + (+btn.getAttribute('data-step') || 0), +el.getAttribute('data-min'), +el.getAttribute('data-max'));
  }
  function priceLine(price, pax) {
    return esc(fmt.money(price)) + ' per person \u00b7 <span class="price-line__total">' + esc(fmt.money(price * pax)) + ' for ' + pax + '</span>';
  }

  /* ---------------------------------------------------------- Ask sheet */
  function openAsk(text) {
    text = text || wa.msg.ask();
    var body = document.createElement('div');
    body.className = 'ask';
    body.innerHTML =
      '<label class="field__label" for="ask-text">Your message</label>' +
      '<textarea class="input input--textarea ask__text" id="ask-text" rows="5">' + esc(text) + '</textarea>' +
      '<p class="field__help">Opens WhatsApp to ' + esc(waDisplay()) + '. Edit anything before you send it.</p>' +
      '<a class="btn btn--dark btn--block ask__open" href="' + esc(wa.link(text)) + '" target="_blank" rel="noopener">' + ICON.wa + '<span>Open WhatsApp</span></a>' +
      copyField(waDisplay(), 'WhatsApp number');
    var ta = body.querySelector('textarea'), a = body.querySelector('.ask__open');
    ta.addEventListener('input', function () { a.href = wa.link(ta.value); });
    return sheet.open({ title: 'Ask Sandip', body: body });
  }
  // The topbar WhatsApp button asks about whatever is on screen.
  function contextAsk() {
    var r = state.route || {};
    if (r.name === 'trek') { var t = trekById(r.id); if (t) return wa.msg.askTrek(t); }
    if (r.name === 'departure' || r.name === 'book') {
      var d = departures.byId(r.id), tk = d && trekById(d.trekId);
      if (d && tk) return isPastStart(d.start) ? wa.msg.askTrek(tk) : wa.msg.askDeparture(tk, d);
      var pd = !d && parseDepId(r.id);
      if (pd && isPastStart(pd.dep.start)) return wa.msg.askTrek(pd.trek);
    }
    return wa.msg.ask();
  }

  // Departure ids are slugs "{trekId}-{YYYYMMDD}[-n]": recover trek + date when no live data exists.
  function parseDepId(id) {
    var m = /^(.+)-(\d{4})(\d{2})(\d{2})(?:-\d+)?$/.exec(String(id || ''));
    if (!m) return null;
    var trek = trekById(m[1]);
    var start = m[2] + '-' + m[3] + '-' + m[4];
    if (!trek || fmt.iso(fmt.parse(start)) !== start) return null;
    return { trek: trek, dep: { id: id, trekId: trek.id, start: start, days: trek.days, capacity: null, spotsLeft: null, price: null, status: 'open', note: '' } };
  }

  /* ============================================================ chrome */

  var NAV = [['home', 'Home'], ['agenda', 'Dates'], ['treks', 'Treks'], ['my-trips', 'My trips'], ['about', 'About']];
  var TABS = [['home', 'Home', 'home'], ['agenda', 'Dates', 'dates'], ['treks', 'Treks', 'treks'], ['my-trips', 'My trips', 'trips']];
  var SECTION_OF = { home: 'home', agenda: 'agenda', departure: 'agenda', book: 'agenda', treks: 'treks', trek: 'treks', 'my-trips': 'my-trips', about: 'about' };
  var tabsMode = null;      // 'public' | 'admin'
  var chromeMode = 'tabs';  // 'tabs' | 'cta' | 'none' | 'admin'
  var ctaHandler = null;

  function renderTopbar() {
    var tb = document.getElementById('topbar'); if (!tb) return;
    tb.innerHTML = '<div class="topbar__inner">' +
      '<a class="topbar__brand" href="#home" aria-label="' + esc(SITE_NAME) + ', home">' +
        '<span class="topbar__wordmark">' + esc(SITE_NAME) + '</span>' +
        '<svg class="topbar__thread thread" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path class="thread__line" d="M1.5 3H98.5"/></svg>' +
      '</a>' +
      '<nav class="topbar__nav" aria-label="Sections">' + NAV.map(function (n) {
        return '<a class="topbar__link" href="#' + n[0] + '" data-nav="' + n[0] + '">' + n[1] + '</a>';
      }).join('') + '</nav>' +
      '<div class="topbar__actions">' +
        '<button type="button" class="iconbtn iconbtn--wa" aria-label="Ask Sandip on WhatsApp" title="Ask Sandip on WhatsApp">' + ICON.chat + '</button>' +
        '<button type="button" class="iconbtn iconbtn--theme"></button>' +
      '</div></div>';
    paintThemeButton();
  }
  // The wordmark underline draws once, on first load, only when home is the view.
  function drawWordmarkThread(animate) {
    var svg = $('.topbar__thread'), line = svg && svg.querySelector('.thread__line');
    if (!line) return;
    if (!animate || reduced()) { svg.classList.add('is-drawn'); return; }
    line.setAttribute('pathLength', '1');
    line.setAttribute('stroke-dasharray', '1');
    line.setAttribute('stroke-dashoffset', '1');
    nextFrame(function () { nextFrame(function () { svg.classList.add('is-drawn'); }); });
  }

  function renderTabs() {
    var tb = document.getElementById('tabbar'); if (!tb) return;
    tb.className = 'tabbar';
    tb.innerHTML = TABS.map(function (t) {
      return '<a class="tabbar__tab" href="#' + t[0] + '" data-tab="' + t[0] + '">' + ICON.tab(t[2]) + '<span class="tabbar__label">' + t[1] + '</span></a>';
    }).join('') + '<span class="tabbar__ink" aria-hidden="true" style="opacity:0"></span>';
    tabsMode = 'public';
  }
  function paintNav(route) {
    var sec = SECTION_OF[route.name] || null;
    $$('.topbar__link').forEach(function (a) {
      var on = a.getAttribute('data-nav') === sec;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    var idx = -1;
    $$('#tabbar .tabbar__tab').forEach(function (a, i) {
      var on = a.getAttribute('data-tab') === sec;
      if (on) idx = i;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    var ink = $('#tabbar .tabbar__ink');
    if (ink) {
      if (idx < 0) ink.style.opacity = '0';
      else { ink.style.opacity = '1'; ink.style.transform = 'translateX(' + (idx * 100) + '%)'; }
    }
  }
  // Decides which bar occupies the bottom slot (spec 1.3).
  function setChrome(mode) {
    chromeMode = mode;
    var tb = document.getElementById('tabbar'), cb = document.getElementById('ctabar');
    if (tb) {
      if (mode === 'admin') {
        // admin.js renders its tabs into #tabbar; keep it hidden while empty.
        if (tabsMode !== 'admin') { tb.innerHTML = ''; tabsMode = 'admin'; }
        tb.classList.toggle('is-hidden', !tb.children.length);
      } else {
        if (tabsMode !== 'public' || !tb.querySelector('.tabbar__tab')) renderTabs();
        tb.classList.toggle('is-hidden', mode !== 'tabs');
      }
    }
    if (cb) cb.hidden = !(mode === 'cta' && cb.children.length);
  }
  function ctaInner(o) {
    var cls = 'btn ' + (o.dark ? 'btn--dark' : 'btn--primary') + ' ctabar__btn';
    var btn = o.href
      ? '<a class="' + cls + '" href="' + esc(o.href) + '"' + (o.external ? ' target="_blank" rel="noopener"' : '') + '>' + (o.dark ? ICON.wa : '') + '<span>' + esc(o.label) + '</span></a>'
      : '<button type="button" class="' + cls + '" data-cta>' + esc(o.label) + '</button>';
    return '<div class="ctabar__price tnum"><span>' + esc(o.price) + '</span>' + (o.note ? '<span class="ctabar__price-note">' + esc(o.note) + '</span>' : '') + '</div>' + btn;
  }
  function setCta(o) {
    var cb = document.getElementById('ctabar'); if (!cb) return;
    cb.className = 'ctabar';
    cb.innerHTML = ctaInner(o);
    ctaHandler = typeof o.onClick === 'function' ? o.onClick : null;
    cb.hidden = chromeMode !== 'cta';
  }
  function hideCta() {
    var cb = document.getElementById('ctabar');
    if (cb) { cb.hidden = true; cb.innerHTML = ''; }
    ctaHandler = null;
  }
  // >=1024 the CtaBar is rendered inline in the page head instead of fixed.
  function inlineCtaHTML(o) {
    return '<div class="ctabar ctabar--inline"' + (isDesktop() ? '' : ' hidden') + '>' + ctaInner(o) + '</div>';
  }
  function syncInlineCta() { var d = isDesktop(); $$('.ctabar--inline').forEach(function (el) { el.hidden = !d; }); }

  function setTitle(prefix) { document.title = prefix ? prefix + ' \u00b7 ' + SITE_NAME : SITE_NAME; }

  // Coalesces store emits into one region render per microtask, by region name.
  var DEP_KEYS = { departures: 1, departuresTimeout: 1, departuresSource: 1 };
  function makeUpdater(handlers, isDead) {
    var pending = new Set(), scheduled = false;
    return function update(key) {
      var k = DEP_KEYS[key] ? 'departures' : key;
      if (!handlers[k]) return;
      pending.add(k);
      if (scheduled) return;
      scheduled = true;
      Promise.resolve().then(function () {
        scheduled = false;
        var ks = Array.from(pending); pending.clear();
        if (isDead && isDead()) return;
        ks.forEach(function (x) { try { handlers[x](); } catch (e) { console.error(e); } });
      });
    };
  }
  // Re-render a region; keep the view title focused if it was.
  function setRegion(root, sel, html) {
    $$(sel, root).forEach(function (el) { el.innerHTML = html; });
  }

  /* ============================================================= views */

  /* ------------------------------------------------------------- home */
  function viewHome(root) {
    setTitle('');
    root.style.paddingBottom = '0';
    var reviews = (SITE.reviews || []).slice(0, 2);
    root.innerHTML =
      '<div class="hero hero--map"><div class="container">' +
        '<p class="eyebrow">Guided treks in Nepal \u00b7 ' + esc(SITE.guide || '') + '</p>' +
        '<h1 class="hero__tagline view__title" tabindex="-1" style="margin-top:12px">' + esc(SITE.tagline || SITE_NAME) + '</h1>' +
        '<div data-live="settings" data-part="hero">' + heroNote() + '</div>' +
      '</div><div class="hero__map"></div></div>' +
      '<section class="section" aria-labelledby="h-next"><div class="container">' +
        sectionHead('Next departures', { id: 'h-next', more: '#agenda', moreLabel: 'See all dates' }) +
        '<div data-live="departures">' + homeDepartures() + '</div>' +
      '</div></section>' +
      '<section class="section" aria-labelledby="h-treks"><div class="container">' +
        sectionHead('Eight treks', { id: 'h-treks', more: '#treks', moreLabel: 'Filter and sort' }) +
        '<div class="trek-list">' + sortedTreks('days').map(trekCard).join('') + '</div>' +
      '</div></section>' +
      '<section class="section" aria-labelledby="h-guide"><div class="container">' +
        sectionHead('Your guide', { id: 'h-guide', more: '#about', moreLabel: 'About Sandip' }) +
        guideBlock(false) +
      '</div></section>' +
      (reviews.length ? '<section class="section" aria-labelledby="h-trail"><div class="container">' +
        sectionHead('From the trail', { id: 'h-trail', more: '#about', moreLabel: 'All three' }) +
        quotesList(reviews) +
      '</div></section>' : '') +
      '<section class="section" aria-labelledby="h-how"><div class="container">' +
        sectionHead('How booking works', { id: 'h-how' }) +
        '<ol class="cols__list" style="list-style:none" role="list">' + (SITE.howItWorks || []).map(function (s, i) {
          return '<li style="display:flex;align-items:center;gap:12px"><span class="day__num" aria-hidden="true">' + (i + 1) + '</span><span>' + esc(s) + '</span></li>';
        }).join('') + '</ol>' +
      '</div></section>' +
      '<section class="section" aria-labelledby="h-faq"><div class="container">' +
        sectionHead('Questions', { id: 'h-faq', more: '#about', moreLabel: 'All questions' }) +
        faqList((MBH.FAQS || []).slice(0, 4)) +
      '</div></section>' +
      footer();
    fillTrekNext(root);
    // Hero map of all eight routes (overview.js). Optional: the page is complete without it.
    var overview = null;
    try {
      var mapHost = root.querySelector('.hero__map');
      if (mapHost && typeof MBH.OverviewMap === 'function') overview = MBH.OverviewMap(mapHost, MBH.TREKS);
    } catch (e) { overview = null; }

    var dead = false;
    var update = makeUpdater({
      departures: function () { setRegion(root, '[data-live="departures"]', homeDepartures()); fillTrekNext(root); },
      status: function () { setRegion(root, '[data-live="departures"]', homeDepartures()); },
      settings: function () {
        setRegion(root, '[data-part="hero"]', heroNote());
        setRegion(root, '[data-part="contact"]', contactStrip());
      }
    }, function () { return dead; });
    return { update: update, destroy: function () { dead = true; if (overview) { try { overview.destroy(); } catch (e) { /* ignore */ } } } };
  }
  function heroNote() {
    var note = String((store.settings && store.settings.heroNote) || '').trim();
    return note
      ? '<p class="hero__note hero__note--live">' + esc(note) + '</p>'
      : '<p class="hero__note">' + esc(SITE.heroFallback || '') + '</p>';
  }
  function homeDepartures() {
    var st = depState();
    if (st === 'pending') return skelRows(3);
    var rows = st === 'live' || st === 'cache' ? departures.open().slice(0, 4) : [];
    if (!rows.length) return emptyDates(st) + staleNote();
    return '<div class="agenda__list">' + rows.map(function (d) { return renderDepartureRow(d); }).join('') + '</div>' + staleNote();
  }

  /* ------------------------------------------------------------ treks */
  var DIFF_CHIPS = [['all', 'All levels'], ['easy', 'Easy'], ['moderate', 'Moderate'], ['challenging', 'Challenging'], ['strenuous', 'Strenuous']];
  var LEN_CHIPS = [['all', 'Any length'], ['short', '\u2264 5 days'], ['medium', '6\u201310 days'], ['long', '11+ days']];
  var SORT_CHIPS = [['days', 'Shortest first'], ['price', 'Lowest price first']];

  function viewTreks(root) {
    setTitle('Treks');
    root.style.paddingBottom = '0';
    var f = state.filters;
    var chip = function (group, v, label) {
      var on = f[group] === v;
      return '<button type="button" class="chip' + (on ? ' is-on' : '') + '" data-group="' + group + '" data-value="' + v + '" aria-pressed="' + on + '">' + esc(label) + '</button>';
    };
    var days = treks().map(function (t) { return t.days; });
    root.innerHTML = '<div class="container">' +
      '<h1 class="view__title" tabindex="-1">Treks</h1>' +
      '<p class="prose" style="color:var(--text-2)">' + treks().length + ' guided routes, ' + Math.min.apply(null, days.length ? days : [0]) + ' to ' + Math.max.apply(null, days.length ? days : [0]) + ' days. Prices are per person and depend on group size.</p>' +
      '<div class="agenda__tools">' +
        '<div class="chips" role="group" aria-label="Difficulty">' + DIFF_CHIPS.map(function (c) { return chip('diff', c[0], c[1]); }).join('') + '</div>' +
        '<div class="chips" role="group" aria-label="Length">' + LEN_CHIPS.map(function (c) { return chip('len', c[0], c[1]); }).join('') + '</div>' +
        '<div class="chips" role="group" aria-label="Sort">' + SORT_CHIPS.map(function (c) { return chip('sort', c[0], c[1]); }).join('') + '</div>' +
      '</div>' +
      '<p class="note" data-count aria-live="polite"></p>' +
      '<div class="trek-list" data-list></div>' +
      '<div data-none hidden><div class="empty"><p class="empty__title">No trek matches both filters</p>' +
        '<div class="empty__actions"><button type="button" class="btn btn--ghost" data-clear>Clear filters</button></div></div></div>' +
      '</div>' + footer();

    var list = $('[data-list]', root);
    function apply() {
      var shown = 0;
      list.innerHTML = sortedTreks(f.sort).map(trekCard).join('');
      $$('.trek-card', list).forEach(function (card) {
        var t = trekById(card.getAttribute('data-trek'));
        var ok = (f.diff === 'all' || (typeof MBH.difficultyBands === 'function' && MBH.difficultyBands(t).has(f.diff))) &&
                 (f.len === 'all' || (typeof MBH.lengthBand === 'function' && MBH.lengthBand(t) === f.len));
        card.classList.toggle('is-hidden', !ok);
        if (ok) shown++;
      });
      fillTrekNext(root);
      $('[data-count]', root).textContent = 'Showing ' + shown + ' of ' + treks().length + ' treks';
      $('[data-none]', root).hidden = shown > 0;
      $$('.chip[data-group]', root).forEach(function (c) {
        var on = f[c.getAttribute('data-group')] === c.getAttribute('data-value');
        c.classList.toggle('is-on', on);
        c.setAttribute('aria-pressed', String(on));
      });
      storage.session.set('mbh.filters.treks', { diff: f.diff, len: f.len, sort: f.sort });
    }
    root.addEventListener('click', function (e) {
      var c = e.target.closest('.chip[data-group]');
      if (c) { f[c.getAttribute('data-group')] = c.getAttribute('data-value'); apply(); return; }
      if (e.target.closest('[data-clear]')) { f.diff = 'all'; f.len = 'all'; apply(); }
    });
    apply();

    var dead = false;
    var update = makeUpdater({
      departures: function () { fillTrekNext(root); },
      settings: function () { setRegion(root, '[data-part="contact"]', contactStrip()); }
    }, function () { return dead; });
    return { update: update, destroy: function () { dead = true; } };
  }

  /* ------------------------------------------------------------- trek */
  function notListed() {
    return '<div class="container"><a class="view__back" href="#treks">\u2190 All treks</a>' +
      '<div class="empty" style="margin-top:24px"><h1 class="empty__title view__title" tabindex="-1" style="margin:0">That trek isn\'t listed</h1>' +
      '<p class="empty__body">It may have been renamed. The full list is one tap away.</p>' +
      '<div class="empty__actions"><a class="btn btn--ghost" href="#treks">See all treks</a></div></div></div>';
  }

  function dayRowsHTML(trek) {
    var dd = trek.days_data || [];
    return dd.map(function (d, i) {
      var prev = i > 0 ? dd[i - 1] : null;
      // "rest" only where the itinerary says so; a walking day that ends at the same height
      // as the night before is not a rest day (it shows "±0 m").
      var rest = /acclimati[sz]ation|rest day/i.test(d.route) || /^rest day$/i.test(String(d.time || '').trim());
      var facts = ['sleep ' + fmt.num(d.alt) + ' m'];
      if (rest && !/rest day/i.test(d.time || '')) facts.push('rest');
      else if (!rest && prev) facts.push(d.alt === prev.alt ? '\u00b10 m' : signedM(d.alt - prev.alt));
      if (d.time) facts.push(d.time);
      return '<li class="day" data-day="' + d.day + '" style="scroll-margin-top:72px;scroll-margin-bottom:88px">' +
        '<button type="button" class="day__head" aria-expanded="false" aria-controls="day-body-' + d.day + '">' +
          '<span class="day__num" aria-hidden="true">' + d.day + '</span>' +
          '<span class="day__route"><span class="sr-only">Day ' + d.day + ': </span>' + esc(d.route) + '</span>' +
          '<span class="day__facts tnum">' + esc(facts.join(' \u00b7 ')) + '</span>' +
        '</button>' +
        '<div class="day__body" id="day-body-' + d.day + '">' +
          '<p class="day__desc">' + esc(d.desc) + '</p>' +
          ((d.tags || []).length ? '<div class="day__tags">' + d.tags.map(function (t) { return '<span class="chip chip--tag">' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
        '</div></li>';
    }).join('');
  }

  function priceTiersHTML(trek) {
    var tier = typeof MBH.tierFor === 'function' ? MBH.tierFor(trek, state.pax) : null;
    var rows = (trek.pricing || []).map(function (p, i) {
      return '<tr class="tiers__row' + (tier && tier.index === i ? ' is-on' : '') + '" data-tier="' + i + '">' +
        '<td class="tiers__label">' + esc(p[0]) + '</td><td class="tiers__price tnum">' + esc(fmt.money(p[1])) + '</td></tr>';
    }).join('');
    if (!tier) return '<table class="tiers tiers__fallback"><caption class="sr-only">Price per person by group size</caption><tbody>' + rows + '</tbody></table>';
    return '<p class="note">Per person, by group size. Group departures on the Dates page carry their own fixed price.</p>' +
      '<div class="tiers__stepper">' +
        '<span class="field__label" id="pax-label">Group size</span>' +
        stepperHTML('pax', state.pax, 1, 12, 'pax-label') +
        '<p class="price-line tnum" data-price-line aria-live="polite">' + priceLine(tier.price, state.pax) + '</p>' +
      '</div>' +
      '<table class="tiers"><caption class="sr-only">Price per person by group size</caption><tbody>' + rows + '</tbody></table>';
  }

  function viewTrek(root, route) {
    var trek = trekById(route.id);
    if (!trek) { setTitle(''); setChrome('tabs'); root.innerHTML = notListed(); return {}; }
    setTitle(trek.name);
    state.selectedDay = null;
    root.style.paddingBottom = '0';
    var cta = { price: 'From ' + fmt.money(trek.fromPrice) + ' pp', note: trek.days + ' days \u00b7 price by group size', label: 'See dates', onClick: seeDates };
    var fact = function (k, v) { return '<div class="phero__fact"><dt class="phero__fact-key">' + esc(k) + '</dt><dd class="tnum">' + esc(v) + '</dd></div>'; };

    root.innerHTML =
      '<div class="phero">' +
        '<div class="phero__svg" data-hero aria-hidden="true"></div>' +
        '<div class="container container--wide">' +
          '<a class="view__back" href="#treks">\u2190 All treks</a>' +
          '<p class="phero__eyebrow">' + esc(trek.region) + '</p>' +
          '<h1 class="phero__title view__title" tabindex="-1" style="margin-top:0">' + esc(trek.name) + '</h1>' +
          '<dl class="phero__facts">' +
            fact('Length', trek.days + ' days') + fact('Highest', fmt.num(trek.maxElev) + ' m') +
            fact('Difficulty', trek.difficulty) + fact('Season', trek.season) + fact('From', fmt.money(trek.fromPrice) + ' pp') +
          '</dl>' +
          inlineCtaHTML(cta) +
        '</div>' +
      '</div>' +
      '<div class="container container--wide">' +
        '<div class="intro">' +
          '<figure class="intro__photo"><img src="' + esc(trek.heroImage || trek.image) + '" alt="' + esc(trek.imageAlt || '') + '" width="1920" height="1080" loading="lazy"></figure>' +
          '<div class="intro__text">' +
            '<p class="prose">' + esc(trek.overview) + '</p>' +
            (trek.overview2 ? '<p class="aside">' + esc(trek.overview2) + '</p>' : '') +
            (trek.overview3 ? '<p class="prose">' + esc(trek.overview3) + '</p>' : '') +
          '</div>' +
        '</div>' +
        '<section class="section" aria-labelledby="h-route">' +
          sectionHead('Route and itinerary', { id: 'h-route' }) +
          '<div class="split">' +
            '<div class="split__aside"><div data-map></div></div>' +
            '<div><ol class="days" role="list" style="list-style:none">' + dayRowsHTML(trek) + '</ol></div>' +
          '</div>' +
        '</section>' +
        '<section class="section" aria-labelledby="h-high">' + sectionHead('Highlights', { id: 'h-high' }) +
          '<ul class="highlights">' + (trek.highlights || []).map(function (h) { return '<li>' + esc(Array.isArray(h) ? h[0] : h) + '</li>'; }).join('') + '</ul>' +
        '</section>' +
        '<section class="section" id="prices" aria-labelledby="h-prices">' + sectionHead('Prices', { id: 'h-prices' }) + '<div data-tiers>' + priceTiersHTML(trek) + '</div></section>' +
        '<section class="section" aria-labelledby="h-incl">' + sectionHead('What\u2019s included', { id: 'h-incl' }) + colsBlock() + '</section>' +
        '<section class="section" id="trek-departures" aria-labelledby="h-deps" style="scroll-margin-top:64px">' +
          sectionHead('Departures for this trek', { id: 'h-deps', more: '#agenda', moreLabel: 'All dates' }) +
          '<div data-live="departures">' + trekDeps() + '</div>' +
        '</section>' +
        '<section class="section" aria-labelledby="h-ask">' + sectionHead('Ask Sandip', { id: 'h-ask' }) +
          '<p class="prose">Questions about ' + esc(trek.name) + ' or a private date go straight to Sandip on WhatsApp.</p>' +
          '<div class="empty__actions">' + askBtn(wa.msg.askTrek(trek), 'Write to Sandip', 'btn--dark', true) + '</div>' +
        '</section>' +
      '</div>' + footer();

    setCta(cta);

    // Profile hero (the view's animated Thread) and the interactive map.
    var hero = null, map = null;
    try { if (typeof MBH.ElevationProfile === 'function') hero = MBH.ElevationProfile($('[data-hero]', root), trek, { hero: true }); }
    catch (e) { console.error(e); }
    try {
      if (typeof MBH.RouteMap === 'function') map = MBH.RouteMap($('[data-map]', root), trek, { onDaySelect: openDay });
      else $('[data-map]', root).innerHTML = '<p class="note">The route map didn\u2019t load.</p>';
    } catch (e) { console.error(e); }

    function setOpen(li, open) {
      li.classList.toggle('is-open', open);
      var h = li.querySelector('.day__head'); if (h) h.setAttribute('aria-expanded', String(open));
    }
    function setActive(d) {
      state.selectedDay = d;
      $$('.day', root).forEach(function (li) { li.classList.toggle('is-active', +li.getAttribute('data-day') === d); });
    }
    // Map / profile tap -> open that day and bring it into view.
    function openDay(d) {
      var li = $('.day[data-day="' + (+d) + '"]', root); if (!li) return;
      setOpen(li, true);
      setActive(+d);
      try { li.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }); } catch (e) { li.scrollIntoView(); }
    }
    function seeDates() {
      var sec = $('#trek-departures', root);
      var st = depState();
      if ((st === 'live' || st === 'cache') && departures.forTrek(trek.id).length && sec) {
        try { sec.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }); } catch (e) { sec.scrollIntoView(); }
      } else openAsk(wa.msg.askTrek(trek));
    }
    function paintTiers() {
      var tier = typeof MBH.tierFor === 'function' ? MBH.tierFor(trek, state.pax) : null;
      if (!tier) return;
      paintStepper($('[data-stepper="pax"]', root), state.pax);
      $$('.tiers__row', root).forEach(function (r) { r.classList.toggle('is-on', +r.getAttribute('data-tier') === tier.index); });
      var pl = $('[data-price-line]', root); if (pl) pl.innerHTML = priceLine(tier.price, state.pax);
    }
    function trekDeps() {
      var st = depState();
      if (st === 'pending') return skelRows(2);
      var rows = st === 'live' || st === 'cache' ? departures.forTrek(trek.id) : [];
      if (!rows.length) {
        // Only a live (or cached) list can say there are no dates; otherwise stay neutral.
        var known = st === 'live' || st === 'cache';
        return '<div class="empty"><p class="empty__title">' + (known
            ? 'No fixed dates yet \u2014 ask Sandip for a private date'
            : 'Dates are set by Sandip and posted here \u2014 ask on WhatsApp') + '</p>' +
          '<div class="empty__actions">' + waBtn(wa.msg.askTrek(trek), 'Ask on WhatsApp') + '</div></div>' +
          (known ? '' : LIVE_OFF) + staleNote();
      }
      return '<div class="agenda__list">' + rows.map(function (d) { return renderDepartureRow(d, { showTrek: false }); }).join('') + '</div>' + staleNote();
    }

    root.addEventListener('click', function (e) {
      var head = e.target.closest('.day__head');
      if (head) {
        var li = head.closest('.day'), d = +li.getAttribute('data-day');
        setOpen(li, !li.classList.contains('is-open'));
        setActive(d);
        if (map) { try { map.highlightDay(d); } catch (err) { console.error(err); } }
        return;
      }
      var step = e.target.closest('[data-stepper="pax"] [data-step]');
      if (step) { state.pax = stepFrom(step, state.pax); state.paxTouched = true; paintTiers(); return; }
      if (e.target.closest('[data-cta]')) seeDates();
    });

    var dead = false;
    var update = makeUpdater({
      departures: function () { setRegion(root, '[data-live="departures"]', trekDeps()); },
      status: function () { setRegion(root, '[data-live="departures"]', trekDeps()); },
      settings: function () { setRegion(root, '[data-part="contact"]', contactStrip()); }
    }, function () { return dead; });
    return {
      update: update,
      destroy: function () {
        dead = true;
        if (map) { try { map.destroy(); } catch (e) { /* ignore */ } map = null; }
        if (hero) { try { hero.destroy(); } catch (e) { /* ignore */ } hero = null; }
      }
    };
  }

  /* ----------------------------------------------------------- agenda */
  function viewAgenda(root) {
    setTitle('Departures');
    root.style.paddingBottom = '0';
    var fit = storage.session.get('mbh.fit', null) || {};
    fit = { land: ISO_RE.test(fit.land || '') ? fit.land : '', flyout: ISO_RE.test(fit.flyout || '') ? fit.flyout : '' };
    var selMonth = null;
    var today = fmt.todayISO();

    // 12 months from the current one; dots are painted from the filtered set.
    var now = new Date(), chips = '';
    for (var i = 0; i < 12; i++) {
      var md = new Date(now.getFullYear(), now.getMonth() + i, 1);
      var key = md.getFullYear() + '-' + pad2(md.getMonth() + 1);
      chips += '<button type="button" class="mstrip__chip is-empty' + (i === 0 ? ' is-current' : '') + '" data-month="' + key + '">' +
        '<span>' + MON[md.getMonth()] + '</span><span class="mstrip__year">' + md.getFullYear() + '</span></button>';
    }

    root.innerHTML = '<div class="container agenda">' +
      '<h1 class="view__title" tabindex="-1">Departures</h1>' +
      '<p class="prose" style="color:var(--text-2)">Scheduled group starts with a fixed price and capacity. A request never holds a spot \u2014 Sandip confirms on WhatsApp.</p>' +
      '<div class="mstrip" role="group" aria-label="Jump to a month">' + chips + '</div>' +
      '<div class="agenda__tools">' +
        '<div class="chips" role="group" aria-label="Filter by trek" data-part="trekchips">' + trekChips() + '</div>' +
        '<details class="fit"' + (fit.land || fit.flyout ? ' open' : '') + '>' +
          '<summary class="fit__toggle">Fit my dates</summary>' +
          '<div class="fit__fields field__row">' +
            '<div class="field"><label class="field__label" for="fit-land">Land in Nepal</label><input class="input input--date" type="date" id="fit-land" value="' + esc(fit.land) + '" min="' + today + '"></div>' +
            '<div class="field"><label class="field__label" for="fit-out">Fly out</label><input class="input input--date" type="date" id="fit-out" value="' + esc(fit.flyout) + '" min="' + today + '"></div>' +
          '</div>' +
          '<p class="note" data-fit-note style="padding:0 16px 8px" aria-live="polite"></p>' +
          '<button type="button" class="btn btn--link fit__clear">Clear dates</button>' +
        '</details>' +
      '</div>' +
      '<div data-live="departures" data-part="list">' + listHTML() + '</div>' +
      '</div>' + footer();

    var strip = $('.mstrip', root);
    paintStrip();
    // The month strip spine is this view's Thread: it draws once.
    nextFrame(function () { nextFrame(function () { strip.classList.add('is-drawn'); }); });
    // The strip hides its scrollbar, so its edges fade where months are hidden, and with a
    // mouse a vertical wheel scrolls it sideways (until an end, then the page scrolls).
    function paintEdges() {
      var chipsEls = $$('.mstrip__chip', strip);
      if (!chipsEls.length) return;
      var sr = strip.getBoundingClientRect(), cs = getComputedStyle(strip);
      var inL = sr.left + (parseFloat(cs.paddingLeft) || 0), inR = sr.right - (parseFloat(cs.paddingRight) || 0);
      strip.classList.toggle('mstrip--more-left', chipsEls[0].getBoundingClientRect().left < inL - 2);
      strip.classList.toggle('mstrip--more-right', chipsEls[chipsEls.length - 1].getBoundingClientRect().right > inR + 2);
    }
    function onStripWheel(e) {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      var max = strip.scrollWidth - strip.clientWidth;
      if (max <= 0) return;
      var dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      var next = clamp(strip.scrollLeft + dy, 0, max);
      if (Math.abs(next - strip.scrollLeft) < 1) return;
      e.preventDefault();
      strip.scrollLeft = next;
    }
    strip.addEventListener('scroll', paintEdges, { passive: true });
    strip.addEventListener('wheel', onStripWheel, { passive: false });
    window.addEventListener('resize', paintEdges);
    paintEdges();

    function all() { var st = depState(); return st === 'live' || st === 'cache' ? departures.public() : []; }
    function filtered() { return state.agendaTrek === 'all' ? all() : all().filter(function (d) { return d.trekId === state.agendaTrek; }); }
    function trekChips() {
      var ids = new Set(all().map(function (d) { return d.trekId; }));
      if (state.agendaTrek !== 'all') ids.add(state.agendaTrek);
      var list = sortedTreks('days').filter(function (t) { return ids.has(t.id); });
      var chip = function (v, label) {
        var on = state.agendaTrek === v;
        return '<button type="button" class="chip' + (on ? ' is-on' : '') + '" data-group="trek" data-value="' + esc(v) + '" aria-pressed="' + on + '">' + esc(label) + '</button>';
      };
      return chip('all', 'All treks') + list.map(function (t) { return chip(t.id, t.name); }).join('');
    }
    function fitFor(dep) {
      if (!fit.land && !fit.flyout) return null;
      var end = fmt.endDate(dep.start, depDays(dep, trekById(dep.trekId)));
      var ok = (!fit.land || dep.start >= fit.land) && (!fit.flyout || end <= fit.flyout);
      var text = '';
      if (ok && fit.land && fit.flyout) {
        var spare = fmt.daysBetween(fit.land, dep.start) + fmt.daysBetween(end, fit.flyout);
        text = spare === 0 ? 'fits your dates exactly' : 'leaves you ' + spare + ' spare ' + plural(spare, 'day', 'days');
      } else if (ok) text = 'fits your dates';
      return { ok: ok, text: text };
    }
    function listHTML() {
      var st = depState();
      if (st === 'pending') return skelRows(3);
      var everything = st === 'live' || st === 'cache' ? departures.public() : [];
      if (!everything.length) return emptyDates(st) + staleNote();
      var rows = state.agendaTrek === 'all' ? everything : everything.filter(function (d) { return d.trekId === state.agendaTrek; });
      if (!rows.length) {
        var t = trekById(state.agendaTrek);
        return '<div class="empty"><p class="empty__title">No dates for ' + esc(t ? t.name : 'this trek') + ' yet</p>' +
          '<p class="empty__body">Ask Sandip for a private date, or see every departure.</p>' +
          '<div class="empty__actions">' + (t ? askBtn(wa.msg.askTrek(t), 'Ask on WhatsApp', 'btn--dark', true) : '') +
          '<button type="button" class="btn btn--ghost" data-trek-all>Show all treks</button></div></div>' + staleNote();
      }
      var groups = [], byKey = {};
      rows.forEach(function (d) {
        var k = fmt.monthKey(d.start);
        if (!byKey[k]) { byKey[k] = []; groups.push([k, byKey[k]]); }
        byKey[k].push(d);
      });
      return groups.map(function (g) {
        return '<section aria-labelledby="m-' + g[0] + '"><h2 class="agenda__month" id="m-' + g[0] + '">' + esc(fmt.monthLabel(g[0])) + '</h2>' +
          '<div class="agenda__list">' + g[1].map(function (d) {
            var f = fitFor(d);
            return renderDepartureRow(d, { fit: f && f.ok ? f.text : '', dim: !!(f && !f.ok) });
          }).join('') + '</div></section>';
      }).join('') + staleNote();
    }
    function paintStrip() {
      var have = new Set(filtered().map(function (d) { return fmt.monthKey(d.start); }));
      $$('.mstrip__chip', strip).forEach(function (ch) {
        var k = ch.getAttribute('data-month'), has = have.has(k);
        ch.classList.toggle('is-empty', !has);
        ch.classList.toggle('is-on', k === selMonth);
        ch.setAttribute('aria-pressed', String(k === selMonth));
        ch.setAttribute('aria-label', fmt.monthLabel(k) + (has ? ', has departures' : ', no departures'));
        var dot = ch.querySelector('.mstrip__dot');
        if (has && !dot) ch.insertAdjacentHTML('beforeend', '<span class="mstrip__dot" aria-hidden="true"></span>');
        else if (!has && dot) dot.parentNode.removeChild(dot);
      });
    }
    function paintFitNote() {
      var el = $('[data-fit-note]', root); if (!el) return;
      if (!fit.land && !fit.flyout) { el.textContent = 'Add the day you land and the day you fly out; dates that don\u2019t fit are dimmed.'; return; }
      if (fit.land && fit.flyout && fit.flyout < fit.land) { el.textContent = 'Your fly-out date is before your landing date.'; return; }
      var rows = filtered(), n = rows.filter(function (d) { var f = fitFor(d); return f && f.ok; }).length;
      el.textContent = rows.length ? n + ' of ' + rows.length + ' ' + plural(rows.length, 'departure fits', 'departures fit') + ' your dates' : '';
    }
    function renderAll() {
      setRegion(root, '[data-part="trekchips"]', trekChips());
      setRegion(root, '[data-part="list"]', listHTML());
      paintStrip();
      paintFitNote();
    }
    function onFit() {
      fit.land = $('#fit-land', root).value || '';
      fit.flyout = $('#fit-out', root).value || '';
      storage.session.set('mbh.fit', { land: fit.land, flyout: fit.flyout });
      setRegion(root, '[data-part="list"]', listHTML());
      paintFitNote();
    }
    paintFitNote();

    root.addEventListener('click', function (e) {
      var mc = e.target.closest('.mstrip__chip');
      if (mc) {
        var k = mc.getAttribute('data-month');
        selMonth = k;
        paintStrip();
        var target = document.getElementById('m-' + k);
        if (target) { try { target.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }); } catch (err) { target.scrollIntoView(); } }
        else toast('No departures in ' + fmt.monthLabel(k) + (state.agendaTrek !== 'all' ? ' for this trek' : ''));
        return;
      }
      var tc = e.target.closest('.chip[data-group="trek"]');
      if (tc) { state.agendaTrek = tc.getAttribute('data-value'); renderAll(); return; }
      if (e.target.closest('[data-trek-all]')) { state.agendaTrek = 'all'; renderAll(); return; }
      if (e.target.closest('.fit__clear')) {
        $('#fit-land', root).value = ''; $('#fit-out', root).value = '';
        onFit();
      }
    });
    root.addEventListener('change', function (e) { if (e.target.closest('.fit__fields')) onFit(); });
    root.addEventListener('input', function (e) { if (e.target.closest('.fit__fields')) onFit(); });

    var dead = false;
    var update = makeUpdater({
      departures: renderAll,
      status: renderAll,
      settings: function () { setRegion(root, '[data-part="contact"]', contactStrip()); }
    }, function () { return dead; });
    return { update: update, destroy: function () { dead = true; window.removeEventListener('resize', paintEdges); } };
  }

  /* -------------------------------------------------------- departure */
  function viewDeparture(root, route, opts) {
    opts = opts || {};
    var under = !!opts.underSheet;       // rendered beneath the booking sheet
    var map = null, sig = null, dead = false;
    root.style.paddingBottom = '0';

    function render() {
      var dep = departures.byId(route.id);
      var st = depState();
      var trek = dep ? trekById(dep.trekId) : null;
      var nextSig = JSON.stringify([st, dep, caps.status.db, store.departuresTimeout]);
      if (nextSig === sig) return;
      sig = nextSig;
      var hadFocus = document.activeElement && root.contains(document.activeElement) && document.activeElement.classList.contains('view__title');
      if (map) { try { map.destroy(); } catch (e) { /* ignore */ } map = null; }

      if (!dep && st === 'pending') {
        root.innerHTML = '<div class="container depage"><a class="view__back" href="#agenda">\u2190 All dates</a>' +
          '<h1 class="view__title" tabindex="-1">Departure</h1>' + skelRows(3) + '</div>';
        if (!under) { hideCta(); setChrome('tabs'); }
      } else if (!dep && (st === 'none' || st === 'timeout') && parseDepId(route.id)) {
        // Nothing could be read, so nothing is known to be missing: show what the id itself
        // says (trek + dates) and the request path, never "no longer listed" -- unless the
        // date in the id has already passed, which the id alone proves.
        var prov = parseDepId(route.id);
        if (isPastStart(prov.dep.start)) renderMissing(st, true); else renderProvisional(prov);
      } else if (!dep || dep.status === 'closed' || !trek) {
        renderMissing(st);
      } else if (isPastStart(dep.start)) {
        // An old shared link: never offer "Request a spot" or live spots for a date already under way.
        renderMissing(st, true);
      } else {
        renderFound(dep, trek);
      }
      if (hadFocus) { var t = $('.view__title', root); if (t) { try { t.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } }
    }

    function renderMissing(st, past) {
      var p = parseDepId(route.id);
      var ask = p ? (past ? wa.msg.askTrek(p.trek) : wa.msg.askDeparture(p.trek, p.dep)) : wa.msg.ask();
      if (!under) setTitle('Departures');
      root.innerHTML = '<div class="container depage"><a class="view__back" href="#agenda">\u2190 All dates</a>' +
        '<div class="depage__missing empty">' +
          '<h1 class="empty__title view__title" tabindex="-1" style="margin:0">' + (past ? 'This departure has already left' : 'This date is no longer listed') + '</h1>' +
          '<p class="empty__body">' + (past ? 'See the upcoming departures, or ask Sandip about the next one.' : 'See the current departures, or ask Sandip about this one.') + '</p>' +
          '<div class="empty__actions"><a class="btn btn--ghost" href="#agenda">See all dates</a>' + askBtn(ask, 'Ask on WhatsApp', 'btn--dark', true) + '</div>' +
        '</div>' +
        (st === 'none' || st === 'timeout' ? LIVE_OFF : staleNote()) +
        '</div>' + footer();
      if (!under) { hideCta(); setChrome('tabs'); }
    }

    function renderProvisional(p) {
      var trek = p.trek, dep = p.dep;
      var id = slug(route.id);
      var days = depDays(dep, trek);
      var end = fmt.endDate(dep.start, days);
      var d = fmt.parse(dep.start);
      if (!under) setTitle(trek.name + ' \u00b7 ' + fmt.short(dep.start));
      root.innerHTML = '<div class="container depage">' +
        '<a class="view__back" href="#agenda">\u2190 All dates</a>' +
        '<div class="depage__head">' +
          '<div class="dep__date" aria-hidden="true"><span class="dep__day tnum">' + (d ? d.getDate() : '') + '</span><span class="dep__wd">' + esc(wdMon(dep.start)) + '</span></div>' +
          '<div>' +
            '<h1 class="depage__title view__title" tabindex="-1" style="margin-top:0"><a href="#trek-' + esc(slug(trek.id)) + '">' + esc(trek.name) + '</a></h1>' +
            '<p class="depage__sub tnum">' + esc(fmt.short(dep.start)) + ' \u2192 ' + esc(fmt.short(end)) + ' \u00b7 ' + days + ' days</p>' +
            '<p class="depage__price"><span class="depage__price-val tnum">from ' + esc(fmt.money(trek.fromPrice)) + '</span>' +
              '<span class="depage__price-note">per person \u00b7 Sandip confirms the price for this date</span></p>' +
          '</div>' +
        '</div>' +
        '<p class="note note--live-off">Spots for this date can\u2019t be checked in this view. Send a request or ask \u2014 Sandip replies with what\u2019s left.</p>' +
        '<div class="depage__actions"><a class="btn btn--primary btn--lg" href="#book-' + id + '">Request a spot</a>' +
          askBtn(wa.msg.askDeparture(trek, dep), 'Ask on WhatsApp', 'btn--ghost btn--lg') + '</div>' +
        '<p class="note"><a href="#trek-' + esc(slug(trek.id)) + '">Read the full ' + esc(trek.name) + ' itinerary</a></p>' +
        '</div>' + footer();
      if (!under) {
        setChrome('cta');
        setCta({ price: 'from ' + fmt.money(trek.fromPrice) + ' pp', note: '', label: 'Request a spot', href: '#book-' + id });
      }
    }

    function renderFound(dep, trek) {
      var id = slug(dep.id);
      var days = depDays(dep, trek);
      var end = fmt.endDate(dep.start, days);
      var s = spotsInfo(dep);
      var taken = clamp(s.cap - s.left, 0, s.cap);
      var dots = '';
      for (var i = 0; i < s.cap; i++) dots += '<span class="capdots__dot' + (i < taken ? ' capdots__dot--taken' : '') + '"></span>';
      var capText = s.full ? 'Full' : s.left + ' of ' + s.cap + ' spots left';
      var d = fmt.parse(dep.start);
      var priced = hasPrice(dep);
      var primary = s.full
        ? waBtn(wa.msg.waitlist(trek, dep), 'Join waitlist on WhatsApp', 'btn--lg')
        : '<a class="btn btn--primary btn--lg" href="#book-' + id + '">Request a spot</a>';
      var strip = (trek.days_data || []).map(function (x) {
        return '<li class="datestrip__row"><span class="datestrip__day" aria-hidden="true">' + x.day + '</span>' +
          '<span class="datestrip__date tnum">' + esc(fmt.short(fmt.addDays(dep.start, x.day - 1))) + '</span>' +
          '<span><span class="datestrip__route"><span class="sr-only">Day ' + x.day + ': </span>' + esc(x.route) + '</span>' +
          '<span class="datestrip__alt tnum">sleep ' + fmt.num(x.alt) + ' m</span></span></li>';
      }).join('');

      if (!under) setTitle(trek.name + ' \u00b7 ' + fmt.short(dep.start));
      root.innerHTML = '<div class="container depage">' +
        '<a class="view__back" href="#agenda">\u2190 All dates</a>' +
        '<div class="depage__head">' +
          '<div class="dep__date" aria-hidden="true"><span class="dep__day tnum">' + (d ? d.getDate() : '') + '</span><span class="dep__wd">' + esc(wdMon(dep.start)) + '</span></div>' +
          '<div>' +
            '<h1 class="depage__title view__title" tabindex="-1" style="margin-top:0"><a href="#trek-' + esc(slug(trek.id)) + '">' + esc(trek.name) + '</a></h1>' +
            '<p class="depage__sub tnum">' + esc(fmt.short(dep.start)) + ' \u2192 ' + esc(fmt.short(end)) + ' \u00b7 ' + days + ' days</p>' +
            '<p class="depage__price">' + (priced
              ? '<span class="depage__price-val tnum">' + esc(fmt.money(dep.price)) + '</span><span class="depage__price-note">per person \u00b7 fixed for this group departure</span>'
              : '<span class="depage__price-val tnum">from ' + esc(fmt.money(trek.fromPrice)) + '</span><span class="depage__price-note">per person</span>') + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="capdots" role="img" aria-label="' + esc(capText) + '">' + dots + '<span class="capdots__text tnum" aria-hidden="true">' + esc(capText) + '</span></div>' +
        (dep.note ? '<p class="depage__note aside">' + esc(dep.note) + '</p>' : '') +
        '<div class="depage__actions">' + primary + askBtn(wa.msg.askDeparture(trek, dep), 'Ask on WhatsApp', 'btn--ghost btn--lg') + '</div>' +
        staleNote() +
        '<section class="section" aria-labelledby="h-daybyday">' + sectionHead('Day by day', { id: 'h-daybyday' }) +
          '<ol class="datestrip" role="list" style="list-style:none">' + strip + '</ol>' +
        '</section>' +
        '<section class="section" aria-labelledby="h-map">' + sectionHead('Route', { id: 'h-map', more: '#trek-' + slug(trek.id), moreLabel: 'Read the full itinerary' }) +
          '<div data-map></div>' +
        '</section>' +
        '</div>' + footer();

      try {
        if (typeof MBH.RouteMap === 'function') map = MBH.RouteMap($('[data-map]', root), trek, { static: true, profile: false, dates: { start: dep.start } });
      } catch (e) { console.error(e); }

      if (!under) {
        setChrome('cta');
        if (s.full) setCta({ price: priced ? fmt.money(dep.price) + ' pp' : 'Full', note: 'this date is full', label: 'Join waitlist', href: wa.link(wa.msg.waitlist(trek, dep)), external: true, dark: true });
        else setCta({ price: (priced ? fmt.money(dep.price) : 'from ' + fmt.money(trek.fromPrice)) + ' pp', note: priced ? 'fixed for this group' : '', label: 'Request a spot', href: '#book-' + id });
      }
    }

    render();
    var update = makeUpdater({
      departures: render,
      status: render,
      settings: function () { setRegion(root, '[data-part="contact"]', contactStrip()); }
    }, function () { return dead; });
    return {
      update: update,
      destroy: function () {
        dead = true;
        if (map) { try { map.destroy(); } catch (e) { /* ignore */ } map = null; }
      }
    };
  }

  /* ------------------------------------------------------------- book */
  function viewBook(root, route) {
    setTitle('Request a spot');
    var id = route.id;
    var under = viewDeparture(root, route, { underSheet: true });
    var draftKey = 'mbh.draft.' + id;
    var dead = false, mounted = false, busy = false, triedSubmit = false;
    var ctx = null;          // {dep, trek, provisional, gone}

    var body = document.createElement('div');
    var foot = document.createElement('div');

    sheet.open({
      title: 'Request a spot', full: true, panel: true, body: body, foot: foot, closeLabel: 'Back',
      onClose: function () {
        if (history.length > 1 && state.prevToken === 'departure-' + id) history.back();
        else go('departure-' + id);
      }
    });
    var footWrap = foot.parentNode;   // the .sheet__foot the sheet created

    // What the form is about: the live/cached departure, or -- while no live data exists -- one
    // recovered from the id slug, so the form is usable before (or without) any capability.
    function resolve() {
      var dep = departures.byId(id);
      var trek = dep && trekById(dep.trekId);
      if (dep && isPastStart(dep.start)) return { missing: true, past: true };  // under way or over
      if (dep && trek && dep.status !== 'closed') return { dep: dep, trek: trek, provisional: false };
      if (dep || store.departuresSource === 'live') return { missing: true };   // live data says it isn't bookable
      var waiting = caps.status.db !== 'null' && !store.departuresTimeout;      // live data may still arrive
      var p = parseDepId(id);
      if (p && isPastStart(p.dep.start)) return { missing: true, past: true };
      if (p) return { dep: p.dep, trek: p.trek, provisional: true, waiting: waiting };
      return waiting ? { pending: true } : { missing: true };
    }

    function draft() { var d = storage.session.get(draftKey, null); return d && typeof d === 'object' ? d : {}; }
    function mode() { return canSaveBooking() && ctx && !ctx.provisional && !ctx.gone ? 'db' : 'wa'; }
    function label() { return mode() === 'db' ? 'Request a spot' : 'Send request on WhatsApp'; }

    function field(name, text, control, help, hint) {
      return '<div class="field" data-field="' + name + '">' +
        '<label class="field__label" for="bk-' + name + '">' + esc(text) + (hint ? '<span class="field__hint">' + esc(hint) + '</span>' : '') + '</label>' +
        control +
        (help ? '<p class="field__help" id="bk-' + name + '-help">' + esc(help) + '</p>' : '') +
        '<p class="field__error" id="bk-' + name + '-err" role="alert" hidden></p></div>';
    }
    function summaryHTML() {
      var dep = ctx.dep, trek = ctx.trek;
      var end = fmt.endDate(dep.start, depDays(dep, trek));
      return '<strong>' + esc(trek.name) + '</strong><span class="tnum">' + esc(fmt.short(dep.start)) + ' \u2192 ' + esc(fmt.short(end)) + '</span>' +
        (ctx.provisional || ctx.gone ? '' : spotsPill(dep)) +
        '<a class="book__change" href="#agenda">Change date</a>';
    }
    function bannerHTML() {
      var h = '';
      if (ctx.gone) h += '<div class="banner banner--warn"><span class="banner__text">This date is no longer listed \u2014 you can still ask Sandip on WhatsApp.</span></div>';
      else if (ctx.provisional && !ctx.waiting) h += LIVE_OFF;
      var mine = store.myBookings && Array.isArray(store.myBookings.items) ? store.myBookings.items : [];
      if (mine.some(function (it) { return it && it.departureId === id && it.status !== 'cancelled'; })) {
        h += '<p class="note">You already sent a request for this date \u2014 see <a href="#my-trips">My trips</a>.</p>';
      }
      return h;
    }
    function unitPrice() { return hasPrice(ctx.dep) ? Number(ctx.dep.price) : null; }
    function priceHTML(pax) {
      var p = unitPrice();
      return p !== null ? priceLine(p, pax) : 'from ' + esc(fmt.money(ctx.trek.fromPrice)) + ' per person \u00b7 Sandip confirms the price';
    }
    function warnText(pax) {
      if (ctx.provisional || ctx.gone) return '';
      var s = spotsInfo(ctx.dep);
      if (s.full) return 'This departure is full \u2014 you can still request, Sandip will reply';
      if (pax > s.left) return 'Only ' + s.left + ' ' + plural(s.left, 'spot', 'spots') + ' left \u2014 you can still request, Sandip will reply';
      return '';
    }

    function mountForm() {
      mounted = true;
      var d = draft();
      var pax = clamp(parseInt(d.pax, 10) || (state.paxTouched ? state.pax : 1), 1, 12);
      body.innerHTML =
        '<form class="book form" id="bk-form" novalidate>' +
          '<div class="book__summary" data-summary>' + summaryHTML() + '</div>' +
          '<div data-banner>' + bannerHTML() + '</div>' +
          field('name', 'Name', '<input class="input" id="bk-name" name="name" type="text" autocomplete="name" value="' + esc(d.name || '') + '" aria-describedby="bk-name-err">') +
          field('email', 'Email', '<input class="input" id="bk-email" name="email" type="email" inputmode="email" autocomplete="email" value="' + esc(d.email || '') + '" aria-describedby="bk-email-err">') +
          field('whatsapp', 'WhatsApp number',
            '<div class="field__wrap"><span class="field__prefix" aria-hidden="true">+</span><input class="input" id="bk-whatsapp" name="whatsapp" type="tel" inputmode="tel" autocomplete="tel" value="' + esc(d.whatsapp || '') + '" aria-describedby="bk-whatsapp-help bk-whatsapp-err"></div>',
            'Country code first, e.g. 44 7700 900123') +
          '<div class="field" data-field="pax"><span class="field__label" id="bk-pax-label">Group size</span>' +
            '<div class="book__pax">' + stepperHTML('bkpax', pax, 1, 12, 'bk-pax-label') +
              '<p class="price-line tnum" data-price aria-live="polite">' + priceHTML(pax) + '</p></div>' +
            '<p class="book__warn" data-warn' + (warnText(pax) ? '' : ' hidden') + '>' + esc(warnText(pax)) + '</p>' +
          '</div>' +
          field('note', 'Notes', '<textarea class="input input--textarea" id="bk-note" name="note" rows="4" maxlength="500" aria-describedby="bk-note-err">' + esc(d.note || '') + '</textarea>',
            'Anything Sandip should know: experience, dietary needs, questions.', 'optional') +
        '</form>';
      body.setAttribute('data-pax', String(pax));
      foot.innerHTML = '<button type="submit" form="bk-form" class="book__submit btn btn--primary btn--block btn--lg">' + esc(label()) + '</button>' +
        (caps.status.user === 'pending' ? '<p class="book__cap-note">Checking if this can be saved to My trips\u2026</p>' : '');
      if (footWrap) footWrap.hidden = false;
      $('#bk-form', body).addEventListener('submit', onSubmit);
    }

    function currentPax() { return clamp(parseInt(body.getAttribute('data-pax'), 10) || 1, 1, 12); }
    function readForm() {
      var v = function (n) { var el = $('#bk-' + n, body); return el ? el.value : ''; };
      return { name: v('name').trim(), email: v('email').trim(), whatsapp: v('whatsapp').trim(), pax: currentPax(), note: v('note').trim() };
    }
    function saveDraft() { if (mounted && $('#bk-form', body)) storage.session.set(draftKey, readForm()); }
    function validate(f) {
      var errs = {};
      if (f.name.length < 2) errs.name = 'Please enter your name (at least 2 characters).';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) errs.email = 'Please enter an email address like name@example.com.';
      var digits = f.whatsapp.replace(/\D/g, '');
      if (digits.length < 8 || digits.length > 15) errs.whatsapp = 'Please enter your WhatsApp number with country code (8\u201315 digits).';
      if (!(Number.isInteger(f.pax) && f.pax >= 1 && f.pax <= 12)) errs.pax = 'Group size is 1 to 12 people.';
      if (f.note.length > 500) errs.note = 'Please keep notes to 500 characters.';
      return errs;
    }
    function showErrors(errs) {
      ['name', 'email', 'whatsapp', 'pax', 'note'].forEach(function (n) {
        var fEl = $('[data-field="' + n + '"]', body); if (!fEl) return;
        var msg = errs[n] || '';
        fEl.classList.toggle('is-invalid', !!msg);
        var input = $('#bk-' + n, body); if (input) { if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); }
        var err = $('.field__error', fEl); if (err) { err.textContent = msg; err.hidden = !msg; }
      });
    }
    function refresh() {
      if (!mounted || !$('#bk-form', body)) return;
      var pax = currentPax();
      setRegion(body, '[data-summary]', summaryHTML());
      setRegion(body, '[data-banner]', bannerHTML());
      var pl = $('[data-price]', body); if (pl) pl.innerHTML = priceHTML(pax);
      var w = $('[data-warn]', body); if (w) { var t = warnText(pax); w.textContent = t; w.hidden = !t; }
      paintLabel();
    }
    // The label may flip quietly when capabilities resolve; the button is never disabled for it.
    function paintLabel() {
      var btn = $('.book__submit', foot); if (!btn) return;
      var l = label();
      if (btn.textContent !== l && !busy) { btn.classList.add('is-quiet-flip'); btn.textContent = l; }
      var note = $('.book__cap-note', foot);
      if (note && caps.status.user !== 'pending') note.parentNode.removeChild(note);
    }

    async function onSubmit(e) {
      e.preventDefault();
      if (busy || !ctx) return;
      triedSubmit = true;
      var f = readForm();
      var errs = validate(f);
      showErrors(errs);
      var firstBad = ['name', 'email', 'whatsapp', 'pax', 'note'].find(function (n) { return errs[n]; });
      if (firstBad) {
        var el = $('#bk-' + firstBad, body) || $('[data-stepper="bkpax"] button', body);
        if (el) { try { el.focus(); } catch (err) { /* ignore */ } }
        return;
      }
      var digits = f.whatsapp.replace(/\D/g, '');
      var shown = Object.assign({}, f, { whatsapp: '+' + digits });
      var dep = Object.assign({}, ctx.dep, { days: depDays(ctx.dep, ctx.trek) });
      var text = wa.msg.request(ctx.trek, dep, shown);

      if (mode() !== 'db') {
        wa.open(text);
        showCard('wa', text);
        return;
      }
      var btn = $('.book__submit', foot);
      busy = true;
      if (btn) { btn.classList.add('is-busy'); btn.setAttribute('aria-busy', 'true'); }
      var now = Date.now();
      var item = {
        id: newBookingId(), departureId: ctx.dep.id, trekId: ctx.trek.id, start: ctx.dep.start,
        name: f.name, email: f.email, whatsapp: digits, pax: f.pax, note: f.note,
        status: 'requested', createdAt: now, updatedAt: now
      };
      try {
        await withTimeout(saveBooking(item), 20000);
        storage.session.remove(draftKey);
        if (!dead) showCard('saved', text + '\nBooking ref: ' + item.id.toUpperCase(), item);
      } catch (err) {
        if (!dead) showCard('fallback', text);
      } finally {
        busy = false;
        if (btn) { btn.classList.remove('is-busy'); btn.removeAttribute('aria-busy'); }
      }
    }

    // ConfirmationCard replaces the form body.
    function showCard(kind, text, item) {
      var h;
      if (kind === 'saved') {
        h = '<div class="confirm-card" role="status">' +
          '<h3 class="confirm-card__title" tabindex="-1">Requested.</h3>' +
          '<p class="confirm-card__body">Sandip confirms on WhatsApp.</p>' +
          '<p class="confirm-card__ref tnum">Ref ' + esc(String(item.id).toUpperCase()) + '</p>' +
          '<div class="confirm-card__actions">' + waBtn(text, 'Send a copy on WhatsApp') + '<a class="btn btn--ghost" href="#my-trips">See my trips</a></div></div>';
      } else if (kind === 'wa') {
        h = '<div class="confirm-card" role="status">' +
          '<h3 class="confirm-card__title" tabindex="-1">Opened WhatsApp with your request</h3>' +
          '<p class="confirm-card__body">Send the message there \u2014 Sandip confirms on WhatsApp. If WhatsApp didn\u2019t open, use the button below.</p>' +
          '<div class="confirm-card__actions">' + waBtn(text, 'Open WhatsApp again') + '<button type="button" class="btn btn--ghost" data-edit>Edit request</button></div></div>';
      } else {
        h = '<div class="confirm-card confirm-card--fallback" role="alert">' +
          '<h3 class="confirm-card__title" tabindex="-1">Not saved</h3>' +
          '<p class="confirm-card__body">Couldn\u2019t save the request here \u2014 send it on WhatsApp instead</p>' +
          '<div class="confirm-card__actions">' + waBtn(text, 'Send on WhatsApp') + '<button type="button" class="btn btn--ghost" data-edit>Back to the form</button></div></div>';
      }
      mounted = false;
      body.innerHTML = h;
      if (footWrap) footWrap.hidden = true;
      var t = $('.confirm-card__title', body); if (t) { try { t.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    }

    function renderBody() {
      if (dead || $('.confirm-card', body)) return;       // never replace a confirmation
      var r = resolve();
      if (r.pending) {
        // Only when the id can't be read as {trek}-{date}: nothing to fill a form with yet.
        if (!mounted) { body.innerHTML = skelRows(3); if (footWrap) footWrap.hidden = true; }
        return;
      }
      if (r.missing) {
        if (mounted && ctx) { ctx.gone = true; refresh(); return; }   // keep what they typed
        ctx = null;
        body.innerHTML = '<div class="empty"><p class="empty__title">' + (r.past ? 'This departure has already left' : 'This date is no longer listed') + '</p>' +
          '<p class="empty__body">' + (r.past ? 'See the upcoming departures, or ask Sandip about the next one.' : 'See the current departures, or ask Sandip about it.') + '</p>' +
          '<div class="empty__actions"><a class="btn btn--ghost" href="#agenda">See all dates</a>' + askBtn(contextAsk(), 'Ask on WhatsApp', 'btn--dark', true) + '</div></div>';
        if (footWrap) footWrap.hidden = true;
        return;
      }
      var wasMounted = mounted && ctx;
      ctx = { dep: r.dep, trek: r.trek, provisional: r.provisional, waiting: !!r.waiting, gone: false };
      if (wasMounted) refresh(); else mountForm();
    }

    // Form events: stepper, draft persistence, live re-validation after a failed submit, edit.
    body.addEventListener('click', function (e) {
      var step = e.target.closest('[data-stepper="bkpax"] [data-step]');
      if (step) {
        var pax = stepFrom(step, currentPax());
        body.setAttribute('data-pax', String(pax));
        paintStepper(step.closest('.stepper'), pax);
        var pl = $('[data-price]', body); if (pl) pl.innerHTML = priceHTML(pax);
        var w = $('[data-warn]', body); if (w) { var t = warnText(pax); w.textContent = t; w.hidden = !t; }
        saveDraft();
        if (triedSubmit) showErrors(validate(readForm()));
        return;
      }
      if (e.target.closest('[data-edit]')) { mountForm(); var n = $('#bk-name', body); if (n) { try { n.focus(); } catch (err) { /* ignore */ } } }
    });
    body.addEventListener('input', function () { saveDraft(); if (triedSubmit) showErrors(validate(readForm())); });

    renderBody();

    var update = makeUpdater({
      departures: renderBody,
      status: function () { renderBody(); paintLabel(); },
      myBookings: function () { if (mounted && ctx) setRegion(body, '[data-banner]', bannerHTML()); },
      settings: function () { /* wa.link reads settings at click time */ }
    }, function () { return dead; });
    return {
      update: function (key) { under.update(key); update(key); },
      destroy: function () { dead = true; saveDraft(); under.destroy(); }
    };
  }

  /* --------------------------------------------------------- my trips */
  function viewMyTrips(root) {
    setTitle('My trips');
    root.style.paddingBottom = '0';
    var timedOut = false, dead = false;
    root.innerHTML = '<div class="container">' +
      '<h1 class="view__title" tabindex="-1">My trips</h1>' +
      '<p class="prose" style="color:var(--text-2)">Requests you sent from this site. Sandip confirms each one on WhatsApp.</p>' +
      '<div data-live="myBookings">' + listHTML() + '</div>' +
      '</div>' + footer();

    function signedOut(signedIn) {
      // Signed in but the database never came up: the list may exist, it just can't be read here.
      var body = signedIn
        ? 'Requests are saved to your claude.ai identity, but saved requests can\u2019t be read in this view right now. Anything you sent on WhatsApp is with Sandip.'
        : 'Requests are saved to your claude.ai identity. You\u2019re not signed in here, so this list is empty; anything you sent on WhatsApp is with Sandip.';
      return '<div class="empty trips__signed-out"><p class="empty__title">' + (signedIn ? 'Can\u2019t show saved requests' : 'Nothing saved here') + '</p>' +
        '<p class="empty__body">' + body + '</p>' +
        '<div class="empty__actions">' + waBtn(wa.msg.ask(), 'Message Sandip') + '</div></div>';
    }
    function tripHTML(item) {
      var trek = trekById(item.trekId);
      var name = trek ? trek.name : 'Trek';
      var status = ['requested', 'confirmed', 'cancelled'].indexOf(item.status) >= 0 ? item.status : 'requested';
      var pax = Math.max(1, toNum(item.pax, 1));
      var actions = '';
      if (status === 'requested') {
        actions = '<div class="trip__actions"><button type="button" class="btn btn--danger btn--sm" data-withdraw="' + esc(item.id) + '">Withdraw</button></div>';
      } else if (status === 'confirmed') {
        actions = '<div class="trip__actions"><span>To change a confirmed booking, message Sandip</span>' +
          waBtn(wa.msg.changeBooking(trek || { name: name }, item), 'Message Sandip', 'btn--sm') + '</div>';
      }
      return '<li class="trip" data-item="' + esc(item.id) + '">' +
        '<div class="trip__head"><a href="#departure-' + esc(slug(item.departureId)) + '">' + esc(name) + '</a>' +
          '<span class="pill pill--' + status + '">' + cap1(status) + '</span></div>' +
        '<p class="trip__meta tnum">' + esc(fmt.short(item.start)) + ' \u00b7 ' + pax + ' ' + plural(pax, 'person', 'people') + ' \u00b7 Ref ' + esc(String(item.id || '').toUpperCase()) + '</p>' +
        actions + '</li>';
    }
    function listHTML() {
      var us = caps.status.user, ds = caps.status.db;
      var signedIn = !!(caps.me && caps.me.id);
      if (!timedOut && (us === 'pending' || (signedIn && ds === 'pending'))) return skelRows(2);
      if (!signedIn || ds !== 'ready') return signedOut(signedIn);
      var mb = store.myBookings;
      if (!mb) {
        if (!timedOut) return skelRows(2);
        return '<div class="empty"><p class="empty__title">No requests yet</p><div class="empty__actions"><a class="btn btn--ghost" href="#agenda">See dates</a></div></div>' +
          '<p class="note note--live-off">Live data unavailable \u2014 this list may be incomplete</p>';
      }
      var items = (Array.isArray(mb.items) ? mb.items : []).filter(function (x) { return x && x.id; })
        .slice().sort(function (a, b) { return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0); });
      if (!items.length) {
        if (!canSaveBooking()) {
          // Signed in, but this view can't save: every request goes out on WhatsApp.
          return '<div class="empty"><p class="empty__title">No requests saved here</p>' +
            '<p class="empty__body">Requests from this view go to Sandip on WhatsApp and aren\u2019t saved here.</p>' +
            '<div class="empty__actions"><a class="btn btn--ghost" href="#agenda">See dates</a>' + waBtn(wa.msg.ask(), 'Message Sandip') + '</div></div>';
        }
        return '<div class="empty"><p class="empty__title">No requests yet</p>' +
          '<p class="empty__body">Pick a departure and send a request; it will show up here.</p>' +
          '<div class="empty__actions"><a class="btn btn--ghost" href="#agenda">See dates</a></div></div>';
      }
      return '<ul class="trips">' + items.map(tripHTML).join('') + '</ul>';
    }
    function render() { setRegion(root, '[data-live="myBookings"]', listHTML()); }

    var timer = setTimeout(function () { timedOut = true; if (!dead) render(); }, 4000);

    root.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-withdraw]');
      if (!btn) return;
      var itemId = btn.getAttribute('data-withdraw');
      inlineConfirm(btn, {
        question: 'Withdraw this request?', yesLabel: 'Withdraw', danger: true,
        onYes: async function () {
          if (!(caps.db && caps.me && caps.me.id)) { toast('Can\u2019t reach your saved requests here \u2014 message Sandip instead', { kind: 'error' }); return; }
          try {
            var r = await withTimeout(withdrawBooking(itemId), 20000);
            if (r && r.stale) toast('Sandip already ' + r.stale + ' this \u2014 message him to change it');
            else toast('Request withdrawn', { kind: 'ok' });
          } catch (err) {
            toast('Couldn\u2019t withdraw \u2014 try again or message Sandip', { kind: 'error' });
          }
        }
      });
    });

    var update = makeUpdater({
      myBookings: render,
      status: render,
      settings: function () { setRegion(root, '[data-part="contact"]', contactStrip()); }
    }, function () { return dead; });
    return { update: update, destroy: function () { dead = true; clearTimeout(timer); } };
  }

  /* ------------------------------------------------------------ about */
  function viewAbout(root) {
    setTitle('About');
    root.style.paddingBottom = '0';
    root.innerHTML = '<div class="container">' +
      '<h1 class="view__title" tabindex="-1">About</h1>' +
      guideBlock(true) +
      ((SITE.reviews || []).length ? '<section class="section" aria-labelledby="h-say">' +
        '<p class="section__eyebrow" id="h-say">What trekkers say</p>' +
        '<p class="quotes__lede">' + esc(SITE.reviewsLede || '') + '</p>' +
        quotesList(SITE.reviews) +
      '</section>' : '') +
      '<section class="section" aria-labelledby="h-incl">' + sectionHead('What\u2019s included', { id: 'h-incl' }) + colsBlock() + '</section>' +
      '<section class="section" aria-labelledby="h-faq">' + sectionHead('Questions', { id: 'h-faq' }) + faqList(MBH.FAQS || []) + '</section>' +
      '</div>' + footer();
    var dead = false;
    var update = makeUpdater({
      settings: function () { setRegion(root, '[data-part="contact"]', contactStrip()); }
    }, function () { return dead; });
    return { update: update, destroy: function () { dead = true; } };
  }

  /* ------------------------------------------------------------ admin */
  function viewAdmin(root) {
    setTitle('Sandip\u2019s desk');
    var unavailable = function () {
      return '<div class="container"><div class="gate gate--unavailable"><div class="gate__card">' +
        '<h1 class="gate__title view__title" tabindex="-1" style="margin:0">Sandip\u2019s desk.</h1>' +
        '<p class="gate__body">The desk didn\u2019t load. Reload the page.</p>' +
        '<div class="gate__actions"><a class="btn btn--ghost" href="#home">Back to site</a></div></div></div></div>';
    };
    if (typeof MBH.mountAdmin !== 'function') { root.innerHTML = unavailable(); return {}; }
    try { return MBH.mountAdmin(root, app) || {}; }
    catch (e) { console.error(e); root.innerHTML = unavailable(); return {}; }
  }

  /* ============================================================ spec 6.8 router */

  var EXACT = ['home', 'treks', 'agenda', 'about', 'my-trips', 'admin', 'admin-departures', 'admin-bookings', 'admin-settings'];
  var PREFIXES = [['admin-departure-', 'admin-departure'], ['trek-', 'trek'], ['departure-', 'departure'], ['book-', 'book']];
  function parseRoute() {
    var raw = String(location.hash || '').slice(1);
    var token = /^[a-z0-9-]+$/.test(raw) ? raw : 'home';
    if (EXACT.indexOf(token) >= 0) return { token: token, name: token, id: null };
    for (var i = 0; i < PREFIXES.length; i++) {
      var p = PREFIXES[i][0];
      if (token.indexOf(p) === 0 && token.length > p.length) return { token: token, name: PREFIXES[i][1], id: slug(token.slice(p.length)) };
    }
    return { token: 'home', name: 'home', id: null };
  }
  function go(token) {
    token = slug(token) || 'home';
    if (location.hash === '#' + token) renderRoute(); else location.hash = '#' + token;
  }
  var VIEWS = {
    home: viewHome, treks: viewTreks, trek: viewTrek, agenda: viewAgenda, departure: viewDeparture,
    book: viewBook, 'my-trips': viewMyTrips, about: viewAbout,
    admin: viewAdmin, 'admin-departures': viewAdmin, 'admin-bookings': viewAdmin, 'admin-settings': viewAdmin, 'admin-departure': viewAdmin
  };
  function chromeFor(name) {
    if (name.indexOf('admin') === 0) return 'admin';
    if (name === 'trek' || name === 'departure') return 'cta';
    if (name === 'book') return 'none';
    return 'tabs';
  }

  function renderRoute() {
    var route = parseRoute();
    var prev = state.route;
    state.prevToken = prev ? prev.token : null;
    state.route = route;

    if (state.view && typeof state.view.destroy === 'function') { try { state.view.destroy(); } catch (e) { console.error(e); } }
    state.view = null;
    sheet.close({ silent: true });
    hideCta();

    var appEl = document.getElementById('app');
    var section = document.createElement('section');
    section.className = 'view';
    section.id = 'view';
    while (appEl.firstChild) appEl.removeChild(appEl.firstChild);
    appEl.appendChild(section);

    var tb = document.getElementById('topbar');
    if (tb) tb.classList.toggle('topbar--admin', route.name.indexOf('admin') === 0);
    setChrome(chromeFor(route.name));
    paintNav(route);
    setTitle('');

    var view;
    try { view = (VIEWS[route.name] || viewHome)(section, route) || {}; }
    catch (e) {
      console.error(e);
      section.innerHTML = '<div class="container"><div class="empty" style="margin-top:24px"><h1 class="empty__title view__title" tabindex="-1" style="margin:0">Something went wrong on this page</h1>' +
        '<div class="empty__actions"><a class="btn btn--ghost" href="#home">Back to home</a></div></div></div>';
      view = {};
    }
    state.view = view;

    // departure-{id} <-> book-{id} keeps the scroll position (the sheet opens over the same page).
    var pair = prev && prev.id && prev.id === route.id &&
      ((prev.name === 'departure' && route.name === 'book') || (prev.name === 'book' && route.name === 'departure'));
    if (!pair) scrollTop();
    if (!sheet.isOpen()) {
      var t = section.querySelector('.view__title');
      if (t) {
        if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
        try { t.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      }
    }
  }

  /* ============================================================== state */

  var savedFilters = storage.session.get('mbh.filters.treks', null) || {};
  var state = {
    route: null, prevToken: null, view: null, sheet: null,
    selectedDay: null, pax: 2,
    filters: {
      diff: DIFF_CHIPS.some(function (c) { return c[0] === savedFilters.diff; }) ? savedFilters.diff : 'all',
      len: LEN_CHIPS.some(function (c) { return c[0] === savedFilters.len; }) ? savedFilters.len : 'all',
      sort: savedFilters.sort === 'price' ? 'price' : 'days'
    },
    agendaTrek: 'all'
  };

  // Every store emit reaches the current view's update(key), once per key per microtask.
  var pendingKeys = new Set(), flushScheduled = false;
  store.on('*', function (key) {
    pendingKeys.add(key);
    if (flushScheduled) return;
    flushScheduled = true;
    Promise.resolve().then(function () {
      flushScheduled = false;
      var keys = Array.from(pendingKeys); pendingKeys.clear();
      var v = state.view;
      if (!v || typeof v.update !== 'function') return;
      keys.forEach(function (k) { try { v.update(k); } catch (e) { console.error(e); } });
    });
  });

  // "No spinner ever persists": any .skel-group[data-timeout] (ours or admin's) is removed after its timeout.
  function armSkeletons() {
    $$('.skel-group[data-timeout]:not([data-armed])').forEach(function (g) {
      g.setAttribute('data-armed', '1');
      var ms = parseInt(g.getAttribute('data-timeout'), 10) || 4000;
      setTimeout(function () { if (g.parentNode) g.parentNode.removeChild(g); }, ms);
    });
  }

  /* ========================================================= spec 6.15 export */

  var app = {
    state: state, store: store, caps: caps,
    get db() { return caps.db; },
    get user() { return caps.user; },
    theme: theme, route: parseRoute, go: go, toast: toast, sheet: sheet, wa: wa, fmt: fmt, copy: copy, storage: storage,
    writeQueue: writeQueue, inFlight: inFlight, snapData: snapData, snapExists: snapExists, docsOf: docsOf,
    mergeItems: mergeItems, newBookingId: newBookingId, slug: slug,
    departures: departures, settings: settings, renderDepartureRow: renderDepartureRow, inlineConfirm: inlineConfirm,
    // Conveniences beyond the contract (safe for admin.js to ignore).
    esc: esc, ask: openAsk, spotsPill: spotsPill, setTitle: setTitle
  };
  MBH.app = app;

  /* =============================================================== boot */

  var booted = false;
  function boot() {
    if (booted) return;
    booted = true;

    // Seed departures from the last live snapshot so returning visitors see dates at once.
    var cached = storage.get('mbh.cache.departures', null);
    if (cached && Array.isArray(cached.docs)) {
      store.departures = cached.docs.filter(function (d) { return d && typeof d === 'object'; });
      store.departuresSource = 'cache';
      store.departuresCachedAt = Number(cached.at) || null;
    }

    renderTopbar();
    renderTabs();

    document.addEventListener('click', function (e) {
      var t = e.target instanceof Element ? e.target : null;
      if (!t) return;
      var c = t.closest('[data-copy]');
      if (c) { e.preventDefault(); copy(c.getAttribute('data-copy'), c); return; }
      var a = t.closest('[data-ask]');
      if (a) { e.preventDefault(); openAsk(a.getAttribute('data-ask')); return; }
      if (t.closest('.iconbtn--theme')) { theme.cycle(); return; }
      if (t.closest('.iconbtn--wa')) { openAsk(contextAsk()); return; }
      if (t.closest('[data-sheet-dismiss]') && sheet.isOpen()) { e.preventDefault(); sheet.close(); return; }
      if (t.closest('#ctabar [data-cta]') && ctaHandler) { ctaHandler(); }
    });
    document.addEventListener('keydown', sheet.onKey);
    window.addEventListener('hashchange', renderRoute);
    try {
      var mq = window.matchMedia('(min-width:1024px)');
      if (mq.addEventListener) mq.addEventListener('change', syncInlineCta); else if (mq.addListener) mq.addListener(syncInlineCta);
    } catch (e) { /* no matchMedia */ }
    if (typeof MutationObserver === 'function') {
      var mo = new MutationObserver(armSkeletons);
      ['app', 'sheet-root'].forEach(function (id) { var el = document.getElementById(id); if (el) mo.observe(el, { childList: true, subtree: true }); });
      // In admin mode #tabbar stays hidden until admin.js puts its tabs in it.
      var tbEl = document.getElementById('tabbar');
      if (tbEl) new MutationObserver(function () {
        if (tabsMode === 'admin') tbEl.classList.toggle('is-hidden', !tbEl.children.length);
      }).observe(tbEl, { childList: true });
    }

    var first = parseRoute();
    renderRoute();                       // synchronous: the page is complete before any capability resolves
    armSkeletons();
    drawWordmarkThread(first.name === 'home');
    caps.init();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);
})();

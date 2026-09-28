/*
 * admin.js - Sandip's desk (FINAL-SPEC section 7).
 *
 *   MBH.mountAdmin(root, app) -> { update(key), destroy() }
 *
 * Mounted by app.js on every #admin* route. Reaches the runtime only through the
 * app.* surface (spec 6.15), never window.claude. Renders text only: no images.
 *
 * File layout
 *   1. Module state (survives the re-mount on every admin hash change)
 *   2. Small helpers: escaping, numbers, dates
 *   3. Store selectors, the desk ledger and derived counts (spec 7.2). Capacity is counted from
 *      departures/{id}.ledger (admin-written), never from a booker-writable bookings doc.
 *   4. Writes: queue wrapper, outbox, departure lock, bookings subscription, syncDeparture (spec 7.1, 7.7)
 *   5. Row write sequences: Confirm / Decline / Cancel / Restore (spec 7.6)
 *   6. Markup builders: rows and screens (spec 7.3 to 7.6)
 *   7. DepartureForm sheet (spec 7.4)
 *   8. mountAdmin: gate, shell, tabs, screens, settings (spec 7.1, 7.2, 7.8)
 */
(function () {
  'use strict';

  const MBH = (window.MBH = window.MBH || {});

  /* ======================================================================
     1. Module state
     ====================================================================== */
  let APP = null;                 // the app object from the latest mount
  let active = null;              // controller of the live mount ({refreshSoon}) or null
  let adminSubscribed = false;    // bookings collection subscribed (once per page load, again after an error)
  let bookingsFired = false;      // at least one bookings snapshot arrived
  let bookingsTimedOut = false;   // 4s passed after subscribing without a snapshot
  let bookingsErrored = false;    // the listener failed after (or before) a snapshot; counts are paused
  let bookingsUnsub = null;       // unsubscribe for the live bookings listener
  let resubTimer = null;          // pending re-subscribe after a listener error
  let resubDelay = 0;             // back-off for re-subscribing (ms)
  let gatePassedOnce = false;     // the 600ms "granted" card shows only on the first pass
  let replaying = false;          // replayOutbox re-entry guard
  let memOutbox = [];             // mirror of mbh.outbox for when storage is unavailable
  let formCleanup = null;         // tears down the open DepartureForm's store listener
  let fabTucked = false;          // phone/tablet: "+ New departure" slides away while scrolling down

  const pending = new Map();      // itemId -> {label, target, done, seen, timer}
  const rowErrors = new Map();    // itemId -> {msg, retry: {act, ack} | null}
  const rowNotices = new Map();   // itemId -> {depId, kind: 'confirm' | 'cancel'}
  const asks = new Map();         // itemId -> {avail, timer}  (overbook question showing)
  const echoed = new Set();       // itemIds flashing .is-echoed
  const expanded = new Set();     // itemIds with "Other requests by this booker" open
  const busy = new Set();         // itemIds with an action running (double-tap guard)
  const recentIds = new Set();    // items acted on in the Inbox during this mount (kept visible)
  const profileNames = new Map(); // viewerId -> claude.ai display name
  const profileAsked = new Set();
  const myInflight = new Map();   // path -> writes queued by this module and not yet settled
  const depChains = new Map();    // depId -> tail of the per-departure capacity lock
  const depHolds = new Map();     // depId -> sequences holding or waiting for that lock
  const keyMemo = new Map();      // viewerId + itemId -> ledger key
  const bookingsFilter = { status: 'requested', dep: 'all', q: '' };

  const OUTBOX_KEY = 'mbh.outbox';
  const OUTBOX_MAX = 20;
  const PAX_MAX = 12;             // the booking form's group-size ceiling
  const RECONNECT_TEXT = 'Reconnecting to bookings…';
  const DB_OFF_TEXT = 'Database unavailable in this view';
  const STATUS_WORD = {
    open: 'Open', full: 'Full', closed: 'Closed',
    requested: 'Requested', confirmed: 'Confirmed', cancelled: 'Cancelled'
  };

  /* ======================================================================
     2. Small helpers
     ====================================================================== */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  // Every user/db string goes through esc() before it touches innerHTML.
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ESC[c]); }
  function num(v) { const x = Number(v); return Number.isFinite(x) ? x : 0; }
  // Party sizes come from booker-writable documents: whole people, 0..12, never negative or huge.
  function clampPax(v) { return Math.min(PAX_MAX, Math.max(0, Math.floor(num(v)))); }
  function wholeNonNeg(v) { return Math.max(0, Math.floor(num(v))); }
  function safeId(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9-]/g, ''); }
  function digits(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function norm(s) { return String(s == null ? '' : s).trim().replace(/\s+/g, ' ').toLowerCase(); }
  function slug(s) {
    try { if (APP && typeof APP.slug === 'function') return APP.slug(s); } catch (e) { /* fall through */ }
    return safeId(s);
  }
  function refreshSoon() { if (active) active.refreshSoon(); }
  function toast(msg, kind) {
    try { APP.toast(msg, { kind: kind || 'info' }); } catch (e) { /* toasts are cosmetic */ }
  }

  // Formatting goes through app.fmt; the wrappers stop one malformed db value from
  // throwing in the middle of a render.
  function fmt() { return (APP && APP.fmt) || {}; }
  const isISO = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function today() {
    try { const t = fmt().todayISO(); if (isISO(t)) return t; } catch (e) { /* fall through */ }
    const d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function fshort(iso) {
    if (!isISO(iso)) return iso ? String(iso) : '\u2014';
    try { return fmt().short(iso); } catch (e) { return iso; }
  }
  function flong(iso) {
    if (!isISO(iso)) return iso ? String(iso) : '\u2014';
    try { return fmt().long(iso); } catch (e) { return iso; }
  }
  function addDays(iso, n) {
    if (!isISO(iso)) return iso;
    try { return fmt().addDays(iso, n); } catch (e) { return iso; }
  }
  function rel(ms) {
    if (!num(ms)) return '';
    try { return fmt().rel(num(ms)) || ''; } catch (e) { return ''; }
  }
  function money(n) {
    try { return fmt().money(num(n)); } catch (e) { return '$' + num(n); }
  }
  function fnum(n) {
    try { return fmt().num(num(n)); } catch (e) { return String(num(n)); }
  }
  // Whole days from ISO a to ISO b (calendar arithmetic in UTC avoids DST drift).
  function dayDiff(a, b) {
    if (!isISO(a) || !isISO(b)) return 0;
    const p = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
    return Math.round((p(b) - p(a)) / 864e5);
  }

  /* ======================================================================
     3. Store selectors and derived counts
     ====================================================================== */
  function store() { return APP.store; }
  function depsLoaded() { return Array.isArray(store().departures); }
  function allDeps() { return depsLoaded() ? store().departures.filter((d) => d && d.id) : []; }
  function depById(id) { return allDeps().find((d) => d.id === id) || null; }
  // "Loaded" means a real bookings snapshot arrived and the listener is still healthy. After
  // a listener error the last good list stays on screen (bookingsShown) but is never trusted
  // for capacity maths, Delete or writes until a fresh snapshot arrives.
  function bookingsLoaded() { return bookingsFired && !bookingsErrored && Array.isArray(store().adminBookings); }
  function bookingsShown() { return bookingsFired && Array.isArray(store().adminBookings); }
  function allItems() {
    const list = store().adminBookings;
    return Array.isArray(list) ? list.filter((it) => it && typeof it === 'object') : [];
  }
  function findItem(viewerId, id) {
    return allItems().find((it) => it.viewerId === viewerId && it.id === id) || null;
  }
  function trekOf(id) {
    try { return (MBH.trekById && MBH.trekById(id)) || null; } catch (e) { return null; }
  }
  function trekName(id) { const t = trekOf(id); return t ? t.name : (id ? String(id) : 'Unknown trek'); }
  function endOf(dep) { return addDays(dep.start, Math.max(1, num(dep.days)) - 1); }
  function depLabel(dep) { return trekName(dep.trekId) + ' \u00b7 ' + fshort(dep.start); }
  function statusDb() { const c = APP.caps || {}; return (c.status && c.status.db) || 'pending'; }
  function dbOK() { return !!(APP.caps && APP.caps.db) && statusDb() === 'ready'; }
  function byStart(a, b) {
    const x = a.start || '', y = b.start || '';
    return x < y ? -1 : x > y ? 1 : 0;
  }
  // Inbox order: departure start ascending (unknown departures last), then departure id
  // (keeps one departure's requests consecutive), then oldest request first.
  function byDeparture(a, b) {
    const da = depById(a.departureId), db = depById(b.departureId);
    const sa = da && da.start ? da.start : '\uffff', sb = db && db.start ? db.start : '\uffff';
    if (sa !== sb) return sa < sb ? -1 : 1;
    const ia = String(a.departureId || ''), ib = String(b.departureId || '');
    if (ia !== ib) return ia < ib ? -1 : 1;
    return num(a.createdAt) - num(b.createdAt);
  }

  /* ---- The desk ledger ----------------------------------------------------------------
     bookings/{viewerId} is writable by the booker, so a booking item's status/confirmedPax
     can never be the source of truth for capacity. What this desk confirmed lives on the
     admin-only departures/{id} document instead, written in the same update as spotsLeft:
       ledger: [{ k, pax, at }]      k = ledgerKey(viewerId, itemId)
     k is a one-way hash so the public departure document never reveals who booked.
     The booker's status is display only; rows flag where it disagrees with the ledger.
     A departure written before the ledger existed (no `ledger` field) adopts its confirmed
     items once, clamped, and the next desk write stores that as its ledger. */
  function cyrb53(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }
  function ledgerKey(viewerId, itemId) {
    const raw = String(viewerId == null ? '' : viewerId) + '\u0000' + String(itemId == null ? '' : itemId);
    let k = keyMemo.get(raw);
    if (!k) { k = 'k' + cyrb53(raw).toString(36); keyMemo.set(raw, k); }
    return k;
  }
  function keyOf(it) { return ledgerKey(it.viewerId, it.id); }
  function isLegacy(dep) { return !!dep && dep.ledger == null; }
  // The stored ledger, sanitised (unique keys, whole people 1..12).
  function ledgerEntries(dep) {
    const out = new Map();
    (dep && Array.isArray(dep.ledger) ? dep.ledger : []).forEach((e) => {
      if (!e || typeof e.k !== 'string' || !e.k) return;
      const pax = clampPax(e.pax);
      if (pax > 0) out.set(e.k, { k: e.k, pax, at: num(e.at) });
    });
    return Array.from(out.values());
  }
  // Legacy departure: its confirmed items, each capped at its own party size and at 12.
  function adoptedEntries(depId) {
    const out = new Map();
    allItems().forEach((it) => {
      if (it.departureId !== depId || it.status !== 'confirmed' || !it.id) return;
      const pax = Math.min(clampPax(it.pax), clampPax(it.confirmedPax != null ? it.confirmedPax : it.pax));
      if (pax > 0) out.set(keyOf(it), { k: keyOf(it), pax, at: num(it.updatedAt) });
    });
    return Array.from(out.values());
  }
  // What counts for capacity on `dep` (a store row or a fresh doc); null = can't know yet.
  function ledgerFor(dep) {
    if (!dep) return [];
    if (!isLegacy(dep)) return ledgerEntries(dep);
    return bookingsLoaded() ? adoptedEntries(dep.id) : null;
  }
  function ledgerKnown(dep) { return ledgerFor(dep) !== null; }
  function ledgerSum(entries, excludeKey) {
    return (entries || []).reduce((s, e) => (e.k === excludeKey ? s : s + e.pax), 0);
  }
  function ledgerPaxOf(it) {
    const e = (ledgerFor(depById(it.departureId)) || []).find((x) => x.k === keyOf(it));
    return e ? e.pax : 0;
  }
  function capOf(dep) { return wholeNonNeg(dep && dep.capacity); }
  function manualOf(dep) { return wholeNonNeg(dep && dep.manualPax); }
  // spotsLeft always lies in [0, capacity], whatever the inputs.
  function spotsFrom(dep, booked) { const cap = capOf(dep); return Math.min(cap, Math.max(0, cap - booked)); }

  // spec 7.2 derived helpers. Capacity truth = manualPax + the desk ledger (never booker status).
  function confirmedPaxFor(depId, excludeItemId) {
    const dep = depById(depId);
    const items = excludeItemId != null ? allItems().filter((it) => it.id === excludeItemId && it.departureId === depId) : [];
    const exclude = items.length ? keyOf(items[0]) : null;
    return ledgerSum(ledgerFor(dep) || [], exclude);
  }
  function bookedFor(dep) { return manualOf(dep) + confirmedPaxFor(dep.id); }
  function computedSpots(dep) { return spotsFrom(dep, bookedFor(dep)); }
  function drift(dep) { return typeof dep.spotsLeft !== 'number' || dep.spotsLeft !== computedSpots(dep); }
  // People waiting on a reply (same unit as "booked").
  function requestedFor(depId) {
    return allItems().reduce((s, it) => (it.departureId === depId && it.status === 'requested' ? s + clampPax(it.pax) : s), 0);
  }
  function nonCancelledCount(depId) {
    return allItems().filter((it) => it.departureId === depId && it.status !== 'cancelled').length;
  }
  // Where the booker's own document disagrees with the desk ledger (display + actions).
  function mismatchOf(it) {
    const dep = depById(it.departureId);
    if (!dep || isLegacy(dep) || !it.id || !bookingsShown()) return null;
    if (pending.has(it.id) || depHolds.has(dep.id) || isInFlight('departures/' + dep.id)) return null;
    const key = keyOf(it);
    const entry = ledgerEntries(dep).find((e) => e.k === key);
    const waiting = outboxOpsFor(dep.id)[key] !== undefined;
    if (it.status === 'confirmed' && !entry) return { kind: 'unverified', waiting };
    if (it.status !== 'confirmed' && entry) return { kind: 'unconfirmed', pax: entry.pax, waiting };
    if (entry) {
      const p = clampPax(it.pax);
      if (p !== entry.pax) return { kind: 'pax', pax: entry.pax, now: p, waiting: false };
      if (it.confirmedPax != null && num(it.confirmedPax) !== entry.pax) return { kind: 'cpax', pax: entry.pax, claimed: num(it.confirmedPax), waiting: false };
    }
    return null;
  }
  // Ledger entries whose booking item no longer exists anywhere (the booker removed it).
  function orphanEntries(dep) {
    if (!dep || isLegacy(dep) || !bookingsLoaded()) return [];
    const keys = new Set(allItems().filter((it) => it.departureId === dep.id).map(keyOf));
    return ledgerEntries(dep).filter((e) => !keys.has(e.k));
  }
  function nextDeparture() {
    const t = today();
    return allDeps()
      .filter((d) => (d.status === 'open' || d.status === 'full') && isISO(d.start) && d.start >= t)
      .sort(byStart)[0] || null;
  }

  /* ======================================================================
     4. Writes: queue wrapper, outbox, subscription, syncDeparture
     ====================================================================== */
  function isInFlight(path) {
    try { if (typeof APP.inFlight === 'function' && APP.inFlight(path)) return true; } catch (e) { /* ignore */ }
    return (myInflight.get(path) || 0) > 0;
  }
  function anyInFlight() {
    for (const c of myInflight.values()) if (c > 0) return true;
    return false;
  }
  // Every admin write goes through app.writeQueue (one write in flight per doc path).
  // The local counter lets the SyncPill show "Saving..." and rows show .is-pending.
  function queue(path, fn) {
    myInflight.set(path, (myInflight.get(path) || 0) + 1);
    refreshSoon();
    const settle = () => {
      myInflight.set(path, Math.max(0, (myInflight.get(path) || 1) - 1));
      refreshSoon();
    };
    let p;
    try { p = Promise.resolve(APP.writeQueue(path, fn)); } catch (e) { p = Promise.reject(e); }
    p.then(settle, settle);
    return p;
  }

  // Outbox entries (spec 6.1) also carry the ledger change that still has to reach the
  // departure: ops = { [ledgerKey]: pax (set) | 0 (remove) }.
  function readOutbox() {
    let v = null;
    try { v = APP.storage.get(OUTBOX_KEY, null); } catch (e) { v = null; }
    const list = Array.isArray(v) ? v : memOutbox;
    return list.filter((e) => e && e.type === 'syncDeparture' && e.departureId);
  }
  function writeOutbox(list) {
    memOutbox = list.slice(-OUTBOX_MAX);
    try { APP.storage.set(OUTBOX_KEY, memOutbox); } catch (e) { /* memory copy still holds it */ }
  }
  function cleanOps(ops) {
    const out = {};
    if (ops && typeof ops === 'object') {
      Object.keys(ops).forEach((k) => { if (/^k[0-9a-z]+$/.test(k)) out[k] = clampPax(ops[k]); });
    }
    return out;
  }
  function outboxOpsFor(depId) {
    const e = readOutbox().find((x) => x.departureId === depId);
    return e ? cleanOps(e.ops) : {};
  }
  function pushOutbox(depId, ops) {
    const merged = Object.assign(outboxOpsFor(depId), cleanOps(ops));
    const list = readOutbox().filter((e) => e.departureId !== depId);
    list.push({ type: 'syncDeparture', departureId: depId, at: Date.now(), ops: merged });
    writeOutbox(list);
  }
  function dropOutbox(depId) { writeOutbox(readOutbox().filter((e) => e.departureId !== depId)); }
  function clearNoticesFor(depId) {
    rowNotices.forEach((n, id) => { if (n.depId === depId) rowNotices.delete(id); });
  }

  // Per-departure lock: a Confirm's capacity check and its writes run as one unit, so two
  // quick Confirms on one device can never both pass the check against the same spots.
  function withDepLock(depId, fn) {
    const prev = depChains.get(depId) || Promise.resolve();
    depHolds.set(depId, (depHolds.get(depId) || 0) + 1);
    refreshSoon();
    const run = prev.catch(() => {}).then(fn);
    const tail = run.catch(() => {}).then(() => {
      const n = (depHolds.get(depId) || 1) - 1;
      if (n <= 0) depHolds.delete(depId); else depHolds.set(depId, n);
      if (depChains.get(depId) === tail) depChains.delete(depId);
      refreshSoon();
    });
    depChains.set(depId, tail);
    return run;
  }

  // spec 7.1: subscribe to the whole bookings collection, once, only after canEdit is true.
  // A listener error keeps the last good list (never trusted for maths while errored) and
  // re-subscribes with back-off, so a later snapshot restores the loaded state.
  function subscribeBookings() {
    const app = APP;
    if (adminSubscribed || !app || !app.caps || !app.caps.db) return;
    adminSubscribed = true;
    if (resubTimer) { clearTimeout(resubTimer); resubTimer = null; }
    if (!bookingsFired) setTimeout(() => { if (!bookingsFired) { bookingsTimedOut = true; refreshSoon(); } }, 4000);
    let dead = false;
    const onError = () => {
      if (dead) return;
      dead = true;
      onBookingsError();
    };
    try {
      const off = app.caps.db.collection('bookings').onSnapshot((snap) => {
        if (dead) return;
        const raw = new Map();
        const flat = [];
        app.docsOf(snap).forEach((d) => {
          const items = Array.isArray(d.items) ? d.items : [];
          raw.set(d.id, items);
          // viewerId always comes from the doc id: it is the write path for this item.
          items.forEach((it) => { if (it && typeof it === 'object') flat.push(Object.assign({}, it, { viewerId: d.id })); });
        });
        bookingsFired = true;
        bookingsErrored = false;
        resubDelay = 0;
        noteEchoes(flat);
        app.store.set('adminBookingsRaw', raw);
        app.store.set('adminBookings', flat);
        replayOutbox();
      }, onError);
      bookingsUnsub = typeof off === 'function' ? off : null;
    } catch (e) {
      onError();
    }
  }
  function onBookingsError() {
    bookingsErrored = true;
    bookingsTimedOut = true;
    if (bookingsUnsub) { try { bookingsUnsub(); } catch (e) { /* already gone */ } bookingsUnsub = null; }
    // Nothing ever arrived: spec 7.1's empty list. Otherwise keep the last good copy on screen.
    if (!bookingsFired && APP) APP.store.set('adminBookings', []);
    resubDelay = Math.min(30000, resubDelay ? resubDelay * 2 : 2000);
    if (resubTimer) clearTimeout(resubTimer);
    resubTimer = setTimeout(() => { resubTimer = null; reconnectBookings(); }, resubDelay);
    refreshSoon();
  }
  function reconnectBookings() {
    if (resubTimer) { clearTimeout(resubTimer); resubTimer = null; }
    if (bookingsUnsub) { try { bookingsUnsub(); } catch (e) { /* ignore */ } bookingsUnsub = null; }
    adminSubscribed = false;
    subscribeBookings();
    refreshSoon();
  }

  // A pending row clears when a snapshot shows its item in the target status.
  function noteEchoes(flat) {
    if (!pending.size) return;
    const byId = new Map(flat.map((it) => [it.id, it]));
    Array.from(pending.keys()).forEach((id) => {
      const p = pending.get(id);
      const it = byId.get(id);
      if (!p || !it || it.status !== p.target) return;
      if (p.done) finishPending(id, true); else p.seen = true;
    });
  }
  function setPending(id, label, target) {
    const old = pending.get(id);
    if (old && old.timer) clearTimeout(old.timer);
    pending.set(id, { label, target, done: false, seen: false, timer: null });
    refreshSoon();
  }
  function clearPending(id) {
    const p = pending.get(id);
    if (p && p.timer) clearTimeout(p.timer);
    pending.delete(id);
    refreshSoon();
  }
  function finishPending(id, flash) {
    clearPending(id);
    if (flash) {
      echoed.add(id);
      setTimeout(() => { echoed.delete(id); refreshSoon(); }, 1300);
    }
  }
  // The write sequence finished: flash now if the echo already arrived, else wait for
  // it (with a ceiling so a lost snapshot never leaves a row pending forever).
  function donePending(id) {
    const p = pending.get(id);
    if (!p) return;
    p.done = true;
    if (p.seen) { finishPending(id, true); return; }
    p.timer = setTimeout(() => finishPending(id, false), 10000);
  }

  function sameLedger(a, b) {
    const norm = (l) => l.map((e) => e.k + ':' + e.pax).sort().join('|');
    return norm(a) === norm(b);
  }
  // Apply ops ({key: pax | 0}) to a ledger, newest wins.
  function applyOps(entries, ops, now) {
    const map = new Map(entries.map((e) => [e.k, e]));
    Object.keys(ops || {}).forEach((k) => {
      const pax = clampPax(ops[k]);
      if (pax > 0) map.set(k, { k, pax, at: now }); else map.delete(k);
    });
    return Array.from(map.values());
  }

  // spec 7.7 - idempotent; the only writer of spotsLeft, and of the desk ledger. Reads the
  // departure inside the queue so it serialises with any other write to the same departure,
  // and computes from that fresh document's ledger (not from any booker's document).
  async function syncDeparture(depId, ops) {
    const app = APP;
    const db = app && app.caps && app.caps.db;
    if (!db) throw new Error(DB_OFF_TEXT);
    const path = 'departures/' + depId;
    let result = 'same';
    await queue(path, async () => {
      const dep = app.snapData(await db.doc(path).get());
      if (!dep) { result = 'missing'; return; }
      const legacy = isLegacy(dep);
      // A legacy departure adopts its confirmed items: that needs a trusted bookings snapshot,
      // or the sum would read 0 and overstate spots.
      if (legacy && !bookingsLoaded()) throw new Error('Bookings not loaded yet');
      const before = legacy ? adoptedEntries(depId) : ledgerEntries(dep);
      const now = Date.now();
      const ledger = applyOps(before, ops, now);
      const spotsLeft = spotsFrom(dep, manualOf(dep) + ledgerSum(ledger));
      const status = dep.status === 'closed' ? 'closed' : (spotsLeft === 0 ? 'full' : 'open');
      const ledgerChanged = legacy || !Array.isArray(dep.ledger) || !sameLedger(ledgerEntries(dep), ledger);
      if (!ledgerChanged && dep.spotsLeft === spotsLeft && dep.status === status) return;
      const patch = { spotsLeft, status, updatedAt: now };
      if (ledgerChanged) patch.ledger = ledger;
      await db.doc(path).update(patch);
      result = (dep.spotsLeft === spotsLeft && dep.status === status) ? 'ledger' : 'written';
    });
    return result;
  }

  // Runs after each admin bookings snapshot: retries queued counter updates.
  async function replayOutbox() {
    if (replaying || !APP || !APP.caps || !APP.caps.db || !bookingsLoaded()) return 0;
    const list = readOutbox();
    if (!list.length) return 0;
    replaying = true;
    const done = new Map(); // depId -> `at` of the entry that succeeded
    try {
      for (const e of list) {
        // Under the departure lock: a queued ledger change must not land inside a Confirm's
        // capacity check for the same departure.
        // The entry is re-read inside the lock: a Confirm/Cancel that ran meanwhile may have
        // already applied (and dropped) it, and its ops must never be replayed stale.
        try {
          await withDepLock(e.departureId, async () => {
            const cur = readOutbox().find((x) => x.departureId === e.departureId);
            if (!cur) return;
            await syncDeparture(e.departureId, cleanOps(cur.ops));
            done.set(e.departureId, num(cur.at));
          });
        } catch (err) { /* keep it */ }
      }
      // Entries re-queued while replaying (newer `at`) survive.
      writeOutbox(readOutbox().filter((e) => !(done.has(e.departureId) && num(e.at) <= done.get(e.departureId))));
      done.forEach((at, depId) => clearNoticesFor(depId));
    } finally {
      replaying = false;
      refreshSoon();
    }
    return done.size;
  }

  /* ======================================================================
     5. Row write sequences (spec 7.6)
     ====================================================================== */
  function rowError(msg) { const e = new Error(msg); e.rowMessage = msg; return e; }
  function failRow(id, msg, retry) {
    clearPending(id);
    rowErrors.set(id, { msg, retry: retry || null });
    refreshSoon();
  }

  // Step 3 of every sequence: re-read the viewer's bookings doc, patch one item by id,
  // write the whole items array back, then patch the store optimistically.
  async function writeItem(item, patch) {
    const app = APP;
    const db = app.caps.db;
    const bpath = 'bookings/' + item.viewerId;
    let written = null;
    await queue(bpath, async () => {
      const cur = app.snapData(await db.doc(bpath).get()) || {};
      const items = Array.isArray(cur.items) ? cur.items.slice() : [];
      const i = items.findIndex((x) => x && x.id === item.id);
      if (i < 0) throw rowError('Booking not found \u2014 refresh');
      items[i] = patch(items[i]);
      await db.doc(bpath).update({ items });
      written = items;
    });
    patchStore(item.viewerId, written);
  }
  function patchStore(viewerId, items) {
    if (!Array.isArray(items)) return;
    const st = store();
    const raw = new Map(st.adminBookingsRaw instanceof Map ? st.adminBookingsRaw : []);
    raw.set(viewerId, items);
    const flat = [];
    raw.forEach((list, vid) => {
      (Array.isArray(list) ? list : []).forEach((it) => {
        if (it && typeof it === 'object') flat.push(Object.assign({}, it, { viewerId: vid }));
      });
    });
    st.set('adminBookingsRaw', raw);
    st.set('adminBookings', flat);
  }

  // Step 4 with the outbox fallback: the booking is already written, so a failed
  // counter/ledger update is queued (with its ledger ops) and surfaced, never dropped.
  async function syncOrQueue(depId, itemId, kind, ops) {
    try {
      await syncDeparture(depId, Object.assign(outboxOpsFor(depId), cleanOps(ops)));
      dropOutbox(depId);
      clearNoticesFor(depId);
    } catch (e) {
      pushOutbox(depId, ops);
      if (itemId) rowNotices.set(itemId, { depId, kind });
    }
    refreshSoon();
  }

  // Confirm (spec 7.6). `item.status` is what the row showed when Confirm was tapped: normally
  // "requested"; "confirmed" when the desk records an item the booker marked confirmed. The
  // fresh read must still show exactly that status, so a withdraw that lands in between is
  // never overwritten. Steps 1-4 run under the departure lock.
  async function doConfirm(item, ack) {
    const app = APP;
    const db = app.caps && app.caps.db;
    const id = item.id;
    if (!db || !dbOK() || busy.has(id) || bookingsErrored) return;
    const expected = item.status;
    if (expected !== 'requested' && expected !== 'confirmed') {
      failRow(id, 'Already ' + (expected || 'changed'), null);
      return;
    }
    busy.add(id);
    rowErrors.delete(id);
    clearAsk(id);
    setPending(id, 'Confirming\u2026', 'confirmed');
    const depId = item.departureId;
    const key = keyOf(item);
    try {
      await withDepLock(depId, async () => {
        // 1. Fresh read of the departure (its ledger is the capacity truth).
        let dep;
        try { dep = app.snapData(await db.doc('departures/' + depId).get()); } catch (e) {
          failRow(id, "Didn't send \u2014 tap to retry", { act: 'confirm', ack });
          return;
        }
        if (!dep) { failRow(id, 'Departure no longer exists \u2014 the request can only be cancelled', null); return; }
        const ledger = isLegacy(dep) ? (bookingsLoaded() ? adoptedEntries(depId) : null) : ledgerEntries(dep);
        if (!ledger) { failRow(id, 'Bookings are still loading \u2014 tap to retry', { act: 'confirm', ack }); return; }
        // 2. Capacity check (unless the overbook question was answered Yes), counting the
        //    ledger plus any of this device's queued changes for the departure.
        const counted = applyOps(ledger, outboxOpsFor(depId), 0);
        const avail = Math.max(0, capOf(dep) - manualOf(dep) - ledgerSum(counted, key));
        const pax = clampPax(item.pax);
        if (pax < 1) { failRow(id, 'No party size on this request \u2014 check with the booker', null); return; }
        if (pax > avail && !ack) { clearPending(id); showAsk(id, avail); return; }
        // 3. Booking item first.
        try {
          await writeItem(item, (cur) => {
            if (cur.status !== expected) throw rowError('Already ' + cur.status);
            if (clampPax(cur.pax) !== pax) throw rowError('Party size changed to ' + clampPax(cur.pax) + ' \u2014 check it and confirm again');
            return Object.assign({}, cur, { status: 'confirmed', confirmedPax: pax, updatedAt: Date.now() });
          });
        } catch (e) {
          failRow(id, e.rowMessage || "Didn't send \u2014 tap to retry", e.rowMessage ? null : { act: 'confirm', ack });
          return;
        }
        // 4. Then the departure: ledger entry + counter in one update.
        await syncOrQueue(depId, id, 'confirm', { [key]: pax });
        // 5. Stay pending until the snapshot echoes.
        donePending(id);
      });
    } finally {
      busy.delete(id);
      refreshSoon();
    }
  }

  // Decline (requested -> cancelled), Cancel (confirmed -> cancelled), Restore (cancelled -> requested),
  // Keep (booker-changed status back to confirmed, ledger untouched). Cancelling releases the
  // item's ledger entry; Decline/Restore never touch the departure (spec 7.6).
  async function doSetStatus(item, from, to, act) {
    const id = item.id;
    if (!APP.caps || !APP.caps.db || !dbOK() || busy.has(id) || bookingsErrored) return;
    busy.add(id);
    rowErrors.delete(id);
    clearAsk(id);
    setPending(id, 'Saving\u2026', to);
    const depId = item.departureId;
    const key = keyOf(item);
    const releases = act === 'cancel';
    const run = async () => {
      let keepPax = 0;
      if (act === 'keep') {
        keepPax = ledgerPaxOf(item);
        if (!keepPax) { failRow(id, 'Not in your confirmed list any more \u2014 refresh', null); return; }
      }
      try {
        await writeItem(item, (cur) => {
          if (cur.status !== from) throw rowError('Already ' + cur.status);
          const patch = { status: to, updatedAt: Date.now() };
          if (act === 'keep') patch.confirmedPax = keepPax;
          return Object.assign({}, cur, patch);
        });
      } catch (e) {
        failRow(id, e.rowMessage || "Didn't send \u2014 tap to retry", e.rowMessage ? null : { act });
        return;
      }
      if (releases) await syncOrQueue(depId, id, 'cancel', { [key]: 0 });
      donePending(id);
    };
    try {
      if (releases) await withDepLock(depId, run); else await run();
    } finally {
      busy.delete(id);
      refreshSoon();
    }
  }

  // Release: drop a ledger entry whose booking the booker changed or removed (no item write).
  async function doRelease(depId, key, itemId) {
    const busyKey = itemId || key;
    if (!APP.caps || !APP.caps.db || !dbOK() || busy.has(busyKey)) return;
    busy.add(busyKey);
    if (itemId) { rowErrors.delete(itemId); setPending(itemId, 'Saving\u2026', null); }
    try {
      await withDepLock(depId, () => syncOrQueue(depId, itemId, 'cancel', { [key]: 0 }));
      toast('Spots released', 'ok');
    } finally {
      if (itemId) finishPending(itemId, false);
      busy.delete(busyKey);
      refreshSoon();
    }
  }

  function runRowAct(act, item, ack) {
    if (act === 'confirm') return doConfirm(item, !!ack);
    if (act === 'decline') return doSetStatus(item, 'requested', 'cancelled', 'decline');
    if (act === 'cancel') return doSetStatus(item, 'confirmed', 'cancelled', 'cancel');
    if (act === 'restore') return doSetStatus(item, 'cancelled', 'requested', 'restore');
    if (act === 'keep') return doSetStatus(item, item.status, 'confirmed', 'keep');
    return null;
  }

  // Overbook question: kept as row state so re-renders from snapshots don't drop it.
  function showAsk(id, avail) {
    clearAsk(id);
    const timer = setTimeout(() => { asks.delete(id); refreshSoon(); }, 6000);
    asks.set(id, { avail, timer });
    if (active) active.focusNext('[data-act="ask-yes"][data-id="' + cssEsc(id) + '"]');
    refreshSoon();
  }
  function clearAsk(id) {
    const a = asks.get(id);
    if (a) { clearTimeout(a.timer); asks.delete(id); }
  }
  function cssEsc(s) {
    return (window.CSS && CSS.escape) ? CSS.escape(String(s)) : String(s).replace(/["\\]/g, '\\$&');
  }

  /* ======================================================================
     6. Markup builders
     ====================================================================== */
  function pill(status) {
    const mod = STATUS_WORD[status] ? status : 'closed';
    return '<span class="pill pill--' + mod + '">' + esc(STATUS_WORD[status] || status || 'Unknown') + '</span>';
  }
  function sectionTitle(text) {
    return '<p class="admin__section-title" role="heading" aria-level="2">' + esc(text) + '</p>';
  }
  function skelRows() {
    return '<div class="skel-group" aria-hidden="true"><div class="skel skel--row"></div>'
      + '<div class="skel skel--row"></div><div class="skel skel--row"></div></div>';
  }
  // title/body are plain text (escaped here); actions is trusted markup built in this file.
  function emptyHTML(title, body, actions) {
    return '<div class="empty"><h3 class="empty__title">' + esc(title) + '</h3>'
      + (body ? '<p class="empty__body">' + esc(body) + '</p>' : '')
      + (actions ? '<div class="empty__actions">' + actions + '</div>' : '') + '</div>';
  }
  // Attribute string for a button that writes: disabled without a database, or when busy.
  function wdis(extra) {
    if (!dbOK()) return ' disabled title="' + esc(DB_OFF_TEXT) + '"';
    return extra ? ' disabled' : '';
  }
  // Row (booking) writes also pause while the bookings listener is reconnecting: the list
  // on screen is the last good copy, not live.
  function rowWdis(extra) {
    if (dbOK() && bookingsErrored) return ' disabled title="' + esc(RECONNECT_TEXT) + '"';
    return wdis(extra);
  }
  function itemAttrs(it) { return 'data-viewer="' + esc(it.viewerId) + '" data-id="' + esc(it.id) + '"'; }
  function barHTML(booked, cap) {
    const pct = cap > 0 ? Math.max(0, Math.min(100, Math.round((booked / cap) * 100))) : 0;
    return '<div class="arow__bar" role="img" aria-label="' + booked + ' of ' + cap + ' booked">'
      + '<div class="arow__bar-fill" style="width:' + pct + '%"></div></div>';
  }
  function copyField(text, label) {
    return '<div class="copyfield"><span class="copyfield__text">' + esc(text) + '</span>'
      + '<button type="button" class="btn btn--ghost btn--sm copyfield__btn" data-act="copy" data-copy-text="'
      + esc(text) + '" aria-label="' + esc(label) + '">Copy</button></div>';
  }

  // The row's own write sequence shows its label ("Confirming..."); every other row whose
  // docs are being written -- including any row on a departure where a Confirm or Cancel is
  // running, whose capacity check must see that result first -- keeps its buttons, disabled.
  function rowPendingLabel(it) {
    const p = pending.get(it.id);
    return p ? p.label : '';
  }
  function rowBlocked(it) {
    return isInFlight('bookings/' + it.viewerId) || isInFlight('departures/' + it.departureId) || depHolds.has(it.departureId);
  }

  // The consequence line (spec 7.3), computed from the desk ledger, never from the stored counter.
  function consequenceHTML(it, dep, missing) {
    if (missing) return '<div class="arow__line arow__line--warn">Departure no longer exists \u2014 cancel only</div>';
    if (!dep || it.status !== 'requested' || !ledgerKnown(dep) || bookingsErrored || mismatchOf(it)) return '';
    const pax = clampPax(it.pax), cap = capOf(dep), booked = bookedFor(dep), avail = computedSpots(dep);
    if (pax <= avail) return '<div class="arow__line">' + booked + ' of ' + cap + ' booked \u00b7 confirming leaves ' + (avail - pax) + '</div>';
    return '<div class="arow__line arow__line--warn">Would overbook by ' + (pax - avail) + '</div>';
  }
  // The booker's document disagrees with what this desk confirmed.
  function mismatchHTML(it) {
    const m = mismatchOf(it);
    if (!m) return '';
    let text;
    if (m.waiting) text = 'Counter update waiting on this device \u2014 Recount to finish';
    else if (m.kind === 'unverified') text = 'Status changed by booker: marked confirmed, but not confirmed from this desk \u2014 not counted in spots';
    else if (m.kind === 'unconfirmed') text = 'Status changed by booker to ' + (STATUS_WORD[it.status] || 'unknown').toLowerCase() + ' \u2014 you confirmed ' + plural(m.pax, 'person', 'people') + ', still counted';
    else if (m.kind === 'pax') text = 'Party size changed by booker to ' + m.now + ' \u2014 you confirmed ' + m.pax + ', ' + m.pax + ' counted';
    else text = 'Booker\u2019s list claims ' + m.claimed + ' confirmed \u2014 you confirmed ' + m.pax + ', ' + m.pax + ' counted';
    return '<div class="arow__line arow__line--warn" role="note">' + esc(text) + '</div>';
  }

  function chatLink(it, dep, wa) {
    const trek = trekOf(it.trekId || (dep && dep.trekId)) || { name: trekName(it.trekId), days: dep ? dep.days : '' };
    let text;
    try { text = APP.wa.msg.adminChat(Object.assign({}, it, { id: String(it.id || '') }), trek, dep); } catch (e) {
      text = 'Hi ' + (it.name || '') + ', this is Sandip from Magic Beyond Himalaya.';
    }
    return 'https://wa.me/' + wa + '?text=' + encodeURIComponent(text);
  }
  function contactHTML(it, dep) {
    const raw = String(it.whatsapp == null ? '' : it.whatsapp).trim();
    const wa = digits(raw);
    // Show digits-only numbers with a leading + so they read as international.
    const shown = raw ? (/^\d+$/.test(raw) ? '+' + raw : raw) : '';
    const parts = [];
    if (shown) parts.push(copyField(shown, 'Copy WhatsApp number'));
    if (it.email) parts.push(copyField(String(it.email), 'Copy email'));
    if (wa.length >= 6) {
      parts.push('<a class="btn btn--dark btn--sm" href="' + esc(chatLink(it, dep, wa))
        + '" target="_blank" rel="noopener">Chat</a>');
    }
    return parts.length ? '<div class="arow__contact">' + parts.join('') + '</div>' : '';
  }
  function captionHTML(it) {
    const p = profileNames.get(it.viewerId);
    if (!p || norm(p) === norm(it.name)) return '';
    return '<div class="arow__caption">claude.ai: ' + esc(p) + '</div>';
  }
  function othersHTML(it) {
    const others = allItems().filter((x) => x.viewerId === it.viewerId && x.id !== it.id);
    if (!others.length || !it.id) return '';
    const open = expanded.has(it.id);
    let h = '<div><button type="button" class="btn btn--link" data-act="expand" ' + itemAttrs(it)
      + ' aria-expanded="' + open + '">Other requests by this booker (' + others.length + ')</button></div>';
    if (open) {
      h += others.map((o) => {
        const d = depById(o.departureId);
        return '<div class="arow__meta">' + esc(trekName(o.trekId || (d && d.trekId))) + ' \u00b7 '
          + esc(fshort(d ? d.start : o.start)) + ' \u00b7 ' + plural(num(o.pax), 'person', 'people') + ' \u00b7 '
          + esc(o.status) + '</div>';
      }).join('');
    }
    return h;
  }
  function askHTML(it, avail) {
    const ids = itemAttrs(it);
    return '<span class="inline-confirm" data-own="1"><span class="inline-confirm__q">Only ' + avail
      + ' left, this needs ' + clampPax(it.pax) + '. Confirm anyway (overbook)?</span>'
      + '<button type="button" class="btn btn--primary btn--sm inline-confirm__yes" data-act="ask-yes" ' + ids + '>Confirm anyway</button>'
      + '<button type="button" class="btn btn--ghost btn--sm inline-confirm__no" data-act="ask-no" ' + ids + '>Not now</button></span>';
  }
  function actionsHTML(it, dep, ctx) {
    if (!it.id) return '';
    const pend = rowPendingLabel(it);
    if (pend) {
      return '<div class="arow__actions"><button type="button" class="btn btn--ghost btn--sm" disabled>' + esc(pend) + '</button></div>';
    }
    const ids = itemAttrs(it);
    const w = rowWdis(rowBlocked(it));
    const missing = depsLoaded() && !dep;
    const b = [];
    const m = missing ? null : mismatchOf(it);
    if (m && m.waiting) {
      // The row notice (when this session raised it) already carries the Recount button.
      if (!rowNotices.has(it.id)) b.push('<button type="button" class="btn btn--ghost btn--sm" data-act="notice-retry" data-dep="' + esc(it.departureId) + '" '
        + ids + w + '>Recount</button>');
    } else if (m && m.kind === 'unverified') {
      // Booker-set "confirmed": record it through the normal capacity check, or cancel it.
      const ask = asks.get(it.id);
      b.push(ask ? askHTML(it, ask.avail)
        : '<button type="button" class="btn btn--primary btn--sm" data-act="confirm" ' + ids + w + '>Confirm</button>');
      b.push('<button type="button" class="btn btn--danger btn--sm" data-act="cancel" ' + ids + w + '>Cancel booking</button>');
    } else if (m && m.kind === 'unconfirmed') {
      // The desk confirmed it, the booker changed it: put the status back, or free the spots.
      b.push('<button type="button" class="btn btn--primary btn--sm" data-act="keep" ' + ids + w + '>Keep confirmed</button>');
      b.push('<button type="button" class="btn btn--danger btn--sm" data-act="release" data-dep="' + esc(it.departureId) + '" '
        + ids + w + '>Release ' + plural(m.pax, 'spot', 'spots') + '</button>');
    } else if (it.status === 'requested') {
      if (!missing) {
        const ask = asks.get(it.id);
        b.push(ask ? askHTML(it, ask.avail)
          : '<button type="button" class="btn btn--primary btn--sm" data-act="confirm" ' + ids + w + '>Confirm</button>');
      }
      b.push('<button type="button" class="btn btn--danger btn--sm" data-act="decline" ' + ids + w + '>Decline</button>');
    } else if (it.status === 'confirmed' && !ctx.inbox) {
      b.push('<button type="button" class="btn btn--danger btn--sm" data-act="cancel" ' + ids + w + '>Cancel booking</button>');
    } else if (it.status === 'cancelled' && !ctx.inbox && !missing) {
      b.push('<button type="button" class="btn btn--ghost btn--sm" data-act="restore" ' + ids + w + '>Restore</button>');
    }
    return b.length ? '<div class="arow__actions">' + b.join('') + '</div>' : '';
  }
  function tailHTML(it) {
    let h = '';
    const e = rowErrors.get(it.id);
    if (e) {
      h += e.retry
        ? '<button type="button" class="arow__error" data-act="retry" ' + itemAttrs(it) + '>' + esc(e.msg) + '</button>'
        : '<div class="arow__error" role="alert">' + esc(e.msg) + '</div>';
    }
    const n = rowNotices.get(it.id);
    if (n) {
      const d = depById(n.depId);
      const label = d ? depLabel(d) : n.depId;
      const text = n.kind === 'cancel'
        ? 'Spots may be off for ' + label
        : "Spots were reserved but the counter didn't update for " + label;
      h += '<div class="arow__notice banner banner--danger" role="alert"><span class="banner__text">' + esc(text)
        + '</span><button type="button" class="btn btn--sm btn--ghost banner__action" data-act="notice-retry" data-dep="'
        + esc(n.depId) + '" ' + itemAttrs(it) + rowWdis() + '>Recount</button></div>';
    }
    return h;
  }

  // One booking item as an admin row (Inbox, Bookings, departure party list).
  function itemRow(it, ctx) {
    const dep = depById(it.departureId);
    const missing = depsLoaded() && !dep;
    const start = dep ? dep.start : it.start;
    const pax = num(it.pax);
    const pend = rowPendingLabel(it);
    const cls = ['arow'];
    if (pend || rowBlocked(it)) cls.push('is-pending');
    if (echoed.has(it.id)) cls.push('is-echoed');
    const word = STATUS_WORD[it.status] ? it.status : 'unknown';
    const when = rel(it.status === 'requested' ? it.createdAt : (it.updatedAt || it.createdAt));
    let title = esc(it.name || 'No name given') + ' \u00b7 ' + pax + ' ' + (pax === 1 ? 'person' : 'people');
    if (ctx.showStatus || it.status !== 'requested') title += ' ' + pill(it.status);
    if (it.status === 'confirmed' && it.confirmedPax == null) {
      title += ' <span class="pill pill--few arow__badge-verify" title="No confirmed party size stored \u2014 check with the booker">Verify</span>';
    }
    const main = '<div class="arow__main">'
      + '<div class="arow__title">' + title + '</div>'
      + '<div class="arow__meta">' + esc(trekName(it.trekId || (dep && dep.trekId))) + ' \u00b7 ' + esc(fshort(start))
      + ' \u00b7 ' + esc(word) + (when ? ' ' + esc(when) : '') + '</div>'
      + consequenceHTML(it, dep, missing)
      + (missing ? '' : mismatchHTML(it))
      + (it.note ? '<div class="arow__note">' + esc(it.note) + '</div>' : '')
      + captionHTML(it)
      + othersHTML(it)
      + '</div>';
    return '<div class="' + cls.join(' ') + '" data-viewer="' + esc(it.viewerId) + '">'
      + main + actionsHTML(it, dep, ctx) + contactHTML(it, dep) + tailHTML(it) + '</div>';
  }

  /* ---- Inbox (spec 7.3) ---- */
  function groupHeader(it) {
    const d = depById(it.departureId);
    const text = d ? depLabel(d) : trekName(it.trekId) + ' \u00b7 ' + fshort(it.start);
    return '<h3 class="admin__group">' + esc(text) + '</h3>';
  }
  function inboxHTML(ctx) {
    let h = '<section class="admin__section">' + sectionTitle('Needs a reply');
    if (!bookingsShown()) {
      const waiting = statusDb() !== 'null' && !ctx.timedOut && !bookingsTimedOut;
      h += waiting ? skelRows() : emptyHTML('No requests visible',
        dbOK() ? 'Requests sent from the site appear here. Access rules may hide some of them from this view.' : '');
    } else {
      const list = allItems().filter((it) => (it.status === 'requested' && !mismatchOf(it)) || recentIds.has(it.id)).sort(byDeparture);
      if (!list.length) {
        const next = nextDeparture();
        h += emptyHTML('Nothing needs you.', next
          ? 'Next departure: ' + trekName(next.trekId) + ' ' + fshort(next.start)
          : 'No upcoming departures');
      } else {
        // A departure header precedes every run of >=2 consecutive requests for one departure.
        const out = [];
        let i = 0;
        while (i < list.length) {
          let j = i;
          while (j + 1 < list.length && list[j + 1].departureId === list[i].departureId) j++;
          if (j > i) out.push(groupHeader(list[i]));
          for (let k = i; k <= j; k++) out.push(itemRow(list[k], { inbox: true }));
          i = j + 1;
        }
        h += '<div>' + out.join('') + '</div>';
      }
    }
    return h + '</section>' + changedHTML() + soonHTML() + driftHTML();
  }
  // Items whose booker-side status disagrees with the desk ledger: shown until resolved.
  function changedHTML() {
    if (!bookingsShown()) return '';
    const list = allItems().filter((it) => !recentIds.has(it.id) && mismatchOf(it)).sort(byDeparture);
    if (!list.length) return '';
    return '<section class="admin__section">' + sectionTitle('Changed by bookers')
      + '<p class="note">Spots follow what you confirmed here, not what a booker’s own list says.</p>'
      + '<div>' + list.map((it) => itemRow(it, { showStatus: true })).join('') + '</div></section>';
  }
  function soonHTML() {
    let h = '<section class="admin__section">' + sectionTitle('Departing within 14 days');
    if (!depsLoaded()) {
      const gone = statusDb() === 'null' || store().departuresTimeout;
      return h + '<p class="note">' + (gone ? "Departures aren't available in this view." : 'Departures are still loading.') + '</p></section>';
    }
    const t = today(), until = addDays(t, 14);
    const list = allDeps()
      .filter((d) => d.status !== 'closed' && isISO(d.start) && d.start >= t && d.start <= until
        && (requestedFor(d.id) > 0 || bookedFor(d) === 0))
      .sort(byStart);
    if (!list.length) return h + '<p class="note">Nothing departing in the next 14 days needs attention.</p></section>';
    return h + '<div>' + list.map((d) => {
      const req = requestedFor(d.id), booked = bookedFor(d), cap = capOf(d), days = dayDiff(t, d.start);
      return '<div class="arow"><div class="arow__main">'
        + '<div class="arow__title">' + esc(depLabel(d)) + ' ' + pill(d.status) + '</div>'
        + '<div class="arow__meta">' + (days === 0 ? 'starts today' : 'in ' + plural(days, 'day', 'days')) + ' \u00b7 '
        + booked + '/' + cap + ' booked \u00b7 ' + req + ' requested</div>'
        + '<div class="arow__line' + (req > 0 ? ' arow__line--warn' : '') + '">'
        + (req > 0 ? plural(req, 'person', 'people') + ' waiting for a reply' : 'Nobody booked yet') + '</div>'
        + '</div><div class="arow__actions"><a class="btn btn--ghost btn--sm" href="#admin-departure-'
        + esc(safeId(d.id)) + '">Open</a></div></div>';
    }).join('') + '</div></section>';
  }
  function driftHTML() {
    let h = '<section class="admin__section">' + sectionTitle('Counter drift');
    if (!depsLoaded() || !bookingsLoaded()) {
      return h + '<p class="note">' + (dbOK() ? 'Counts appear once bookings load.' : 'Counts need the database.') + '</p></section>';
    }
    const list = allDeps().filter(drift).sort(byStart);
    if (!list.length) return h + '<p class="note">Every public counter matches the bookings.</p></section>';
    return h + '<div>' + list.map((d) => {
      const inflight = isInFlight('departures/' + d.id);
      const stored = typeof d.spotsLeft === 'number' ? d.spotsLeft : '\u2014';
      return '<div class="arow arow--drift' + (inflight ? ' is-pending' : '') + '"><div class="arow__main">'
        + '<div class="arow__title">' + esc(depLabel(d)) + '</div>'
        + '<div class="arow__meta">stored ' + esc(stored) + ' \u00b7 computed ' + computedSpots(d) + '</div>'
        + '</div><div class="arow__actions"><button type="button" class="btn btn--ghost btn--sm" data-act="recount" data-dep="'
        + esc(d.id) + '"' + wdis(inflight) + '>' + (inflight ? 'Saving\u2026' : 'Recount') + '</button></div></div>';
    }).join('') + '</div></section>';
  }

  /* ---- Departures (spec 7.4) ---- */
  // Delete needs a trusted bookings list and an empty ledger (spec 7.4, plus the ledger).
  function deleteAttr(d, w) {
    if (!bookingsLoaded()) return ' disabled title="' + esc(bookingsErrored ? RECONNECT_TEXT : 'Checking bookings\u2026') + '"';
    if (nonCancelledCount(d.id) > 0) return ' disabled title="Has bookings \u2014 close it instead"';
    if (ledgerSum(ledgerFor(d) || [])) return ' disabled title="Has confirmed places \u2014 close it instead"';
    return w;
  }
  function depRow(d, past) {
    const cap = capOf(d), booked = bookedFor(d), req = requestedFor(d.id);
    const drifted = bookingsLoaded() && drift(d);
    const inflight = isInFlight('departures/' + d.id);
    const cls = 'arow' + (past ? ' arow--past' : '') + (drifted ? ' arow--drift' : '') + (inflight ? ' is-pending' : '');
    const w = wdis(inflight);
    const did = 'data-dep="' + esc(d.id) + '"';
    const delAttr = deleteAttr(d, w);
    // Recount only where it can change something: drift, or an update waiting on this device.
    const showRecount = drifted || readOutbox().some((e) => e.departureId === d.id);
    const price = num(d.price) > 0 ? esc(money(d.price)) + ' pp' : 'no price set';
    return '<div class="' + cls + '"><div class="arow__main">'
      + '<div class="arow__title">' + esc(depLabel(d)) + ' ' + pill(d.status)
      + (drifted ? ' <span class="pill pill--few">Counter drift</span>' : '') + '</div>'
      + '<div class="arow__meta">' + plural(num(d.days), 'day', 'days') + ' \u00b7 ' + price + ' \u00b7 ' + booked + '/' + cap
      + ' booked \u00b7 ' + req + ' requested</div>'
      + barHTML(booked, cap)
      + (d.note ? '<div class="arow__note">' + esc(d.note) + '</div>' : '')
      + '</div><div class="arow__actions">'
      + '<a class="btn btn--ghost btn--sm" href="#admin-departure-' + esc(safeId(d.id)) + '">Open</a>'
      + '<button type="button" class="btn btn--ghost btn--sm" data-act="edit" ' + did + w + '>Edit</button>'
      + (d.status === 'closed'
        ? '<button type="button" class="btn btn--ghost btn--sm" data-act="reopen" ' + did + w + '>Reopen</button>'
        : '<button type="button" class="btn btn--ghost btn--sm" data-act="close" ' + did + w + '>Close</button>')
      + '<button type="button" class="btn btn--ghost btn--sm" data-act="duplicate" ' + did + wdis() + '>Duplicate</button>'
      + (showRecount ? '<button type="button" class="btn btn--ghost btn--sm" data-act="recount" ' + did + w + '>Recount</button>' : '')
      + '<button type="button" class="btn btn--danger btn--sm" data-act="delete" ' + did + delAttr + '>Delete</button>'
      + '</div></div>';
  }
  function departuresHTML(ctx) {
    let h = '<section class="admin__section"><div class="section__head">' + sectionTitle('Departures')
      + '<button type="button" class="btn btn--primary admin__fab' + (fabTucked ? ' is-tucked' : '') + '" data-act="new"' + wdis() + '>+ New departure</button></div>';
    if (!depsLoaded()) {
      const waiting = !ctx.timedOut && !store().departuresTimeout;
      return h + (waiting ? skelRows() : emptyHTML('No departures visible', 'Departures could not be loaded in this view.')) + '</section>';
    }
    if (store().departuresSource === 'cache') {
      h += '<p class="note note--stale">Showing cached departures \u2014 live data unavailable.</p>';
    }
    const deps = allDeps();
    if (!deps.length) {
      return h + emptyHTML('No departures yet',
        'Create the first one with + New departure. It appears on the public Dates page once saved.') + '</section>';
    }
    const t = today();
    const up = deps.filter((d) => (d.start || '') >= t).sort(byStart);
    const past = deps.filter((d) => !((d.start || '') >= t)).sort((a, b) => byStart(b, a));
    h += '<h3 class="admin__group">Upcoming</h3>'
      + (up.length ? '<div>' + up.map((d) => depRow(d, false)).join('') + '</div>' : '<p class="note">No upcoming departures.</p>');
    if (past.length) h += '<h3 class="admin__group">Past</h3><div>' + past.map((d) => depRow(d, true)).join('') + '</div>';
    return h + '</section>';
  }

  /* ---- Departure detail (spec 7.5) ---- */
  function detailHTML(id, ctx) {
    let h = '<a class="view__back" href="#admin-departures">\u2190 Departures</a>';
    if (!depsLoaded()) {
      const waiting = !ctx.timedOut && !store().departuresTimeout;
      return h + (waiting ? skelRows() : emptyHTML('No departures visible', 'Departures could not be loaded in this view.'));
    }
    const dep = depById(id);
    if (!dep) {
      h += emptyHTML('This departure no longer exists',
        'It may have been deleted on another device. Bookings still pointing at it are listed below and can only be cancelled.');
      const orphans = allItems().filter((it) => it.departureId === id);
      if (orphans.length) {
        h += '<section class="admin__section">' + sectionTitle('Orphaned bookings') + '<div>'
          + orphans.map((it) => itemRow(it, { showStatus: true })).join('') + '</div></section>';
      }
      return h;
    }
    const cap = capOf(dep), booked = bookedFor(dep), manual = manualOf(dep);
    const drifted = bookingsLoaded() && drift(dep);
    const inflight = isInFlight('departures/' + dep.id);
    const w = wdis(inflight);
    const did = 'data-dep="' + esc(dep.id) + '"';
    const stored = typeof dep.spotsLeft === 'number' ? dep.spotsLeft : '\u2014';
    h += '<section class="admin__section" style="display:grid;gap:var(--s-4)">'
      + '<div class="section__head" style="margin-bottom:0"><h2 class="section__title">' + esc(trekName(dep.trekId)) + '</h2>' + pill(dep.status) + '</div>'
      + '<dl class="kv">'
      + '<dt class="kv__k">Dates</dt><dd class="kv__v">' + esc(fshort(dep.start)) + ' \u2192 ' + esc(fshort(endOf(dep))) + ' \u00b7 '
      + plural(num(dep.days), 'day', 'days') + '</dd>'
      + '<dt class="kv__k">Price</dt><dd class="kv__v">' + (num(dep.price) > 0 ? esc(money(dep.price)) + ' per person' : 'Not set') + '</dd>'
      + '<dt class="kv__k">Capacity</dt><dd class="kv__v">' + booked + ' of ' + cap + ' booked \u00b7 ' + manual + ' by WhatsApp \u00b7 '
      + esc(stored) + ' left</dd>'
      + '<dt class="kv__k">Waiting</dt><dd class="kv__v">' + plural(requestedFor(dep.id), 'person', 'people') + ' requested</dd>'
      + '<dt class="kv__k">Id</dt><dd class="kv__v">' + esc(dep.id) + '</dd>'
      + (dep.note ? '<dt class="kv__k">Note</dt><dd class="kv__v">' + esc(dep.note) + '</dd>' : '')
      + (num(dep.updatedAt) ? '<dt class="kv__k">Updated</dt><dd class="kv__v">' + esc(rel(dep.updatedAt)) + '</dd>' : '')
      + '</dl>'
      + barHTML(booked, cap)
      + (drifted
        ? '<div class="banner banner--warn" role="status"><span class="banner__text">Public counter says ' + esc(stored)
          + ' left; bookings say ' + computedSpots(dep) + '.</span><button type="button" class="btn btn--sm btn--ghost banner__action" data-act="recount" '
          + did + w + '>Recount</button></div>'
        : '')
      + '<div class="arow__actions">'
      + '<button type="button" class="btn btn--ghost btn--sm" data-act="edit" ' + did + w + '>Edit</button>'
      + (dep.status === 'closed'
        ? '<button type="button" class="btn btn--ghost btn--sm" data-act="reopen" ' + did + w + '>Reopen</button>'
        : '<button type="button" class="btn btn--ghost btn--sm" data-act="close" ' + did + w + '>Close</button>')
      + '<button type="button" class="btn btn--ghost btn--sm" data-act="duplicate" ' + did + wdis() + '>Duplicate</button>'
      + '<button type="button" class="btn btn--ghost btn--sm" data-act="copy-invite" ' + did + '>Copy WhatsApp invite</button>'
      + '<button type="button" class="btn btn--ghost btn--sm" data-act="copy-sheet" ' + did + '>Copy trip sheet</button>'
      + '</div></section>';

    h += '<section class="admin__section">' + sectionTitle('Party');
    if (!bookingsShown()) {
      const waiting = statusDb() !== 'null' && !ctx.timedOut && !bookingsTimedOut;
      return h + (waiting ? skelRows() : emptyHTML('No requests visible', dbOK() ? 'Access rules may hide requests from this view.' : '')) + '</section>';
    }
    // Places this desk confirmed whose booking the booker has since removed from their list.
    const orphans = orphanEntries(dep);
    if (orphans.length) {
      h += '<div class="banner banner--warn" role="status"><span class="banner__text">'
        + plural(ledgerSum(orphans), 'place', 'places') + ' you confirmed here no longer ' + (orphans.length === 1 ? 'has its' : 'have their')
        + ' booking in the booker\u2019s list. ' + (orphans.length === 1 ? 'It is' : 'They are') + ' still counted.</span>'
        + orphans.map((e) => '<button type="button" class="btn btn--sm btn--ghost banner__action" data-act="release-key" data-dep="' + esc(dep.id)
          + '" data-key="' + esc(e.k) + '"' + rowWdis() + '>Release ' + plural(e.pax, 'spot', 'spots') + '</button>').join('')
        + '</div>';
    }
    const items = allItems().filter((it) => it.departureId === dep.id);
    if (!items.length) {
      return h + '<p class="note">No requests through the site yet' + (manual ? ' \u00b7 ' + manual + ' confirmed by WhatsApp' : '') + '.</p></section>';
    }
    [['confirmed', 'Confirmed'], ['requested', 'Requested'], ['cancelled', 'Cancelled']].forEach(([s, label]) => {
      const g = items.filter((it) => it.status === s).sort((a, b) => num(a.createdAt) - num(b.createdAt));
      if (g.length) {
        h += '<h3 class="admin__group">' + label + ' \u00b7 ' + g.length + '</h3><div>'
          + g.map((it) => itemRow(it, {})).join('') + '</div>';
      }
    });
    return h + '</section>';
  }

  // Clipboard texts for the departure detail actions (spec 7.5). Plain text, not HTML.
  function inviteText(dep) {
    const name = trekName(dep.trekId);
    return name + ' \u2014 group departure ' + flong(dep.start) + ' to ' + flong(endOf(dep)) + '\n'
      + num(dep.days) + ' days \u00b7 $' + num(dep.price) + ' per person \u00b7 ' + num(dep.spotsLeft) + ' of ' + num(dep.capacity)
      + ' spots left\nDetails and request: ' + location.href.split('#')[0] + '#departure-' + dep.id;
  }
  function tripSheetText(dep) {
    const trek = trekOf(dep.trekId);
    const lines = [trekName(dep.trekId), flong(dep.start) + ' to ' + flong(endOf(dep)) + ' \u00b7 ' + plural(num(dep.days), 'day', 'days'), '', 'Party:'];
    // The party is what this desk confirmed (the ledger), whatever a booker's own list says.
    const ledger = ledgerFor(dep) || [];
    const byKey = new Map(ledger.map((e) => [e.k, e.pax]));
    const confirmed = allItems().filter((it) => it.departureId === dep.id && byKey.has(keyOf(it)))
      .sort((a, b) => num(a.createdAt) - num(b.createdAt));
    confirmed.forEach((it) => {
      lines.push((it.name || 'No name') + ' \u00d7 ' + byKey.get(keyOf(it)) + ' \u00b7 ' + (it.whatsapp || '\u2014'));
      byKey.delete(keyOf(it));
    });
    const unlisted = Array.from(byKey.values()).reduce((s, p) => s + p, 0);
    if (unlisted > 0) lines.push(plural(unlisted, 'person', 'people') + ' confirmed on the site (booking no longer listed)');
    if (manualOf(dep) > 0) lines.push(manualOf(dep) + ' confirmed by WhatsApp');
    if (!ledger.length && !manualOf(dep)) lines.push('No one confirmed yet');
    lines.push('Total: ' + bookedFor(dep) + ' of ' + capOf(dep), '', 'Day plan:');
    const days = trek && Array.isArray(trek.days_data) ? trek.days_data : [];
    days.forEach((d, i) => {
      const n = num(d.day) || i + 1;
      lines.push('Day ' + n + ' \u00b7 ' + fshort(addDays(dep.start, n - 1)) + ' \u00b7 ' + d.route + ' \u00b7 ' + fnum(d.alt) + ' m');
    });
    return lines.join('\n');
  }

  /* ---- Bookings (spec 7.6) ---- */
  function bookingsListHTML(ctx) {
    if (!bookingsShown()) {
      const waiting = statusDb() !== 'null' && !ctx.timedOut && !bookingsTimedOut;
      return waiting ? skelRows() : emptyHTML('No requests visible', dbOK() ? 'Access rules may hide requests from this view.' : '');
    }
    const all = allItems();
    if (!all.length) {
      return emptyHTML('No requests visible', 'Requests sent from the site appear here. Access rules may hide some of them from this view.');
    }
    const q = norm(bookingsFilter.q);
    // A row being written, or showing an error, stays in view even once its status moved on.
    const list = all.filter((it) => (bookingsFilter.status === 'all' || it.status === bookingsFilter.status || pending.has(it.id) || rowErrors.has(it.id))
      && (bookingsFilter.dep === 'all' || it.departureId === bookingsFilter.dep)
      && (!q || norm(it.name).includes(q))).sort(byDeparture);
    if (!list.length) return emptyHTML('No bookings match', 'Try another status, departure or name.');
    const people = list.reduce((s, it) => s + clampPax(it.pax), 0);
    return '<p class="note">' + plural(list.length, 'booking', 'bookings') + ' \u00b7 ' + plural(people, 'person', 'people') + '</p>'
      + '<div>' + list.map((it) => itemRow(it, { showStatus: true })).join('') + '</div>';
  }
  function depOptions() {
    const seen = new Map();
    allDeps().forEach((d) => seen.set(d.id, { id: d.id, label: depLabel(d), start: d.start || '' }));
    allItems().forEach((it) => {
      if (!it.departureId || seen.has(it.departureId)) return;
      seen.set(it.departureId, { id: it.departureId, label: trekName(it.trekId) + ' \u00b7 ' + fshort(it.start) + ' (deleted)', start: it.start || '' });
    });
    return Array.from(seen.values()).sort(byStart);
  }

  /* ======================================================================
     7. DepartureForm sheet (spec 7.4)
     ====================================================================== */
  function tierPrice(trek, cap) {
    let t = null;
    try { t = MBH.tierFor ? MBH.tierFor(trek, cap) : null; } catch (e) { t = null; }
    return num((t || { price: trek.fromPrice }).price);
  }
  function capMax(f) { return Math.max(20, f.loadedCapacity || 0); }

  function initialForm(mode, src) {
    const f = {
      mode, id: null, trekId: '', start: '', days: 0, capacity: 8, manualPax: 0, price: 0,
      priceTouched: false, note: '', status: 'open', loadedUpdatedAt: 0, loadedCapacity: 0, loadedManualPax: 0,
      overwriteAck: false, saving: false, errors: {}
    };
    if (src) {
      f.trekId = src.trekId || '';
      f.days = num(src.days) || num((trekOf(src.trekId) || {}).days);
      f.capacity = Math.max(1, num(src.capacity) || 8);
      f.loadedCapacity = f.capacity;
      f.price = num(src.price);
      f.priceTouched = f.price > 0; // an existing price is deliberate: don't re-tier it
      f.note = typeof src.note === 'string' ? src.note : '';
    }
    if (mode === 'edit' && src) {
      f.id = src.id;
      f.start = src.start || '';
      f.manualPax = manualOf(src);
      f.loadedManualPax = f.manualPax;
      f.status = src.status === 'closed' ? 'closed' : 'open';
      f.loadedUpdatedAt = num(src.updatedAt);
    }
    if (mode === 'duplicate' && src) {
      f.start = addDays(src.start, 7);
      f.manualPax = 0;
    }
    return f;
  }

  // Id for a new departure from the store (preview). Save re-checks the database too.
  function previewId(trekId, start) {
    const base = slug(trekId + '-' + start.replace(/-/g, ''));
    const taken = new Set(allDeps().map((d) => d.id));
    let id = base, n = 2;
    while (taken.has(id)) id = base + '-' + n++;
    return id;
  }
  async function freeDepartureId(db, trekId, start) {
    const base = slug(trekId + '-' + start.replace(/-/g, ''));
    const taken = new Set(allDeps().map((d) => d.id));
    for (let n = 1; n < 100; n++) {
      const id = n === 1 ? base : base + '-' + n;
      if (taken.has(id)) continue;
      let exists = false;
      try { exists = APP.snapExists(await db.doc('departures/' + id).get()); } catch (e) { exists = false; }
      if (!exists) return id;
    }
    throw new Error('No free id');
  }

  // Capacity guard (spec 7.4): capacity >= manualPax + what this desk confirmed. An edit that
  // doesn't shrink the headroom is never blocked, so an already-overbooked departure can still
  // have its price, note, days or status changed.
  function siteConfirmed(f) { return f.mode === 'edit' ? confirmedPaxFor(f.id) : 0; }
  function capacityError(f) {
    const floor = f.manualPax + siteConfirmed(f);
    if (f.capacity >= floor) return '';
    const worse = f.mode !== 'edit' || (f.capacity - f.manualPax) < (f.loadedCapacity - f.loadedManualPax);
    return worse ? "Capacity can't go below the " + floor + ' people already confirmed' : '';
  }
  // Named explanation when confirmed people already exceed this capacity.
  function capNoteText(f) {
    if (f.mode !== 'edit') return '';
    const site = siteConfirmed(f), floor = f.manualPax + site;
    if (f.capacity >= floor) return '';
    const dep = depById(f.id);
    const byKey = new Map((ledgerFor(dep) || []).map((e) => [e.k, e.pax]));
    const names = allItems().filter((it) => it.departureId === f.id && byKey.has(keyOf(it)))
      .map((it) => (it.name || 'No name') + ' \u00d7 ' + byKey.get(keyOf(it)));
    return plural(floor, 'person is', 'people are') + ' confirmed (' + f.manualPax + ' by WhatsApp, ' + site + ' on the site'
      + (names.length ? ': ' + names.slice(0, 3).join(', ') + (names.length > 3 ? ', \u2026' : '') : '')
      + ') \u2014 more than this capacity. Cancel a booking in the party list to free places; other changes still save.';
  }
  function validateForm(f) {
    const e = {};
    if (f.mode !== 'edit' && (!f.trekId || !trekOf(f.trekId))) e.trekId = 'Pick a trek';
    if (!isISO(f.start)) e.start = 'Pick a start date';
    else if (f.mode !== 'edit' && f.start < today()) e.start = "Start can't be in the past";
    if (!(Number.isInteger(f.days) && f.days >= 1)) e.days = 'At least 1 day';
    if (!(f.price > 0)) e.price = 'Set a price per person';
    const ce = capacityError(f);
    if (ce) e.capacity = ce;
    return e;
  }

  function stepperHTML(name, val, label) {
    // Wrapped so the inline-flex stepper keeps its natural width inside the .field grid.
    return '<div><div class="stepper"><button type="button" class="stepper__btn" data-df="step" data-name="' + name
      + '" data-delta="-1" aria-label="Fewer ' + label + '">\u2212</button><output class="stepper__val tnum" data-out="' + name
      + '" aria-live="polite">' + val + '</output><button type="button" class="stepper__btn" data-df="step" data-name="' + name
      + '" data-delta="1" aria-label="More ' + label + '">+</button></div></div>';
  }
  function formHTML(f) {
    const edit = f.mode === 'edit';
    // In edit mode the trek is part of the id and can't change: show only its own tile.
    const treks = (MBH.TREKS || []).filter((t) => !edit || t.id === f.trekId);
    const tiles = treks.map((t) => '<button type="button" class="trekpick__tile' + (t.id === f.trekId ? ' is-on' : '')
      + '" data-df="trek" data-trek="' + esc(t.id) + '" role="radio" aria-checked="' + (t.id === f.trekId) + '"'
      + (edit ? ' disabled' : '') + '>' + esc(t.name) + '<small>' + plural(num(t.days), 'day', 'days') + '</small></button>').join('');
    const err = (k) => '<div class="field__error" role="alert" data-err="' + k + '" hidden></div>';
    return '<form class="form dep-form" novalidate data-df="form">'
      + '<div data-df-slot="banner"></div>'
      + '<div class="field" data-field="trekId"><span class="field__label" id="df-trek-label">Trek</span>'
      + '<div class="trekpick" role="radiogroup" aria-labelledby="df-trek-label">' + tiles + '</div>' + err('trekId') + '</div>'
      + '<div class="field" data-field="start"><label class="field__label" for="df-start">Start date</label>'
      + '<input id="df-start" class="input input--date" type="date" data-name="start" value="' + esc(f.start) + '"'
      + (edit ? ' readonly aria-readonly="true"' : ' min="' + esc(today()) + '" required') + '>'
      + (edit ? '<div class="field__help">Dates are fixed once created \u2014 Duplicate to move a departure</div>' : '')
      + err('start') + '</div>'
      // Top-aligned so the shorter field's input doesn't stretch to the taller one's height.
      + '<div class="field__row">'
      + '<div class="field" data-field="days" style="align-content:start"><label class="field__label" for="df-days">Days</label>'
      + '<input id="df-days" class="input tnum" type="number" inputmode="numeric" min="1" step="1" data-name="days" value="'
      + (f.days || '') + '">' + err('days') + '</div>'
      + '<div class="field" data-field="price" style="align-content:start"><label class="field__label" for="df-price">Price</label>'
      + '<div class="field__wrap"><span class="field__prefix">$</span><input id="df-price" class="input tnum" type="number" inputmode="numeric" min="1" step="1" data-name="price" value="'
      + (f.price || '') + '" required></div><div class="field__help">Per person, fixed for this group</div>' + err('price') + '</div>'
      + '</div>'
      + '<div class="field" data-field="capacity"><span class="field__label">Capacity</span>'
      + stepperHTML('capacity', f.capacity, 'spots') + err('capacity')
      + '<div class="field__help" data-df-slot="capnote" hidden></div></div>'
      + '<div class="field" data-field="manualPax"><span class="field__label">Already booked by WhatsApp</span>'
      + stepperHTML('manualPax', f.manualPax, 'people booked by WhatsApp')
      + '<div class="field__help">People Sandip confirmed outside this site</div></div>'
      + '<div class="field" data-field="note"><label class="field__label" for="df-note">Note <span class="field__hint">optional</span></label>'
      + '<textarea id="df-note" class="input input--textarea" maxlength="500" data-name="note">' + esc(f.note) + '</textarea></div>'
      + '<div class="field" data-field="status"><span class="field__label" id="df-status-label">Status</span>'
      + '<div class="radios" role="radiogroup" aria-labelledby="df-status-label">'
      + '<label class="radio"><input type="radio" name="df-status" value="open" data-name="status"' + (f.status !== 'closed' ? ' checked' : '') + '> Open for requests</label>'
      + '<label class="radio"><input type="radio" name="df-status" value="closed" data-name="status"' + (f.status === 'closed' ? ' checked' : '') + '> Closed \u2014 hidden from the public site</label>'
      + '</div><div class="field__help">Full is set automatically when no spots are left.</div></div>'
      + '<p class="dep-form__preview tnum" data-df-slot="preview" aria-live="polite"></p>'
      + '</form>';
  }
  function previewText(f) {
    const end = isISO(f.start) && f.days >= 1 ? fshort(addDays(f.start, f.days - 1)) : '\u2014';
    const id = f.mode === 'edit' ? f.id : (f.trekId && isISO(f.start) ? previewId(f.trekId, f.start) : '\u2014');
    return 'Ends ' + end + ' \u00b7 id ' + id;
  }

  function openDepartureForm(mode, src) {
    const app = APP;
    if (!app.sheet || typeof app.sheet.open !== 'function') return;
    if (formCleanup) formCleanup();
    const f = initialForm(mode, src);
    const body = document.createElement('div');
    const foot = document.createElement('div');
    body.innerHTML = formHTML(f);
    foot.innerHTML = '<button type="button" class="btn btn--primary btn--block" data-df="save"' + (dbOK() ? '' : ' disabled') + '>'
      + (mode === 'edit' ? 'Save changes' : 'Save departure') + '</button>'
      + (dbOK() ? '' : '<div class="field__help">' + esc(DB_OFF_TEXT) + '</div>');
    const saveBtn = foot.querySelector('[data-df="save"]');
    const q = (sel) => body.querySelector(sel);
    let handle = null;
    let off = null;

    function cleanup() {
      if (off) { try { off(); } catch (e) { /* ignore */ } off = null; }
      if (formCleanup === cleanup) formCleanup = null;
    }
    function close() {
      cleanup();
      try { if (handle && typeof handle.close === 'function') handle.close(); else app.sheet.close(); } catch (e) { /* ignore */ }
    }
    function banner(kind, text, action) {
      const slot = q('[data-df-slot="banner"]');
      if (!slot) return;
      slot.innerHTML = kind ? '<div class="banner banner--' + kind + '" role="alert"><span class="banner__text">' + esc(text) + '</span>'
        + (action ? '<button type="button" class="btn btn--sm btn--ghost banner__action" data-df="reload">' + esc(action) + '</button>' : '')
        + '</div>' : '';
      if (kind && slot.scrollIntoView) slot.scrollIntoView({ block: 'nearest' });
    }
    function showErrors() {
      body.querySelectorAll('[data-err]').forEach((el) => {
        const k = el.getAttribute('data-err');
        const msg = f.errors[k];
        el.textContent = msg || '';
        el.hidden = !msg;
        const field = el.closest('.field');
        if (field) field.classList.toggle('is-invalid', !!msg);
      });
    }
    // Push form state into the DOM without touching the field the user is typing in.
    function sync() {
      body.querySelectorAll('.trekpick__tile').forEach((t) => {
        const on = t.getAttribute('data-trek') === f.trekId;
        t.classList.toggle('is-on', on);
        t.setAttribute('aria-checked', String(on));
      });
      const setVal = (sel, v) => { const el = q(sel); if (el && document.activeElement !== el) el.value = v; };
      setVal('[data-name="days"]', f.days || '');
      setVal('[data-name="price"]', f.price || '');
      const bounds = { capacity: [1, capMax(f)], manualPax: [0, f.capacity] };
      Object.keys(bounds).forEach((name) => {
        const out = q('[data-out="' + name + '"]');
        if (out) out.textContent = String(f[name]);
        body.querySelectorAll('[data-df="step"][data-name="' + name + '"]').forEach((b) => {
          const d = Number(b.getAttribute('data-delta'));
          b.disabled = d < 0 ? f[name] <= bounds[name][0] : f[name] >= bounds[name][1];
        });
      });
      // The capacity guard shows live, not only on Save.
      const ce = capacityError(f);
      if (ce) f.errors.capacity = ce; else delete f.errors.capacity;
      const cn = q('[data-df-slot="capnote"]');
      if (cn) { const t = capNoteText(f); cn.textContent = t; cn.hidden = !t; }
      showErrors();
      const prev = q('[data-df-slot="preview"]');
      if (prev) prev.textContent = previewText(f);
    }
    function setBusy(on) {
      saveBtn.classList.toggle('is-busy', on);
      saveBtn.setAttribute('aria-busy', String(on));
    }

    async function save() {
      if (f.saving) return;
      f.errors = validateForm(f);
      showErrors();
      const first = Object.keys(f.errors)[0];
      if (first) {
        const field = q('[data-field="' + first + '"]');
        const target = field && field.querySelector('input:not([readonly]),button:not([disabled]),textarea');
        if (target) target.focus();
        return;
      }
      const db = app.caps && app.caps.db;
      if (!db || !dbOK()) { banner('danger', DB_OFF_TEXT); return; }
      if (!depsLoaded() || (f.mode === 'edit' && isLegacy(depById(f.id)) && !bookingsLoaded())) {
        banner('warn', bookingsErrored ? RECONNECT_TEXT + ' Try again in a moment.' : 'Still loading departures and bookings \u2014 try again in a moment.');
        return;
      }
      if (f.mode === 'edit') {
        const cur = depById(f.id);
        if (cur && num(cur.updatedAt) > f.loadedUpdatedAt && !f.overwriteAck) {
          f.overwriteAck = true;
          banner('warn', 'Edited ' + (rel(cur.updatedAt) || 'just now') + ' on another device \u2014 Reload, or Save again to overwrite', 'Reload');
          return;
        }
      }
      f.saving = true;
      setBusy(true);
      banner(null);
      const now = Date.now();
      const note = f.note.trim();
      try {
        if (f.mode === 'edit') {
          // spotsLeft from the fresh document's ledger, inside the departure's write queue.
          const path = 'departures/' + f.id;
          await queue(path, async () => {
            const fresh = app.snapData(await db.doc(path).get());
            if (!fresh) throw new Error('missing');
            const legacy = isLegacy(fresh);
            if (legacy && !bookingsLoaded()) throw new Error('Bookings not loaded yet');
            const ledger = legacy ? adoptedEntries(f.id) : ledgerEntries(fresh);
            const computed = Math.min(f.capacity, Math.max(0, f.capacity - f.manualPax - ledgerSum(ledger)));
            const patch = {
              days: f.days, capacity: f.capacity, manualPax: f.manualPax, price: f.price, note,
              status: f.status === 'closed' ? 'closed' : (computed === 0 ? 'full' : 'open'),
              spotsLeft: computed, updatedAt: now
            };
            if (legacy) patch.ledger = ledger;
            await db.doc(path).update(patch);
          });
        } else {
          const id = await freeDepartureId(db, f.trekId, f.start);
          const spotsLeft = Math.max(0, f.capacity - f.manualPax);
          // "full" is never chosen by hand; it follows from the numbers.
          const status = f.status === 'closed' ? 'closed' : (spotsLeft === 0 ? 'full' : 'open');
          await queue('departures/' + id, () => db.doc('departures/' + id).set({
            trekId: f.trekId, start: f.start, days: f.days, capacity: f.capacity, manualPax: f.manualPax,
            spotsLeft, price: f.price, status, note, ledger: [], createdAt: now, updatedAt: now
          }));
        }
        f.saving = false;
        setBusy(false);
        toast('Saved', 'ok');
        close();
      } catch (e) {
        f.saving = false;
        setBusy(false);
        banner('danger', "Couldn't save. Nothing changed.");
      }
    }

    // Another device bumped updatedAt (or deleted the doc) while this form is open.
    function onDeps() {
      if (f.mode === 'edit' && !f.saving) {
        const cur = depById(f.id);
        if (!cur && depsLoaded()) {
          banner('danger', 'This departure was deleted on another device.');
          saveBtn.disabled = true;
        } else if (cur && num(cur.updatedAt) > f.loadedUpdatedAt) {
          banner('warn', 'Edited ' + (rel(cur.updatedAt) || 'just now') + ' on another device', 'Reload');
        }
      }
      const prev = q('[data-df-slot="preview"]');
      if (prev) prev.textContent = previewText(f);
    }

    body.addEventListener('click', (ev) => {
      const el = ev.target.closest && ev.target.closest('[data-df]');
      if (!el || el.disabled) return;
      const kind = el.getAttribute('data-df');
      if (kind === 'trek') {
        const trek = trekOf(el.getAttribute('data-trek'));
        if (!trek || f.mode === 'edit') return;
        f.trekId = trek.id;
        f.days = num(trek.days);
        if (!f.priceTouched) f.price = tierPrice(trek, f.capacity);
        delete f.errors.trekId;
        sync();
      } else if (kind === 'step') {
        const name = el.getAttribute('data-name');
        const d = Number(el.getAttribute('data-delta'));
        if (name === 'capacity') {
          f.capacity = Math.max(1, Math.min(capMax(f), f.capacity + d));
          const trek = trekOf(f.trekId);
          if (trek && !f.priceTouched) f.price = tierPrice(trek, f.capacity);
        } else if (name === 'manualPax') {
          f.manualPax = Math.max(0, Math.min(f.capacity, f.manualPax + d));
        }
        sync();
      } else if (kind === 'reload') {
        const cur = depById(f.id);
        if (!cur) return;
        Object.assign(f, initialForm('edit', cur));
        body.innerHTML = formHTML(f);
        sync();
      }
    });
    body.addEventListener('input', (ev) => {
      const t = ev.target;
      const name = t && t.getAttribute && t.getAttribute('data-name');
      if (!name) return;
      if (name === 'start') f.start = t.value;
      else if (name === 'days') f.days = parseInt(t.value, 10) || 0;
      else if (name === 'price') { f.price = Number(t.value) || 0; f.priceTouched = true; }
      else if (name === 'note') f.note = t.value;
      else if (name === 'status') f.status = t.value === 'closed' ? 'closed' : 'open';
      delete f.errors[name];
      sync();
    });
    body.addEventListener('change', (ev) => {
      const t = ev.target;
      if (t && t.getAttribute && t.getAttribute('data-name') === 'status') f.status = t.value === 'closed' ? 'closed' : 'open';
      if (t && t.getAttribute && t.getAttribute('data-name') === 'start') { f.start = t.value; sync(); }
    });
    body.addEventListener('submit', (ev) => { ev.preventDefault(); save(); });
    saveBtn.addEventListener('click', save);

    const title = mode === 'edit' ? 'Edit departure' : mode === 'duplicate' ? 'Duplicate departure' : 'New departure';
    handle = app.sheet.open({ title, body, foot, full: true, panel: true, onClose: cleanup });
    try { off = app.store.on('departures', onDeps); } catch (e) { off = null; }
    formCleanup = cleanup;
    sync();
    return handle;
  }

  /* ======================================================================
     8. mountAdmin
     ====================================================================== */
  // The first admin token among app.route() (live hash), app.state.route and the raw hash.
  function parseRoute(app) {
    const candidates = [];
    try { if (typeof app.route === 'function') candidates.push((app.route() || {}).token); } catch (e) { /* ignore */ }
    try { candidates.push(((app.state && app.state.route) || {}).token); } catch (e) { /* ignore */ }
    candidates.push(String(location.hash || '').slice(1));
    const token = candidates.find((c) => typeof c === 'string' && /^admin(-[a-z0-9-]+)?$/.test(c)) || 'admin';
    if (token === 'admin-departures') return { screen: 'departures', tab: 'departures' };
    if (token === 'admin-bookings') return { screen: 'bookings', tab: 'bookings' };
    if (token === 'admin-settings') return { screen: 'settings', tab: 'settings' };
    if (token.indexOf('admin-departure-') === 0) return { screen: 'detail', tab: 'departures', id: safeId(token.slice(16)) };
    return { screen: 'inbox', tab: 'inbox' };
  }

  // Fallback only: app.inlineConfirm is the contract; this keeps destructive actions
  // two-tap even if it is missing.
  function localInlineConfirm(btn, o) {
    const wrap = document.createElement('span');
    wrap.className = 'inline-confirm';
    wrap.innerHTML = '<span class="inline-confirm__q">' + esc(o.question) + '</span>'
      + '<button type="button" class="btn btn--sm ' + (o.danger ? 'btn--danger' : 'btn--primary') + ' inline-confirm__yes">' + esc(o.yesLabel || 'Yes') + '</button>'
      + '<button type="button" class="btn btn--ghost btn--sm inline-confirm__no">Keep</button>';
    let timer = null;
    const revert = () => { clearTimeout(timer); if (wrap.parentNode) wrap.replaceWith(btn); };
    timer = setTimeout(revert, 6000);
    wrap.querySelector('.inline-confirm__yes').addEventListener('click', (ev) => { ev.stopPropagation(); revert(); if (o.onYes) o.onYes(); });
    wrap.querySelector('.inline-confirm__no').addEventListener('click', (ev) => { ev.stopPropagation(); revert(); btn.focus(); });
    btn.replaceWith(wrap);
    wrap.querySelector('.inline-confirm__yes').focus();
  }
  function confirmInline(btn, opts) {
    if (APP && typeof APP.inlineConfirm === 'function') return APP.inlineConfirm(btn, opts);
    return localInlineConfirm(btn, opts);
  }

  function wantProfiles(ids) {
    const caps = APP.caps;
    if (!caps || typeof caps.profiles !== 'function') return;
    const need = Array.from(new Set(ids)).filter((id) => id && !profileAsked.has(id));
    if (!need.length) return;
    need.forEach((id) => profileAsked.add(id));
    Promise.resolve(caps.profiles(need)).then((m) => {
      let changed = false;
      need.forEach((id) => {
        const p = m instanceof Map ? m.get(id) : (m && m[id]);
        if (p && p.name) { profileNames.set(id, String(p.name)); changed = true; }
      });
      if (changed) refreshSoon();
    }).catch(() => { /* captions are optional */ });
  }

  MBH.mountAdmin = function mountAdmin(root, app) {
    APP = app;
    recentIds.clear();

    let destroyed = false;
    let dashboard = false;
    let gateSettled = false;
    let mountTimedOut = false;
    let screen = null;
    let refreshTimer = null;
    let deferTimer = null;
    let focusSel = null;
    let tabSaved = null;       // #tabbar's own children/state while admin tabs occupy it
    let tabHTMLCache = '';
    let deskNavHTML = '';
    let tabObserver = null;
    let reasserts = 0;
    const timers = new Set();
    const offs = [];
    const route = parseRoute(app);
    const mq = window.matchMedia ? window.matchMedia('(min-width:1024px)') : null;
    const isDesk = () => !!(mq && mq.matches);

    // The router hands us <section class="view" id="view">; make one if it didn't.
    let view = root;
    if (!root.classList || !root.classList.contains('view')) {
      root.innerHTML = '<section class="view" id="view"></section>';
      view = root.firstElementChild;
    }
    view.classList.add('admin');
    // The sr-only h1 stays put across gate -> dashboard so router focus is never lost.
    view.innerHTML = '<h1 class="view__title sr-only" tabindex="-1">Sandip\'s desk</h1><div data-admin="stage"></div>';
    const stage = view.querySelector('[data-admin="stage"]');
    let band = null;
    let screenEl = null;
    let dbNoteEl = null;

    function later(fn, ms) {
      const t = setTimeout(() => { timers.delete(t); if (!destroyed) fn(); }, ms);
      timers.add(t);
      return t;
    }
    function markTopbar(on) {
      const tb = document.getElementById('topbar');
      if (tb) tb.classList.toggle('topbar--admin', on);
    }
    markTopbar(true);

    /* ---- Gate (spec 7.1) ---- */
    function whoHTML(me, role) {
      const name = me && me.name ? String(me.name) : 'a guest';
      const color = me && /^#[0-9a-f]{3,8}$/i.test(String(me.color || '')) ? String(me.color) : '';
      const initial = me && me.name ? (Array.from(name.trim())[0] || '?').toUpperCase() : '?';
      return '<div class="gate__who"><span class="gate__avatar" aria-hidden="true"' + (color ? ' style="background:' + color + '"' : '')
        + '>' + esc(initial) + '</span><span>Signed in as ' + esc(name) + ' \u00b7 ' + role + '</span></div>';
    }
    function renderGate(state) {
      const me = (app.caps && app.caps.me) || null;
      const back = '<div class="gate__actions"><a class="btn btn--ghost" href="#home">Back to site</a></div>';
      let body = '';
      if (state === 'checking') {
        body = '<div class="skel skel--text" aria-hidden="true"></div><p class="gate__body">Checking your identity\u2026</p>';
      } else if (state === 'unavailable') {
        body = '<p class="gate__body">Identity isn\'t available in this view (for example a preview). Open the published artifact directly on claude.ai.</p>' + back;
      } else if (state === 'denied') {
        body = '<p class="gate__body">This page checks who you are on claude.ai, not a password. Only the owner and editors of this artifact can open the desk \u2014 Sandip can add you as an editor from the share menu.</p>'
          + whoHTML(me, 'viewer') + back;
      } else {
        body = whoHTML(me, 'editor')
          + '<div class="gate__actions"><button type="button" class="btn btn--primary" data-act="open-desk">Open desk</button></div>';
      }
      stage.innerHTML = '<div class="container"><div class="gate gate--' + state + '" aria-live="polite"><div class="gate__card">'
        + '<h2 class="gate__title">Sandip\'s desk.</h2>' + body + '</div></div></div>';
    }
    // app.caps.userReady only exists once caps.init() ran (boot renders the route first).
    function waitUserReady() {
      return new Promise((resolve) => {
        const check = () => {
          if (destroyed) return;
          const c = app.caps || {};
          if (c.userReady && typeof c.userReady.then === 'function') { c.userReady.then(resolve, () => resolve(null)); return; }
          if (c.status && c.status.user === 'null') { resolve(null); return; }
          if (c.status && c.status.user === 'ready') { resolve(c.user || null); return; }
          later(check, 50);
        };
        check();
      });
    }
    function runGate() {
      renderGate('checking');
      later(() => { if (!gateSettled) renderGate('unavailable'); }, 6000);
      waitUserReady().then(async (u) => {
        if (destroyed) return;
        if (!u) { gateSettled = true; renderGate('unavailable'); return; }
        let ok = false;
        try { ok = !!(await app.caps.canEdit()); } catch (e) { ok = false; }
        if (destroyed) return;
        gateSettled = true;
        if (!ok) { renderGate('denied'); return; }
        subscribeBookings(); // only now: the viewer is an editor
        if (gatePassedOnce) { showDashboard(); return; }
        gatePassedOnce = true;
        renderGate('granted');
        later(showDashboard, 600);
      });
    }

    /* ---- Shell (spec 7.2) ---- */
    function pillHTML() {
      const st = statusDb();
      let mod = '', text = 'Connecting\u2026';
      if (st === 'null' || (st === 'ready' && !app.caps.db)) { mod = 'off'; text = 'Offline view'; }
      else if (st !== 'ready') { mod = ''; text = 'Connecting\u2026'; }
      else if (bookingsErrored) { mod = ''; text = 'Reconnecting\u2026'; }
      else if (anyInFlight()) { mod = 'saving'; text = 'Saving\u2026'; }
      else if (readOutbox().length) { mod = 'waiting'; text = readOutbox().length + ' waiting'; }
      else if (bookingsFired && store().departuresSource === 'live') { mod = 'live'; text = 'Live'; }
      const cls = 'pill syncpill' + (mod ? ' syncpill--' + mod : '');
      if (mod === 'waiting') {
        return '<button type="button" class="' + cls + '" data-act="replay" title="Counter updates are waiting \u2014 tap to retry">' + esc(text) + '</button>';
      }
      return '<span class="' + cls + '" role="status">' + esc(text) + '</span>';
    }
    function tabsHTML() {
      const n = allItems().filter((it) => it.status === 'requested').length;
      return [['inbox', '#admin', 'Inbox'], ['departures', '#admin-departures', 'Departures'],
        ['bookings', '#admin-bookings', 'Bookings'], ['settings', '#admin-settings', 'Settings']].map(([k, href, label]) => {
        const on = route.tab === k;
        return '<a class="admin-tabs__tab' + (on ? ' is-active' : '') + '" href="' + href + '"' + (on ? ' aria-current="page"' : '') + '>'
          + label + (k === 'inbox' && n ? '<span class="admin-tabs__badge">' + n + '</span><span class="sr-only"> waiting</span>' : '') + '</a>';
      }).join('');
    }
    // Phone: tabs live in #tabbar (the bottom slot, spec 8). Desktop: a sticky row under the band.
    function takeTabbar(html) {
      const tb = document.getElementById('tabbar');
      if (!tb) return;
      if (!tabSaved) {
        tabSaved = {
          nodes: Array.from(tb.childNodes), hadHidden: tb.classList.contains('is-hidden'),
          hiddenAttr: tb.hidden, label: tb.getAttribute('aria-label')
        };
      }
      tb.classList.add('admin-tabs');
      tb.classList.remove('is-hidden');
      tb.hidden = false;
      tb.setAttribute('aria-label', 'Desk');
      if (tabHTMLCache !== html || !tb.querySelector('.admin-tabs__tab')) { tb.innerHTML = html; tabHTMLCache = html; }
      if (!tabObserver && window.MutationObserver) {
        // If app.js re-renders #tabbar while the desk is open, put the admin tabs back.
        tabObserver = new MutationObserver(() => {
          if (destroyed || !dashboard || isDesk() || tb.querySelector('.admin-tabs__tab') || reasserts > 20) return;
          reasserts++;
          tabHTMLCache = '';
          takeTabbar(tabsHTML());
        });
        tabObserver.observe(tb, { childList: true });
      }
    }
    function restoreTabbar() {
      if (tabObserver) { tabObserver.disconnect(); tabObserver = null; }
      const tb = document.getElementById('tabbar');
      if (!tb || !tabSaved) { tabSaved = null; return; }
      if (tb.querySelector('.admin-tabs__tab')) {
        tb.innerHTML = '';
        tabSaved.nodes.forEach((n) => tb.appendChild(n));
      }
      tb.classList.remove('admin-tabs');
      if (tabSaved.hadHidden) tb.classList.add('is-hidden');
      tb.hidden = tabSaved.hiddenAttr;
      if (tabSaved.label == null) tb.removeAttribute('aria-label'); else tb.setAttribute('aria-label', tabSaved.label);
      tabSaved = null;
      tabHTMLCache = '';
    }
    function placeTabs() {
      if (!dashboard) return;
      const html = tabsHTML();
      let nav = stage.querySelector('nav.admin-tabs');
      if (isDesk()) {
        restoreTabbar();
        if (!nav) {
          nav = document.createElement('nav');
          nav.className = 'admin-tabs';
          nav.setAttribute('aria-label', 'Desk');
          band.insertAdjacentElement('afterend', nav);
          deskNavHTML = '';
        }
        if (deskNavHTML !== html) { nav.innerHTML = html; deskNavHTML = html; }
      } else {
        if (nav) { nav.remove(); deskNavHTML = ''; }
        takeTabbar(html);
      }
    }
    function renderPill() {
      const slot = band && band.querySelector('[data-admin="pill"]');
      if (!slot) return;
      const html = pillHTML();
      if (slot.getAttribute('data-html') !== html) { slot.innerHTML = html; slot.setAttribute('data-html', html); }
    }
    function renderDbNote() {
      if (!dbNoteEl) return;
      const off = statusDb() === 'null' || (statusDb() === 'ready' && !app.caps.db);
      let html = off ? '<div class="banner banner--info" role="status"><span class="banner__text">' + esc(DB_OFF_TEXT)
        + ' \u2014 you can read what loaded, but nothing can be saved.</span></div>' : '';
      if (!off && bookingsErrored && adminSubscribed) {
        html = '<div class="banner banner--warn" role="status"><span class="banner__text">Lost the live bookings list \u2014 '
          + (bookingsFired ? 'showing the last copy. Confirm, cancel and delete are paused until it reconnects.' : 'requests can\u2019t be shown yet.')
          + '</span><button type="button" class="btn btn--sm btn--ghost banner__action" data-act="reconnect">Reconnect</button></div>';
      }
      if (dbNoteEl.getAttribute('data-html') !== html) { dbNoteEl.innerHTML = html; dbNoteEl.setAttribute('data-html', html); }
    }
    function renderChrome() {
      markTopbar(true);
      renderPill();
      placeTabs();
      renderDbNote();
    }

    function showDashboard() {
      if (destroyed || dashboard) return;
      dashboard = true;
      stage.innerHTML = '<div class="admin__band"><div class="container container--wide">'
        + '<h2 class="admin__title">Sandip\'s desk</h2><span data-admin="pill"></span>'
        + '<a href="#home">Back to site</a></div></div>'
        + '<div class="admin__body container container--wide"><div data-admin="dbnote"></div><div data-admin="screen"></div></div>';
      band = stage.querySelector('.admin__band');
      dbNoteEl = stage.querySelector('[data-admin="dbnote"]');
      screenEl = stage.querySelector('[data-admin="screen"]');
      renderChrome();
      screen = makeScreen();
      screen.mount(screenEl);
      afterRender();
      later(() => { mountTimedOut = true; refreshSoon(); }, 4000);
      const h1 = view.querySelector('.view__title');
      const ae = document.activeElement;
      if (h1 && (!ae || ae === document.body)) { try { h1.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    }

    function refreshSoonLocal() {
      if (destroyed || refreshTimer) return;
      refreshTimer = setTimeout(() => { refreshTimer = null; refresh(); }, 0);
    }
    function refresh() {
      if (destroyed || !dashboard) return;
      if (dbOK()) subscribeBookings();
      renderChrome();
      // Don't wipe an app.inlineConfirm the user is looking at; try again shortly.
      if (screenEl.querySelector('.inline-confirm:not([data-own])')) {
        if (!deferTimer) deferTimer = setTimeout(() => { deferTimer = null; refresh(); }, 400);
        return;
      }
      screen.refresh();
      afterRender();
    }
    function afterRender() {
      if (focusSel) {
        const el = screenEl.querySelector(focusSel);
        focusSel = null;
        if (el) { try { el.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
      }
      wantProfiles(Array.from(screenEl.querySelectorAll('.arow[data-viewer]')).map((n) => n.getAttribute('data-viewer')));
    }
    // Re-render a region but keep keyboard focus on the "same" control when it survives.
    function keepFocus(container, fn) {
      const ae = document.activeElement;
      let sel = null;
      if (ae && ae !== document.body && container.contains(ae) && ae.getAttribute('data-act')) {
        sel = '[data-act="' + cssEsc(ae.getAttribute('data-act')) + '"]';
        ['data-id', 'data-dep'].forEach((a) => { if (ae.hasAttribute(a)) sel += '[' + a + '="' + cssEsc(ae.getAttribute(a)) + '"]'; });
      }
      fn();
      if (sel && !focusSel) {
        const el = container.querySelector(sel);
        if (el) { try { el.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
      }
    }

    /* ---- Screens ---- */
    function ctx() { return { timedOut: mountTimedOut }; }
    function simpleScreen(htmlFn) {
      let el = null;
      return {
        mount(target) { el = target; el.innerHTML = htmlFn(ctx()); },
        refresh() { keepFocus(el, () => { el.innerHTML = htmlFn(ctx()); }); }
      };
    }
    function makeScreen() {
      if (route.screen === 'departures') return simpleScreen(departuresHTML);
      if (route.screen === 'detail') return simpleScreen((c) => detailHTML(route.id, c));
      if (route.screen === 'bookings') return bookingsScreen();
      if (route.screen === 'settings') return settingsScreen();
      return simpleScreen(inboxHTML);
    }

    // Bookings: filter controls render once; only the list re-renders (keeps typing focus).
    function bookingsScreen() {
      let el = null, listEl = null, sel = null, optsKey = '';
      const CHIPS = [['requested', 'Requested'], ['confirmed', 'Confirmed'], ['cancelled', 'Cancelled'], ['all', 'All']];
      function syncChips() {
        el.querySelectorAll('.chip[data-group="status"]').forEach((c) => {
          const on = c.getAttribute('data-val') === bookingsFilter.status;
          c.classList.toggle('is-on', on);
          c.setAttribute('aria-pressed', String(on));
        });
      }
      function syncSelect() {
        const opts = depOptions();
        const key = opts.map((o) => o.id + '|' + o.label).join('\n');
        if (key === optsKey) return;
        optsKey = key;
        if (bookingsFilter.dep !== 'all' && !opts.some((o) => o.id === bookingsFilter.dep)) bookingsFilter.dep = 'all';
        sel.innerHTML = '<option value="all">All departures</option>' + opts.map((o) => '<option value="' + esc(o.id) + '"'
          + (o.id === bookingsFilter.dep ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('');
        sel.value = bookingsFilter.dep;
      }
      function renderList() { keepFocus(listEl, () => { listEl.innerHTML = bookingsListHTML(ctx()); }); }
      return {
        mount(target) {
          el = target;
          el.innerHTML = '<section class="admin__section">' + sectionTitle('Bookings')
            + '<div class="chips" role="group" aria-label="Status">' + CHIPS.map(([v, l]) => '<button type="button" class="chip" data-group="status" data-val="'
              + v + '" data-act="filter" aria-pressed="false">' + l + '</button>').join('') + '</div>'
            + '<div class="field__row" style="margin:var(--s-3) 0 var(--s-2)">'
            + '<div class="field"><label class="field__label" for="ab-dep">Departure</label><select id="ab-dep" class="input"></select></div>'
            + '<div class="field"><label class="field__label" for="ab-q">Name</label><input id="ab-q" class="input" type="search" placeholder="Search by name" autocomplete="off" value="'
            + esc(bookingsFilter.q) + '"></div></div>'
            + '<div data-admin="list"></div></section>';
          listEl = el.querySelector('[data-admin="list"]');
          sel = el.querySelector('#ab-dep');
          sel.addEventListener('change', () => { bookingsFilter.dep = sel.value || 'all'; renderList(); afterRender(); });
          el.querySelector('#ab-q').addEventListener('input', (ev) => { bookingsFilter.q = ev.target.value; renderList(); afterRender(); });
          syncChips();
          syncSelect();
          renderList();
        },
        refresh() { syncChips(); syncSelect(); renderList(); },
        onAct(act, btn) {
          if (act !== 'filter') return false;
          bookingsFilter.status = btn.getAttribute('data-val') || 'requested';
          syncChips();
          renderList();
          afterRender();
          return true;
        }
      };
    }

    // Settings (spec 7.8): the form renders once; snapshots refill it only while untouched.
    function settingsScreen() {
      let el = null, form = null, dirty = false, until = null, saving = false;
      const cur = () => store().settings || {};
      const f = (name) => form.querySelector('[data-name="' + name + '"]');
      function runningDeparture() {
        const t = today();
        return allDeps().filter((d) => (d.status === 'open' || d.status === 'full') && isISO(d.start)
          && d.start <= t && t <= endOf(d)).sort(byStart)[0] || null;
      }
      function presetText(d) {
        return "I'm guiding " + trekName(d.trekId) + ' until ' + fshort(endOf(d)) + ', replies may be slow';
      }
      function fill() {
        const s = cur();
        const site = MBH.SITE || {};
        f('whatsapp').value = digits(s.whatsapp || site.whatsapp || '');
        f('email').value = s.email || site.email || '';
        f('heroNote').value = s.heroNote || '';
        until = s.heroNoteUntil || null;
        count();
      }
      function count() {
        const c = form.querySelector('[data-admin="count"]');
        if (c) c.textContent = f('heroNote').value.length + '/140';
      }
      function setErr(name, msg) {
        const e = form.querySelector('[data-err="' + name + '"]');
        if (e) { e.textContent = msg || ''; e.hidden = !msg; }
        const field = form.querySelector('[data-field="' + name + '"]');
        if (field) field.classList.toggle('is-invalid', !!msg);
      }
      function renderMeta() {
        const s = cur();
        const parts = [];
        if (s.heroNote && num(s.heroNoteSetAt)) parts.push('Note set ' + rel(s.heroNoteSetAt));
        if (num(s.updatedAt)) parts.push('Saved ' + rel(s.updatedAt));
        const m = form.querySelector('.settings-form__meta');
        m.textContent = parts.join(' \u00b7 ');
        m.hidden = !parts.length;
      }
      function renderNudge() {
        const s = cur();
        const slot = el.querySelector('[data-admin="nudge"]');
        const show = s.heroNoteUntil && s.heroNote && today() > s.heroNoteUntil;
        const html = show ? '<div class="banner banner--warn" role="status" style="margin-bottom:var(--s-4)"><span class="banner__text">This note has been up past '
          + esc(fshort(s.heroNoteUntil)) + '. Clear it?</span><button type="button" class="btn btn--sm btn--ghost banner__action" data-act="clear-note"'
          + wdis() + '>Clear</button></div>' : '';
        if (slot.getAttribute('data-html') !== html) { slot.innerHTML = html; slot.setAttribute('data-html', html); }
      }
      function renderPreset() {
        const d = runningDeparture();
        const btn = form.querySelector('.settings-form__preset');
        btn.disabled = !d;
        const help = form.querySelector('[data-admin="preset-help"]');
        help.textContent = d ? 'Fills: ' + presetText(d) : 'Available while a departure is under way.';
      }
      function setDisabled() {
        const b = form.querySelector('[data-admin="save"]');
        b.disabled = !dbOK() || saving;
        const h = form.querySelector('[data-admin="save-help"]');
        h.hidden = dbOK();
      }
      async function save() {
        if (saving) return;
        const wa = digits(f('whatsapp').value);
        const email = f('email').value.trim();
        const heroNote = f('heroNote').value.replace(/\s+/g, ' ').trim();
        const errs = {
          whatsapp: wa.length >= 8 && wa.length <= 15 ? '' : 'Digits only, 8 to 15, with the country code',
          email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : 'Enter an email address',
          heroNote: heroNote.length <= 140 ? '' : 'Keep it to 140 characters'
        };
        Object.keys(errs).forEach((k) => setErr(k, errs[k]));
        const bad = Object.keys(errs).find((k) => errs[k]);
        if (bad) { f(bad).focus(); return; }
        const db = app.caps && app.caps.db;
        const slot = form.querySelector('[data-admin="banner"]');
        if (!db || !dbOK()) return;
        const prev = cur();
        const now = Date.now();
        const changed = heroNote !== (prev.heroNote || '');
        const body = {
          whatsapp: wa, email, heroNote,
          heroNoteSetAt: heroNote ? (changed ? now : (prev.heroNoteSetAt || null)) : null,
          heroNoteUntil: heroNote ? (until || null) : null,
          updatedAt: now
        };
        saving = true;
        const b = form.querySelector('[data-admin="save"]');
        b.classList.add('is-busy');
        setDisabled();
        slot.innerHTML = '';
        try {
          // set() works whether or not settings/site exists yet.
          await queue('settings/site', () => db.doc('settings/site').set(body));
          dirty = false;
          toast('Saved', 'ok');
        } catch (e) {
          slot.innerHTML = '<div class="banner banner--danger" role="alert"><span class="banner__text">Couldn\'t save. Nothing changed.</span></div>';
        } finally {
          saving = false;
          b.classList.remove('is-busy');
          setDisabled();
        }
      }
      return {
        mount(target) {
          el = target;
          const err = (k) => '<div class="field__error" role="alert" data-err="' + k + '" hidden></div>';
          el.innerHTML = '<section class="admin__section">' + sectionTitle('Settings') + '<div data-admin="nudge"></div>'
            + '<form class="form settings-form" novalidate>'
            + '<div class="field" data-field="whatsapp"><label class="field__label" for="as-wa">WhatsApp number</label>'
            + '<input id="as-wa" class="input tnum" type="text" inputmode="numeric" autocomplete="off" data-name="whatsapp">'
            + '<div class="field__help">Country code without +, e.g. 9779851353347</div>' + err('whatsapp') + '</div>'
            + '<div class="field" data-field="email"><label class="field__label" for="as-email">Email</label>'
            + '<input id="as-email" class="input" type="email" autocomplete="off" data-name="email">' + err('email') + '</div>'
            + '<div class="field" data-field="heroNote"><label class="field__label" for="as-note">Home page note <span class="field__hint tnum" data-admin="count">0/140</span></label>'
            + '<textarea id="as-note" class="input input--textarea" maxlength="140" data-name="heroNote"></textarea>'
            + '<div class="field__help">One line shown on the home page. Leave empty to hide.</div>' + err('heroNote') + '</div>'
            + '<div class="field"><button type="button" class="btn btn--ghost btn--sm settings-form__preset" data-act="preset">Use \'guiding until\u2026\' preset</button>'
            + '<div class="field__help" data-admin="preset-help"></div></div>'
            + '<p class="settings-form__meta"></p>'
            + '<div data-admin="banner"></div>'
            + '<div class="field"><button type="submit" class="btn btn--primary" data-admin="save" style="justify-self:start">Save settings</button>'
            + '<div class="field__help" data-admin="save-help">' + esc(DB_OFF_TEXT) + '</div></div>'
            + '</form></section>'
            + '<section class="admin__section">' + sectionTitle('Publish check') + '<div class="publish-check"><dl class="kv">'
            + '<dt class="kv__k">Static</dt><dd class="kv__v">Prices, itineraries, photos, FAQ \u2014 static in data.js. Edit in source and ask Claude to republish.</dd>'
            + '<dt class="kv__k">Live</dt><dd class="kv__v">Departures, bookings and these settings \u2014 saved here and shown on the site after each save.</dd>'
            + '<dt class="kv__k">Treks</dt><dd class="kv__v" data-admin="pc-treks"></dd>'
            + '<dt class="kv__k">Departures</dt><dd class="kv__v" data-admin="pc-deps"></dd>'
            + '</dl></div></section>';
          form = el.querySelector('form');
          form.addEventListener('input', (ev) => {
            dirty = true;
            const name = ev.target.getAttribute('data-name');
            if (name) setErr(name, '');
            if (name === 'heroNote') { count(); if (!ev.target.value.trim()) until = null; }
          });
          form.addEventListener('submit', (ev) => { ev.preventDefault(); save(); });
          fill();
          this.refresh();
        },
        refresh() {
          if (!dirty && !saving) fill();
          renderMeta();
          renderNudge();
          renderPreset();
          setDisabled();
          const t = today();
          el.querySelector('[data-admin="pc-treks"]').textContent = (MBH.TREKS || []).length + ' treks in data.js';
          el.querySelector('[data-admin="pc-deps"]').textContent = depsLoaded()
            ? allDeps().filter((d) => (d.start || '') >= t).length + ' upcoming \u00b7 '
              + allDeps().filter((d) => d.status === 'open' && (d.start || '') >= t).length + ' open for requests'
            : 'Loading\u2026';
        },
        onAct(act) {
          if (act === 'preset') {
            const d = runningDeparture();
            if (!d) return true;
            f('heroNote').value = presetText(d);
            until = endOf(d);
            dirty = true;
            setErr('heroNote', '');
            count();
            f('heroNote').focus();
            return true;
          }
          if (act === 'clear-note') {
            f('heroNote').value = '';
            until = null;
            dirty = true;
            count();
            save();
            return true;
          }
          return false;
        }
      };
    }

    /* ---- Departure actions ---- */
    async function depWrite(depId, fn, okMsg) {
      const db = app.caps && app.caps.db;
      if (!db || !dbOK()) return false;
      const path = 'departures/' + depId;
      try {
        await queue(path, () => fn(db.doc(path)));
        toast(okMsg, 'ok');
        return true;
      } catch (e) {
        toast("Couldn't save. Nothing changed.", 'error');
        return false;
      }
    }
    // Recount = syncDeparture plus any ledger change still queued on this device.
    async function doRecount(depId) {
      try {
        const r = await withDepLock(depId, () => syncDeparture(depId, outboxOpsFor(depId)));
        dropOutbox(depId);
        clearNoticesFor(depId);
        toast(r === 'written' ? 'Counter updated' : r === 'missing' ? 'That departure no longer exists' : r === 'ledger' ? 'Confirmed list updated' : 'Counter already matches', 'ok');
      } catch (e) {
        toast(e && e.message === 'Bookings not loaded yet' ? 'Bookings are still loading \u2014 try again in a moment' : "Couldn't recount \u2014 try again", 'error');
      }
      refreshSoonLocal();
    }
    async function manualReplay() {
      const before = readOutbox().length;
      if (!before) return;
      await replayOutbox();
      const after = readOutbox().length;
      toast(after ? after + ' still waiting \u2014 try again later' : 'Counters updated', after ? 'error' : 'ok');
    }

    /* ---- Clicks (one delegated listener for the whole admin view) ---- */
    function onClick(ev) {
      const el = ev.target.closest && ev.target.closest('[data-act]');
      if (!el || !view.contains(el) || el.disabled) return;
      const act = el.getAttribute('data-act');
      if (screen && typeof screen.onAct === 'function' && screen.onAct(act, el, ev)) return;
      const vid = el.getAttribute('data-viewer');
      const iid = el.getAttribute('data-id');
      const did = el.getAttribute('data-dep');
      const item = vid && iid ? findItem(vid, iid) : null;
      const dep = did ? depById(did) : null;
      const track = () => { if (item && route.screen === 'inbox') recentIds.add(item.id); };

      switch (act) {
        case 'open-desk': showDashboard(); break;
        case 'replay': manualReplay(); break;
        case 'reconnect': reconnectBookings(); break;
        case 'copy': app.copy(el.getAttribute('data-copy-text') || '', el); break;
        case 'expand':
          if (iid) { if (expanded.has(iid)) expanded.delete(iid); else expanded.add(iid); focusSel = '[data-act="expand"][data-id="' + cssEsc(iid) + '"]'; refreshSoonLocal(); }
          break;
        case 'confirm': if (item) { track(); doConfirm(item, false); } break;
        case 'ask-yes': if (item) { track(); clearAsk(item.id); doConfirm(item, true); } break;
        case 'ask-no':
          if (iid) { clearAsk(iid); focusSel = '[data-act="confirm"][data-id="' + cssEsc(iid) + '"]'; refreshSoonLocal(); }
          break;
        case 'decline':
          if (item) confirmInline(el, { question: 'Decline this request?', yesLabel: 'Decline', danger: true, onYes: () => { track(); runRowAct('decline', item); } });
          break;
        case 'cancel':
          if (item) confirmInline(el, { question: 'Cancel this confirmed booking?', yesLabel: 'Cancel booking', danger: true, onYes: () => { track(); runRowAct('cancel', item); } });
          break;
        case 'restore': if (item) runRowAct('restore', item); break;
        case 'retry': {
          const r = iid ? rowErrors.get(iid) : null;
          if (item && r && r.retry) { rowErrors.delete(iid); runRowAct(r.retry.act, item, r.retry.ack); }
          break;
        }
        case 'notice-retry':
          if (did) {
            withDepLock(did, () => syncDeparture(did, outboxOpsFor(did)))
              .then(() => { dropOutbox(did); clearNoticesFor(did); toast('Counter updated', 'ok'); refreshSoonLocal(); },
                () => toast("Couldn't update the counter \u2014 try again", 'error'));
          }
          break;
        case 'keep': if (item) { track(); runRowAct('keep', item); } break;
        case 'release':
          if (item && did) {
            const n = ledgerPaxOf(item);
            confirmInline(el, {
              question: 'Release ' + plural(n, 'spot', 'spots') + ' you confirmed?', yesLabel: 'Release', danger: true,
              onYes: () => { track(); doRelease(did, keyOf(item), item.id); }
            });
          }
          break;
        case 'release-key': {
          const k = el.getAttribute('data-key');
          if (did && k && /^k[0-9a-z]+$/.test(k)) {
            confirmInline(el, { question: 'Release these spots?', yesLabel: 'Release', danger: true, onYes: () => doRelease(did, k, null) });
          }
          break;
        }
        case 'recount': if (did) doRecount(did); break;
        case 'new': openDepartureForm('new', null); break;
        case 'edit': if (dep) openDepartureForm('edit', dep); break;
        case 'duplicate': if (dep) openDepartureForm('duplicate', dep); break;
        case 'close':
          if (dep) {
            confirmInline(el, {
              question: 'Close ' + depLabel(dep) + '? It leaves the public site.', yesLabel: 'Close', danger: true,
              onYes: () => depWrite(dep.id, (ref) => ref.update({ status: 'closed', updatedAt: Date.now() }), 'Closed')
            });
          }
          break;
        case 'reopen':
          if (dep) {
            if (isLegacy(dep) && !bookingsLoaded()) { toast('Bookings are still loading \u2014 try again in a moment', 'error'); break; }
            // Counted from the fresh document's ledger, inside the departure's write queue.
            depWrite(dep.id, async (ref) => {
              const fresh = app.snapData(await ref.get());
              if (!fresh) throw new Error('missing');
              const legacy = isLegacy(fresh);
              if (legacy && !bookingsLoaded()) throw new Error('Bookings not loaded yet');
              const ledger = legacy ? adoptedEntries(dep.id) : ledgerEntries(fresh);
              const computed = spotsFrom(fresh, manualOf(fresh) + ledgerSum(ledger));
              const patch = { status: computed === 0 ? 'full' : 'open', spotsLeft: computed, updatedAt: Date.now() };
              if (legacy) patch.ledger = ledger;
              return ref.update(patch);
            }, 'Reopened');
          }
          break;
        case 'delete':
          if (dep && bookingsLoaded() && nonCancelledCount(dep.id) === 0 && !ledgerSum(ledgerFor(dep) || [])) {
            confirmInline(el, {
              question: 'Delete ' + depLabel(dep) + '?', yesLabel: 'Delete', danger: true,
              onYes: () => depWrite(dep.id, (ref) => ref.delete(), 'Deleted').then((ok) => {
                if (ok && route.screen === 'detail' && typeof app.go === 'function') app.go('admin-departures');
              })
            });
          }
          break;
        case 'copy-invite': if (dep) app.copy(inviteText(dep), el); break;
        case 'copy-sheet': if (dep) app.copy(tripSheetText(dep), el); break;
        default: break;
      }
    }
    view.addEventListener('click', onClick);

    // Phone/tablet: the fixed "+ New departure" slides out of the way while the list scrolls
    // down (it would sit on top of row actions) and comes back on scroll up or at the end.
    fabTucked = false;
    let lastY = window.scrollY || 0;
    function onScroll() {
      const y = window.scrollY || 0;
      const dy = y - lastY;
      if (Math.abs(dy) < 6) return;
      lastY = y;
      const atEnd = window.innerHeight + y >= document.documentElement.scrollHeight - 8;
      const tuck = dy > 0 && y > 120 && !atEnd;
      if (tuck === fabTucked) return;
      fabTucked = tuck;
      const fab = view.querySelector('.admin__fab');
      if (fab) fab.classList.toggle('is-tucked', tuck);
    }
    window.addEventListener('scroll', onScroll, { passive: true });

    const onMq = () => { if (dashboard) placeTabs(); };
    if (mq) {
      if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
    }
    ['departures', 'departuresSource', 'departuresTimeout', 'adminBookings', 'settings', 'status'].forEach((k) => {
      try {
        const off = app.store.on(k, refreshSoonLocal);
        if (typeof off === 'function') offs.push(off);
      } catch (e) { /* the router's update(key) still drives refreshes */ }
    });

    const ctl = {
      refreshSoon: refreshSoonLocal,
      focusNext(sel) { focusSel = sel; }
    };
    active = ctl;
    runGate();

    return {
      update() { refreshSoonLocal(); },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        timers.forEach(clearTimeout);
        timers.clear();
        clearTimeout(refreshTimer);
        clearTimeout(deferTimer);
        offs.forEach((off) => { try { off(); } catch (e) { /* ignore */ } });
        view.removeEventListener('click', onClick);
        window.removeEventListener('scroll', onScroll);
        if (mq) {
          if (mq.removeEventListener) mq.removeEventListener('change', onMq); else if (mq.removeListener) mq.removeListener(onMq);
        }
        restoreTabbar();
        markTopbar(false);
        if (formCleanup) formCleanup();
        if (active === ctl) active = null;
      }
    };
  };
})();

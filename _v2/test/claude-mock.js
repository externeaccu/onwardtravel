/*
 * Test-only mock of the artifact runtime's window.claude (contract 0.2.60).
 * NEVER published. Injected by Playwright via addInitScript before the page loads.
 *
 * Configure with window.__MBH_MOCK before the page scripts run:
 *   {
 *     role: 'owner' | 'admin' | 'interact' | 'view' | 'none',   // 'none' => use('user') resolves null and use('db') resolves null
 *     dbAvailable: true,                                          // false => use('db') resolves null even when signed in
 *     id: 'u_test_1', name: 'Patrick',
 *     delayMs: 60,                                                // use() resolves after this delay (never synchronously)
 *     seed: { 'departures/d1': {...}, 'settings/site': {...}, 'bookings/u_x': {items:[...]} },
 *     rules: [ {path:'', read:'view', write:'interact'}, ... ]   // defaults mirror BRIEF.md
 *   }
 * Levels: view < interact < admin < owner.
 */
(function () {
  const cfg = Object.assign({
    role: 'owner', dbAvailable: true, id: 'u_test_1', name: 'Patrick', delayMs: 60, seed: {}, rules: null,
  }, window.__MBH_MOCK || {});

  const LEVEL = { view: 0, interact: 1, admin: 2, owner: 3 };
  const myLevel = cfg.role === 'none' ? -1 : LEVEL[cfg.role];
  const myId = cfg.role === 'none' ? null : cfg.id;

  // Rules as in BRIEF.md unless overridden.
  const RULES = cfg.rules || [
    { path: '', read: 'view', write: 'interact' },
    { path: 'departures', read: 'view', write: 'admin' },
    { path: 'settings', read: 'view', write: 'admin' },
    { path: 'bookings', read: 'admin', write: 'admin' },
    { path: 'bookings/{self}', write: 'interact' },
  ];

  function segs(p) { return p.split('/').filter(Boolean); }
  function validatePath(p, wantDoc) {
    const s = segs(p);
    if (!s.length) throw new TypeError('empty path');
    for (const x of s) {
      if (!/^[A-Za-z0-9_\-.~:@+]{1,200}$/.test(x) || x === '.' || x === '..') throw new TypeError('bad segment: ' + x);
    }
    if (wantDoc && s.length % 2 !== 0) throw new TypeError('document path needs an even number of segments, got ' + s.length);
    if (!wantDoc && s.length % 2 !== 1) throw new TypeError('collection path needs an odd number of segments, got ' + s.length);
    return s;
  }

  // Resolve effective read/write minimum for a path, honouring {self}.
  function effective(path) {
    const s = segs(path);
    let read = 'view', write = 'interact', selfOwned = null;
    // sort rules by specificity (segment count)
    const sorted = RULES.slice().sort((a, b) => segs(a.path).length - segs(b.path).length);
    for (const r of sorted) {
      const rs = segs(r.path);
      let match = true, selfAt = -1;
      for (let i = 0; i < rs.length; i++) {
        if (rs[i] === '{self}') { selfAt = i; if (s[i] === undefined) { match = false; break; } continue; }
        if (s[i] !== rs[i]) { match = false; break; }
      }
      if (!match) continue;
      if (selfAt >= 0) {
        // rule applies only to the viewer's own subtree
        if (myId && s[selfAt] === myId) { if (r.read) read = r.read; if (r.write) write = r.write; selfOwned = true; }
        else { selfOwned = selfOwned === true ? true : false; }
        continue;
      }
      if (r.read) read = r.read; if (r.write) write = r.write;
    }
    // {self} privacy: a sibling's subtree is invisible below the prefix rule's levels
    return { read, write, selfOwned };
  }
  function canRead(path) {
    const e = effective(path);
    if (e.selfOwned === false) return myLevel >= LEVEL[e.read]; // sibling subtree: only prefix level (admin) sees it
    return myLevel >= LEVEL[e.read] || e.selfOwned === true;
  }
  function canWrite(path) {
    const e = effective(path);
    if (e.selfOwned === false) return myLevel >= LEVEL[e.write];
    if (e.selfOwned === true) return myLevel >= LEVEL[e.write];
    return myLevel >= LEVEL[e.write];
  }

  // ---- store ----
  const store = new Map(); // docPath -> object
  for (const [k, v] of Object.entries(cfg.seed || {})) store.set(k, JSON.parse(JSON.stringify(v)));
  const listeners = new Set(); // {kind:'doc'|'query', path, fn, err, query}
  let uid = 1000;
  function mintId() { uid += 1; return 'm' + uid.toString(36) + Math.floor((uid * 7919) % 46656).toString(36); }
  function freeze(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }

  function docSnap(path) {
    const visible = canRead(path) && store.has(path);
    const data = visible ? freeze(store.get(path)) : undefined;
    return { id: segs(path).pop(), exists: !!visible, data: () => data, metadata: { fromCache: false, hasPendingWrites: false } };
  }
  function cmp(a, b) { if (a === b) return 0; if (a === undefined) return 1; if (b === undefined) return -1; return a < b ? -1 : 1; }
  function evalQuery(q) {
    const prefix = q.path + '/';
    const out = [];
    for (const [k, v] of store) {
      if (!k.startsWith(prefix)) continue;
      if (segs(k).length !== segs(q.path).length + 1) continue;
      if (!canRead(k)) continue;
      let ok = true;
      for (const [f, op, val] of q.filters) {
        const x = v[f];
        switch (op) {
          case '==': ok = x === val; break;
          case '!=': ok = x !== val; break;
          case '<': ok = x < val; break;
          case '<=': ok = x <= val; break;
          case '>': ok = x > val; break;
          case '>=': ok = x >= val; break;
          case 'in': ok = Array.isArray(val) && val.includes(x); break;
          case 'not-in': ok = Array.isArray(val) && !val.includes(x); break;
          case 'array-contains': ok = Array.isArray(x) && x.includes(val); break;
          default: ok = false;
        }
        if (!ok) break;
      }
      if (ok) out.push([k, v]);
    }
    if (q.order) out.sort((a, b) => { const c = cmp(a[1][q.order[0]], b[1][q.order[0]]); return q.order[1] === 'desc' ? -c : c; });
    else out.sort((a, b) => cmp(a[0], b[0]));
    const lim = q.lim ? out.slice(0, q.lim) : out;
    const docs = lim.map(([k]) => docSnap(k));
    return { docs, size: docs.length, empty: docs.length === 0, docChanges: () => docs.map((d, i) => ({ type: 'added', doc: d, oldIndex: -1, newIndex: i })), metadata: { fromCache: false, hasPendingWrites: false } };
  }
  function notify() {
    for (const l of Array.from(listeners)) {
      try { l.fn(l.kind === 'doc' ? docSnap(l.path) : evalQuery(l.query)); } catch (e) { console.error('[mock] listener threw', e); }
    }
  }
  function reject(code, message) { const e = new Error(message); e.code = code; return Promise.reject(e); }
  function later(v) { return new Promise(r => setTimeout(() => r(v), 8)); }

  function makeDoc(path) {
    validatePath(path, true);
    return {
      id: segs(path).pop(), path,
      get: () => later(docSnap(path)),
      set: (data) => {
        if (!data || typeof data !== 'object' || Array.isArray(data)) return reject('invalid_argument', 'body must be an object');
        if (!canWrite(path)) return reject('invalid_argument', 'write not permitted at ' + path);
        store.set(path, freeze(data)); notify(); return later(undefined);
      },
      update: (data) => {
        if (!store.has(path)) return reject('invalid_argument', 'update requires an existing document');
        if (!canWrite(path)) return reject('invalid_argument', 'write not permitted at ' + path);
        const cur = store.get(path);
        const merge = (t, s) => { for (const k of Object.keys(s)) { if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) && t[k] && typeof t[k] === 'object' && !Array.isArray(t[k])) merge(t[k], s[k]); else t[k] = freeze(s[k]); } };
        merge(cur, data); store.set(path, cur); notify(); return later(undefined);
      },
      delete: () => { if (!canWrite(path)) return reject('invalid_argument', 'write not permitted at ' + path); store.delete(path); notify(); return later(undefined); },
      acquire: (o) => later({ acquired: true, version: 1, expiresAt: new Date(Date.now() + (o.ttlMs || 30000)).toISOString(), holder: o.holder }),
      onSnapshot: (fn, err) => { const l = { kind: 'doc', path, fn, err }; listeners.add(l); setTimeout(() => { if (listeners.has(l)) fn(docSnap(path)); }, 5); return () => listeners.delete(l); },
      collection: (sub) => makeCollection(path + '/' + sub),
    };
  }
  function makeQuery(q) {
    return {
      where: (f, op, v) => makeQuery({ ...q, filters: q.filters.concat([[f, op, v]]) }),
      orderBy: (f, dir) => makeQuery({ ...q, order: [f, dir || 'asc'] }),
      limit: (n) => makeQuery({ ...q, lim: n }),
      get: () => later(evalQuery(q)),
      onSnapshot: (fn, err) => { const l = { kind: 'query', query: q, fn, err }; listeners.add(l); setTimeout(() => { if (listeners.has(l)) fn(evalQuery(q)); }, 5); return () => listeners.delete(l); },
    };
  }
  function makeCollection(path) {
    validatePath(path, false);
    const q = makeQuery({ path, filters: [], order: null, lim: 0 });
    return Object.assign(q, {
      path,
      doc: (id) => makeDoc(path + '/' + (id || mintId())),
      add: async (data) => { const d = makeDoc(path + '/' + mintId()); await d.set(data); return d; },
    });
  }
  const db = Object.freeze({ doc: makeDoc, collection: makeCollection });

  // ---- user ----
  const profiles = { [cfg.id]: { name: cfg.name, color: '#3e6e68' }, u_alice: { name: 'Alice Verhoeven', color: '#7a4b9c' }, u_bob: { name: 'Bob Tanaka', color: '#b56f1a' } };
  function avatar(name, color) { return 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="${color}"/><text x="20" y="25" font-size="16" text-anchor="middle" fill="#fff" font-family="sans-serif">${(name || '?')[0]}</text></svg>`); }
  const user = Object.freeze({
    isOwner: async () => cfg.role === 'owner',
    canEdit: async () => myLevel >= LEVEL.admin,
    can: async (name) => { if (myLevel < 0) return null; if (name === 'data.write') return myLevel >= LEVEL.interact; if (name === 'files.write' || name === 'assets.write') return myLevel >= LEVEL.admin; return false; },
    me: async () => ({ id: myId, name: myId ? cfg.name : '', avatarUrl: avatar(cfg.name, '#3e6e68'), color: '#3e6e68', email: null, isOwner: cfg.role === 'owner', canEdit: myLevel >= LEVEL.admin }),
    id: async () => myId,
    profiles: async (ids) => { const arr = typeof ids === 'string' ? [ids] : ids; const out = {}; for (const id of arr) { const p = profiles[id]; out[id] = { id, name: p ? p.name : '', avatarUrl: avatar(p ? p.name : '?', p ? p.color : '#888'), color: p ? p.color : '#888888', email: null, isMe: id === myId, guest: false }; } return out; },
    name: async () => myId ? cfg.name : '',
    avatarUrl: async () => myId ? avatar(cfg.name, '#3e6e68') : null,
    search: async () => [],
    email: async () => null,
  });

  const memo = {};
  window.claude = Object.freeze({
    use(name) {
      if (memo[name]) return memo[name];
      memo[name] = new Promise(res => setTimeout(() => {
        if (name === 'db') return res(cfg.role !== 'none' && cfg.dbAvailable ? db : null);
        if (name === 'user') return res(cfg.role !== 'none' ? user : null);
        res(null);
      }, cfg.delayMs));
      return memo[name];
    },
  });
  // test hooks
  window.__MBH_MOCK_STORE = { dump: () => Object.fromEntries(store), set: (k, v) => { store.set(k, freeze(v)); notify(); } };
})();

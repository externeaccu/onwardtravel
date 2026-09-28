// Lifecycle probe: listener leaks across navigation, title focus/scroll on route change,
// copy feedback, price tiers, and (owner) no images on admin + settings create when missing.
//   node test/run.mjs --role owner --width 390 --route '#home' --seed test/seed.json --scenario test/scenarios/critic-lifecycle.mjs
export default async function (page, t) {
  await page.addInitScript(() => {
    const w = { n: 0, byType: {} };
    window.__L = w;
    const add = EventTarget.prototype.addEventListener, rem = EventTarget.prototype.removeEventListener;
    const seen = new WeakMap();
    EventTarget.prototype.addEventListener = function (type, fn, o) {
      if (this === window || this === document) {
        let s = seen.get(this); if (!s) seen.set(this, s = new Map());
        const key = type + '|' + (typeof o === 'object' ? !!(o && o.capture) : !!o);
        let set = s.get(key); if (!set) s.set(key, set = new Set());
        if (!set.has(fn)) { set.add(fn); w.byType[type] = (w.byType[type] || 0) + 1; }
      }
      return add.call(this, type, fn, o);
    };
    EventTarget.prototype.removeEventListener = function (type, fn, o) {
      if (this === window || this === document) {
        const s = seen.get(this); const key = type + '|' + (typeof o === 'object' ? !!(o && o.capture) : !!o);
        const set = s && s.get(key);
        if (set && set.delete(fn)) w.byType[type] -= 1;
      }
      return rem.call(this, type, fn, o);
    };
    // count db subscriptions
    const orig = window.claude;
    const subs = { n: 0 };
    window.__SUBS = subs;
    const wrapQ = (q) => new Proxy(q, { get(tg, p) {
      const v = tg[p];
      if (p === 'onSnapshot') return (a, b) => { subs.n++; const u = v(a, b); return () => { subs.n--; u(); }; };
      if (typeof v === 'function' && ['where', 'orderBy', 'limit', 'collection', 'doc'].includes(p)) return (...x) => wrapQ(v(...x));
      return v;
    } });
    window.claude = { use: (n) => n === 'db' ? orig.use('db').then((db) => db && { doc: (p) => wrapQ(db.doc(p)), collection: (p) => wrapQ(db.collection(p)) }) : orig.use(n) };
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await t.sleep(900);
  const go = async (h, ms = 700) => { await page.evaluate((x) => { location.hash = x; }, h); await t.sleep(ms); };
  const snap = () => page.evaluate(() => ({ l: Object.assign({}, window.__L.byType), s: window.__SUBS.n }));

  const route = ['#trek-langtang', '#agenda', '#departure-mardi-himal-20261016', '#book-mardi-himal-20261016', '#my-trips', '#admin', '#admin-departures', '#admin-bookings', '#admin-settings', '#admin-departure-mardi-himal-20261016', '#home'];
  for (const r of route) await go(r, 900);
  const a = await snap();
  for (const r of route) await go(r, 900);
  for (const r of route) await go(r, 900);
  const b = await snap();
  t.log(JSON.stringify({ a, b }));
  const grew = Object.keys(b.l).filter((k) => (b.l[k] || 0) > (a.l[k] || 0));
  t.expect(!grew.length, 'no window/document listeners accumulate over two more laps (' + grew.map((k) => k + ' ' + a.l[k] + '->' + b.l[k]).join(', ') + ')');
  t.expect(b.s <= a.s, 'db subscriptions do not accumulate (' + a.s + ' -> ' + b.s + ')');

  // route change: scroll top + title focus
  await go('#about');
  await page.evaluate(() => window.scrollTo({ top: 1500, behavior: 'instant' }));
  await t.sleep(200);
  const y0 = await page.evaluate(() => window.scrollY);
  await go('#treks');
  const rc = await page.evaluate(() => ({ y: window.scrollY, f: document.activeElement && (document.activeElement.className || document.activeElement.tagName) }));
  t.expect(y0 > 500 && rc.y === 0 && /view__title/.test(rc.f), 'route change scrolls to top and focuses the title ' + y0 + ' ' + JSON.stringify(rc));

  // price tiers
  const tier = async (id, pax) => {
    await go('#trek-' + id);
    for (let i = 0; i < 12; i++) { const d = await page.$('[data-stepper="pax"] [data-step="-1"]:not([disabled])'); if (!d) break; await d.click(); }
    for (let i = 1; i < pax; i++) { await page.click('[data-stepper="pax"] [data-step="1"]'); }
    return page.$eval('.price-line', (e) => e.textContent);
  };
  const p1 = await tier('poon-hill', 3), p2 = await tier('ebc-gokyo', 5);
  t.log(p1 + ' / ' + p2);
  t.expect(/\$225 per person/.test(p1) && /\$650 per person/.test(p2), 'tiers: Poon Hill x3 $225, EBC x5 $650');

  // copy feedback
  await go('#about');
  const cb = await page.$('.footer [data-copy]');
  await cb.click();
  await t.sleep(200);
  const c1 = await cb.evaluate((e) => e.textContent);
  await t.sleep(1600);
  const c2 = await cb.evaluate((e) => e.textContent);
  t.expect(/Copied/.test(c1) && !/Copied/.test(c2), 'copy shows Copied, then reverts (' + c1 + ' / ' + c2 + ')');

  // admin: no images requested
  const imgs = [];
  page.on('request', (r) => { if (r.resourceType() === 'image' && !/^data:/.test(r.url())) imgs.push(r.url()); });
  await page.goto(page.url().split('#')[0] + '#admin-settings', { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await t.sleep(1500);
  for (const r of ['#admin', '#admin-departures', '#admin-bookings', '#admin-departure-mardi-himal-20261016']) await go(r, 700);
  t.expect(!imgs.length, 'no images load on admin routes (' + imgs.join(', ') + ')');
  return { ok: true };
}

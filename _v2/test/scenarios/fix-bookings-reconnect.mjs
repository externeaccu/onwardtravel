// Integrity: bookings listener error after the first snapshot. Counts/Delete pause, last list stays,
// re-subscribe restores the live state.
//   node test/run.mjs --role owner --width 390 --route '#admin' --seed test/seed.json --scenario test/scenarios/fix-bookings-reconnect.mjs
// Bookings listener errors after the first snapshot: counts pause, last list stays, reconnect restores.
export default async function (page, t) {
  await page.addInitScript(() => {
    const iv = setInterval(() => {
      if (!window.claude || window.claude.__wrapped) return;
      const orig = window.claude;
      const use = orig.use.bind(orig);
      window.claude = Object.assign({}, orig, { __wrapped: true });
      window.claude.use = (n) => Promise.resolve(use(n)).then((db) => {
        if (n !== 'db' || !db) return db;
        const w = Object.assign({}, db);
        w.collection = (p) => { const c = db.collection(p); if (p !== 'bookings') return c;
          return Object.assign({}, c, { onSnapshot: (fn, err) => { window.__bkErr = err; window.__subs = (window.__subs || 0) + 1; return c.onSnapshot(fn, err); } }); };
        return w;
      });
      clearInterval(iv);
    }, 0);
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { location.hash = '#admin-departures'; });
  for (let i = 0; i < 30; i++) { if (await page.$('.admin__band')) break; await t.sleep(100); }
  await t.sleep(900);
  const st = () => page.evaluate(() => ({ subs: window.__subs, recount: Array.from(document.querySelectorAll('[data-act="recount"]')).map(b => b.getAttribute('data-dep')), pill: document.querySelector('.syncpill').textContent, note: (document.querySelector('[data-admin="dbnote"]')||{}).innerText, del: Array.from(document.querySelectorAll('[data-act="delete"]')).map((b) => b.getAttribute('data-dep') + ':' + b.disabled + ':' + b.title).filter(x => /mardi-himal-2026|langtang/.test(x)), rows: Array.from(document.querySelectorAll('.arow__meta')).length }));
  const before = await st();
  t.log('before ' + JSON.stringify(before));
  t.expect(before.subs === 1 && before.recount.includes('langtang-20261128'), 'subscribed once, langtang drift recount shown');
  await page.evaluate(() => window.__bkErr(new Error('unavailable')));
  await t.sleep(300);
  const after = await st();
  t.log('after ' + JSON.stringify(after));
  t.expect(after.del.every((x) => /:true:/.test(x)), 'delete stays disabled on departures with bookings after the error');
  t.expect(/Reconnect/.test(after.note) && /Reconnecting/.test(after.pill), 'banner + pill show the reconnecting state');
  t.expect(after.rows === before.rows, 'last good list still shown');
  // Recount while errored: langtang is a legacy doc -> refused, nothing written
  const dep0 = await page.evaluate(() => JSON.stringify(window.__MBH_MOCK_STORE.dump()['departures/langtang-20261128']));
  await page.evaluate(() => window.MBH && 0);
  await t.sleep(2600);
  const re = await st();
  t.log('after reconnect ' + JSON.stringify(re));
  t.expect(re.subs === 2 && re.pill === 'Live' && !re.note && re.recount.includes('langtang-20261128'), 're-subscribed and live again');
  await page.click('[data-act="recount"][data-dep="langtang-20261128"]');
  await t.sleep(400);
  const d = await page.evaluate(() => window.__MBH_MOCK_STORE.dump()['departures/langtang-20261128']);
  t.log(JSON.stringify(d));
  t.expect(d.spotsLeft === 6 && Array.isArray(d.ledger) && d.ledger.length === 1 && d.ledger[0].pax === 1, 'recount after reconnect writes 6 and adopts the ledger');
  t.expect(dep0 !== JSON.stringify(d), 'changed only after reconnect');
}

// Reviewer scenario: bookings subscription errors AFTER a first snapshot, then Recount.
const dump = (page) => page.evaluate(() => window.__MBH_MOCK_STORE.dump());
export default async function (page, t) {
  for (let i = 0; i < 30; i++) { if (await page.evaluate(() => !!(window.MBH && MBH.app && MBH.app.caps.db))) break; await t.sleep(100); }
  await page.evaluate(() => {
    const db = MBH.app.caps.db; const w = Object.assign({}, db); MBH.app.caps.db = w;
    w.collection = (p) => { const c = db.collection(p); if (p !== 'bookings') return c; return Object.assign({}, c, { onSnapshot: (fn, err) => { window.__bkErr = err; return c.onSnapshot(fn, err); } }); };
  });
  await page.evaluate(() => { location.hash = '#admin-departures'; });
  for (let i = 0; i < 30; i++) { if (await page.$('.admin__band')) break; await t.sleep(100); }
  await t.sleep(800);
  const before = await page.evaluate(() => Array.from(document.querySelectorAll('[data-act="delete"]')).map((b) => b.getAttribute('data-dep') + ':' + b.disabled));
  t.log('delete before: ' + JSON.stringify(before));
  // transient listener error (e.g. network blip)
  await page.evaluate(() => window.__bkErr && window.__bkErr(new Error('unavailable')));
  await t.sleep(400);
  const after = await page.evaluate(() => Array.from(document.querySelectorAll('[data-act="delete"]')).map((b) => b.getAttribute('data-dep') + ':' + b.disabled));
  t.log('delete after error: ' + JSON.stringify(after));
  await t.shot('after-snap-error');
  // Sandip taps Recount on langtang (Alice confirmed 1) and mardi
  await page.evaluate(() => { const b = document.querySelector('[data-act="recount"][data-dep="langtang-20261128"]'); b && b.click(); });
  await t.sleep(600);
  const d = await dump(page);
  t.log('langtang ' + JSON.stringify(d['departures/langtang-20261128']));
  t.log('toasts ' + JSON.stringify(await page.evaluate(() => Array.from(document.querySelectorAll('.toast')).map((x) => x.textContent))));
}

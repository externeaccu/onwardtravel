// Integrity: Confirm races on one device.
//   node test/run.mjs --role owner --width 390 --route '#admin' --seed test/seed.json --scenario test/scenarios/fix-confirm-races.mjs
// 1. A booker withdraws while the admin's Confirm is in flight -> the withdraw wins, "Already cancelled".
// 2. Two Confirms on one departure in quick succession -> the second waits, then sees the real count
//    and asks before overbooking.
const waitDash = async (page, t) => { for (let i = 0; i < 40; i++) { if (await page.$('.admin__band')) return; await t.sleep(100); } };
const dump = (page) => page.evaluate(() => window.__MBH_MOCK_STORE.dump());
const slowDb = (page) => page.evaluate(() => {
  const db = window.MBH.app.caps.db; const orig = db.doc.bind(db); const w = Object.assign({}, db); window.MBH.app.caps.db = w;
  const slow = (f) => (...a) => new Promise((r) => setTimeout(r, 250)).then(() => f(...a));
  w.doc = (p) => { const d = orig(p); return Object.assign({}, d, { get: slow(d.get), update: slow(d.update), set: slow(d.set) }); };
});

export default async function (page, t) {
  // ---- 1. withdraw during Confirm
  await waitDash(page, t);
  await page.evaluate(() => { location.hash = '#admin-bookings'; });
  await t.sleep(600);
  await slowDb(page);
  await page.evaluate(() => document.querySelector('[data-act="confirm"][data-id="b1alice01"]').click());
  await t.sleep(100);
  await page.evaluate(() => { const b = window.__MBH_MOCK_STORE.dump()['bookings/u_alice']; const i = b.items.findIndex((x) => x.id === 'b1alice01'); b.items[i] = Object.assign({}, b.items[i], { status: 'cancelled', updatedAt: Date.now() }); window.__MBH_MOCK_STORE.set('bookings/u_alice', b); });
  await t.sleep(1800);
  let d = await dump(page);
  const alice = d['bookings/u_alice'].items.find((x) => x.id === 'b1alice01');
  const errs = await page.evaluate(() => Array.from(document.querySelectorAll('.arow__error')).map((x) => x.textContent));
  t.log('alice ' + alice.status + ' dep ' + d['departures/mardi-himal-20261016'].spotsLeft + ' errors ' + JSON.stringify(errs));
  t.expect(alice.status === 'cancelled' && !('confirmedPax' in alice), 'the withdraw is never overwritten by Confirm');
  t.expect(d['departures/mardi-himal-20261016'].spotsLeft === 2 && d['departures/mardi-himal-20261016'].status === 'open', 'no spots taken');
  t.expect(errs.some((e) => /Already cancelled/.test(e)), 'row says "Already cancelled"');

  // ---- 2. two Confirms on one departure (Alice 2 + Bob 2, 2 spots left)
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitDash(page, t);
  await page.evaluate(() => { const b = window.__MBH_MOCK_STORE.dump()['bookings/u_bob']; b.items[0].pax = 2; window.__MBH_MOCK_STORE.set('bookings/u_bob', b); });
  await page.evaluate(() => { location.hash = '#admin-bookings'; });
  await t.sleep(600);
  await slowDb(page);
  await page.evaluate(() => document.querySelector('[data-act="confirm"][data-id="b1alice01"]').click());
  await t.sleep(300);
  const mid = await page.evaluate(() => { const b = document.querySelector('[data-act="confirm"][data-id="b1bob0001"]'); return b ? b.disabled : 'missing'; });
  t.expect(mid === true, 'Bob\'s Confirm is disabled while Alice\'s Confirm holds the departure (' + mid + ')');
  await page.evaluate(() => { const b = document.querySelector('[data-act="confirm"][data-id="b1bob0001"]'); if (b) b.click(); });
  await t.sleep(2200);
  await page.evaluate(() => { const b = document.querySelector('[data-act="confirm"][data-id="b1bob0001"]'); if (b) b.click(); });
  await t.sleep(900);
  const ask = await page.evaluate(() => Array.from(document.querySelectorAll('.inline-confirm__q')).map((x) => x.textContent));
  d = await dump(page);
  const items = [...d['bookings/u_alice'].items, ...d['bookings/u_bob'].items].filter((i) => i.departureId === 'mardi-himal-20261016').map((i) => i.id + ':' + i.status);
  t.log('ask ' + JSON.stringify(ask) + ' items ' + JSON.stringify(items));
  t.expect(items.includes('b1alice01:confirmed') && items.includes('b1bob0001:requested'), 'only Alice confirmed');
  t.expect(ask.some((q) => /^Only 0 left, this needs 2\./.test(q)), 'second Confirm asks with the real count ("Only 0 left, this needs 2")');
  const dep = d['departures/mardi-himal-20261016'];
  t.expect(dep.spotsLeft === 0 && dep.status === 'full' && dep.ledger.length === 1, 'departure full, ledger holds Alice only');
  await t.shot('race-ask');
  return { ok: true };
}

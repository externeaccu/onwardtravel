// Reviewer scenario: booker withdraws (requested -> cancelled) while the admin's Confirm is in flight.
const waitDash = async (page, t) => { for (let i = 0; i < 30; i++) { if (await page.$('.admin__band')) return; await t.sleep(100); } };
const dump = (page) => page.evaluate(() => window.__MBH_MOCK_STORE.dump());
export default async function (page, t) {
  await waitDash(page, t);
  await page.evaluate(() => { location.hash = '#admin-bookings'; });
  await t.sleep(600);
  await page.evaluate(() => {
    const db = window.MBH.app.caps.db; const orig = db.doc.bind(db); const w = Object.assign({}, db); window.MBH.app.caps.db = w;
    const slow = (f) => (...a) => new Promise((r) => setTimeout(r, 250)).then(() => f(...a));
    w.doc = (p) => { const d = orig(p); return Object.assign({}, d, { get: slow(d.get), update: slow(d.update), set: slow(d.set) }); };
  });
  await page.evaluate(() => document.querySelector('[data-act="confirm"][data-id="b1alice01"]').click());
  await t.sleep(100);
  // Alice withdraws from her own device (exactly what withdrawBooking writes).
  await page.evaluate(() => { const b = window.__MBH_MOCK_STORE.dump()['bookings/u_alice']; const i = b.items.findIndex((x) => x.id === 'b1alice01'); b.items[i] = Object.assign({}, b.items[i], { status: 'cancelled', updatedAt: Date.now() }); window.__MBH_MOCK_STORE.set('bookings/u_alice', b); });
  await t.sleep(2000);
  await t.shot('withdraw-race');
  const d = await dump(page);
  t.log('alice item: ' + JSON.stringify(d['bookings/u_alice'].items.find((x) => x.id === 'b1alice01')));
  t.log('dep: ' + JSON.stringify(d['departures/mardi-himal-20261016']));
  t.log('row errors: ' + JSON.stringify(await page.evaluate(() => Array.from(document.querySelectorAll('.arow__error')).map((x) => x.textContent))));
}

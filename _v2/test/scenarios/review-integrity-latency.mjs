// Reviewer scenario: realistic 250ms db latency; human-speed second Confirm on the same departure.
const waitDash = async (page, t) => { for (let i = 0; i < 30; i++) { if (await page.$('.admin__band')) return; await t.sleep(100); } };
const dump = (page) => page.evaluate(() => window.__MBH_MOCK_STORE.dump());
export default async function (page, t) {
  await waitDash(page, t);
  await page.evaluate(() => { const b = window.__MBH_MOCK_STORE.dump()['bookings/u_bob']; b.items[0].pax = 2; window.__MBH_MOCK_STORE.set('bookings/u_bob', b); });
  await page.evaluate(() => { location.hash = '#admin-bookings'; });
  await t.sleep(600);
  await page.evaluate(() => {
    const db = window.MBH.app.caps.db; const orig = db.doc.bind(db); const w = Object.assign({}, db); window.MBH.app.caps.db = w;
    window.__log=[]; const T0=Date.now(); const slow = (f, n, p) => (...a) => { window.__log.push([Date.now()-T0, n, p]); return new Promise((r) => setTimeout(r, 250)).then(() => f(...a)); };
    w.doc = (p) => { const d = orig(p); return Object.assign({}, d, { get: slow(d.get,'get',p), update: slow(d.update,'update',p), set: slow(d.set,'set',p) }); };
  });
  await page.click('[data-act="confirm"][data-id="b1alice01"]');
  await t.sleep(300);
  const st = await page.evaluate(() => { const b = document.querySelector('[data-act="confirm"][data-id="b1bob0001"]'); return b ? { disabled: b.disabled } : 'gone'; });
  t.log('bob button 300ms after alice tap: ' + JSON.stringify(st));
  await t.shot('mid');
  if (st && !st.disabled) await page.evaluate(() => document.querySelector('[data-act="confirm"][data-id="b1bob0001"]').click());
  await t.sleep(2500);
  await page.evaluate(() => { location.hash = '#admin-departure-mardi-himal-20261016'; });
  await t.sleep(700);
  t.log('detail head: ' + await page.evaluate(() => (document.querySelector('[data-admin="screen"]')||document.body).innerText.slice(0, 400)));
  await t.shot('race-detail');
  const d = await dump(page);
  const items = [...d['bookings/u_alice'].items, ...d['bookings/u_bob'].items].filter((i) => i.departureId === 'mardi-himal-20261016');
  t.log('items ' + JSON.stringify(items.map((i) => [i.id, i.status, i.confirmedPax])));
  const dep = d['departures/mardi-himal-20261016'];
  t.log('dep spotsLeft=' + dep.spotsLeft + ' status=' + dep.status + ' cap=' + dep.capacity + ' manual=' + dep.manualPax);
  t.log(JSON.stringify(await page.evaluate(() => window.__log)));
  t.log('asks ' + JSON.stringify(await page.evaluate(() => Array.from(document.querySelectorAll('.inline-confirm__q')).map((x) => x.textContent))));
}

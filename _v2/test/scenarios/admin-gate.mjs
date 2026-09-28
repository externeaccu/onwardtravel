// Run with GATE=denied (--role view), GATE=unavailable (--role none), GATE=nodb (--role owner --dbAvailable false),
// GATE=fail (--role owner) or no GATE (--role owner|admin), all with --route '#admin' --seed test/seed.json.
// Gate outcome per role, plus (owner) the syncDeparture failure → outbox → Recount path.
export default async function (page, t) {
  const seen = [];
  for (let i = 0; i < 30; i++) {
    const s = await page.evaluate(() => { const g = document.querySelector('.gate'); return g ? g.className : (document.querySelector('.admin__band') ? 'dashboard' : 'none'); });
    if (seen[seen.length - 1] !== s) seen.push(s);
    if (s === 'dashboard' || /denied|unavailable/.test(s)) break;
    await t.sleep(100);
  }
  t.log('states: ' + seen.join(' -> '));
  const txt = await page.evaluate(() => document.querySelector('#view').innerText);
  t.log(txt.slice(0, 500));
  await t.shot('gate');
  const pw = await page.$$('input[type="password"]');
  t.expect(pw.length === 0, 'no password field');
  const flags = process.env.GATE || '';
  if (flags === 'denied') {
    t.expect(/gate--denied/.test(seen[seen.length - 1]), 'view role denied');
    t.expect(/Signed in as Patrick · viewer/.test(txt), 'denied shows name');
    const subscribed = await page.evaluate(() => window.MBH.app.store.adminBookings);
    t.expect(subscribed === null, 'no bookings subscription for viewer');
  } else if (flags === 'unavailable') {
    t.expect(/gate--unavailable/.test(seen[seen.length - 1]), 'role none -> unavailable');
  } else if (flags === 'nodb') {
    await t.sleep(300);
    const s = await page.evaluate(() => ({ pill: document.querySelector('.syncpill').className + ' ' + document.querySelector('.syncpill').textContent, note: (document.querySelector('[data-admin="dbnote"]') || {}).innerText, disabled: Array.from(document.querySelectorAll('[data-act="confirm"],[data-act="new"]')).map((b) => b.disabled), body: document.querySelector('[data-admin="screen"]').innerText.slice(0, 200) }));
    t.log(JSON.stringify(s));
    t.expect(/syncpill--off/.test(s.pill) && /Database unavailable in this view/.test(s.note), 'db null → off pill + help');
    t.expect(/No requests visible/.test(s.body), 'db null inbox empty state');
  } else if (flags === 'fail') {
    await t.sleep(300);
    // Make departure updates fail (booking writes still succeed).
    await page.evaluate(() => {
      const real = window.MBH.app.caps.db;
      window.__realDb = real;
      window.MBH.app.caps.db = {
        collection: (p) => real.collection(p),
        doc: (p) => { const d = real.doc(p); if (!/^departures\//.test(p)) return d; return Object.assign({}, d, { get: () => d.get(), update: () => Promise.reject(new Error('boom')), set: (x) => d.set(x), delete: () => d.delete(), onSnapshot: (a, b) => d.onSnapshot(a, b) }); }
      };
    });
    await page.locator('.arow', { hasText: 'Alice Verhoeven · 2 people' }).first().locator('[data-act="confirm"]').click();
    await t.sleep(600);
    const s = await page.evaluate(() => ({ outbox: JSON.parse(localStorage.getItem('mbh.outbox') || 'null'), pill: document.querySelector('.syncpill').textContent, notice: (document.querySelector('.arow__notice') || {}).innerText || '' }));
    t.log(JSON.stringify(s));
    t.expect(Array.isArray(s.outbox) && s.outbox.length === 1 && s.outbox[0].departureId === 'mardi-himal-20261016', 'outbox queued');
    t.expect(/1 waiting/.test(s.pill), 'pill shows waiting');
    t.expect(/counter didn't update for Mardi Himal/.test(s.notice), 'row notice shown');
    await t.shot('notice');
    const d1 = await page.evaluate(() => window.__MBH_MOCK_STORE.dump());
    t.expect(d1['bookings/u_alice'].items[0].status === 'confirmed' && d1['departures/mardi-himal-20261016'].spotsLeft === 2, 'booking written, departure not');
    // Heal and Recount from the notice
    await page.evaluate(() => { window.MBH.app.caps.db = window.__realDb; });
    await page.click('.arow__notice [data-act="notice-retry"]');
    await t.sleep(500);
    const s2 = await page.evaluate(() => ({ outbox: JSON.parse(localStorage.getItem('mbh.outbox') || 'null'), pill: document.querySelector('.syncpill').textContent, notice: !!document.querySelector('.arow__notice') }));
    t.log(JSON.stringify(s2));
    const d2 = await page.evaluate(() => window.__MBH_MOCK_STORE.dump());
    t.expect(d2['departures/mardi-himal-20261016'].spotsLeft === 0 && d2['departures/mardi-himal-20261016'].status === 'full', 'recount repaired');
    t.expect(s2.outbox.length === 0 && !s2.notice && s2.pill === 'Live', 'outbox cleared, notice gone, pill live');
    // Booking write failure → "Didn't send — tap to retry"
    await page.evaluate(() => {
      const real = window.__realDb;
      window.MBH.app.caps.db = { collection: (p) => real.collection(p), doc: (p) => { const d = real.doc(p); if (!/^bookings\//.test(p)) return d; return Object.assign({}, d, { get: () => d.get(), update: () => Promise.reject(new Error('net')), onSnapshot: (a, b) => d.onSnapshot(a, b) }); } };
    });
    await page.locator('.arow', { hasText: 'Bob Tanaka' }).first().locator('[data-act="decline"]').click();
    await page.click('.inline-confirm__yes');
    await t.sleep(400);
    const err = await page.evaluate(() => (document.querySelector('.arow__error') || {}).textContent || '');
    t.expect(err === "Didn't send — tap to retry", 'retry error shown');
    await page.evaluate(() => { window.MBH.app.caps.db = window.__realDb; });
    await page.click('.arow__error');
    await t.sleep(400);
    const d3 = await page.evaluate(() => window.__MBH_MOCK_STORE.dump());
    t.expect(d3['bookings/u_bob'].items[0].status === 'cancelled', 'retry succeeded');
  } else {
    t.expect(seen.includes('dashboard'), 'dashboard for editor');
  }
  return { seen };
}

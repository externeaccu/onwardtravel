// Integrity: a Confirm whose departure write fails queues the ledger change with the outbox,
// flags the row as waiting (not as a booker change), and the replay after a reload applies it.
//   node test/run.mjs --role owner --width 390 --route '#admin' --seed test/seed.json --scenario test/scenarios/fix-ledger-outbox.mjs
const waitDash = async (page, t) => { for (let i = 0; i < 40; i++) { if (await page.$('.admin__band')) return; await t.sleep(100); } };
const dump = (page) => page.evaluate(() => window.__MBH_MOCK_STORE.dump());
export default async function (page, t) {
  await waitDash(page, t);
  const now = Date.now();
  await page.evaluate((now) => {
    window.__MBH_MOCK_STORE.set('departures/langtang-20261205', { trekId: 'langtang', start: '2026-12-05', days: 7, capacity: 8, manualPax: 2, spotsLeft: 6, price: 175, status: 'open', note: '', ledger: [], createdAt: now, updatedAt: now });
    window.__MBH_MOCK_STORE.set('bookings/u_cara', { items: [{ id: 'bcara1', departureId: 'langtang-20261205', trekId: 'langtang', start: '2026-12-05', name: 'Cara Diaz', email: 'cara@example.com', whatsapp: '34600111222', pax: 2, note: '', status: 'requested', createdAt: now, updatedAt: now }] });
  }, now);
  await t.sleep(400);
  await page.evaluate(() => {
    const real = window.MBH.app.caps.db;
    window.MBH.app.caps.db = { collection: (p) => real.collection(p), doc: (p) => { const d = real.doc(p); if (!/^departures\//.test(p)) return d; return Object.assign({}, d, { update: () => Promise.reject(new Error('boom')) }); } };
  });
  await page.click('[data-act="confirm"][data-id="bcara1"]');
  await t.sleep(700);
  const s = await page.evaluate(() => ({ outbox: JSON.parse(localStorage.getItem('mbh.outbox') || 'null'), rows: Array.from(document.querySelectorAll('.arow')).filter((r) => /Cara Diaz/.test(r.innerText)).map((r) => r.innerText.replace(/\s+/g, ' ')) }));
  t.log(JSON.stringify(s));
  t.expect(s.outbox && s.outbox.length === 1 && Object.values(s.outbox[0].ops || {})[0] === 2, 'outbox entry carries the ledger op (2 people)');
  t.expect(s.rows.length && s.rows.every((r) => !/Status changed by booker/.test(r)), 'own failed write is not blamed on the booker');
  let d = await dump(page);
  t.expect(d['bookings/u_cara'].items[0].status === 'confirmed' && d['departures/langtang-20261205'].ledger.length === 0, 'booking confirmed, ledger not yet written');
  // Reload (the outbox survives in storage); the replay after the first bookings snapshot applies it.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.evaluate((now) => {
    // the mock store resets on reload: restore the state that existed before it
    window.__MBH_MOCK_STORE.set('departures/langtang-20261205', { trekId: 'langtang', start: '2026-12-05', days: 7, capacity: 8, manualPax: 2, spotsLeft: 6, price: 175, status: 'open', note: '', ledger: [], createdAt: now, updatedAt: now });
    window.__MBH_MOCK_STORE.set('bookings/u_cara', { items: [{ id: 'bcara1', departureId: 'langtang-20261205', trekId: 'langtang', start: '2026-12-05', name: 'Cara Diaz', email: 'cara@example.com', whatsapp: '34600111222', pax: 2, confirmedPax: 2, note: '', status: 'confirmed', createdAt: now, updatedAt: now + 1 }] });
  }, now);
  await waitDash(page, t);
  await t.sleep(1200);
  d = await dump(page);
  const dep = d['departures/langtang-20261205'];
  const ob = await page.evaluate(() => JSON.parse(localStorage.getItem('mbh.outbox') || 'null'));
  t.log(JSON.stringify({ dep: [dep.spotsLeft, dep.status, dep.ledger], ob }));
  t.expect(dep.spotsLeft === 4 && dep.ledger.length === 1 && dep.ledger[0].pax === 2, 'replay wrote the ledger entry and the counter (8 - 2 - 2)');
  t.expect(Array.isArray(ob) && ob.length === 0, 'outbox cleared');
  return { ok: true };
}

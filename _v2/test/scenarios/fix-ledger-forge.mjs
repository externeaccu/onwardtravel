// Security: a booker's own bookings doc can't change capacity maths (desk ledger on departures/{id}).
//   node test/run.mjs --role owner --width 390 --route '#admin' --seed test/seed.json --scenario test/scenarios/fix-ledger-forge.mjs
// Seeds a "Mallory" doc with forged confirmed items (confirmedPax 50 / -40) on legacy departures,
// then checks clamping, Recount, the edit guard, a ledger departure where forged status is not
// counted at all, the "Changed by bookers" flags, and booker flips of a desk-confirmed item.
const waitDash = async (page, t) => { for (let i = 0; i < 40; i++) { if (await page.$('.admin__band')) return; await t.sleep(100); } };
const dump = (page) => page.evaluate(() => window.__MBH_MOCK_STORE.dump());
const setDoc = (page, k, v) => page.evaluate(([k, v]) => window.__MBH_MOCK_STORE.set(k, v), [k, v]);
const go = async (page, t, h) => { await page.evaluate((x) => { location.hash = x; }, h); await t.sleep(300); await waitDash(page, t); await t.sleep(250); };
const forged = (id, dep, trek, start, pax, cpax, extra) => Object.assign({ id, departureId: dep, trekId: trek, start, name: 'Mallory', email: 'm@x.io', whatsapp: '15550001111', pax, status: 'confirmed', confirmedPax: cpax, createdAt: 1790550000000, updatedAt: 1790550000000 }, extra || {});

export default async function (page, t) {
  await waitDash(page, t);
  const now = Date.now();
  // A departure created by the desk (has a ledger) and a legacy one, both with forged items.
  await setDoc(page, 'departures/langtang-20261205', { trekId: 'langtang', start: '2026-12-05', days: 7, capacity: 8, manualPax: 2, spotsLeft: 6, price: 175, status: 'open', note: '', ledger: [], createdAt: now, updatedAt: now });
  await setDoc(page, 'bookings/u_mallory', { items: [
    forged('bforge2', 'poon-hill-20261010', 'poon-hill', '2026-10-10', 1, 50),
    forged('bforge3', 'abc-poon-20261024', 'abc-poon', '2026-10-24', 1, -40),
    forged('bforge4', 'langtang-20261205', 'langtang', '2026-12-05', 12, 12)
  ] });
  await go(page, t, '#admin-departures');
  const rows = await page.evaluate(() => Array.from(document.querySelectorAll('[data-admin="screen"] .arow')).map((r) => r.innerText.replace(/\s+/g, ' ')));
  const row = (re) => rows.find((r) => re.test(r)) || '';
  t.log(row(/Poon Hill · Sat 10 Oct/)); t.log(row(/Annapurna Base Camp/)); t.log(row(/Langtang Valley · Sat 5 Dec/));
  t.expect(/4\/8 booked/.test(row(/Poon Hill · Sat 10 Oct/)), 'legacy: confirmedPax 50 clamped to the party size (3 + 1 of 8)');
  t.expect(/2\/8 booked/.test(row(/Annapurna Base Camp/)), 'legacy: negative confirmedPax counts 0');
  t.expect(/2\/8 booked/.test(row(/Langtang Valley · Sat 5 Dec/)), 'ledger departure: forged "confirmed" not counted');

  // Recount everything that shows Recount; public counters stay within [0, capacity].
  await page.evaluate(() => document.querySelectorAll('[data-act="recount"]').forEach((b) => b.click()));
  await t.sleep(800);
  let d = await dump(page);
  const poon = d['departures/poon-hill-20261010'], abc = d['departures/abc-poon-20261024'], lt = d['departures/langtang-20261205'];
  t.log(JSON.stringify({ poon: [poon.spotsLeft, poon.status], abc: [abc.spotsLeft, abc.status], lt: [lt.spotsLeft, lt.status, lt.ledger] }));
  t.expect(poon.status === 'open' && poon.spotsLeft >= 4 && poon.spotsLeft <= 8, 'Poon Hill never forced Full');
  t.expect(abc.spotsLeft <= abc.capacity, 'ABC spotsLeft never above capacity');
  t.expect(lt.spotsLeft === 6 && lt.status === 'open' && Array.isArray(lt.ledger) && lt.ledger.length === 0, 'ledger departure untouched by the forged item');
  const pub = JSON.stringify(d['departures/langtang-20261205']);
  t.expect(!/u_mallory|bforge/.test(pub) && !/u_alice|b1alice/.test(JSON.stringify(d['departures/langtang-20261128'] || {})), 'public departure docs never name bookers');

  // Edit of Poon Hill (price only) saves; the edit guard is not locked by the forged item.
  await page.click('[data-act="edit"][data-dep="poon-hill-20261010"]');
  await t.sleep(300);
  await page.fill('#df-price', '170');
  await page.click('[data-df="save"]');
  await t.sleep(500);
  d = await dump(page);
  t.expect(d['departures/poon-hill-20261010'].price === 170, 'edit saves (no forged capacity floor)');

  // Inbox: the forged confirmed item on the ledger departure is flagged, not counted.
  await go(page, t, '#admin');
  const changed = await page.evaluate(() => Array.from(document.querySelectorAll('.admin__section')).filter((s) => /Changed by bookers/.test(s.textContent)).map((s) => s.innerText.replace(/\s+/g, ' ')));
  t.log('changed: ' + changed.join(' // '));
  t.expect(changed.length === 1 && /not confirmed from this desk/.test(changed[0]), '"Changed by bookers" flags the unverified confirmed item');
  await t.shot('changed');

  // Desk confirms Bob on the ledger departure, then Bob flips it to cancelled in his own doc.
  await setDoc(page, 'bookings/u_bob', { items: [{ id: 'bbob2', departureId: 'langtang-20261205', trekId: 'langtang', start: '2026-12-05', name: 'Bob Tanaka', email: 'bob@example.com', whatsapp: '819012345678', pax: 3, note: '', status: 'requested', createdAt: now, updatedAt: now }] });
  await t.sleep(300);
  await page.click('[data-act="confirm"][data-id="bbob2"]');
  await t.sleep(900);
  d = await dump(page);
  t.expect(d['departures/langtang-20261205'].spotsLeft === 3 && d['departures/langtang-20261205'].ledger.length === 1, 'desk confirm writes the ledger entry and counter (8 - 2 - 3)');
  const bob = d['bookings/u_bob'];
  bob.items[0] = Object.assign({}, bob.items[0], { status: 'cancelled', updatedAt: Date.now() });
  await setDoc(page, 'bookings/u_bob', bob);
  await t.sleep(400);
  const flip = await page.evaluate(() => Array.from(document.querySelectorAll('.arow')).filter((r) => /Bob Tanaka/.test(r.innerText)).map((r) => r.innerText.replace(/\s+/g, ' ')));
  t.log('flip: ' + flip.join(' // '));
  t.expect(flip.some((r) => /Status changed by booker to cancelled/.test(r) && /Keep confirmed/.test(r) && /Release 3 spots/.test(r)), 'booker regress is flagged with Keep / Release');
  await go(page, t, '#admin-departures');
  const ltRow = await page.evaluate(() => Array.from(document.querySelectorAll('.arow')).map((r) => r.innerText.replace(/\s+/g, ' ')).find((r) => /Langtang Valley · Sat 5 Dec/.test(r)) || '');
  t.expect(/5\/8 booked/.test(ltRow) && !/Counter drift/.test(ltRow), 'spots stay reserved after the booker flip (2 + 3)');
  // Recount does not release them either
  d = await dump(page);
  t.expect(d['departures/langtang-20261205'].spotsLeft === 3, 'counter unchanged by the booker flip');
  // Keep confirmed puts the booker doc back
  await go(page, t, '#admin');
  await page.click('[data-act="keep"][data-id="bbob2"]');
  await t.sleep(600);
  d = await dump(page);
  t.expect(d['bookings/u_bob'].items[0].status === 'confirmed' && d['bookings/u_bob'].items[0].confirmedPax === 3, 'Keep confirmed restores the booker doc');
  // Mallory's forged item: Cancel booking clears the flag, writes no spots change
  await page.click('[data-act="cancel"][data-id="bforge4"]');
  await t.sleep(100);
  await page.click('.inline-confirm__yes');
  await t.sleep(600);
  d = await dump(page);
  t.expect(d['bookings/u_mallory'].items[2].status === 'cancelled' && d['departures/langtang-20261205'].spotsLeft === 3, 'cancelling the forged item changes no spots');
  return { ok: true };
}

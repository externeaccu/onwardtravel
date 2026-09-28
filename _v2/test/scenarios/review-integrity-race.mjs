// Reviewer scenario: two quick Confirms on one departure (single device).
const waitDash = async (page, t) => { for (let i = 0; i < 30; i++) { if (await page.$('.admin__band')) return; await t.sleep(100); } };
const dump = (page) => page.evaluate(() => window.__MBH_MOCK_STORE.dump());
export default async function (page, t) {
  await waitDash(page, t);
  await page.evaluate(() => { const b = window.__MBH_MOCK_STORE.dump()['bookings/u_bob']; b.items[0].pax = Number(window.__BOBPAX || 3); window.__MBH_MOCK_STORE.set('bookings/u_bob', b); });
  await page.evaluate(() => { location.hash = '#admin-bookings'; });
  await t.sleep(600);
  await t.shot('before');
  const r = await page.evaluate(() => {
    const a = document.querySelector('[data-act="confirm"][data-id="b1alice01"]');
    const b = document.querySelector('[data-act="confirm"][data-id="b1bob0001"]');
    const s = [!!a, !!b];
    a.click();
    // second tap 20ms later, as a human double-handed tap would be
    return new Promise((res) => setTimeout(() => { const b2 = document.querySelector('[data-act="confirm"][data-id="b1bob0001"]'); s.push(b2 ? b2.disabled : 'gone'); if (b2 && !b2.disabled) b2.click(); res(s); }, Number(window.__GAP || 0)));
  });
  t.log('buttons ' + JSON.stringify(r));
  await t.sleep(1500);
  await t.shot('after');
  const d = await dump(page);
  const items = [...d['bookings/u_alice'].items, ...d['bookings/u_bob'].items].filter((i) => i.departureId === 'mardi-himal-20261016');
  t.log('items ' + JSON.stringify(items.map((i) => [i.id, i.status, i.confirmedPax])));
  t.log('dep ' + JSON.stringify(d['departures/mardi-himal-20261016']));
  const asks = await page.evaluate(() => Array.from(document.querySelectorAll('.inline-confirm__q')).map((x) => x.textContent));
  t.log('asks ' + JSON.stringify(asks));
}

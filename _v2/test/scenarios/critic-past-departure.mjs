// An old shared link to a departure that already started: never "Request a spot" or live spots.
//   node test/run.mjs --role interact --width 390 --route '#home' --seed test/seed.json --scenario test/scenarios/critic-past-departure.mjs
//   node test/run.mjs --role none     --width 390 --route '#home' --scenario test/scenarios/critic-past-departure.mjs
// interact: a live departure that started 2 days ago (still status open) and one that is a week old.
// none:     nothing is read; the id alone proves the date is past.
export default async function (page, t) {
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const n = new Date();
  const under = iso(new Date(n.getFullYear(), n.getMonth(), n.getDate() - 2));
  const gone = iso(new Date(n.getFullYear(), n.getMonth(), n.getDate() - 9));
  const future = iso(new Date(n.getFullYear(), n.getMonth(), n.getDate() + 20));
  const ids = [under, gone].map((d) => 'poon-hill-' + d.replace(/-/g, ''));
  const futureId = 'mardi-himal-' + future.replace(/-/g, '');
  await page.evaluate(({ ids, under, gone, futureId, future }) => {
    const S = window.__MBH_MOCK_STORE;
    S.set('departures/' + ids[0], { trekId: 'poon-hill', start: under, days: 4, capacity: 8, spotsLeft: 8, price: 165, status: 'open', note: '', createdAt: 1, updatedAt: 1 });
    S.set('departures/' + ids[1], { trekId: 'poon-hill', start: gone, days: 4, capacity: 8, spotsLeft: 3, price: 165, status: 'open', note: '', createdAt: 1, updatedAt: 1 });
    S.set('departures/' + futureId, { trekId: 'mardi-himal', start: future, days: 5, capacity: 8, spotsLeft: 8, price: 175, status: 'open', note: '', createdAt: 1, updatedAt: 1 });
  }, { ids, under, gone, futureId, future });
  const go = async (h, ms) => { await page.evaluate((x) => { location.hash = x; }, h); await t.sleep(ms); };
  const wait = t.role === 'none' ? 4500 : 900;
  let first = true;
  for (const id of ids) {
    await go('#departure-' + id, first ? wait : 700); first = false;
    const s = await page.evaluate(() => document.querySelector('#app').innerText);
    t.expect(/already left/.test(s) && !/spots left/.test(s), id + ': departure page says it already left, no spots');
    t.expect(!(await page.$('#app a[href^="#book-"]')) && !(await page.$('#ctabar:not([hidden]) a[href^="#book-"]')), id + ': no Request a spot link');
    const ask = await page.$eval('#app [data-ask]', (b) => b.getAttribute('data-ask')).catch(() => '');
    t.expect(!/Is there space/.test(ask), id + ': Ask does not ask for space on a past date');
    await go('#book-' + id, 700);
    const sh = await page.evaluate(() => document.getElementById('sheet-root').innerText);
    t.expect(/already left/.test(sh) && !(await page.$('.book__submit:not([hidden])')) && !(await page.$('#bk-form')), id + ': booking sheet has no form');
    await page.keyboard.press('Escape'); await t.sleep(400);
  }
  if (t.role !== 'none') {
    const before = JSON.stringify(await page.evaluate(() => window.__MBH_MOCK_STORE.dump()['bookings/u_test_1'] || null));
    t.expect(before === 'null', 'nothing was saved for a past date');
    await go('#departure-' + futureId, 700);
    t.expect(await page.$('#app a[href="#book-' + futureId + '"]') !== null, 'a future departure is still bookable');
  } else {
    await go('#departure-' + futureId, 700);
    t.expect(/can.t be checked/.test(await page.evaluate(() => document.querySelector('#app').innerText)), 'none: a future id still gets the provisional head');
  }
  return { ok: true };
}

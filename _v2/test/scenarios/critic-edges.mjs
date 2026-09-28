// Edge routes and storage failure.
//   node test/run.mjs --role interact --width 390 --route '#home' --seed test/seed.json --scenario test/scenarios/critic-edges.mjs
// Throwing localStorage/sessionStorage (private mode): theme toggle, agenda, fit, booking draft all work.
// Odd hashes: key=value -> home; unknown trek -> "isn't listed"; book -> Back returns to the departure.
// Keyboard: day rows and map markers reachable and operable.
export default async function (page, t) {
  const go = async (h, ms = 900) => { await page.evaluate((x) => { location.hash = x; }, h); await t.sleep(ms); };
  const text = () => page.evaluate(() => document.querySelector('#app').innerText);

  await go('#treks=all');
  t.expect(await page.evaluate(() => document.title) === 'Magic Beyond Himalaya', 'key=value hash renders home');
  await go('#trek-nope');
  t.expect(/isn.t listed/.test(await text()), 'unknown trek says it is not listed');
  await go('#departure-mardi-himal-20261016');
  await page.click('a[href="#book-mardi-himal-20261016"]');
  await t.sleep(700);
  await page.click('.sheet__close');
  await t.sleep(700);
  t.expect(await page.evaluate(() => location.hash) === '#departure-mardi-himal-20261016', 'Back on the booking sheet returns to the departure');

  // keyboard: day head and map marker
  await go('#trek-mardi-himal');
  const dayFocusable = await page.evaluate(() => { const h = document.querySelector('.day[data-day="3"] .day__head'); return !!h && (h.tagName === 'BUTTON' || h.tabIndex >= 0); });
  t.expect(dayFocusable, 'day head is keyboard focusable');
  await page.focus('.day[data-day="3"] .day__head');
  await page.keyboard.press('Enter');
  await t.sleep(200);
  t.expect(await page.evaluate(() => document.querySelector('.day[data-day="3"]').classList.contains('is-open')), 'Enter opens a day');
  const mk = await page.evaluate(() => { const m = document.querySelector('.rmap__marker'); return m ? { tab: m.getAttribute('tabindex'), role: m.getAttribute('role'), label: m.getAttribute('aria-label') } : null; });
  t.log(JSON.stringify(mk));
  t.expect(mk && mk.tab === '0', 'map markers are in the tab order');
  if (mk) {
    await page.focus('.rmap__marker[aria-label^="Day 2"]').catch(() => {});
    await page.keyboard.press('Enter');
    await t.sleep(300);
    t.expect(await page.evaluate(() => { const d = document.querySelector('.day.is-active'); return d && d.getAttribute('data-day'); }) === '2', 'Enter on a marker selects that day');
  }

  // private mode
  await page.addInitScript(() => {
    for (const k of ['localStorage', 'sessionStorage']) Object.defineProperty(window, k, { get() { throw new Error('SecurityError'); }, configurable: true });
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await t.sleep(900);
  await page.click('.iconbtn--theme');
  t.expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme')) === 'light', 'private mode: theme toggle still works');
  await go('#agenda');
  t.expect((await page.$$('.dep')).length > 5, 'private mode: agenda renders live rows');
  await page.click('.fit__toggle');
  await page.fill('#fit-land', '2026-10-15');
  await t.sleep(150);
  t.expect((await page.$$('.dep--dim')).length > 0, 'private mode: fit my dates works');
  await go('#book-mardi-himal-20261016');
  await page.fill('#bk-name', 'Private Mode');
  await page.fill('#bk-email', 'p@example.com');
  await page.fill('#bk-whatsapp', '447700900123');
  await page.click('.book__submit');
  await t.sleep(700);
  t.expect(/Requested\./.test(await page.evaluate(() => document.getElementById('sheet-root').innerText)), 'private mode: booking saves');
  return { ok: true };
}

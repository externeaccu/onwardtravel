// Acceptance items outside the four main flows.
//   role none:   node test/run.mjs --role none  --width 390 --route '#home' --seed test/seed.json --scenario test/scenarios/integration-extras.mjs
//                (cached departures with db null, routing edge cases, throwing storage)
//   role owner:  node test/run.mjs --role owner --width 390 --route '#home' --seed test/seed.json --scenario test/scenarios/integration-extras.mjs
//                (book sheet back/Escape, theme cycle + persistence, copy, dark-mode shots)
export default async function (page, t) {
  const found = {};
  const waitFor = (sel, ms = 5000) => page.waitForSelector(sel, { timeout: ms, state: 'attached' }).then(() => true, () => false);
  const until = (fn, arg, ms = 5000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
  const text = (sel) => page.$eval(sel, (e) => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
  const go = async (h) => { await page.evaluate((x) => { location.hash = x; }, h); await t.sleep(200); };

  if (t.role === 'none') {
    // ---- cached departures render with a stale note when db is null
    const seedDocs = [
      { id: 'mardi-himal-20261016', trekId: 'mardi-himal', start: '2026-10-16', days: 5, capacity: 8, manualPax: 6, spotsLeft: 2, price: 175, status: 'open', note: '' },
      { id: 'langtang-20261128', trekId: 'langtang', start: '2026-11-28', days: 7, capacity: 8, manualPax: 1, spotsLeft: 7, price: 175, status: 'open', note: '' },
      { id: 'poon-hill-20250101', trekId: 'poon-hill', start: '2025-01-01', days: 4, capacity: 8, manualPax: 0, spotsLeft: 8, price: 165, status: 'open', note: '' },
      { id: 'abc-poon-20261024', trekId: 'abc-poon', start: '2026-10-24', days: 8, capacity: 8, manualPax: 0, spotsLeft: 8, price: 185, status: 'closed', note: '' }
    ];
    await page.evaluate((docs) => localStorage.setItem('mbh.cache.departures', JSON.stringify({ at: Date.now() - 3 * 3600e3, docs })), seedDocs);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await go('#agenda');
    await until(() => document.querySelectorAll('.agenda__list .dep').length > 0, null, 3000);
    const rows = await page.$$eval('.agenda__list .dep', (e) => e.map((x) => x.getAttribute('data-dep')));
    found.cachedRows = rows;
    t.expect(rows.join(',') === 'mardi-himal-20261016,langtang-20261128', 'cached rows render (past and closed never shown)');
    await until(() => /live availability unavailable/.test((document.querySelector('.note--stale') || {}).textContent || ''), null, 3000);
    const stale = await text('.note--stale');
    t.expect(/^Showing dates cached 3 h ago — live availability unavailable$/.test(stale), '.note--stale "Showing dates cached 3 h ago — live availability unavailable" (' + stale + ')');
    await go('#departure-mardi-himal-20261016');
    t.expect((await text('.capdots__text')) === '2 of 8 spots left', 'departure page renders from the cache');
    await go('#book-mardi-himal-20261016');
    await waitFor('.book__submit', 2000);
    t.expect((await text('.book__submit')) === 'Send request on WhatsApp', 'cached departure + no identity -> WhatsApp path');
    await page.evaluate(() => localStorage.removeItem('mbh.cache.departures'));

    // ---- routing edge cases
    await go('#no-such-route');
    t.expect((await text('.view__title')) === 'Every step tells a story.', 'unknown hash renders #home');
    await page.evaluate(() => { location.hash = '#key=value'; });
    await t.sleep(200);
    t.expect((await text('.view__title')) === 'Every step tells a story.', '"#key=value" falls back to #home');
    await go('#trek-atlantis');
    t.expect(/That trek isn.t listed/.test(await text('.view__title')) && await page.$$eval('a[href="#treks"]', (e) => e.length) > 0, 'unknown trek -> "That trek isn\'t listed" + link to #treks');
    await go('#trek-langtang');
    t.expect(await page.evaluate(() => document.title) === 'Langtang Valley · Magic Beyond Himalaya', 'document.title follows the route');
    t.expect(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('view__title')), '.view__title focused after route change');
    t.expect(await page.$$eval('.day', (e) => e.length) === 7 && await page.$$eval('.rmap__marker', (e) => e.length) > 3, 'Langtang page has 7 day rows and a map');
    await go('#trek-mardi-himal');
    const leaks = await page.$$eval('.rmap', (e) => e.length);
    t.expect(leaks === 1, 'exactly one RouteMap alive after navigating between treks');

    // ---- throwing localStorage/sessionStorage (private mode)
    await page.addInitScript(() => {
      const boom = { get() { throw new Error('SecurityError: storage disabled'); } };
      Object.defineProperty(window, 'localStorage', boom);
      Object.defineProperty(window, 'sessionStorage', boom);
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await t.sleep(500);
    t.expect((await text('.phero__title')) === 'Mardi Himal', 'trek page renders with storage disabled');
    await page.click('.iconbtn--theme');
    t.expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme')) === 'light', 'theme toggle still works without storage');
    await go('#book-mardi-himal-20261016');
    await waitFor('#bk-name', 2000);
    await page.fill('#bk-name', 'No Storage');
    t.expect((await text('.book__submit')) === 'Send request on WhatsApp', 'booking form works without storage');
    await go('#agenda');
    t.expect(await until(() => /Dates are set by Sandip/.test(document.body.textContent), null, 5000), 'agenda settles to the empty state without storage');
    return found;
  }

  // ---- signed-in: book sheet Back returns to the departure; Escape closes too
  await go('#departure-mardi-himal-20261016');
  await waitFor('.depage__actions a.btn--primary', 5000);
  await page.click('.depage__actions a.btn--primary');
  await waitFor('.sheet.is-in', 3000);
  t.expect(await page.evaluate(() => document.getElementById('app').getAttribute('aria-hidden')) === 'true', 'sheet marks #app aria-hidden');
  t.expect(await page.evaluate(() => !!document.activeElement.closest('.sheet')), 'focus moves into the sheet');
  await page.click('.sheet__close');
  t.expect(await until(() => location.hash === '#departure-mardi-himal-20261016', null, 3000), 'sheet Back returns to #departure-{id}');
  t.expect(await until(() => document.getElementById('sheet-root').hidden, null, 2000), 'sheet root hidden after close');
  await page.click('.depage__actions a.btn--primary');
  await waitFor('.sheet.is-in', 3000);
  await page.keyboard.press('Escape');
  t.expect(await until(() => location.hash === '#departure-mardi-himal-20261016', null, 3000), 'Escape closes the booking sheet');

  // ---- Ask sheet from the topbar WhatsApp button
  await page.click('.iconbtn--wa');
  await waitFor('.ask__text', 2000);
  const ask = await page.$eval('.ask__text', (e) => e.value);
  t.expect(/Mardi Himal departure starting 16 October 2026 \(ref mardi-himal-20261016\)/.test(ask), 'topbar Ask is prefilled for the current departure');
  await page.keyboard.press('Escape');
  await t.sleep(300);

  // ---- copy buttons: "Copied" for 1.5s (clipboard or fallback)
  await go('#about');
  await page.click('.contact .copyfield__btn');
  // navigator.clipboard may hang in headless Chrome; app.copy falls back to execCommand after 1.5s.
  t.expect(await until(() => (document.querySelector('.contact .copyfield__btn') || {}).textContent === 'Copied', null, 2500), 'Copy shows "Copied"');
  await t.sleep(1700);
  t.expect((await text('.contact .copyfield__btn')).startsWith('Copy') && !(await text('.contact .copyfield__btn')).startsWith('Copied'), 'label returns after 1.5s');
  t.expect(await page.$$eval('a[href^="mailto:"], a[href^="tel:"]', (e) => e.length) === 0, 'no mailto:/tel: links');
  t.expect(await page.$$eval('a[href*="wa.me"]', (e) => e.every((a) => a.target === '_blank' && /noopener/.test(a.rel))), 'every WhatsApp link is target=_blank rel=noopener');

  // ---- theme: system -> light -> dark, persisted and applied before paint
  const cycle = [];
  for (let i = 0; i < 3; i++) {
    await page.click('.iconbtn--theme');
    cycle.push(await page.evaluate(() => document.documentElement.getAttribute('data-theme') || 'system'));
  }
  found.themeCycle = cycle;
  t.expect(cycle.join(',') === 'light,dark,system', 'theme cycles system -> light -> dark -> system');
  await page.click('.iconbtn--theme'); await page.click('.iconbtn--theme');     // -> dark
  await page.reload({ waitUntil: 'domcontentloaded' });
  t.expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme')) === 'dark', 'dark theme persists across reload');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  t.expect(bg === 'rgb(20, 48, 45)', 'dark body background is --bg #14302d (' + bg + ')');

  // ---- dark-mode shots of the main surfaces
  for (const h of ['#home', '#trek-ebc-gokyo', '#agenda', '#departure-mardi-himal-20261016', '#admin', '#admin-departures']) {
    await go(h);
    await t.sleep(h.startsWith('#admin') ? 1200 : 500);
    if (h.startsWith('#trek')) { await page.$eval('.rmap', (e) => e.scrollIntoView({ block: 'center' })); await t.sleep(1200); }
    await t.shot('dark-' + h.slice(1));
  }
  await page.evaluate(() => { localStorage.removeItem('mbh.theme'); });
  return found;
}

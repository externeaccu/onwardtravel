// End-to-end public booking with a signed-in contributor (role interact) and live data.
//   node test/run.mjs --role interact --width 390 --route '#agenda' --seed test/seed.json --scenario test/scenarios/booking.mjs
// Agenda -> departure page -> booking sheet -> saved request -> My trips -> withdraw.
const DEP = 'mardi-himal-20261016';

export default async function (page, t) {
  const found = {};
  const waitFor = (sel, ms = 5000) => page.waitForSelector(sel, { timeout: ms, state: 'visible' }).then(() => true, () => false);
  const text = (sel) => page.$eval(sel, (e) => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
  const dump = () => page.evaluate(() => window.__MBH_MOCK_STORE.dump());
  const myItems = async () => ((await dump())['bookings/u_test_1'] || {}).items || [];

  // ---- #agenda: month headers + rows from live data
  await page.evaluate(() => { location.hash = '#agenda'; });
  t.expect(await waitFor('.agenda__list .dep', 5000), 'agenda renders departure rows');
  const months = await page.$$eval('.agenda__month', (els) => els.map((e) => e.id + ':' + e.textContent.trim()));
  found.months = months;
  t.expect(months.length >= 3 && months[0] === 'm-2026-10:October 2026', 'agenda has month headers starting with October 2026');
  const rows = await page.$$eval('.agenda__list .dep', (els) => els.map((e) => e.getAttribute('data-dep')));
  t.expect(rows.includes(DEP) && rows.length === 10, 'all 10 open/full seed departures listed (' + rows.length + ')');
  t.expect(await page.$$eval('.mstrip__chip .mstrip__dot', (e) => e.length) >= 3, 'month strip shows dots for months with departures');
  t.expect(await page.$eval('.dep[data-dep="annapurna-tilicho-20261101"]', (e) => e.classList.contains('dep--full') && /Full/.test(e.textContent)).catch(() => false), 'full departure row is greyed with "Full"');
  await t.shot('agenda');

  // ---- tap the row -> departure page
  await page.click('.dep[data-dep="' + DEP + '"]');
  await page.waitForFunction((id) => location.hash === '#departure-' + id, DEP, { timeout: 3000 }).catch(() => {});
  t.expect(await waitFor('.depage__head', 3000), 'departure page renders');
  const cap = await text('.capdots__text');
  t.expect(cap === '2 of 8 spots left', 'capacity reads "2 of 8 spots left" (got "' + cap + '")');
  t.expect(await page.$$eval('.capdots__dot--taken', (e) => e.length) === 6, '6 of 8 capacity dots taken');
  const price = await text('.depage__price');
  t.expect(price.includes('$175') && price.includes('fixed for this group departure'), 'price "$175 … fixed for this group departure"');
  t.expect(await page.$$eval('.datestrip__row', (e) => e.length) === 5, 'DateStrip lists all 5 days');
  t.expect((await text('.datestrip__row:nth-child(4) .datestrip__date')) === 'Mon 19 Oct', 'day 4 carries its real date (Mon 19 Oct)');
  t.expect(await page.$$eval('.rmap--static .rmap__label', (els) => els.some((e) => /^D\d.* · \d+ Oct$/.test(e.textContent))), 'static map labels carry dates ("D4 · 19 Oct" style)');
  await t.shot('departure');

  // ---- Request a spot -> booking sheet
  await page.click('.depage__actions a.btn--primary');
  await page.waitForFunction((id) => location.hash === '#book-' + id, DEP, { timeout: 3000 }).catch(() => {});
  t.expect(await waitFor('.sheet.is-in .book', 3000), 'booking sheet opens over the departure');
  await page.waitForFunction(() => { const b = document.querySelector('.book__submit'); return b && b.textContent === 'Request a spot'; }, null, { timeout: 3000 }).catch(() => {});
  t.expect((await text('.book__submit')) === 'Request a spot', 'submit reads "Request a spot" for a signed-in contributor');
  t.expect((await text('.book__summary')).includes('2 left'), 'sheet summary shows the SpotsPill "2 left"');
  await page.fill('#bk-name', 'Patrick Moran');
  await page.fill('#bk-email', 'patrick@example.com');
  await page.fill('#bk-whatsapp', '353 87 123 4567');
  await page.click('[data-stepper="bkpax"] [data-step="1"]');
  t.expect((await text('.stepper__val')) === '2', 'pax stepper at 2');
  t.expect((await text('[data-price]')) === '$175 per person · $350 for 2', 'live price line "$175 per person · $350 for 2"');
  t.expect(!(await page.$eval('[data-warn]', (e) => !e.hidden)), 'no overbook warning for pax 2 with 2 left');
  await page.click('[data-stepper="bkpax"] [data-step="1"]');
  t.expect(await page.$eval('[data-warn]', (e) => !e.hidden && /Only 2 spots left/.test(e.textContent)), 'pax 3 shows the amber "Only 2 spots left" note (never blocks)');
  await page.click('[data-stepper="bkpax"] [data-step="-1"]');
  await page.click('.book__submit');

  // ---- ConfirmationCard with ref
  t.expect(await waitFor('.confirm-card', 5000), 'ConfirmationCard replaces the form');
  const title = await text('.confirm-card__title');
  const ref = (await text('.confirm-card__ref')).replace(/^Ref\s+/, '');
  found.ref = ref;
  t.expect(title === 'Requested.' && /^B[A-Z0-9]{6,}$/.test(ref), 'card reads "Requested." with ref ' + ref);
  t.expect(await page.$$eval('.confirm-card--fallback', (e) => e.length) === 0, 'no fallback card (write succeeded)');
  const mirror = await page.$eval('.confirm-card__actions a[href*="wa.me"]', (a) => decodeURIComponent(a.href.split('?text=')[1] || '')).catch(() => '');
  t.expect(mirror.includes('Booking ref: ' + ref) && mirror.includes('Group: 2'), 'WhatsApp mirror carries the request + booking ref');
  await t.shot('confirmed');

  // ---- the store holds exactly one requested item for this viewer
  let items = await myItems();
  found.stored = items;
  t.expect(items.length === 1, 'bookings/u_test_1 has one item');
  const it = items[0] || {};
  t.expect(it.status === 'requested' && it.departureId === DEP && it.trekId === 'mardi-himal' && it.pax === 2 && it.start === '2026-10-16',
    'item: requested, mardi-himal-20261016, pax 2, start 2026-10-16');
  t.expect(it.name === 'Patrick Moran' && it.email === 'patrick@example.com' && it.whatsapp === '353871234567', 'item keeps name, email and WhatsApp digits');
  t.expect(String(it.id).toUpperCase() === ref, 'stored id matches the ref on the card');
  const dep = (await dump())['departures/' + DEP];
  t.expect(dep.spotsLeft === 2 && dep.status === 'open', 'a public request never changes capacity');
  t.expect(await page.evaluate((id) => sessionStorage.getItem('mbh.draft.' + id), DEP) === null, 'draft removed after a saved request');

  // ---- See my trips
  await page.click('.confirm-card__actions a[href="#my-trips"]');
  t.expect(await waitFor('.trip', 5000), '#my-trips lists the request');
  const trip = await text('.trip');
  t.expect(trip.includes('Mardi Himal') && trip.includes('Requested') && trip.includes('Fri 16 Oct') && trip.includes('2 people') && trip.includes('Ref ' + ref),
    'trip row: Mardi Himal · Requested · Fri 16 Oct · 2 people · Ref');
  await t.shot('my-trips');

  // ---- Withdraw via InlineConfirm
  await page.click('[data-withdraw]');
  t.expect(await waitFor('.trip .inline-confirm', 2000), 'Withdraw turns into an inline confirm (no confirm())');
  t.expect((await text('.inline-confirm__q')) === 'Withdraw this request?', 'inline question "Withdraw this request?"');
  await page.click('.trip .inline-confirm__yes');
  const cancelled = await page.waitForFunction(() => /Cancelled/.test((document.querySelector('.trip .pill') || {}).textContent || ''), null, { timeout: 5000 }).then(() => true, () => false);
  t.expect(cancelled, 'trip pill flips to Cancelled');
  items = await myItems();
  t.expect(items.length === 1 && items[0].status === 'cancelled' && items[0].updatedAt >= items[0].createdAt, 'stored item status is cancelled');
  t.expect(await page.$$eval('.trip [data-withdraw]', (e) => e.length) === 0, 'cancelled item has no actions');
  await t.shot('withdrawn');

  // ---- booking again for the same date says so
  await page.evaluate((id) => { location.hash = '#book-' + id; }, DEP);
  await waitFor('.book', 3000);
  t.expect(!(await text('[data-banner]')).includes('already sent'), 'a cancelled request does not count as "already sent"');
  return found;
}

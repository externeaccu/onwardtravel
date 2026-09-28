// Public site with no capabilities: window.claude.use('db'|'user') both resolve null.
//   node test/run.mjs --role none --width 390 --route '#home' --scenario test/scenarios/public-null.mjs
// Checks: home empty state + wa.me link, WhatsApp-only booking form (usable, serialised
// request, draft survives reload), My trips signed-out copy, admin gate "unavailable".
export default async function (page, t) {
  const found = {};
  const waitFor = (sel, ms = 5000) => page.waitForSelector(sel, { timeout: ms, state: 'attached' }).then(() => true, () => false);
  const go = async (hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await t.sleep(150); };
  const text = (sel) => page.$eval(sel, (e) => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');

  // ---- #home: skeleton gives way to the honest empty state within 5s
  await go('#home');
  const t0 = Date.now();
  const emptyShown = await page.waitForFunction(() => {
    const r = document.querySelector('[data-live="departures"]');
    return r && /Dates are set by Sandip and posted here/.test(r.textContent);
  }, null, { timeout: 5000 }).then(() => true, () => false);
  found.homeEmptyMs = Date.now() - t0;
  t.expect(emptyShown, '#home shows "Dates are set by Sandip…" empty state within 5s (' + found.homeEmptyMs + 'ms)');
  const wa = await page.$eval('[data-live="departures"] .empty a[href*="wa.me"]', (a) => ({ href: a.href, target: a.target, rel: a.rel })).catch(() => null);
  t.expect(!!wa && wa.href.startsWith('https://wa.me/9779851353347?text='), '#home empty state has a wa.me/9779851353347?text= link');
  t.expect(!!wa && wa.target === '_blank' && /noopener/.test(wa.rel), 'WhatsApp link opens a new tab with rel=noopener');
  await t.sleep(4300);
  t.expect(await page.$$eval('#app .skel', (e) => e.length) === 0, 'no skeleton persists on #home after 4s');
  t.expect(await page.$$eval('[data-live="departures"] .dep', (e) => e.length) === 0, 'no sample/placeholder departure rows on #home');
  t.expect((await text('.hero__note')).includes('Eight treks. One guide.'), 'hero shows the fallback note (no settings)');
  await t.shot('home');

  // ---- #book-{id}: WhatsApp-only form, usable without any capability
  await go('#book-mardi-himal-20261016');
  t.expect(await waitFor('.sheet .book', 2000), '#book opens the booking sheet with the form');
  const label = await text('.book__submit');
  t.expect(label === 'Send request on WhatsApp', 'submit button reads "Send request on WhatsApp" (got "' + label + '")');
  const disabled = await page.$$eval('.sheet input, .sheet textarea, .sheet button, .sheet select', (els) => els.filter((e) => e.disabled && !e.closest('.stepper')).map((e) => e.id || e.className));
  t.expect(disabled.length === 0, 'no form field or button is disabled (' + disabled.join(',') + ')');
  t.expect((await text('.sheet__title')) === 'Request a spot', 'sheet title "Request a spot"');
  t.expect((await text('.book__summary')).includes('Mardi Himal'), 'summary names the trek recovered from the id');

  // Draft survives a reload.
  await page.fill('#bk-name', 'Priya Shah');
  await page.fill('#bk-email', 'priya@example.com');
  await page.fill('#bk-whatsapp', '44 7700 900123');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitFor('#bk-name', 3000);
  await t.sleep(300);
  t.expect(await page.$eval('#bk-name', (e) => e.value).catch(() => '') === 'Priya Shah', 'draft name restored after reload');
  t.expect(await page.$eval('#bk-whatsapp', (e) => e.value).catch(() => '') === '44 7700 900123', 'draft WhatsApp restored after reload');

  // Inline validation: an empty name blocks and focuses the field, no alert.
  await page.fill('#bk-name', '');
  await page.click('.book__submit');
  await t.sleep(100);
  t.expect(await page.$eval('[data-field="name"]', (e) => e.classList.contains('is-invalid')).catch(() => false), 'empty name shows an inline error');
  t.expect(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'bk-name', 'first invalid field is focused');

  // Submit: window.open is stubbed so nothing leaves the sandbox.
  await page.evaluate(() => { window.__opened = []; window.open = (u, n, f) => { window.__opened.push([u, n, f]); return null; }; });
  await page.fill('#bk-name', 'Priya Shah');
  await page.click('[data-stepper="bkpax"] [data-step="1"]');
  await page.click('.book__submit');
  await t.sleep(200);
  const opened = await page.evaluate(() => window.__opened || []);
  t.expect(opened.length === 1 && opened[0][0].startsWith('https://wa.me/9779851353347?text=') && opened[0][1] === '_blank', 'submit opens wa.me in a new tab');
  const msg = opened.length ? decodeURIComponent(opened[0][0].split('?text=')[1] || '') : '';
  found.waMessage = msg;
  t.expect(/Trek: Mardi Himal \(5 days\)/.test(msg) && /ref mardi-himal-20261016/.test(msg) && /Group: 2/.test(msg) &&
    /Name: Priya Shah/.test(msg) && /Email: priya@example\.com/.test(msg) && /WhatsApp: \+447700900123/.test(msg), 'WhatsApp message carries the fully serialised request');
  t.expect((await text('.confirm-card__title')).startsWith('Opened WhatsApp'), 'ConfirmationCard "Opened WhatsApp with your request" replaces the form');
  t.expect(await page.$$eval('.confirm-card__ref', (e) => e.length) === 0, 'WhatsApp-path card has no booking ref');
  await t.shot('book');

  // ---- #my-trips: signed-out explanation
  await go('#my-trips');
  await waitFor('.trips__signed-out', 2000);
  const trips = await text('.trips__signed-out');
  t.expect(trips.includes('Requests are saved to your claude.ai identity') && /not signed in here/.test(trips), '#my-trips shows the signed-out explanation');
  t.expect(await page.$$eval('.trips__signed-out a[href*="wa.me"]', (e) => e.length) === 1, 'signed-out state offers a WhatsApp button');
  await t.shot('my-trips');

  // ---- #admin: identity unavailable gate (never a dashboard)
  await go('#admin');
  t.expect(await waitFor('.gate--unavailable', 3000), '#admin shows .gate--unavailable');
  t.expect(await page.$$eval('.admin__band, .arow, input[type="password"]', (e) => e.length) === 0, 'no dashboard, rows or password field behind the gate');
  t.expect((await text('.gate--unavailable')).includes('Identity isn'), 'gate explains identity is unavailable');
  await t.shot('admin');

  // Back to a public route: tabs return.
  await go('#home');
  t.expect(await page.$$eval('#tabbar .tabbar__tab', (e) => e.length) === 4, 'public tab bar restored after leaving admin');
  return found;
}

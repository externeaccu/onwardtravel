// Completeness probe of public paths nobody else exercised.
//   node test/run.mjs --role interact --width 390 --route '#agenda' --seed test/seed.json --scenario test/scenarios/critic-public.mjs
// FitMyDates, theme cycle + persistence before first paint, sheet keyboard (focus in, Tab wraps,
// Escape closes and returns focus), book -> my-trips -> withdraw -> re-request, reduced motion map.
export default async function (page, t) {
  const go = async (h, ms = 900) => { await page.evaluate((x) => { location.hash = x; }, h); await t.sleep(ms); };
  const text = (sel = '#app') => page.evaluate((s) => (document.querySelector(s) || {}).innerText || '', sel);

  // ---- FitMyDates
  await go('#agenda', 1000);
  await page.click('.fit__toggle');
  await page.fill('#fit-land', '2026-10-15');
  await page.fill('#fit-out', '2026-10-25');
  await t.sleep(200);
  const fit = await page.evaluate(() => Array.from(document.querySelectorAll('.dep')).map((d) => ({
    href: d.getAttribute('href'), dim: d.classList.contains('dep--dim'), fit: (d.querySelector('.dep__fit') || {}).textContent || '' })));
  t.log(JSON.stringify(fit.slice(0, 4)));
  const mardi = fit.find((f) => /mardi-himal-20261016/.test(f.href));
  const poon = fit.find((f) => /poon-hill-20261010/.test(f.href));
  t.expect(mardi && !mardi.dim && /6 spare days/.test(mardi.fit), 'fit: Mardi 16-20 Oct fits with 6 spare days');
  t.expect(poon && poon.dim && !poon.fit, 'fit: Poon Hill 10 Oct dimmed');
  const note = await page.$eval('[data-fit-note]', (e) => e.textContent);
  t.expect(/^1 of \d+ departures fit your dates$/.test(note), 'fit note counts: ' + note);
  // persisted in session and restored
  await go('#home', 300); await go('#agenda', 600);
  t.expect(await page.$eval('#fit-land', (e) => e.value) === '2026-10-15' && await page.$eval('details.fit', (e) => e.open), 'fit dates restored and panel open');
  await page.fill('#fit-out', '2026-10-01');
  await t.sleep(150);
  t.expect(/before your landing date/.test(await page.$eval('[data-fit-note]', (e) => e.textContent)), 'fit: fly-out before landing explained');
  await page.click('.fit__clear');
  await t.sleep(150);
  t.expect(await page.$$eval('.dep--dim', (e) => e.length) === 0, 'fit: clear removes dimming');

  // ---- theme cycle
  const themeState = () => page.evaluate(() => ({ attr: document.documentElement.getAttribute('data-theme'), ls: localStorage.getItem('mbh.theme'), label: document.querySelector('.iconbtn--theme').getAttribute('aria-label'), bg: getComputedStyle(document.body).backgroundColor }));
  const s0 = await themeState();
  await page.click('.iconbtn--theme'); const s1 = await themeState();
  await page.click('.iconbtn--theme'); const s2 = await themeState();
  t.log(JSON.stringify([s0, s1, s2]));
  t.expect(s0.attr === null && s1.attr === 'light' && s2.attr === 'dark', 'theme cycles system -> light -> dark');
  t.expect(s2.bg !== s1.bg, 'dark background differs from light');
  await page.reload({ waitUntil: 'domcontentloaded' });
  const early = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  t.expect(early === 'dark', 'theme persists and applies before app boot');
  await t.sleep(600);
  await page.click('.iconbtn--theme'); const s3 = await themeState();
  t.expect(s3.attr === null && s3.ls === '"system"', 'third tap returns to system');

  // ---- sheet keyboard
  await go('#trek-mardi-himal', 900);
  await page.focus('.iconbtn--wa');
  await page.keyboard.press('Enter');
  await t.sleep(350);
  const inSheet = () => page.evaluate(() => !!document.activeElement && !!document.activeElement.closest('.sheet'));
  t.expect(await inSheet(), 'Ask sheet: focus moves into the sheet');
  let escaped = false;
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); if (!(await inSheet())) escaped = true; }
  for (let i = 0; i < 5; i++) { await page.keyboard.press('Shift+Tab'); if (!(await inSheet())) escaped = true; }
  t.expect(!escaped, 'Ask sheet: Tab / Shift+Tab stay inside');
  await page.keyboard.press('Escape');
  await t.sleep(400);
  const after = await page.evaluate(() => ({ open: !!document.querySelector('.sheet'), rootHidden: document.getElementById('sheet-root').hidden, focus: document.activeElement && document.activeElement.className, ah: document.getElementById('app').getAttribute('aria-hidden'), ov: document.body.style.overflow }));
  t.log(JSON.stringify(after));
  t.expect(!after.open && after.rootHidden && /iconbtn--wa/.test(after.focus) && after.ah === null && after.ov === '', 'Escape closes, restores focus and page');

  // ---- book, then my trips, withdraw, re-request
  await go('#book-mardi-himal-20261016', 900);
  await page.fill('#bk-name', 'Critic Tester');
  await page.fill('#bk-email', 'c@example.com');
  await page.fill('#bk-whatsapp', '44 7700 900123');
  await page.click('.book__submit');
  await t.sleep(700);
  t.expect(/Requested\./.test(await text('#sheet-root')), 'booking saved');
  // Escape on the confirmation card returns to the departure
  await page.keyboard.press('Escape');
  await t.sleep(600);
  t.expect(/^#departure-mardi-himal-20261016$/.test(await page.evaluate(() => location.hash)), 'Escape on booking sheet returns to the departure');
  await go('#my-trips', 900);
  t.expect(await page.$$eval('.trip', (e) => e.length) === 1, 'my trips lists the request');
  await page.click('[data-withdraw]');
  await t.sleep(150);
  await page.click('.inline-confirm__yes');
  await t.sleep(700);
  const trip = await page.$eval('.trip', (e) => ({ text: e.innerText, actions: !!e.querySelector('.trip__actions') }));
  t.log(JSON.stringify(trip));
  t.expect(/Cancelled|Withdrawn/.test(trip.text) && !trip.actions, 'withdrawn trip shows its state without actions');
  await t.shot('mytrips-withdrawn');
  // a withdrawn request doesn't block a new one; the banner doesn't claim one is pending
  await go('#book-mardi-himal-20261016', 900);
  t.expect(!/already sent a request/.test(await text('#sheet-root')), 'after withdraw, the booking sheet does not say a request is pending');
  await page.keyboard.press('Escape'); await t.sleep(500);

  // ---- reduced motion map
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await go('#trek-langtang', 200);
  const rm = await page.evaluate(() => {
    const line = document.querySelector('.rmap__line--walk');
    const mk = document.querySelector('.rmap__marker');
    return { dash: line ? line.style.strokeDasharray : 'noline', op: mk ? getComputedStyle(mk).opacity : 'nomk' };
  });
  t.log(JSON.stringify(rm));
  t.expect(rm.dash === '' || rm.dash === 'none', 'reduced motion: no dasharray draw-in');
  t.expect(rm.op === '1', 'reduced motion: markers visible immediately');
  return { ok: true };
}

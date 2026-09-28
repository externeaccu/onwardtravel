// Review: in-page jumps at 390 (CTA -> departures, month strip -> month, day tap) and whether sticky bars cover the target.
export default async function (page, t) {
  const D = 'test/shots/review-mobile/jump-';
  const out = {};
  const cover = (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return 'missing ' + s; const b = e.getBoundingClientRect(); const tb = document.querySelector('#topbar').getBoundingClientRect(); return { top: Math.round(b.top), topbarBottom: Math.round(tb.bottom), text: e.textContent.trim().slice(0, 40) }; }, sel);
  await page.evaluate(() => { location.hash = '#trek-poon-hill'; }); await t.sleep(900);
  await page.click('#ctabar .ctabar__btn'); await t.sleep(1500);
  out.cta = await cover('#trek-departures h2, #trek-departures .section__title, #h-deps');
  await page.screenshot({ path: D + 'cta.png' });
  await page.evaluate(() => { location.hash = '#agenda'; }); await t.sleep(900);
  const chips = await page.$$('.mstrip__chip'); out.nchips = chips.length;
  if (chips[2]) { await chips[2].click(); await t.sleep(1500); }
  out.month = await page.evaluate(() => Array.from(document.querySelectorAll('.agenda__month')).map((m) => [m.textContent.trim(), Math.round(m.getBoundingClientRect().top)]));
  await page.screenshot({ path: D + 'month.png' });
  // map marker tap
  await page.evaluate(() => { location.hash = '#trek-ebc-gokyo'; }); await t.sleep(900);
  const m = await page.$('.rmap__marker[data-day="9"]');
  if (m) { await page.evaluate(() => { const r = document.querySelector('.rmap').getBoundingClientRect(); scrollTo({ top: scrollY + r.top - 60, behavior: 'instant' }); }); await t.sleep(300); await m.click({ force: true }).catch((e) => (out.clickErr = String(e))); await t.sleep(1200); }
  await page.screenshot({ path: D + 'marker9.png' });
  out.after = await page.evaluate(() => ({ active: Array.from(document.querySelectorAll('.rmap__marker.is-active')).map((e) => e.getAttribute('aria-label')), card: (document.querySelector('.rmap__daycard:not([hidden])') || {}).textContent, y: scrollY }));
  // elementFromPoint at centers of each marker: which marker is on top?
  out.hit = await page.evaluate(() => Array.from(document.querySelectorAll('.rmap__marker')).map((mk) => { const b = mk.getBoundingClientRect(); const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); const owner = top && top.closest('.rmap__marker'); return [mk.getAttribute('aria-label'), owner === mk ? 'ok' : 'COVERED by ' + (owner ? owner.getAttribute('aria-label') : top && top.tagName)]; }).filter((x) => x[1] !== 'ok'));
  return out;
}

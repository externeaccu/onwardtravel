// Review: agenda month-strip jump and trek CTA jump with seeded departures; checks the target heading clears the sticky topbar.
export default async function (page, t) {
  const out = {};
  await page.evaluate(() => { location.hash = '#agenda'; }); await t.sleep(1200);
  const chips = await page.$$('.mstrip__chip:not(.is-empty)');
  out.n = chips.length;
  if (chips[1]) { await chips[1].click(); await t.sleep(1800); }
  out.month = await page.evaluate(() => Array.from(document.querySelectorAll('.agenda__month')).map((m) => [m.textContent.trim(), Math.round(m.getBoundingClientRect().top), Math.round(m.getBoundingClientRect().bottom)]));
  out.firstRowUnderMonth = await page.evaluate(() => { const m = Array.from(document.querySelectorAll('.agenda__month')).find((x) => x.getBoundingClientRect().top >= 50 && x.getBoundingClientRect().top < 120); const n = m && m.nextElementSibling; return n ? Math.round(n.getBoundingClientRect().top) : null; });
  await page.screenshot({ path: 'test/shots/review-mobile/jump-month.png' });
  await page.evaluate(() => { location.hash = '#trek-mardi-himal'; }); await t.sleep(1200);
  await page.click('#ctabar .ctabar__btn'); await t.sleep(1800);
  out.cta = await page.evaluate(() => { const h = document.querySelector('#h-deps'); const b = h.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)]; });
  await page.screenshot({ path: 'test/shots/review-mobile/jump-cta2.png' });
  return out;
}

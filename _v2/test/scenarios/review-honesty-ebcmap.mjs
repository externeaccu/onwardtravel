// Review: EBC map night markers for days 10-11, and Annapurna day 8 "rest" row.
export default async function (page, t) {
  const out = {};
  await page.evaluate(() => { location.hash = '#trek-ebc-gokyo'; }); await t.sleep(2500);
  const m = await page.$('.rmap'); if (m) { await m.scrollIntoViewIfNeeded(); await t.sleep(1500); }
  await page.click('.day[data-day="11"] .day__head'); await t.sleep(600);
  out.daycard = await page.$eval('.rmap__daycard', (e) => e.innerText).catch(() => null);
  out.activeMarker = await page.evaluate(() => { const a = document.querySelector('.rmap .is-active'); return a ? (a.getAttribute('aria-label') || a.textContent) : null; });
  out.markerLabels = await page.$$eval('.rmap [data-day]', (els) => els.map((e) => (e.getAttribute('aria-label') || '') + '|' + e.getAttribute('data-day')).filter((s) => /Lobuche|10/.test(s)));
  if (m) { await m.screenshot({ path: 'test/shots/review-honesty/ebc-map-day11.png' }); }
  await page.evaluate(() => { location.hash = '#trek-annapurna-tilicho'; }); await t.sleep(1500);
  const row = await page.$('.day[data-day="8"]'); if (row) { await row.scrollIntoViewIfNeeded(); await t.sleep(300); await row.screenshot({ path: 'test/shots/review-honesty/tilicho-day8-rest.png' }); out.day8 = await row.innerText(); }
  const row5 = await page.$('.day[data-day="5"]'); if (row5) out.day5 = await row5.innerText();
  return out;
}

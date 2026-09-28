// Review: clean (non-smooth) map screenshots per trek, light + dark, plus a day-tap state.
export default async function (page, t) {
  await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
  const out = {};
  for (const theme of ['light', 'dark']) {
    await page.evaluate((th) => localStorage.setItem('mbh.theme', JSON.stringify(th)), theme);
    for (const id of ['poon-hill', 'annapurna-tilicho', 'ebc-gokyo', 'manaslu-tsum']) {
      await page.evaluate((h) => { location.hash = '#trek-' + h; }, id);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
      await t.sleep(900);
      await page.evaluate(() => { const r = document.querySelector('.rmap').getBoundingClientRect(); window.scrollTo(0, window.scrollY + r.top - 60); });
      await t.sleep(2500);
      await page.screenshot({ path: 'test/shots/review-mobile/map2-' + id + '-' + theme + '.png' });
      if (theme === 'light') {
        // tap day 3 marker/day head
        await page.evaluate(() => { const h = document.querySelector('.day[data-day="3"] .day__head'); h && h.click(); });
        await t.sleep(900);
        await page.evaluate(() => { const r = document.querySelector('.rmap').getBoundingClientRect(); window.scrollTo(0, window.scrollY + r.top - 60); });
        await t.sleep(400);
        await page.screenshot({ path: 'test/shots/review-mobile/map2-' + id + '-day3.png' });
        out[id] = await page.evaluate(() => { const p = document.querySelector('.rmap__line--walk'); const b = p.getBoundingClientRect(); const s = document.querySelector('.rmap__svg').getBoundingClientRect(); return { line: [b.left - s.left, b.top - s.top, b.width, b.height], svg: [s.width, s.height] }; });
      }
    }
  }
  return out;
}

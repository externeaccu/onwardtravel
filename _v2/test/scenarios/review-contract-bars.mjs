// Review: fixed bottom bars vs content at page end; safe-area padding computed; sticky header top.
const ROUTES = ['#home', '#treks', '#trek-mardi-himal', '#agenda', '#departure-mardi-himal-20261016', '#my-trips', '#about', '#admin', '#admin-departures', '#admin-bookings', '#admin-settings', '#book-mardi-himal-20261016'];
export default async (page, t) => {
  const out = {};
  for (const r of ROUTES) {
    await page.evaluate((h) => { location.hash = h; }, r);
    await t.sleep(1200);
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await t.sleep(500);
    out[r] = await page.evaluate(() => {
      const vis = (el) => el && !el.hidden && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
      const bars = ['#tabbar', '#ctabar', '.admin__fab'].map((s) => document.querySelector(s)).filter(vis)
        .map((el) => ({ sel: el.id || el.className, top: Math.round(el.getBoundingClientRect().top), h: Math.round(el.getBoundingClientRect().height), pos: getComputedStyle(el).position }));
      const fixedBars = bars.filter((b) => b.pos === 'fixed' && !/fab/.test(b.sel));
      const barTop = fixedBars.length ? Math.min(...fixedBars.map((b) => b.top)) : innerHeight;
      // last visible leaf in #app
      const all = Array.from(document.querySelectorAll('#app *')).filter((e) => e.children.length === 0 && e.getBoundingClientRect().height > 0 && getComputedStyle(e).visibility !== 'hidden');
      let maxB = 0, last = null; all.forEach((e) => { const b = e.getBoundingClientRect().bottom; if (b > maxB) { maxB = b; last = e; } });
      return { bars, barTop, lastBottom: Math.round(maxB), last: last && (last.className || last.tagName) + ' "' + (last.textContent || '').trim().slice(0, 40) + '"', covered: Math.round(maxB - barTop), bodyPB: getComputedStyle(document.body).paddingBottom, sheet: !!document.querySelector('.sheet.is-in') };
    });
    await t.shot('bottom-' + r.slice(1));
  }
  return out;
};

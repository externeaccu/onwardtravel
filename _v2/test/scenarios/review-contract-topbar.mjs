// Review: topbar actual height vs --topbar-h used by sticky offsets.
const ROUTES = ['#home', '#agenda', '#trek-mardi-himal', '#admin', '#admin-departures', '#book-mardi-himal-20261016'];
export default async (page, t) => {
  const out = {};
  for (const r of ROUTES) {
    await page.evaluate((h) => { location.hash = h; }, r);
    await t.sleep(1300);
    out[r] = await page.evaluate(() => {
      const tb = document.getElementById('topbar'); const cs = getComputedStyle(document.documentElement);
      const sticky = Array.from(document.querySelectorAll('.agenda__month, .admin-tabs, .split__aside')).map((e) => e.className.split(' ')[0] + ':' + getComputedStyle(e).position + ':' + getComputedStyle(e).top);
      return { h: tb.getBoundingClientRect().height, var: cs.getPropertyValue('--topbar-h').trim(), top: getComputedStyle(tb).top, pos: getComputedStyle(tb).position, sticky: [...new Set(sticky)] };
    });
  }
  if (t.width < 720) {
    await page.evaluate(() => { location.hash = '#agenda'; }); await t.sleep(1200);
    await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' })); await t.sleep(300);
    await t.shot('agenda-scrolled');
  }
  return out;
};

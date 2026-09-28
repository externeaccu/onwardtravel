// Review: measure horizontal overflow with body{overflow-x:hidden} removed (it masks real overflow).
const ROUTES = ['#home', '#treks', '#trek-mardi-himal', '#trek-ebc-gokyo', '#trek-manaslu-tsum', '#trek-poon-hill', '#agenda', '#departure-mardi-himal-20261016', '#book-mardi-himal-20261016', '#my-trips', '#about', '#admin', '#admin-departures', '#admin-bookings', '#admin-settings', '#admin-departure-mardi-himal-20261016'];
export default async (page, t) => {
  const out = {};
  for (const r of ROUTES) {
    await page.evaluate((h) => { location.hash = h; }, r);
    await t.sleep(1300);
    out[r] = await page.evaluate(async () => {
      const st = document.createElement('style'); st.textContent = 'body{overflow-x:visible!important}'; document.head.appendChild(st);
      await new Promise((res) => requestAnimationFrame(() => res()));
      const a = document.documentElement.scrollWidth;
      document.querySelectorAll('.day__head').forEach((h, i) => { if (i < 30) h.click(); });
      await new Promise((res) => setTimeout(res, 300));
      const b = document.documentElement.scrollWidth;
      const wide = Array.from(document.querySelectorAll('body *')).filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1 && e.getBoundingClientRect().width > 0).slice(-4).map((e) => (e.getAttribute('class') || e.tagName) + ':' + Math.round(e.getBoundingClientRect().right));
      st.remove();
      return { idle: a, afterOpen: b, wide };
    });
  }
  return out;
};

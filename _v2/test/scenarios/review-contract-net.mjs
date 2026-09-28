// Review: every network request host across routes.
const ROUTES = ['#home', '#treks', '#trek-mardi-himal', '#trek-ebc-gokyo', '#agenda', '#departure-mardi-himal-20261016', '#book-mardi-himal-20261016', '#my-trips', '#about', '#admin', '#admin-departures', '#admin-bookings', '#admin-settings'];
export default async (page, t) => {
  const urls = new Set();
  page.on('request', (r) => urls.add(r.url().replace(/\?.*$/, '')));
  for (const r of ROUTES) {
    await page.evaluate((h) => { location.hash = h; }, r);
    await t.sleep(900);
    await page.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 500) { window.scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 30)); } });
  }
  const anchors = await page.evaluate(() => Array.from(document.querySelectorAll('a[href]')).map((a) => a.getAttribute('href')).filter((h) => !/^#[a-z0-9-]+$/.test(h)));
  return { urls: Array.from(urls).filter((u) => !/127\.0\.0\.1/.test(u)), local: Array.from(urls).filter((u) => /127\.0\.0\.1/.test(u)).map((u) => u.replace(/^.*?:\d+\//, '')), anchors: [...new Set(anchors.map((a) => a.slice(0, 40)))] };
};

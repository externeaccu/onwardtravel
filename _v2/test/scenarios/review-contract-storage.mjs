// Review: make localStorage/sessionStorage throw on access, then load every route.
const ROUTES = ['#home', '#treks', '#trek-mardi-himal', '#trek-ebc-gokyo', '#agenda', '#departure-mardi-himal-20261016',
  '#book-mardi-himal-20261016', '#my-trips', '#about', '#admin', '#admin-departures', '#admin-bookings', '#admin-settings'];
export default async (page, t) => {
  await page.addInitScript(() => {
    for (const k of ['localStorage', 'sessionStorage']) {
      Object.defineProperty(window, k, { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } });
    }
  });
  const base = page.url().split('#')[0];
  const out = {};
  for (const r of ROUTES) {
    const before = t.errors.length;
    await page.goto('about:blank');
    await page.goto(base + r, { waitUntil: 'domcontentloaded' });
    await t.sleep(1200);
    const info = await page.evaluate(() => {
      let threw = false; try { window.localStorage; } catch (e) { threw = true; }
      return { threw, title: document.title, h1: (document.querySelector('.view__title,h1') || {}).textContent || '', boot: !!document.querySelector('.view.boot'), ov: document.documentElement.scrollWidth - document.documentElement.clientWidth, len: document.getElementById('app').innerText.length };
    });
    // interact a bit: toggle theme button if present
    const tb = await page.$('[data-theme-toggle], .theme-toggle, [aria-label*="heme"]');
    if (tb) { try { await tb.click(); await t.sleep(200); } catch (e) {} }
    out[r] = Object.assign(info, { newErrors: t.errors.slice(before) });
    t.expect(info.threw && !info.boot && info.len > 50, 'rendered with throwing storage ' + r);
    await t.shot('storage-' + r.slice(1));
  }
  return out;
};

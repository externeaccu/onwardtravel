// Review: text-bearing leaf elements closer than 16px to the viewport edge at 390.
const ROUTES = ['#home', '#treks', '#trek-mardi-himal', '#agenda', '#departure-mardi-himal-20261016', '#book-mardi-himal-20261016', '#my-trips', '#about', '#admin', '#admin-departures', '#admin-bookings', '#admin-settings', '#admin-departure-mardi-himal-20261016'];
export default async (page, t) => {
  const out = {};
  for (const r of ROUTES) {
    await page.evaluate((h) => { location.hash = h; }, r);
    await t.sleep(1300);
    out[r] = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth, bad = new Set();
      document.querySelectorAll('#app *, #sheet-root *').forEach((el) => {
        if (el.children.length || !(el.textContent || '').trim()) return;
        if (el.closest('svg, .mstrip, .chips, [class*="scroller"]')) return;
        const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
        let p = el.parentElement, scr = false; while (p && p !== document.body) { if (/(auto|scroll)/.test(getComputedStyle(p).overflowX)) { scr = true; break; } p = p.parentElement; }
        if (scr) return;
        if (r.left < 15 || r.right > vw - 15) bad.add((el.getAttribute('class') || el.tagName) + '[' + Math.round(r.left) + '..' + Math.round(r.right) + ']');
      });
      return Array.from(bad).slice(0, 6);
    });
  }
  return out;
};

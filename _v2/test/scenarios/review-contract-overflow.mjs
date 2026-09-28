// Review: overflow at 390 ignoring body{overflow-x:hidden} masking; also interactive states.
const ROUTES = ['#home', '#treks', '#trek-mardi-himal', '#trek-ebc-gokyo', '#trek-manaslu-tsum', '#agenda', '#departure-mardi-himal-20261016', '#book-mardi-himal-20261016', '#my-trips', '#about', '#admin', '#admin-departures', '#admin-bookings', '#admin-settings', '#admin-departure-mardi-himal-20261016'];
const probe = () => {
  const vw = document.documentElement.clientWidth, res = [];
  document.querySelectorAll('body *').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if (r.right <= vw + 1 && r.left >= -1) return;
    let p = el.parentElement, clipped = false;
    while (p && p !== document.body && p !== document.documentElement) { const ps = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(ps.overflowX)) { clipped = true; break; } p = p.parentElement; }
    if (clipped) return;
    if (el.closest('.sr-only')) return;
    const st = getComputedStyle(el); if (st.visibility === 'hidden' || st.opacity === '0') return;
    if (el.closest('.sheet') && !el.closest('.sheet.is-in')) return;
    res.push((typeof el.className === 'string' ? el.className : el.tagName) + ' [' + Math.round(r.left) + '..' + Math.round(r.right) + '] "' + (el.textContent || '').trim().slice(0, 30) + '"');
  });
  return { bodyOX: getComputedStyle(document.body).overflowX, htmlOX: getComputedStyle(document.documentElement).overflowX, sw: document.documentElement.scrollWidth, over: res.slice(0, 8) };
};
export default async (page, t) => {
  const out = {};
  for (const r of ROUTES) {
    await page.evaluate((h) => { location.hash = h; }, r);
    await t.sleep(1300);
    // open everything openable
    await page.evaluate(() => { document.querySelectorAll('.day__head').forEach((h, i) => { if (i < 30) h.click(); }); });
    await t.sleep(300);
    out[r] = await page.evaluate(probe);
  }
  // treks filter + ask sheet
  await page.evaluate(() => { location.hash = '#trek-mardi-himal'; }); await t.sleep(1000);
  const ask = await page.$('#ctabar .ctabar__btn'); if (ask) { try { await ask.click({ timeout: 3000 }); } catch (e) { t.log('cta click failed'); } await t.sleep(600); out.ctaclick = await page.evaluate(probe); await t.shot('cta-click'); }
  // admin editor sheet
  await page.evaluate(() => { location.hash = '#admin-departures'; }); await t.sleep(1200);
  const fab = await page.$('.admin__fab'); if (fab) { try { await fab.click({ timeout: 3000 }); } catch (e) { t.log('fab click failed'); } await t.sleep(700); out.editor = await page.evaluate(probe); await t.shot('editor'); }
  return out;
};

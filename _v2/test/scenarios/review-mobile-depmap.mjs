// Review: departure page static map geometry (dated labels vs marker discs) and marker hit-testing on EBC trek map.
export default async function (page, t) {
  await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
  const geo = () => page.evaluate(() => {
    const svg = document.querySelector('.rmap__svg'); const sb = svg.getBoundingClientRect();
    const r = (e) => { const b = e.getBoundingClientRect(); return [Math.round(b.left - sb.left), Math.round(b.top - sb.top), Math.round(b.right - sb.left), Math.round(b.bottom - sb.top)]; };
    const dots = Array.from(document.querySelectorAll('.rmap__marker')).map((m) => [m.getAttribute('aria-label') || m.getAttribute('data-day'), r(m.querySelector('.rmap__dot,.rmap__tri,.rmap__via') || m)]);
    const labels = Array.from(document.querySelectorAll('.rmap__label')).map((l) => [l.textContent, r(l)]);
    const ov = []; const hit = (a, b) => a[0] < b[2] - 1 && b[0] < a[2] - 1 && a[1] < b[3] - 1 && b[1] < a[3] - 1;
    labels.forEach(([lt, lb]) => dots.forEach(([mt, mb]) => { if (hit(lb, mb)) ov.push('LABEL "' + lt + '" over ' + mt); }));
    for (let i = 0; i < dots.length; i++) for (let j = i + 1; j < dots.length; j++) if (hit(dots[i][1], dots[j][1])) ov.push('MARKER ' + dots[i][0] + ' x ' + dots[j][0]);
    return { dots, labels, ov };
  });
  const out = {};
  await page.evaluate(() => { location.hash = '#departure-mardi-himal-20261016'; }); await t.sleep(1200);
  out.dep = await geo();
  for (const id of ['ebc-gokyo', 'manaslu-tsum', 'annapurna-tilicho', 'manaslu-circuit', 'langtang', 'abc-poon']) {
    await page.evaluate((h) => { location.hash = '#trek-' + h; }, id); await t.sleep(1000);
    await page.evaluate(() => { const r = document.querySelector('.rmap').getBoundingClientRect(); window.scrollTo(0, scrollY + r.top - 60); }); await t.sleep(2200);
    const g = await geo(); out[id] = g.ov;
    await page.screenshot({ path: 'test/shots/review-mobile/map3-' + id + '.png' });
  }
  return out;
}

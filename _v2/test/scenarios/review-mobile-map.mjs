// Review: map marker/label geometry at the harness width for several treks.
export default async function (page, t) {
  const out = {};
  for (const id of ['poon-hill', 'annapurna-tilicho', 'ebc-gokyo', 'mardi-himal']) {
    await page.evaluate((h) => { location.hash = '#trek-' + h; }, id);
    await t.sleep(900);
    out[id] = await page.evaluate(() => {
      const svg = document.querySelector('.rmap__svg'); if (!svg) return null;
      const sb = svg.getBoundingClientRect();
      const r = (e) => { const b = e.getBoundingClientRect(); return [Math.round(b.left - sb.left), Math.round(b.top - sb.top), Math.round(b.width), Math.round(b.height)]; };
      const markers = Array.from(document.querySelectorAll('.rmap__marker')).map((m) => [m.getAttribute('aria-label'), r(m), getComputedStyle(m).display, getComputedStyle(m).visibility, m.getAttribute('class')]);
      const labels = Array.from(document.querySelectorAll('.rmap__label')).map((l) => [l.textContent, r(l), l.getAttribute('class')]);
      // label outside svg box?
      const outside = labels.filter(([, b]) => b[0] < 0 || b[1] < 0 || b[0] + b[2] > sb.width || b[1] + b[3] > sb.height);
      // label-marker overlaps
      const ov = [];
      labels.forEach(([lt, lb]) => markers.forEach(([mt, mb]) => { if (lb[0] < mb[0] + mb[2] - 1 && mb[0] < lb[0] + lb[2] - 1 && lb[1] < mb[1] + mb[3] - 1 && mb[1] < lb[1] + lb[3] - 1 && !mt.includes(lt)) ov.push(lt + ' x ' + mt); }));
      return { svg: [Math.round(sb.width), Math.round(sb.height)], markers, labels, outside, ov };
    });
    await page.evaluate(() => document.querySelector('.rmap').scrollIntoView({ block: 'center' }));
    await t.sleep(300);
    await page.screenshot({ path: 'test/shots/review-mobile/map-' + id + '.png' });
  }
  return out;
}

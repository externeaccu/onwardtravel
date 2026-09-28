// Map legibility: no two markers (disc/pill/triangle boxes) overlap, no start/end glyph sits on
// another marker, and every dated departure label is nearest its own day's marker.
//   node test/run.mjs --role owner --width 390 --route '#home' --seed test/seed.json --scenario test/scenarios/fix-map-markers.mjs
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
    // a glyph drawn inside its own (non-night) trailhead disc is not an overlap
    Array.from(document.querySelectorAll('.rmap__glyph')).forEach((ge) => { const g = r(ge); const own = ge.closest('.rmap__marker'); Array.from(document.querySelectorAll('.rmap__marker')).forEach((m) => { if (m === own) return; const mb = r(m.querySelector('.rmap__dot,.rmap__tri,.rmap__via') || m); if (hit(g, mb)) ov.push('GLYPH over ' + m.getAttribute('aria-label')); }); });
    // nearest-disc attribution for dated labels
    const att = [];
    labels.forEach(([lt, lb]) => {
      const m = /^D(\d+)/.exec(lt); if (!m) return;
      const dist = (b) => { const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2; const dx = Math.max(lb[0] - cx, 0, cx - lb[2]), dy = Math.max(lb[1] - cy, 0, cy - lb[3]); return Math.hypot(dx, dy) - (b[2] - b[0]) / 2; };
      let best = null, bd = 1e9; dots.forEach(([mt, mb]) => { const d = dist(mb); if (d < bd) { bd = d; best = mt; } });
      const day = m[1]; if (!new RegExp('^Days? ' + day + '(\\D|$)').test(best || '')) att.push(lt + ' nearest ' + best);
    });
    return { n: dots.length, labels: labels.length, ov, att, h: sb.height, w: sb.width };
  });
  const out = {};
  await page.evaluate(() => { location.hash = '#departure-mardi-himal-20261016'; }); await t.sleep(1200);
  out.dep = await geo();
  t.expect(!out.dep.ov.length && !out.dep.att.length, 'Mardi departure map: no overlaps, dated labels by their own marker (' + out.dep.ov.concat(out.dep.att).join('; ') + ')');
  await page.evaluate(() => { location.hash = '#departure-ebc-gokyo-20261105'; }); await t.sleep(1200);
  out.depEbc = await geo();
  t.expect(!out.depEbc.ov.length && !out.depEbc.att.length, 'EBC departure map: no overlaps, dated labels by their own marker (' + out.depEbc.ov.concat(out.depEbc.att).join('; ') + ')');
  for (const id of ['ebc-gokyo', 'manaslu-tsum', 'annapurna-tilicho', 'manaslu-circuit', 'langtang', 'abc-poon', 'poon-hill', 'mardi-himal']) {
    await page.evaluate((h) => { location.hash = '#trek-' + h; }, id); await t.sleep(900);
    await page.evaluate(() => { const r = document.querySelector('.rmap').getBoundingClientRect(); window.scrollTo(0, scrollY + r.top - 60); }); await t.sleep(1900);
    const g = await geo(); out[id] = { n: g.n, labels: g.labels, ov: g.ov, h: g.h, w: g.w };
    t.expect(!g.ov.length, id + ': no overlapping markers or glyphs (' + g.ov.join('; ') + ')');
    if (t.width < 720 && (id === 'ebc-gokyo' || id === 'manaslu-tsum' || id === 'langtang')) await t.shot('map-' + id);
  }
  // EBC day 11 highlight
  await page.evaluate(() => { location.hash = '#trek-ebc-gokyo'; }); await t.sleep(900);
  await page.click('.day[data-day="11"] .day__head'); await t.sleep(200);
  out.ebc11 = await page.evaluate(() => ({ active: Array.from(document.querySelectorAll('.rmap__marker.is-active')).map((e) => e.getAttribute('aria-label')), card: (document.querySelector('.rmap__daycard:not([hidden])') || {}).innerText }));
  await page.click('.day[data-day="10"] .day__head'); await t.sleep(200);
  out.ebc10 = await page.evaluate(() => Array.from(document.querySelectorAll('.rmap__marker.is-active')).map((e) => e.getAttribute('aria-label')));
  await page.evaluate(() => { location.hash = '#trek-annapurna-tilicho'; }); await t.sleep(900);
  out.tilichoDays = await page.evaluate(() => [5, 7, 8].map((d) => document.querySelector('.day[data-day="' + d + '"] .day__facts').textContent));
  return out;
}

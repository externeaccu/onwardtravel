// Theme contrast from review: in dark, nothing on the page is drawn with --brand (darker than the
// page); in light, amber used as TEXT and 11px --text-3 labels reach 4.5:1.
//   node test/run.mjs --role owner --width 390 --route '#home' --seed test/seed.json --scenario test/scenarios/fix-theme-contrast.mjs
const LUM = `(c) => { const m = c.match(/[\\d.]+/g).map(Number); const [r, g, b] = m.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }`;
export default async function (page, t) {
  const go = async (h, ms = 1500) => { await page.evaluate((x) => { location.hash = x; }, h); await t.sleep(ms); };
  const measure = (pairs) => page.evaluate(({ pairs, LUM }) => {
    const lum = eval(LUM);
    const bg = getComputedStyle(document.body).backgroundColor;
    // composite a possibly translucent colour over an opaque one
    const over = (c, base) => { const m = c.match(/[\d.]+/g).map(Number); const a = m.length > 3 ? m[3] : 1; if (a >= 1) return c; const bb = base.match(/[\d.]+/g).map(Number); return 'rgb(' + [0, 1, 2].map((i) => Math.round(m[i] * a + bb[i] * (1 - a))).join(',') + ')'; };
    const cr = (a, b) => { b = over(b, bg); a = over(a, b); const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    return pairs.map(([label, sel, prop, pseudo, against]) => {
      const el = document.querySelector(sel); if (!el) return [label, 'missing'];
      const cs = getComputedStyle(el, pseudo || null);
      const c = cs[prop];
      let b = against === 'bg' ? bg : against ? getComputedStyle(document.querySelector(against))[against === '.rmap__paper' ? 'fill' : 'backgroundColor'] : null;
      if (!b) { let p = el; while (p && (getComputedStyle(p).backgroundColor === 'rgba(0, 0, 0, 0)')) p = p.parentElement; b = p ? getComputedStyle(p).backgroundColor : bg; }
      return [label, Math.round(cr(c, b) * 100) / 100];
    });
  }, { pairs, LUM });
  // ---- dark
  await page.emulateMedia({ colorScheme: 'dark' });
  await go('#treks');
  let r = await measure([
    ['selected chip fill vs page', '.chip.is-on', 'backgroundColor', null, 'bg'],
    ['moderate dot vs page', '.diff--moderate', 'backgroundColor', '::before', 'bg'],
  ]);
  await go('#trek-poon-hill', 2500);
  await page.$eval('.rmap', (e) => e.scrollIntoView({ block: 'center' })); await t.sleep(1500);
  r = r.concat(await measure([
    ['map disc ring vs paper', '.rmap__dot', 'stroke', null, '.rmap__paper'],
    ['map glyph vs paper', '.rmap__glyph', 'fill', null, '.rmap__paper'],
    ['day glyph ring vs page', '.day__num', 'borderTopColor', null, 'bg'],
    ['dark button edge vs page', '.btn--dark', 'borderTopColor', null, 'bg'],
  ]));
  t.log('dark ' + JSON.stringify(r));
  r.forEach(([l, v]) => t.expect(typeof v === 'number' && v >= 3, 'dark: ' + l + ' >= 3:1 (' + v + ')'));
  // ---- light
  await page.emulateMedia({ colorScheme: 'light' });
  await go('#admin-bookings', 2500);
  let l = await measure([['"Requested" pill text', '.pill--requested', 'color']]);
  await go('#agenda');
  l = l.concat(await measure([['"2 left" pill text', '.spots--few', 'color'], ['empty month chip text', '.mstrip__chip.is-empty', 'color']]));
  t.log('light ' + JSON.stringify(l));
  l.forEach(([lab, v]) => t.expect(typeof v === 'number' && v >= 4.5, 'light: ' + lab + ' >= 4.5:1 (' + v + ')'));
  return { ok: true };
}

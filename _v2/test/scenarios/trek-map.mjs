// Trek page map + price tiers + trek index filters, no capabilities (role none).
//   node test/run.mjs --role none --width 390 --route '#trek-annapurna-tilicho' --scenario test/scenarios/trek-map.mjs
// The map checks run at the harness width and again at the other width (390 <-> 1440);
// the viewport is restored before the harness's own overflow check.
const TREK = 'annapurna-tilicho';

export default async function (page, t) {
  const found = { widths: {} };
  const waitFor = (sel, ms = 5000) => page.waitForSelector(sel, { timeout: ms, state: 'attached' }).then(() => true, () => false);
  const text = (sel) => page.$eval(sel, (e) => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
  const height = (w) => (w < 720 ? 844 : 900);

  async function checkMap(w) {
    const tag = '@' + w + ': ';
    await page.evaluate((id) => { location.hash = '#trek-' + id; }, TREK);
    t.expect(await waitFor('.rmap .rmap__svg', 3000), tag + '.rmap__svg present');
    const info = await page.evaluate(() => {
      const svg = document.querySelector('.rmap__svg');
      return {
        viewBox: svg && svg.getAttribute('viewBox'),
        passes: document.querySelectorAll('.rmap__marker--pass').length,
        pass: Array.from(document.querySelectorAll('.rmap__marker--pass')).map((m) => m.getAttribute('aria-label')),
        markers: document.querySelectorAll('.rmap__marker').length,
        scale: (document.querySelector('.rmap__scale-text') || {}).textContent || '',
        legend: (document.querySelector('.rmap__legend') || {}).textContent || '',
        north: !!document.querySelector('.rmap__north'),
        walk: ((document.querySelector('.rmap__line--walk') || { getAttribute: () => '' }).getAttribute('d') || '').length,
        profile: !!document.querySelector('.rmap .elev .elev__svg'),
        hero: !!document.querySelector('.phero .elev--hero .elev__svg'),
        labels: document.querySelectorAll('.rmap__label').length
      };
    });
    found.widths[w] = info;
    t.expect(info.passes >= 1 && /Thorong La/.test(info.pass[0] || ''), tag + '≥1 .rmap__marker--pass (Thorong La)');
    t.expect(/ km$/.test(info.scale), tag + 'scale bar text ends with "km" ("' + info.scale + '")');
    t.expect(info.legend.includes('Sketch map'), tag + 'legend contains "Sketch map"');
    t.expect(info.north && info.walk > 20, tag + 'north mark and walked route line drawn');
    t.expect(info.profile && info.hero, tag + 'docked elevation profile and ProfileHero present');

    // Labels never overlap (omitted rather than colliding).
    const overlaps = await page.evaluate(() => {
      const boxes = Array.from(document.querySelectorAll('.rmap__label:not(.rmap__label--elev)')).map((e) => e.getBoundingClientRect());
      let n = 0;
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) n++;
      }
      return n;
    });
    t.expect(overlaps === 0, tag + 'no overlapping map labels (' + overlaps + ')');

    // DayList -> map: tapping a day head activates that night's marker.
    await page.click('.day[data-day="2"] .day__head');
    await t.sleep(150);
    const d2 = await page.evaluate(() => {
      const act = Array.from(document.querySelectorAll('.rmap__marker.is-active'));
      return { n: act.length, day: act[0] && act[0].getAttribute('data-day'), label: act[0] && act[0].getAttribute('aria-label'),
        rowOpen: document.querySelector('.day[data-day="2"]').classList.contains('is-open'),
        rowActive: document.querySelector('.day[data-day="2"]').classList.contains('is-active'),
        card: (document.querySelector('.rmap__daycard:not([hidden]) .rmap__daycard-title') || {}).textContent || '',
        dot: !!document.querySelector('.elev__dot--active') };
    });
    t.expect(d2.n === 1 && d2.day === '2' && /Chame/.test(d2.label || ''), tag + 'day 2 head -> marker data-day=2 (Chame) .is-active');
    t.expect(d2.rowOpen && d2.rowActive, tag + 'day row opens and is marked active');
    t.expect(d2.card.startsWith('Day 2 · ') && d2.dot, tag + 'day card and profile dot follow the highlight');
    // A rest day resolves to the previous night's merged marker.
    await page.click('.day[data-day="5"] .day__head');
    await t.sleep(150);
    const d5 = await page.$$eval('.rmap__marker.is-active', (els) => els.map((e) => [e.getAttribute('data-day'), e.getAttribute('aria-label'), !!e.querySelector('.rmap__ring2')]));
    t.expect(d5.length === 1 && d5[0][0] === '4' && /Days 4–5, Manang/.test(d5[0][1]) && d5[0][2], tag + 'rest day 5 -> merged "Days 4–5, Manang" marker with ×2 ring');
    // Map -> DayList: tapping a marker opens its day row.
    await page.evaluate(() => { const m = document.querySelector('.rmap__marker[data-day="9"]'); if (m) m.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await t.sleep(150);
    t.expect(await page.$eval('.day[data-day="9"]', (e) => e.classList.contains('is-open') && e.classList.contains('is-active')).catch(() => false), tag + 'marker tap opens day 9 row');
    await page.$eval('.rmap', (e) => e.scrollIntoView({ block: 'center' }));
    await t.sleep(1300);
    t.expect(await page.$eval('.rmap', (e) => e.classList.contains('is-visible')), tag + 'map draws in once visible');
    await t.shot('map-' + w);
  }

  // ---- map at the harness width, then at the other width
  const first = t.width;
  const second = first < 720 ? 1440 : 390;
  await checkMap(first);
  await page.setViewportSize({ width: second, height: height(second) });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await t.sleep(400);
  await checkMap(second);
  await page.setViewportSize({ width: first, height: height(first) });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await t.sleep(400);

  // ---- PriceTiers: stepper to 3 and 4 (tier = largest min ≤ pax, via MBH.tierFor)
  await page.evaluate((id) => { location.hash = '#trek-' + id; }, TREK);
  await waitFor('[data-stepper="pax"]', 3000);
  const expected = await page.evaluate((id) => { const tk = window.MBH.trekById(id); return [3, 4].map((p) => window.MBH.tierFor(tk, p)); }, TREK);
  found.tierFor = expected;
  const setPax = async (n) => {
    for (let i = 0; i < 12; i++) {
      const v = Number(await text('[data-stepper="pax"] .stepper__val'));
      if (v === n) break;
      await page.click('[data-stepper="pax"] [data-step="' + (v < n ? 1 : -1) + '"]');
    }
  };
  await setPax(3);
  const at3 = { line: await text('[data-price-line]'), on: (await text('.tiers__row.is-on .tiers__label')) + ' ' + (await text('.tiers__row.is-on .tiers__price')) };
  found.pax3 = at3;
  t.expect(expected[0] && expected[0].label === '2 pax' && expected[0].price === 350, 'MBH.tierFor(Annapurna Circuit, 3) = "2 pax" $350');
  t.expect(at3.line === '$350 per person · $1,050 for 3' && at3.on === '2 pax $350', 'stepper 3 -> "2 pax" row on, "$350 per person · $1,050 for 3" (got "' + at3.line + '")');
  await setPax(4);
  const at4 = { line: await text('[data-price-line]'), on: (await text('.tiers__row.is-on .tiers__label')) + ' ' + (await text('.tiers__row.is-on .tiers__price')) };
  found.pax4 = at4;
  t.expect(at4.line === '$300 per person · $1,200 for 4' && at4.on === '4 pax $300', 'stepper 4 -> "4 pax" row on, "$300 per person · $1,200 for 4"');
  await setPax(1);
  t.expect(await page.$eval('[data-stepper="pax"] [data-step="-1"]', (e) => e.disabled), 'stepper minus disabled at 1');
  await setPax(2);

  // ---- #treks difficulty chips (a "Challenging to Strenuous" trek is in both)
  await page.evaluate(() => { location.hash = '#treks'; });
  await waitFor('.trek-card', 3000);
  const visible = () => page.$$eval('.trek-card:not(.is-hidden)', (els) => els.map((e) => e.getAttribute('data-trek')).sort());
  const labels = () => page.$$eval('.trek-card:not(.is-hidden) .diff', (els) => els.map((e) => e.textContent.trim()));
  await page.click('.chip[data-group="diff"][data-value="strenuous"]');
  const strenuous = await visible();
  found.strenuous = { ids: strenuous, labels: await labels() };
  t.expect(JSON.stringify(strenuous) === JSON.stringify(['annapurna-tilicho', 'ebc-gokyo', 'manaslu-circuit', 'manaslu-tsum']),
    'Strenuous: Annapurna Circuit, EBC, Manaslu Circuit, Manaslu+Tsum (' + strenuous.join(',') + ')');
  await page.click('.chip[data-group="diff"][data-value="challenging"]');
  const challenging = await visible();
  found.challenging = { ids: challenging, labels: await labels() };
  t.expect(['annapurna-tilicho', 'manaslu-circuit', 'manaslu-tsum'].every((id) => challenging.includes(id)) && !challenging.includes('ebc-gokyo'),
    'Challenging: Annapurna Circuit, Manaslu Circuit, Manaslu+Tsum (and not EBC)');
  t.expect(challenging.includes('abc-poon'), 'Challenging also lists ABC + Poon Hill ("Moderate to Challenging")');
  t.expect((await text('[data-count]')) === 'Showing ' + challenging.length + ' of 8 treks', 'count line matches the visible cards');
  t.expect(await page.$eval('.chip[data-group="diff"][data-value="challenging"]', (e) => e.classList.contains('is-on') && e.getAttribute('aria-pressed') === 'true'), 'active chip is .is-on and aria-pressed');
  await page.click('.chip[data-group="len"][data-value="short"]');
  t.expect((await visible()).length === 0 && await page.$eval('[data-none]', (e) => !e.hidden), 'Challenging + ≤5 days shows the no-match state');
  await page.click('[data-clear]');
  t.expect((await visible()).length === 8, 'Clear filters shows all 8 treks');
  await t.shot('treks');
  return found;
}

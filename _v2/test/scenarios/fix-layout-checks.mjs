// Layout regressions from review: phone tap targets, departure-row date column, Fit-my-dates
// inputs, sticky month header; desktop/tablet: wrapped chips, month strip reachable by wheel,
// add-on prices inside their column, footer at the foot of short pages, full email, admin rows.
//   node test/run.mjs --role owner --width 390|820|1440 --route '#home' --seed test/seed.json --scenario test/scenarios/fix-layout-checks.mjs
export default async function (page, t) {
  await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
  const go = async (h, ms = 1300) => { await page.evaluate((x) => { location.hash = x; }, h); await t.sleep(ms); };
  const small = () => page.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
    const sel = 'a.section__more, .book__change, .chip:not(.chip--tag), .btn, .admin__band a, button, a.btn';
    return Array.from(document.querySelectorAll(sel)).filter(vis).filter((e) => !e.closest('.sr-only') && !e.closest('.rmap') && !e.closest('.elev'))
      .map((e) => { const r = e.getBoundingClientRect(); return (e.textContent || '').trim().slice(0, 24) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height); })
      .filter((s) => Number(s.split('x').pop()) < 44);
  });
  if (t.width < 720) {
    for (const r of ['#home', '#treks', '#agenda', '#book-mardi-himal-20261016', '#admin', '#admin-departures', '#admin-bookings']) {
      await go(r, r.startsWith('#admin') ? 2200 : 1300);
      const s = await small();
      t.expect(!s.length, r + ': every control at least 44px tall (' + s.join(', ') + ')');
    }
    await go('#trek-ebc-gokyo');
    await page.$eval('.rmap', (e) => e.scrollIntoView({ block: 'center' }));
    await t.sleep(1800);
    const hit = await page.evaluate(() => { const m = document.querySelector('.rmap__marker[role="button"] .rmap__hit'); const b = m.getBoundingClientRect(); return Math.round(Math.min(b.width, b.height)); });
    t.expect(hit >= 44, 'map markers have a 44px hit area (' + hit + ')');
    await go('#agenda');
    const wd = await page.evaluate(() => Array.from(document.querySelectorAll('.dep__wd')).map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.width)]; }));
    t.expect(wd.every(([l, w]) => l >= 16 && w <= 64), 'weekday line stays inside the 64px date column and the gutter');
    const ends = await page.evaluate(() => Array.from(document.querySelectorAll('.dep__end')).every((e) => e.getClientRects().length === 1));
    t.expect(ends, '"ends …" never splits across lines');
    const month = await page.evaluate(() => { const r = document.querySelector('.agenda__month').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)]; });
    t.expect(month[0] <= 0 && month[1] >= 390, 'sticky month header covers the gutters');
    await page.click('.fit__toggle'); await t.sleep(300);
    const fit = await page.evaluate(() => ['#fit-land', '#fit-out', '.fit__fields'].map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left, r.right]; }));
    t.expect(fit[0][1] <= fit[1][0] && fit[1][1] <= fit[2][1] && fit[1][1] <= 374, 'Fit my dates inputs do not overlap or cross the panel/gutter');
  } else {
    await go('#agenda');
    const st = await page.evaluate(() => {
      const col = document.querySelector('.agenda').getBoundingClientRect();
      const ch = document.querySelector('.agenda__tools .chips'); const ms = document.querySelector('.mstrip');
      return { colR: col.right - 16, chipsR: Math.max(...Array.from(ch.querySelectorAll('.chip')).map((c) => c.getBoundingClientRect().right)), chipsScroll: ch.scrollWidth > ch.clientWidth + 1, msR: ms.getBoundingClientRect().right, left: ms.classList.contains('mstrip--more-left'), right: ms.classList.contains('mstrip--more-right') };
    });
    t.expect(!st.chipsScroll && st.chipsR <= st.colR + 1, 'trek chips wrap inside the column');
    t.expect(st.msR <= st.colR + 1 && !st.left, 'month strip inside the column, no left fade at the start');
    const ms = await page.$('.mstrip'); const b = await ms.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.wheel(0, 600); await t.sleep(300);
    const wh = await page.evaluate(() => [document.querySelector('.mstrip').scrollLeft, window.scrollY]);
    t.expect(!st.right || (wh[0] > 50 && wh[1] === 0), 'mouse wheel scrolls the month strip sideways (' + wh + ')');
    for (const r of ['#about', '#trek-mardi-himal']) {
      await go(r);
      const over = await page.evaluate(() => { const col = document.querySelectorAll('.cols__col')[2].getBoundingClientRect(); return Array.from(document.querySelectorAll('.addon')).map((a) => [a.querySelector('.addon__name').getBoundingClientRect().width, a.querySelector('.addon__price').getBoundingClientRect().right - col.right]); });
      t.expect(over.every(([nw, o]) => o <= 1 && nw >= 60), r + ': add-on names readable, prices inside their column');
    }
    await go('#my-trips');
    const f = await page.evaluate(() => ({ bottom: document.querySelector('.footer').getBoundingClientRect().bottom + scrollY, doc: document.documentElement.scrollHeight, pb: parseFloat(getComputedStyle(document.body).paddingBottom), email: Array.from(document.querySelectorAll('.footer .copyfield__text')).every((e) => e.scrollWidth <= e.clientWidth + 1) }));
    t.expect(Math.abs(f.bottom + f.pb - f.doc) <= 2, 'footer sits at the foot of a short page');
    t.expect(f.email, 'footer contact text is never truncated');
    await go('#admin-departures', 2500);
    const a = await page.evaluate(() => { const r = document.querySelector('[data-admin="screen"] .arow'); return { main: r.querySelector('.arow__main').getBoundingClientRect().width, w: r.getBoundingClientRect().width }; });
    t.expect(t.width >= 1024 || a.main >= a.w - 1, 'tablet: admin row text uses the full width (actions below)');
  }
  return { ok: true };
}

export default async (page, t) => {
  await t.sleep(1200);
  await page.evaluate(() => { const hs = document.querySelectorAll('.day__head'); hs[hs.length - 1].click(); });
  await t.sleep(800);
  const info = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('svg').forEach((s) => { const r = s.getBoundingClientRect(); out.push({ cls: s.getAttribute('class'), l: Math.round(r.left), r: Math.round(r.right), ov: getComputedStyle(s).overflow, parentOX: getComputedStyle(s.parentElement).overflowX, pcls: s.parentElement.className }); });
    const g = Array.from(document.querySelectorAll('svg g, svg rect')).filter((e) => e.getBoundingClientRect().right > 390).map((e) => { const s = e.closest('svg'); return e.getAttribute('class') + ' in ' + s.getAttribute('class') + ' right=' + Math.round(e.getBoundingClientRect().right); });
    return { out, g };
  });
  const el = await page.$('.rmap, .routemap, [class*="rmap"]');
  if (el) { await el.scrollIntoViewIfNeeded(); await t.sleep(300); }
  await t.shot('maplabel');
  return info;
};

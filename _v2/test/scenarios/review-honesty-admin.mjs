// Review: dump admin copy for owner.
export default async function (page, t) {
  const out = {};
  for (const r of ['admin','admin-departures','admin-bookings','admin-settings','admin-departure-mardi-himal-20261016']) {
    await page.evaluate((h) => { location.hash = h; }, '#' + r); await t.sleep(1200);
    out[r] = await page.evaluate(() => document.querySelector('#app').innerText);
    await t.shot(r);
  }
  // open New departure sheet
  await page.evaluate(() => { location.hash = '#admin-departures'; }); await t.sleep(800);
  const nb = await page.$('[data-act="new"], button:has-text("New departure")');
  if (nb) { await nb.click(); await t.sleep(400); out.newSheet = await page.evaluate(() => document.querySelector('#sheet-root').innerText); await t.shot('new-dep'); }
  return out;
}

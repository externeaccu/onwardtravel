// Review: which treks each difficulty/length chip shows; sort by price.
export default async function (page, t) {
  await page.evaluate(() => { location.hash = '#treks'; }); await t.sleep(300);
  const out = {};
  for (const d of ['all','easy','moderate','challenging','strenuous']) {
    await page.click(`.chip[data-group="diff"][data-value="${d}"]`); await t.sleep(80);
    out[d] = await page.$$eval('.trek-card:not(.is-hidden)', (els) => els.map((e) => e.getAttribute('data-trek')));
  }
  await page.click('.chip[data-group="diff"][data-value="all"]');
  await page.click('.chip[data-group="sort"][data-value="price"]'); await t.sleep(80);
  out.priceSort = await page.$$eval('.trek-card:not(.is-hidden)', (els) => els.map((e) => e.getAttribute('data-trek') + ':' + (e.querySelector('.trek-card__price, [class*=price]')||{}).textContent));
  await t.shot('treks-price');
  return out;
}

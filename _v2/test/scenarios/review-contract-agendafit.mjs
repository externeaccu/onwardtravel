export default async (page, t) => {
  await t.sleep(1500);
  await page.click('.fit__toggle'); await t.sleep(500);
  const info = await page.evaluate(() => Array.from(document.querySelectorAll('.fit .field__label, .fit .input, .fit__fields')).map((e) => (e.getAttribute('class') || '') + ' ' + Math.round(e.getBoundingClientRect().left) + '..' + Math.round(e.getBoundingClientRect().right) + ' sw=' + e.scrollWidth + ' cw=' + e.clientWidth + ' ox=' + getComputedStyle(e).overflowX));
  await t.shot('agenda-fit-open');
  return info;
};

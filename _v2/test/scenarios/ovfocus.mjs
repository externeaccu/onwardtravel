export default async (page, t) => {
  await page.waitForSelector('.hmap__svg'); await t.sleep(1800);
  await page.focus('.hmap__route[data-trek="mardi-himal"]'); await t.sleep(250);
  const st = await page.evaluate(() => ({ active: document.activeElement && document.activeElement.getAttribute('data-trek'), has: document.querySelector('.hmap__svg').classList.contains('has-active'), cap: document.querySelector('.hmap__caption-main').textContent }));
  t.expect(st.active === 'mardi-himal' && st.has, 'focus kept and route lifted: ' + JSON.stringify(st));
  await page.keyboard.press('Tab'); await t.sleep(200);
  const st2 = await page.evaluate(() => ({ active: document.activeElement && document.activeElement.getAttribute('data-trek'), cap: document.querySelector('.hmap__caption-main').textContent }));
  t.log('after Tab ' + JSON.stringify(st2));
  await page.keyboard.press('Enter'); await t.sleep(600);
  t.log('hash ' + await page.evaluate(() => location.hash));
};

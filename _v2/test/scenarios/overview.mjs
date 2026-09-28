// Home hero overview map: renders all eight routes, links work, hover names the trek,
// both themes readable, resting state complete.
export default async (page, t) => {
  await page.waitForSelector('.hmap__svg', { timeout: 5000 });
  await t.sleep(2200);
  const n = await page.$$eval('.hmap__route', (els) => els.map((e) => e.getAttribute('href')));
  t.expect(n.length === 8, '8 route links, got ' + n.length);
  t.expect(n.every((h) => /^#trek-[a-z-]+$/.test(h)), 'hrefs are bare trek tokens');
  const cap0 = await page.$eval('.hmap__caption-main', (e) => e.textContent);
  t.expect(/8 routes across 4 regions/.test(cap0), 'idle caption: ' + cap0);
  const box = await page.$eval('.hmap__stage', (e) => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, top: r.top }; });
  t.log('stage ' + JSON.stringify(box));
  await t.shot('light');
  // hover the Mardi Himal route
  const mh = await page.$('.hmap__route[data-trek="mardi-himal"] .hmap__hit');
  const bb = await mh.boundingBox();
  if (t.width >= 1024) {
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  } else {
    await page.focus('.hmap__route[data-trek="mardi-himal"]');
  }
  await t.sleep(300);
  const cap1 = await page.$eval('.hmap__caption-main', (e) => e.textContent);
  t.log('caption after hover/focus: ' + cap1);
  await t.shot('hover');
  await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); });
  await t.sleep(200);
  await t.shot('dark');
  await page.evaluate(() => { document.documentElement.removeAttribute('data-theme'); });
  await page.click('.hmap__route[data-trek="langtang"]', { force: true }).catch(() => {});
  await t.sleep(800);
  t.log('after click: ' + await page.evaluate(() => location.hash));
};

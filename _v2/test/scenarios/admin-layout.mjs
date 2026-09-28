// Run: node test/run.mjs --role owner --width 1440 --route '#admin' --seed test/seed.json --scenario test/scenarios/admin-layout.mjs
// Desktop layout: tabs under the band (not in #tabbar), panel sheet, then a resize to phone.
const waitDash = async (page, t) => { for (let i = 0; i < 30; i++) { if (await page.$('.admin__band')) return; await t.sleep(100); } };
export default async function (page, t) {
  await waitDash(page, t);
  await t.sleep(300);
  const info = await page.evaluate(() => {
    const nav = document.querySelector('#view nav.admin-tabs');
    const tb = document.getElementById('tabbar');
    return {
      navInView: !!nav, navTabs: nav ? nav.querySelectorAll('.admin-tabs__tab').length : 0,
      navAfterBand: !!(nav && nav.previousElementSibling && nav.previousElementSibling.classList.contains('admin__band')),
      tabbarHasAdmin: !!tb.querySelector('.admin-tabs__tab'), tabbarDisplay: getComputedStyle(tb).display,
      navPos: nav ? getComputedStyle(nav).position : ''
    };
  });
  t.log(JSON.stringify(info));
  t.expect(info.navInView && info.navTabs === 4 && info.navAfterBand, 'desk tabs rendered under the band');
  t.expect(!info.tabbarHasAdmin && info.tabbarDisplay === 'none', '#tabbar untouched and hidden on desktop');
  t.expect(info.navPos === 'sticky', 'desk tabs sticky');
  await t.shot('inbox');
  await page.evaluate(() => { location.hash = '#admin-departures'; });
  await t.sleep(400);
  await t.shot('departures');
  await page.click('[data-act="edit"][data-dep="poon-hill-20261010"]');
  await t.sleep(400);
  await t.shot('form-edit');
  const panel = await page.evaluate(() => document.querySelector('.sheet').className);
  t.expect(/sheet--panel/.test(panel), 'form is a right-hand panel on desktop');
  await page.click('.sheet__close');
  await t.sleep(200);
  // Resize to phone: tabs move into #tabbar
  await page.setViewportSize({ width: 390, height: 844 });
  await t.sleep(300);
  const phone = await page.evaluate(() => ({ nav: !!document.querySelector('#view nav.admin-tabs'), tb: document.querySelectorAll('#tabbar .admin-tabs__tab').length }));
  t.log(JSON.stringify(phone));
  t.expect(!phone.nav && phone.tb === 4, 'resize to phone moves tabs to #tabbar');
  await t.shot('phone-after-resize');
  await page.setViewportSize({ width: 1440, height: 900 });
  await t.sleep(300);
  await page.evaluate(() => { location.hash = '#admin-bookings'; });
  await t.sleep(400);
  await page.click('.chip[data-val="all"]');
  await t.sleep(100);
  await t.shot('bookings');
  return { ok: true };
}

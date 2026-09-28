// Reviewer scenario: confirm -> full, cancel -> open, restore -> requested, close/reopen, edit capacity.
const waitDash = async (page, t) => { for (let i = 0; i < 30; i++) { if (await page.$('.admin__band')) return; await t.sleep(100); } };
const dump = (page) => page.evaluate(() => window.__MBH_MOCK_STORE.dump());
const dep = async (page) => { const d = (await dump(page))['departures/mardi-himal-20261016']; return d.spotsLeft + '/' + d.status; };
const clickYes = async (page) => { await page.evaluate(() => { const y = document.querySelector('.inline-confirm__yes'); y && y.click(); }); };
export default async function (page, t) {
  await waitDash(page, t);
  await page.evaluate(() => { location.hash = '#admin-bookings'; });
  await t.sleep(600);
  await page.evaluate(() => document.querySelector('[data-act="confirm"][data-id="b1alice01"]').click());
  await t.sleep(600); t.log('after confirm alice: ' + await dep(page));
  await page.evaluate(() => { location.hash = '#admin-departure-mardi-himal-20261016'; }); await t.sleep(600);
  await page.evaluate(() => document.querySelector('[data-act="cancel"][data-id="b1alice01"]').click()); await t.sleep(100); await clickYes(page);
  await t.sleep(600); t.log('after cancel alice: ' + await dep(page));
  await page.evaluate(() => document.querySelector('[data-act="restore"][data-id="b1alice01"]').click());
  await t.sleep(600); t.log('after restore: ' + await dep(page) + ' item=' + (await dump(page))['bookings/u_alice'].items[0].status);
  await t.shot('flip');
}

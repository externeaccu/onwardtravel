// Reviewer scenario: edit form open while this same device's syncDeparture writes the departure.
const waitDash = async (page, t) => { for (let i = 0; i < 30; i++) { if (await page.$('.admin__band')) return; await t.sleep(100); } };
const dump = (page) => page.evaluate(() => window.__MBH_MOCK_STORE.dump());
export default async function (page, t) {
  await waitDash(page, t);
  // make the stored counter drift so a Recount has something to write
  await page.evaluate(() => { const d = window.__MBH_MOCK_STORE.dump()['departures/abc-poon-20261024']; d.spotsLeft = 3; window.__MBH_MOCK_STORE.set('departures/abc-poon-20261024', d); });
  await page.evaluate(() => { location.hash = '#admin-departure-abc-poon-20261024'; });
  await t.sleep(700);
  await page.click('[data-act="edit"][data-dep="abc-poon-20261024"]');
  await t.sleep(400);
  // Sandip taps Recount under the panel (desktop) - this device's own write
  await page.evaluate(() => { const b = document.querySelector('[data-act="recount"][data-dep="abc-poon-20261024"]'); if (b) b.click(); else window.__nob = 1; });
  await t.sleep(500);
  const banner = await page.evaluate(() => { const b = document.querySelector('.dep-form .banner'); return b ? b.textContent : null; });
  t.log('banner: ' + banner + ' nob=' + (await page.evaluate(() => window.__nob)));
  await t.shot('edit-own-sync');
  // Edit capacity: step down past confirmed?
  const d = await dump(page);
  t.log('dep ' + JSON.stringify(d['departures/abc-poon-20261024']));
}

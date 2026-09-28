// Review: admin sheets/confirmations at 390 (new departure sheet, delete confirm, decline confirm).
export default async function (page, t) {
  const D = 'test/shots/review-mobile/adm-';
  await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
  await page.evaluate(() => { location.hash = '#admin-departures'; }); await t.sleep(1500);
  await page.click('.admin__fab'); await t.sleep(900);
  await page.screenshot({ path: D + 'new.png' });
  const sh = await page.evaluate(() => { const s = document.querySelector('.sheet__body') || document.querySelector('.sheet'); return s ? s.scrollHeight : 0; });
  await page.evaluate(() => { const s = document.querySelector('.sheet__body') || document.querySelector('.sheet'); if (s) s.scrollTop = 99999; }); await t.sleep(300);
  await page.screenshot({ path: D + 'new-bottom.png' });
  await page.keyboard.press('Escape'); await t.sleep(700);
  const del = await page.$$('button.btn--danger:not([disabled])');
  if (del[0]) { await del[0].scrollIntoViewIfNeeded(); await del[0].click(); await t.sleep(700); await page.screenshot({ path: D + 'delete.png' }); }
  await page.evaluate(() => { location.hash = '#admin'; }); await t.sleep(1200);
  const dec = await page.$$('button.btn--danger');
  if (dec[0]) { await dec[0].click(); await t.sleep(700); await page.screenshot({ path: D + 'decline.png' }); }
  const cf = await page.$$('button.btn--primary');
  return { sh };
}

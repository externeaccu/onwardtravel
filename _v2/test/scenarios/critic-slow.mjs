// Slow capabilities: use() resolves after 2.5s (wrapped). Booking typed before resolution keeps
// its input and flips the label quietly; the admin gate passes checking -> granted -> dashboard;
// draft survives a reload.
//   node test/run.mjs --role interact --width 390 --route '#home' --seed test/seed.json --scenario test/scenarios/critic-slow.mjs
//   node test/run.mjs --role owner    --width 390 --route '#home' --seed test/seed.json --scenario test/scenarios/critic-slow.mjs
export default async function (page, t) {
  await page.addInitScript(() => {
    const orig = window.claude;
    const memo = {};
    window.claude = { use: (n) => memo[n] || (memo[n] = new Promise((r) => setTimeout(() => r(orig.use(n)), 2500))) };
  });
  if (t.role === 'owner') {
    await page.goto(page.url().split('#')[0] + '#admin', { waitUntil: 'domcontentloaded' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await t.sleep(300);
    const g1 = await page.evaluate(() => (document.querySelector('.gate') || {}).className || 'none');
    t.expect(/gate--checking/.test(g1), 'gate starts in checking (' + g1 + ')');
    let seenGranted = false;
    for (let i = 0; i < 40; i++) {
      await t.sleep(100);
      const g = await page.evaluate(() => (document.querySelector('.gate') || {}).className || '');
      if (/gate--granted/.test(g)) seenGranted = true;
      if (await page.$('.admin__band')) break;
    }
    t.expect(seenGranted, 'gate shows granted before the dashboard');
    t.expect(!!(await page.$('.admin__band')), 'dashboard mounts');
    return { ok: true };
  }
  await page.goto(page.url().split('#')[0] + '#book-mardi-himal-20261016', { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await t.sleep(300);
  const l1 = await page.$eval('.book__submit', (b) => b.textContent).catch(() => 'none');
  await page.fill('#bk-name', 'Slow Typer');
  await page.fill('#bk-email', 'slow@example.com');
  await page.click('[data-stepper="bkpax"] [data-step="1"]');
  await t.sleep(3000);
  const l2 = await page.$eval('.book__submit', (b) => b.textContent);
  const vals = await page.evaluate(() => [document.getElementById('bk-name').value, document.getElementById('bk-email').value, document.querySelector('[data-stepper="bkpax"]').textContent]);
  t.log(l1 + ' -> ' + l2 + ' ' + JSON.stringify(vals));
  t.expect(l1 === 'Send request on WhatsApp' && l2 === 'Request a spot', 'label flips once capabilities resolve');
  t.expect(vals[0] === 'Slow Typer' && vals[1] === 'slow@example.com' && /2/.test(vals[2]), 'no input lost across the flip');
  t.expect(!(await page.evaluate(() => document.activeElement === document.body)), 'focus not dropped to body');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await t.sleep(600);
  const d = await page.evaluate(() => [document.getElementById('bk-name').value, document.querySelector('[data-stepper="bkpax"]').textContent]);
  t.expect(d[0] === 'Slow Typer' && /2/.test(d[1]), 'draft survives reload');
  return { ok: true };
}

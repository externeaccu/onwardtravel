// Run: node test/run.mjs --role owner --width 390 --route '#admin' --seed test/seed.json --scenario test/scenarios/admin-inbox.mjs
// admin.js: gate → dashboard → Inbox content, then Confirm (overbook ask), Decline, drift Recount.
export default async function (page, t) {
  const gateStates = [];
  for (let i = 0; i < 12; i++) {
    const s = await page.evaluate(() => { const g = document.querySelector('.gate'); return g ? g.className : (document.querySelector('.admin__band') ? 'dashboard' : 'none'); });
    if (gateStates[gateStates.length - 1] !== s) gateStates.push(s);
    if (s === 'dashboard') break;
    await t.sleep(100);
  }
  t.log('gate states: ' + gateStates.join(' → '));
  t.expect(gateStates.some((s) => /gate--granted/.test(s)) && gateStates.includes('dashboard'), 'gate passes granted → dashboard');
  await t.sleep(300);
  await t.shot('inbox');
  const info = await page.evaluate(() => ({
    tabbarTabs: Array.from(document.querySelectorAll('#tabbar .admin-tabs__tab')).map((a) => a.textContent),
    tabbarClass: document.getElementById('tabbar').className,
    topbarAdmin: document.getElementById('topbar').classList.contains('topbar--admin'),
    pill: (document.querySelector('.syncpill') || {}).textContent,
    groups: Array.from(document.querySelectorAll('.admin__group')).map((h) => h.textContent),
    rows: Array.from(document.querySelectorAll('[data-admin="screen"] .arow')).map((r) => r.innerText.replace(/\n+/g, ' | ')),
    imgs: document.querySelectorAll('#app img').length
  }));
  t.log(JSON.stringify(info, null, 1));
  t.expect(info.tabbarTabs.length === 4, 'admin tabs rendered into #tabbar on phone');
  t.expect(/Inbox2/.test(info.tabbarTabs[0].replace(/\s/g, '')), 'inbox badge = 2 requested');
  t.expect(info.topbarAdmin, 'topbar--admin set');
  t.expect(info.pill === 'Live', 'sync pill live');
  t.expect(info.groups.some((g) => /Mardi Himal/.test(g)), 'departure header for 2 requests on one departure');
  t.expect(info.rows.some((r) => /6 of 8 booked · confirming leaves 0/.test(r)), 'consequence line for Alice');
  t.expect(info.rows.some((r) => /Would overbook by 1/.test(r)), 'overbook line for Bob');
  t.expect(info.rows.some((r) => /stored 7 · computed 6/.test(r)), 'drift row for langtang');
  t.expect(info.imgs === 0, 'no images on admin');

  // Confirm Bob (3 pax, only 2 left) → overbook ask → Not now
  const bob = page.locator('.arow', { hasText: 'Bob Tanaka' }).first();
  await bob.locator('[data-act="confirm"]').click();
  await t.sleep(200);
  const ask = await page.evaluate(() => (document.querySelector('.inline-confirm[data-own]') || {}).innerText || '');
  t.log('ask: ' + ask);
  t.expect(/Only 2 left, this needs 3/.test(ask), 'overbook ask shown');
  await page.locator('[data-act="ask-no"]').click();
  await t.sleep(100);

  // Confirm Alice → booking first then departure
  const alice = page.locator('.arow', { hasText: 'Alice Verhoeven · 2 people' }).first();
  await alice.locator('[data-act="confirm"]').click();
  await t.sleep(60);
  const during = await page.evaluate(() => Array.from(document.querySelectorAll('.arow.is-pending')).map((r) => r.innerText.split('\n')[0]));
  t.log('pending during confirm: ' + JSON.stringify(during));
  await t.sleep(700);
  const dump = await page.evaluate(() => window.__MBH_MOCK_STORE.dump());
  const aItem = dump['bookings/u_alice'].items.find((i) => i.id === 'b1alice01');
  t.expect(aItem.status === 'confirmed' && aItem.confirmedPax === 2, 'alice item confirmed with confirmedPax');
  const mardi = dump['departures/mardi-himal-20261016'];
  t.expect(mardi.spotsLeft === 0 && mardi.status === 'full', 'mardi spotsLeft 0 → full (got ' + mardi.spotsLeft + ' ' + mardi.status + ')');
  await t.shot('after-confirm');
  const after = await page.evaluate(() => ({
    rows: Array.from(document.querySelectorAll('[data-admin="screen"] .arow')).map((r) => r.className + ' :: ' + r.innerText.replace(/\n+/g, ' | ')),
    badge: (document.querySelector('.admin-tabs__badge') || {}).textContent
  }));
  t.log(JSON.stringify(after, null, 1));
  t.expect(after.badge === '1', 'badge now 1');

  // Decline Bob (inline confirm)
  await page.locator('.arow', { hasText: 'Bob Tanaka' }).first().locator('[data-act="decline"]').click();
  await t.sleep(100);
  const q = await page.evaluate(() => (document.querySelector('.inline-confirm:not([data-own])') || {}).innerText || '');
  t.expect(/Decline this request\?/.test(q), 'decline inline confirm');
  await page.locator('.inline-confirm__yes').click();
  await t.sleep(500);
  const dump2 = await page.evaluate(() => window.__MBH_MOCK_STORE.dump());
  t.expect(dump2['bookings/u_bob'].items[0].status === 'cancelled', 'bob cancelled');
  t.expect(dump2['departures/mardi-himal-20261016'].updatedAt === dump['departures/mardi-himal-20261016'].updatedAt, 'decline wrote no departure');

  // Recount langtang drift
  await page.locator('[data-act="recount"][data-dep="langtang-20261128"]').click();
  await t.sleep(400);
  const dump3 = await page.evaluate(() => window.__MBH_MOCK_STORE.dump());
  t.expect(dump3['departures/langtang-20261128'].spotsLeft === 6, 'recount fixed langtang to 6');
  await t.shot('after-recount');
  const empty = await page.evaluate(() => document.querySelector('[data-admin="screen"]').innerText.slice(0, 400));
  t.log(empty);

  // Navigate to public route: tabbar restored
  await page.evaluate(() => { location.hash = '#home'; });
  await t.sleep(200);
  const pub = await page.evaluate(() => ({ tabs: Array.from(document.querySelectorAll('#tabbar a')).map((a) => a.className), cls: document.getElementById('tabbar').className, top: document.getElementById('topbar').className }));
  t.log(JSON.stringify(pub));
  t.expect(pub.tabs.every((c) => /tabbar__tab/.test(c)) && !/admin-tabs/.test(pub.cls), 'public tabbar restored');
  t.expect(!/topbar--admin/.test(pub.top), 'topbar--admin removed');
  return { ok: true };
}

// Run: node test/run.mjs --role owner --width 390 --route '#admin' --seed test/seed.json --scenario test/scenarios/admin-manage.mjs
// Departures list, DepartureForm (new / collision / edit / duplicate / guard / edited-elsewhere),
// detail copy actions, Close/Reopen/Delete, Bookings filters + Restore, Settings.
const waitDash = async (page, t) => { for (let i = 0; i < 30; i++) { if (await page.$('.admin__band')) return; await t.sleep(100); } };
const dump = (page) => page.evaluate(() => window.__MBH_MOCK_STORE.dump());
const go = async (page, t, h) => { await page.evaluate((x) => { location.hash = x; }, h); await t.sleep(250); await waitDash(page, t); await t.sleep(150); };

export default async function (page, t) {
  await waitDash(page, t);
  // Capture clipboard writes (app.copy uses navigator.clipboard when present).
  await page.evaluate(() => { try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (x) => { window.__copied = x; } } }); } catch (e) { /* ignore */ } });

  await go(page, t, '#admin-departures');
  await t.shot('departures');
  const list = await page.evaluate(() => ({
    groups: Array.from(document.querySelectorAll('.admin__group')).map((h) => h.textContent),
    rows: Array.from(document.querySelectorAll('[data-admin="screen"] .arow')).map((r) => r.querySelector('.arow__title').innerText + ' || ' + r.querySelector('.arow__meta').innerText),
    del: Array.from(document.querySelectorAll('[data-act="delete"]')).map((b) => b.disabled + ':' + (b.title || '')),
    fab: !!document.querySelector('.admin__fab'),
    activeTab: (document.querySelector('.admin-tabs__tab.is-active') || {}).textContent
  }));
  t.log(JSON.stringify(list, null, 1));
  t.expect(list.groups[0] === 'Upcoming', 'Upcoming group');
  t.expect(list.activeTab === 'Departures', 'Departures tab active');

  // New departure: pick Mardi Himal, start 2026-10-16 → collision -2
  await page.click('[data-act="new"]');
  await t.sleep(300);
  await page.click('.trekpick__tile[data-trek="mardi-himal"]');
  await page.fill('#df-start', '2026-10-16');
  await t.sleep(100);
  const pv = await page.evaluate(() => ({ preview: document.querySelector('.dep-form__preview').textContent, price: document.querySelector('#df-price').value, days: document.querySelector('#df-days').value }));
  t.log(JSON.stringify(pv));
  t.expect(/id mardi-himal-20261016-2/.test(pv.preview), 'collision suffix -2 in preview');
  t.expect(/Ends Tue 20 Oct/.test(pv.preview), 'end date in preview');
  await t.shot('form-new');
  // capacity guard: manualPax up 3 then capacity down to 2
  for (let i = 0; i < 3; i++) await page.click('[data-df="step"][data-name="manualPax"][data-delta="1"]');
  for (let i = 0; i < 6; i++) await page.click('[data-df="step"][data-name="capacity"][data-delta="-1"]');
  const guard = await page.evaluate(() => (document.querySelector('[data-err="capacity"]') || {}).textContent);
  t.log('guard: ' + guard);
  t.expect(/Capacity can't go below the 3 people already confirmed/.test(guard), 'capacity guard shown');
  for (let i = 0; i < 6; i++) await page.click('[data-df="step"][data-name="capacity"][data-delta="1"]');
  await page.click('[data-df="save"]');
  await t.sleep(500);
  let d = await dump(page);
  const nd = d['departures/mardi-himal-20261016-2'];
  t.log('new: ' + JSON.stringify(nd));
  t.expect(nd && nd.spotsLeft === 5 && nd.status === 'open' && nd.capacity === 8 && nd.manualPax === 3, 'new departure saved with spotsLeft = capacity - manualPax');
  t.expect(!(await page.$('.dep-form')), 'sheet closed after save');

  // Edit mardi-himal-20261016: start read-only; set capacity below confirmed → refused
  await page.click('[data-act="edit"][data-dep="mardi-himal-20261016"]');
  await t.sleep(300);
  const ro = await page.evaluate(() => ({ ro: document.querySelector('#df-start').readOnly, help: document.querySelector('[data-field="start"] .field__help').textContent, preview: document.querySelector('.dep-form__preview').textContent }));
  t.log(JSON.stringify(ro));
  t.expect(ro.ro && /Duplicate to move/.test(ro.help), 'start read-only in edit');
  // Another writer bumps updatedAt
  await page.evaluate(() => { const s = window.__MBH_MOCK_STORE.dump()['departures/mardi-himal-20261016']; s.updatedAt = Date.now(); s.note = 'Changed elsewhere'; window.__MBH_MOCK_STORE.set('departures/mardi-himal-20261016', s); });
  await t.sleep(200);
  const ban = await page.evaluate(() => (document.querySelector('.dep-form .banner') || {}).innerText || '');
  t.log('banner: ' + ban);
  t.expect(/Edited .* on another device/.test(ban) && /Reload/.test(ban), 'edited elsewhere banner');
  await t.shot('form-edit-banner');
  await page.click('[data-df="reload"]');
  await t.sleep(100);
  const note = await page.$eval('#df-note', (e) => e.value);
  t.expect(note === 'Changed elsewhere', 'reload refilled the form');
  await page.fill('#df-price', '180');
  await page.click('[data-df="save"]');
  await t.sleep(400);
  d = await dump(page);
  t.expect(d['departures/mardi-himal-20261016'].price === 180, 'edit saved price');

  // Duplicate
  await page.click('[data-act="duplicate"][data-dep="poon-hill-20261010"]');
  await t.sleep(300);
  const dup = await page.evaluate(() => ({ start: document.querySelector('#df-start').value, preview: document.querySelector('.dep-form__preview').textContent, mp: document.querySelector('[data-out="manualPax"]').textContent }));
  t.log('dup: ' + JSON.stringify(dup));
  t.expect(dup.start === '2026-10-17' && dup.mp === '0', 'duplicate +7 days and manualPax 0');
  await page.click('.sheet__close');
  await t.sleep(200);

  // Detail + copies
  await go(page, t, '#admin-departure-langtang-20261128');
  await t.shot('detail');
  await page.click('[data-act="copy-invite"]');
  await t.sleep(100);
  const inv = await page.evaluate(() => window.__copied);
  t.log('invite:\n' + inv);
  t.expect(/^Langtang Valley — group departure 28 November 2026 to 4 December 2026\n7 days · \$175 per person · 7 of 8 spots left\nDetails and request: http.*#departure-langtang-20261128$/.test(inv), 'invite text');
  await page.click('[data-act="copy-sheet"]');
  await t.sleep(100);
  const sheet = await page.evaluate(() => window.__copied);
  t.log('sheet:\n' + sheet);
  t.expect(/Party:\nAlice Verhoeven × 1 · 31612345678\n1 confirmed by WhatsApp/.test(sheet) && /Day plan:\nDay 1 · Sat 28 Nov · /.test(sheet), 'trip sheet text');
  const det = await page.evaluate(() => document.querySelector('[data-admin="screen"]').innerText);
  t.log(det.slice(0, 600));

  // Close with inline confirm, then Reopen
  await page.click('[data-act="close"][data-dep="langtang-20261128"]');
  await t.sleep(100);
  await page.click('.inline-confirm__yes');
  await t.sleep(400);
  d = await dump(page);
  t.expect(d['departures/langtang-20261128'].status === 'closed', 'closed');
  await page.click('[data-act="reopen"][data-dep="langtang-20261128"]');
  await t.sleep(400);
  d = await dump(page);
  t.expect(d['departures/langtang-20261128'].status === 'open' && d['departures/langtang-20261128'].spotsLeft === 6, 'reopened with computed spots');

  // Delete: disabled for langtang (has bookings); delete the new -2 one
  await go(page, t, '#admin-departures');
  const dis = await page.$eval('[data-act="delete"][data-dep="langtang-20261128"]', (b) => b.disabled + '|' + b.title);
  t.expect(dis === 'true|Has bookings — close it instead', 'delete disabled with bookings');
  await page.click('[data-act="delete"][data-dep="mardi-himal-20261016-2"]');
  await t.sleep(100);
  await page.click('.inline-confirm__yes');
  await t.sleep(400);
  d = await dump(page);
  t.expect(!d['departures/mardi-himal-20261016-2'], 'deleted');

  // Bookings: filters + cancel confirmed + restore
  await go(page, t, '#admin-bookings');
  await t.shot('bookings');
  await page.click('.chip[data-val="confirmed"]');
  await t.sleep(100);
  let rows = await page.$$eval('[data-admin="list"] .arow', (rs) => rs.map((r) => r.innerText.split('\n')[0]));
  t.log('confirmed: ' + JSON.stringify(rows));
  t.expect(rows.length === 1 && /Alice/.test(rows[0]), 'confirmed filter');
  await page.click('[data-admin="list"] [data-act="cancel"]');
  await t.sleep(100);
  await page.click('.inline-confirm__yes');
  await t.sleep(500);
  d = await dump(page);
  t.expect(d['bookings/u_alice'].items[1].status === 'cancelled' && d['departures/langtang-20261128'].spotsLeft === 7, 'cancel confirmed restores spots');
  await page.click('.chip[data-val="cancelled"]');
  await t.sleep(100);
  await page.click('[data-admin="list"] [data-act="restore"]');
  await t.sleep(400);
  d = await dump(page);
  t.expect(d['bookings/u_alice'].items[1].status === 'requested', 'restore sets requested');
  await page.click('.chip[data-val="all"]');
  await page.fill('#ab-q', 'bob');
  await t.sleep(150);
  rows = await page.$$eval('[data-admin="list"] .arow', (rs) => rs.map((r) => r.innerText.split('\n')[0]));
  t.expect(rows.length === 1 && /Bob/.test(rows[0]), 'name search');
  const focusKept = await page.evaluate(() => document.activeElement && document.activeElement.id);
  t.expect(focusKept === 'ab-q', 'search keeps focus');

  // Settings
  await go(page, t, '#admin-settings');
  await t.shot('settings');
  const st = await page.evaluate(() => ({ wa: document.querySelector('#as-wa').value, preset: document.querySelector('.settings-form__preset').disabled, help: document.querySelector('[data-admin="preset-help"]').textContent }));
  t.log(JSON.stringify(st));
  await page.fill('#as-note', 'Back in Pokhara on Monday.');
  await page.click('[data-admin="save"]');
  await t.sleep(400);
  d = await dump(page);
  t.log(JSON.stringify(d['settings/site']));
  t.expect(d['settings/site'].heroNote === 'Back in Pokhara on Monday.' && d['settings/site'].heroNoteSetAt > 0, 'settings saved heroNote + setAt');
  const meta = await page.$eval('.settings-form__meta', (e) => e.textContent);
  t.expect(/Note set just now/.test(meta), 'settings meta');
  // past-until nudge
  await page.evaluate(() => { const s = window.__MBH_MOCK_STORE.dump()['settings/site']; s.heroNoteUntil = '2026-09-01'; window.__MBH_MOCK_STORE.set('settings/site', s); });
  await t.sleep(200);
  const nudge = await page.evaluate(() => (document.querySelector('[data-admin="nudge"] .banner') || {}).innerText || '');
  t.log('nudge: ' + nudge);
  t.expect(/This note has been up past Tue 1 Sept?\. Clear it\?/.test(nudge), 'past-until nudge');
  await page.click('[data-act="clear-note"]');
  await t.sleep(400);
  d = await dump(page);
  t.expect(d['settings/site'].heroNote === '' && d['settings/site'].heroNoteUntil === null, 'clear saved');
  return { ok: true };
}

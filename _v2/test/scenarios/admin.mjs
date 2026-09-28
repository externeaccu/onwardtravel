// Sandip's desk end to end (role owner, seeded).
//   node test/run.mjs --role owner --width 390 --route '#admin' --seed test/seed.json --scenario test/scenarios/admin.mjs
// Gate -> Inbox (grouping + consequence lines) -> Confirm Alice (booking first, then the
// departure counter) -> Decline Bob (booking only) -> Departures shows Full -> New departure
// -> Settings heroNote -> #home shows it.
const DEP = 'mardi-himal-20261016';

export default async function (page, t) {
  const found = {};
  const waitFor = (sel, ms = 5000) => page.waitForSelector(sel, { timeout: ms, state: 'visible' }).then(() => true, () => false);
  const until = (fn, arg, ms = 5000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
  const text = (sel) => page.$eval(sel, (e) => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
  const dump = () => page.evaluate(() => window.__MBH_MOCK_STORE.dump());
  const item = (store, viewer, id) => ((store['bookings/' + viewer] || {}).items || []).find((x) => x.id === id) || {};
  const rowOf = (name) => page.evaluateHandle((n) => Array.from(document.querySelectorAll('.arow')).find((r) => {
    const tt = r.querySelector('.arow__title'); return tt && tt.textContent.startsWith(n);
  }) || null, name);
  const rowText = async (name) => { const h = await rowOf(name); const s = await h.evaluate((r) => (r ? r.textContent.replace(/\s+/g, ' ').trim() : '')); await h.dispose(); return s; };
  const clickIn = async (name, sel) => {
    const h = await rowOf(name);
    const btn = await h.evaluateHandle((r, s) => (r ? r.querySelector(s) : null), sel);
    const el = btn.asElement();
    if (el) await el.click(); else t.expect(false, 'button ' + sel + ' in row "' + name + '"');
    await h.dispose();
  };

  // ---- Gate: checking -> granted -> dashboard
  const sawGate = await page.$$eval('.gate--checking, .gate--granted', (e) => e.length) > 0;
  t.expect(sawGate || await waitFor('.gate--granted', 1000), 'gate shows checking/granted before the desk');
  t.expect(await waitFor('.admin__band', 4000), 'gate passes to the dashboard');
  t.expect(await page.$$eval('input[type="password"]', (e) => e.length) === 0, 'no password field anywhere');
  t.expect((await text('.admin__band .syncpill')) === 'Live' || await until(() => /Live/.test((document.querySelector('.syncpill') || {}).textContent || ''), null, 3000), 'SyncPill reads Live');
  t.expect(await page.$$eval('#app img', (e) => e.length) === 0, 'no images on admin routes');

  // ---- Inbox: one departure header over Alice (2) and Bob (3)
  t.expect(await waitFor('.arow', 5000), 'Inbox rows render');
  const inbox = await page.$$eval('.admin__section:first-child .admin__group, .admin__section:first-child .arow .arow__title', (els) => els.map((e) => (e.classList.contains('admin__group') ? 'H:' : 'R:') + e.textContent.replace(/\s+/g, ' ').trim()));
  found.inbox = inbox;
  t.expect(inbox.length === 3 && inbox[0] === 'H:Mardi Himal · Fri 16 Oct' && inbox[1].startsWith('R:Alice Verhoeven · 2 people') && inbox[2].startsWith('R:Bob Tanaka · 3 people'),
    'Inbox: header "Mardi Himal · Fri 16 Oct" then Alice (2 people), Bob (3 people)');
  const badge = await text('.admin-tabs__badge');
  t.expect(badge === '2', 'Inbox badge equals the requested count (2)');
  const aliceLine = await page.evaluate(() => { const r = Array.from(document.querySelectorAll('.arow')).find((x) => /^Alice/.test(x.textContent.trim())); return r ? r.querySelector('.arow__line').textContent : ''; });
  const bobLine = await page.evaluate(() => { const r = Array.from(document.querySelectorAll('.arow')).find((x) => /^Bob/.test(x.textContent.trim())); const l = r && r.querySelector('.arow__line'); return l ? [l.textContent, l.classList.contains('arow__line--warn')] : ['', false]; });
  t.expect(aliceLine === '6 of 8 booked · confirming leaves 0', 'Alice consequence "6 of 8 booked · confirming leaves 0" (got "' + aliceLine + '")');
  t.expect(bobLine[0] === 'Would overbook by 1' && bobLine[1], 'Bob consequence is amber "Would overbook by 1" (got "' + bobLine[0] + '")');
  await t.shot('inbox');

  // ---- Confirm Alice: booking item first, then departures/{id}
  const before = await dump();
  await clickIn('Alice Verhoeven', '[data-act="confirm"]');
  const confirmed = await until(() => {
    const s = window.__MBH_MOCK_STORE.dump();
    const a = (s['bookings/u_alice'].items || []).find((x) => x.id === 'b1alice01');
    const d = s['departures/mardi-himal-20261016'];
    return a && a.status === 'confirmed' && d.spotsLeft === 0 && d.status === 'full';
  }, null, 6000);
  const s1 = await dump();
  const alice = item(s1, 'u_alice', 'b1alice01');
  const dep1 = s1['departures/' + DEP];
  found.afterConfirm = { alice, dep: dep1 };
  t.expect(confirmed, 'Confirm completed');
  t.expect(alice.status === 'confirmed' && alice.confirmedPax === 2 && alice.updatedAt > alice.createdAt, 'Alice item: status confirmed, confirmedPax 2, updatedAt bumped');
  t.expect(item(s1, 'u_alice', 'b1alice02').status === 'confirmed', "Alice's other booking untouched");
  t.expect(dep1.spotsLeft === 0 && dep1.status === 'full' && dep1.updatedAt > before['departures/' + DEP].updatedAt, 'departure spotsLeft 0, status full, updatedAt bumped');
  t.expect(dep1.capacity === 8 && dep1.manualPax === 6 && dep1.price === 175, 'departure capacity/manualPax/price unchanged');
  t.expect(alice.updatedAt <= dep1.updatedAt, 'booking item written before the departure counter (item updatedAt ≤ departure updatedAt)');
  t.expect(await until(() => { const r = Array.from(document.querySelectorAll('.arow')).find((x) => /^Alice/.test(x.textContent.trim())); return r && /Confirmed/.test(r.querySelector('.arow__title').textContent) && !r.classList.contains('is-pending'); }, null, 4000),
    'Alice row echoes Confirmed and leaves the pending state');
  t.expect(await until(() => (document.querySelector('.admin-tabs__badge') || {}).textContent === '1', null, 3000), 'Inbox badge drops to 1');
  const bobAfter = await page.evaluate(() => { const r = Array.from(document.querySelectorAll('.arow')).find((x) => /^Bob/.test(x.textContent.trim())); const l = r && r.querySelector('.arow__line'); return l ? l.textContent : ''; });
  t.expect(bobAfter === 'Would overbook by 3', 'Bob consequence now "Would overbook by 3"');
  await t.shot('confirmed');

  // ---- Decline Bob: InlineConfirm, booking doc only
  await clickIn('Bob Tanaka', '[data-act="decline"]');
  t.expect(await waitFor('.arow .inline-confirm', 2000), 'Decline asks inline');
  t.expect((await text('.arow .inline-confirm__q')) === 'Decline this request?', 'inline question "Decline this request?"');
  await page.click('.arow .inline-confirm__yes');
  const declined = await until(() => ((window.__MBH_MOCK_STORE.dump()['bookings/u_bob'].items || [])[0] || {}).status === 'cancelled', null, 5000);
  const s2 = await dump();
  t.expect(declined && item(s2, 'u_bob', 'b1bob0001').status === 'cancelled', 'Bob item status cancelled');
  t.expect(JSON.stringify(s2['departures/' + DEP]) === JSON.stringify(dep1), 'departure unchanged by the decline');
  t.expect(await until(() => !document.querySelector('.admin-tabs__badge'), null, 3000), 'Inbox badge cleared (no requests left)');
  await t.shot('declined');

  // ---- Departures: the row is Full
  await page.evaluate(() => { location.hash = '#admin-departures'; });
  t.expect(await waitFor('.arow [data-act="edit"]', 5000), '#admin-departures lists departures');
  const depRow = await rowText('Mardi Himal · Fri 16 Oct');
  t.expect(/Full/.test(depRow) && /8\/8 booked/.test(depRow) && /0 requested/.test(depRow), 'Mardi Himal Fri 16 Oct row shows Full · 8/8 booked · 0 requested');
  t.expect(!/Counter drift/.test(depRow), 'no drift after Confirm (counter matches bookings)');
  await t.shot('departures');

  // ---- New departure: Poon Hill on 2026-12-05
  await page.click('[data-act="new"]');
  t.expect(await waitFor('.sheet.is-in .dep-form', 3000), 'New departure sheet opens');
  await page.click('.trekpick__tile[data-trek="poon-hill"]');
  await page.fill('#df-start', '2026-12-05');
  await t.sleep(100);
  const preview = await text('.dep-form__preview');
  t.expect(preview === 'Ends Tue 8 Dec · id poon-hill-20261205', 'preview "Ends Tue 8 Dec · id poon-hill-20261205" (got "' + preview + '")');
  const form = await page.evaluate(() => ({ days: document.querySelector('#df-days').value, price: document.querySelector('#df-price').value, cap: document.querySelector('[data-out="capacity"]').textContent, manual: document.querySelector('[data-out="manualPax"]').textContent }));
  t.expect(form.days === '4' && form.price === '165' && form.cap === '8' && form.manual === '0', 'prefilled: 4 days, $165 (8-pax tier), capacity 8, manualPax 0');
  await page.click('[data-df="step"][data-name="manualPax"][data-delta="1"]');
  await page.click('.sheet [data-df="save"]');
  const saved = await until(() => !!window.__MBH_MOCK_STORE.dump()['departures/poon-hill-20261205'], null, 5000);
  const nd = (await dump())['departures/poon-hill-20261205'] || {};
  found.newDeparture = nd;
  t.expect(saved, 'departures/poon-hill-20261205 created');
  t.expect(nd.trekId === 'poon-hill' && nd.start === '2026-12-05' && nd.days === 4 && nd.capacity === 8 && nd.manualPax === 1 && nd.price === 165 && nd.status === 'open' && nd.note === '',
    'new departure fields: poon-hill, 2026-12-05, 4 days, cap 8, manualPax 1, $165, open');
  t.expect(nd.spotsLeft === nd.capacity - nd.manualPax, 'spotsLeft = capacity − manualPax (' + nd.spotsLeft + ')');
  t.expect(typeof nd.createdAt === 'number' && nd.createdAt === nd.updatedAt, 'createdAt/updatedAt set');
  t.expect(await until(() => !document.querySelector('#sheet-root .sheet'), null, 3000), 'sheet closes after Save');
  t.expect(await until(() => Array.from(document.querySelectorAll('.arow__title')).some((e) => /^Ghorepani Poon Hill · Sat 5 Dec/.test(e.textContent)), null, 3000), 'new departure appears in the list');
  await t.shot('new-departure');

  // ---- Settings: heroNote
  await page.evaluate(() => { location.hash = '#admin-settings'; });
  t.expect(await waitFor('.settings-form', 5000), '#admin-settings form renders');
  const note = 'Back from the Manaslu circuit on 20 Oct, replies may be slow until then.';
  await page.fill('#as-note', note);
  await page.click('.settings-form [data-admin="save"]');
  const settingsSaved = await until((n) => (window.__MBH_MOCK_STORE.dump()['settings/site'] || {}).heroNote === n, note, 5000);
  const st = (await dump())['settings/site'] || {};
  found.settings = st;
  t.expect(settingsSaved, 'settings/site.heroNote saved');
  t.expect(st.whatsapp === '9779851353347' && st.email === 'magicbeyondhimalaya@gmail.com' && typeof st.heroNoteSetAt === 'number' && st.heroNoteUntil === null,
    'settings keep whatsapp/email, set heroNoteSetAt, heroNoteUntil null');
  await t.shot('settings');

  await page.evaluate(() => { location.hash = '#home'; });
  t.expect(await until((n) => { const e = document.querySelector('.hero__note--live'); return e && e.textContent.trim() === n; }, note, 4000), '#home shows the live hero note');
  t.expect(await page.$$eval('#tabbar .tabbar__tab', (e) => e.length) === 4 && !(await page.$eval('#tabbar', (e) => e.classList.contains('admin-tabs'))), 'public tabs restored on #home');
  t.expect(!(await page.$eval('#topbar', (e) => e.classList.contains('topbar--admin'))), 'topbar leaves admin mode');
  await t.shot('home-note');
  return found;
}

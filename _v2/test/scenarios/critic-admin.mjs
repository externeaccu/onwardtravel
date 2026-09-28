// Completeness probe of admin paths nobody else exercised.
//   node test/run.mjs --role owner --width 390 --route '#admin' --seed test/seed.json --scenario test/scenarios/critic-admin.mjs
// Adds (inside the page) a departure under way today, a stale hero note, and a booking whose
// departure was deleted; then: settings nudge + preset + save -> home, missing-departure detail
// with the orphan (Cancel only), Escape on the new-departure sheet.
export default async function (page, t) {
  const go = async (h, ms = 1000) => { await page.evaluate((x) => { location.hash = x; }, h); await t.sleep(ms); };
  const text = (sel = '#app') => page.evaluate((s) => (document.querySelector(s) || {}).innerText || '', sel);
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const now = new Date();
  const start = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2));
  const staleUntil = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3));
  await page.evaluate(({ start, staleUntil }) => {
    const S = window.__MBH_MOCK_STORE;
    S.set('departures/poon-hill-' + start.replace(/-/g, ''), { trekId: 'poon-hill', start, days: 4, capacity: 8, spotsLeft: 8, price: 165, status: 'full', note: '', createdAt: 1, updatedAt: 1 });
    const s = S.dump()['settings/site']; s.heroNote = 'Back in Pokhara soon'; s.heroNoteSetAt = Date.now() - 864e5 * 9; s.heroNoteUntil = staleUntil; S.set('settings/site', s);
    S.set('bookings/u_carol', { items: [{ id: 'b1carol01', departureId: 'langtang-20261212', trekId: 'langtang', start: '2026-12-12', name: 'Carol', email: 'c@example.com', whatsapp: '4912345678', pax: 2, note: '', status: 'requested', createdAt: 1790600000000, updatedAt: 1790600000000 }] });
  }, { start, staleUntil });

  // ---- settings: nudge, preset, save, home
  await go('#admin-settings', 1500);
  let s = await text();
  t.expect(/This note has been up past/.test(s), 'stale hero note nudge shows');
  const preset = await page.$eval('.settings-form__preset', (b) => ({ dis: b.disabled, help: b.nextElementSibling.textContent }));
  t.log(JSON.stringify(preset));
  t.expect(!preset.dis && /Fills: I'm guiding Ghorepani|Fills: I'm guiding .*Poon Hill/.test(preset.help), 'preset enabled while a departure is under way');
  await page.click('.settings-form__preset');
  await t.sleep(100);
  const note = await page.$eval('#as-note', (e) => e.value);
  t.expect(/^I'm guiding .* until .*, replies may be slow$/.test(note), 'preset fills the note: ' + note);
  await page.click('[data-admin="save"]');
  await t.sleep(700);
  const stored = await page.evaluate(() => window.__MBH_MOCK_STORE.dump()['settings/site']);
  t.log(JSON.stringify(stored));
  t.expect(stored.heroNote === note && /^\d{4}-\d{2}-\d{2}$/.test(stored.heroNoteUntil) && stored.heroNoteUntil >= start, 'save stores heroNote + heroNoteUntil');
  t.expect(!/This note has been up past/.test(await text()), 'nudge disappears after the preset replaced the stale note');
  await t.shot('settings-preset');
  await go('#home', 900);
  t.expect((await text()).includes(note), 'home shows the preset note');

  // ---- missing departure detail with orphan
  await go('#admin-departure-langtang-20261212', 1500);
  s = await text();
  t.expect(/This departure no longer exists/.test(s), 'missing departure: empty state');
  const acts = await page.$$eval('.arow', (rows) => rows.map((r) => Array.from(r.querySelectorAll('.arow__actions button')).map((b) => b.textContent.trim())));
  t.log(JSON.stringify(acts));
  t.expect(acts.length === 1 && acts[0].every((a) => /Cancel|Decline|WhatsApp|Copy/.test(a)) && !acts[0].some((a) => /^Confirm/.test(a)), 'orphan row offers Cancel only');
  await t.shot('missing-dep');

  // ---- sheet keyboard in admin
  await go('#admin-departures', 1200);
  const newBtn = await page.$('[data-act="new"]');
  if (newBtn) {
    await newBtn.click();
    await t.sleep(400);
    const inside = await page.evaluate(() => !!document.activeElement.closest('.sheet'));
    t.expect(inside, 'new-departure sheet takes focus');
    await page.keyboard.press('Escape');
    await t.sleep(400);
    t.expect(!(await page.$('.sheet')), 'Escape closes the new-departure sheet');
  } else t.expect(false, 'found New departure button');
  return { ok: true };
}

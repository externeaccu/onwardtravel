// Run: node test/run.mjs --role owner --width 390 --route '#admin' --seed test/seed.json --scenario test/scenarios/admin-edge.mjs
// admin.js edge cases: HTML escaping of hostile booking/departure strings, the claude.ai caption,
// an orphaned departure (cancel only) and the heroNote "guiding until" preset.
const waitDash = async (page, t) => { for (let i = 0; i < 30; i++) { if (await page.$('.admin__band')) return; await t.sleep(100); } };

export default async function (page, t) {
  await waitDash(page, t);
  // Inject docs at runtime (dates relative to today, so no extra seed file is needed).
  await page.evaluate(() => {
    const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const start = new Date(); start.setDate(start.getDate() - 2);
    const set = window.__MBH_MOCK_STORE.set;
    set('departures/poon-hill-running', { trekId: 'poon-hill', start: iso(start), days: 4, capacity: 8, manualPax: 2, spotsLeft: 6, price: 165, status: 'open', note: '<b>bold</b> & "quoted"', createdAt: 1, updatedAt: 1 });
    set('bookings/u_test_1', { items: [
      { id: 'b"><img src=x onerror=window.__pwned=1>', departureId: 'abc-poon-20261024', trekId: 'abc-poon', start: '2026-10-24', name: '<img src=x onerror=window.__pwned=2>', email: 'x"@y.z', whatsapp: '+44 7700 900123', pax: 1, note: '</div><script>window.__pwned=3</script>', status: 'requested', createdAt: 1790520000000, updatedAt: 1790520000000 },
      { id: 'bpat2', departureId: 'poon-hill-20261010', trekId: 'poon-hill', start: '2026-10-10', name: 'Pat R.', email: 'pat@example.com', whatsapp: '447700900123', pax: 2, note: '', status: 'requested', createdAt: 1790530000000, updatedAt: 1790530000000 },
      { id: 'bpat3', departureId: 'gone-20261201', trekId: 'langtang', start: '2026-12-01', name: 'Pat R.', email: 'pat@example.com', whatsapp: '447700900123', pax: 1, note: '', status: 'requested', createdAt: 1790540000000, updatedAt: 1790540000000 }
    ] });
  });
  await t.sleep(600);
  const r = await page.evaluate(() => ({
    pwned: window.__pwned || 0,
    imgs: document.querySelectorAll('#app img, #app script').length,
    captions: Array.from(document.querySelectorAll('.arow__caption')).map((c) => c.textContent),
    titles: Array.from(document.querySelectorAll('[data-admin="screen"] .arow__title')).map((h) => h.textContent),
    lines: Array.from(document.querySelectorAll('.arow__line')).map((h) => h.textContent)
  }));
  t.log(JSON.stringify(r, null, 1));
  t.expect(r.pwned === 0 && r.imgs === 0, 'no injected markup executed or rendered');
  t.expect(r.titles.some((x) => x.startsWith('<img src=x')), 'hostile name shown as text');
  t.expect(r.captions.includes('claude.ai: Patrick'), 'claude.ai caption when typed name differs');
  t.expect(r.lines.includes('Departure no longer exists — cancel only'), 'orphan consequence line');

  const row = page.locator('.arow', { hasText: '<img src=x' }).first();
  await row.locator('[data-act="confirm"]').click();
  await t.sleep(500);
  const d = await page.evaluate(() => window.__MBH_MOCK_STORE.dump());
  t.expect(d['bookings/u_test_1'].items[0].status === 'confirmed', 'item with a hostile id still confirms');

  await page.evaluate(() => { location.hash = '#admin-settings'; });
  await t.sleep(400);
  const st = await page.evaluate(() => ({ disabled: document.querySelector('.settings-form__preset').disabled, help: document.querySelector('[data-admin="preset-help"]').textContent }));
  t.log(JSON.stringify(st));
  t.expect(!st.disabled && /^Fills: I'm guiding Ghorepani Poon Hill until /.test(st.help), 'preset enabled while a departure is under way');
  await page.click('.settings-form__preset');
  await page.click('[data-admin="save"]');
  await t.sleep(400);
  const s = (await page.evaluate(() => window.__MBH_MOCK_STORE.dump()))['settings/site'];
  t.log(JSON.stringify(s));
  t.expect(/^I'm guiding Ghorepani Poon Hill until .+, replies may be slow$/.test(s.heroNote) && /^\d{4}-\d{2}-\d{2}$/.test(s.heroNoteUntil), 'preset saved with heroNoteUntil');

  await page.evaluate(() => { location.hash = '#admin-departure-poon-hill-running'; });
  await t.sleep(400);
  const kv = await page.evaluate(() => Array.from(document.querySelectorAll('.kv__v')).map((x) => x.textContent));
  t.expect(kv.includes('<b>bold</b> & "quoted"'), 'departure note escaped');

  await page.evaluate(() => { location.hash = '#admin-departure-gone-20261201'; });
  await t.sleep(400);
  const gone = await page.evaluate(() => ({ text: document.querySelector('[data-admin="screen"]').innerText, acts: Array.from(document.querySelectorAll('[data-admin="screen"] [data-act]')).map((b) => b.getAttribute('data-act')) }));
  t.log(JSON.stringify(gone.acts));
  t.expect(/This departure no longer exists/.test(gone.text) && gone.acts.includes('decline') && !gone.acts.includes('confirm'), 'orphan page: cancel only');
  await t.shot('orphan');
  return { ok: true };
}

// Honesty checks on the public side.
//   node test/run.mjs --role none --width 390 --route '#home' --seed test/seed.json --scenario test/scenarios/fix-public-honesty.mjs
//   node test/run.mjs --role view --width 390 --route '#home' --seed test/seed.json --scenario test/scenarios/fix-public-honesty.mjs
// role none: nothing is read, so a shared departure link never claims the date is gone and trek
//            pages never claim "no fixed dates"; itinerary rest tags; EBC night 11 on the map.
// role view: My trips doesn't promise that WhatsApp-only requests show up; spots never exceed capacity.
export default async function (page, t) {
  const go = async (h, ms = 1200) => { await page.evaluate((x) => { location.hash = x; }, h); await t.sleep(ms); };
  const text = () => page.evaluate(() => document.querySelector('#app').innerText);
  if (t.role === 'none') {
    await go('#departure-mardi-himal-20261016', 4800);          // past the 4s live-data timeout
    let s = await text();
    t.expect(!/no longer listed/i.test(s), 'db null: departure link does not say "no longer listed"');
    t.expect(/Mardi Himal/.test(s) && /Fri 16 Oct → Tue 20 Oct/.test(s) && /can’t be checked/.test(s), 'provisional head: trek, dates, availability note');
    t.expect(await page.$('a.btn--primary[href="#book-mardi-himal-20261016"]') !== null, 'Request a spot links to the booking sheet');
    await go('#departure-nonsense-trek', 600);
    s = await text();
    t.expect(/no longer listed/i.test(s), 'an id that parses to no trek still says "no longer listed"');
    await go('#trek-mardi-himal', 4800);
    s = await text();
    t.expect(!/No fixed dates yet/.test(s) && /Dates are set by Sandip and posted here/.test(s), 'trek page: neutral dates copy when nothing was read');
    await go('#trek-annapurna-tilicho');
    const facts = await page.evaluate(() => [5, 7, 8].map((d) => document.querySelector('.day[data-day="' + d + '"] .day__facts').textContent));
    t.log(JSON.stringify(facts));
    t.expect(/rest day$/.test(facts[0]) && !/rest · rest/.test(facts[0]), 'day 5: "rest day" once');
    t.expect(!/\brest\b/.test(facts[2]) && /±0 m · 5 hrs/.test(facts[2]), 'day 8 (walking, same height): no "rest", shows ±0 m');
    await go('#trek-ebc-gokyo');
    await page.click('.day[data-day="11"] .day__head');
    await t.sleep(200);
    const act = await page.$$eval('.rmap__marker.is-active', (els) => els.map((e) => e.getAttribute('aria-label')));
    t.expect(act.length === 1 && /^Day 11, Everest Base Camp, 5,365 m/.test(act[0]), 'EBC day 11 highlights Base Camp, not a second night at Lobuche (' + act.join() + ')');
    const lob = await page.$$eval('.rmap__marker', (els) => els.map((e) => e.getAttribute('aria-label')).filter((l) => /Lobuche/.test(l)));
    t.expect(lob.length === 1 && /^Day 10, Lobuche/.test(lob[0]), 'Lobuche is night 10 only');
  } else {
    await go('#my-trips', 1500);
    const s = await text();
    t.expect(!/it will show up here/.test(s) && /aren’t saved here/.test(s), 'view role: My trips says requests go to WhatsApp and are not saved');
    await page.evaluate(() => { const k = 'departures/abc-poon-20261024'; const d = window.__MBH_MOCK_STORE.dump()[k]; d.spotsLeft = 46; window.__MBH_MOCK_STORE.set(k, d); });
    await go('#agenda', 800);
    const pills = await page.$$eval('.spots', (els) => els.map((e) => e.textContent));
    t.log(JSON.stringify(pills));
    t.expect(!pills.some((p) => /46/.test(p)) && pills.includes('8 of 8 spots left'), 'public spots never exceed capacity');
  }
  return { ok: true };
}

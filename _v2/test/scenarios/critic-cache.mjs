// Cached-dates path after db goes null (spec checklist "Cache").
//   node test/run.mjs --role interact --width 390 --route '#agenda' --seed test/seed.json --scenario test/scenarios/critic-cache.mjs
// 1) one live snapshot writes mbh.cache.departures; 2) the page reloads with use('db') -> null
// (claude.use is wrapped by an init script); every public route then renders the cached rows
// with a stale stamp, never "no longer listed" / "no fixed dates", and booking falls back to WhatsApp.
export default async function (page, t) {
  const go = async (h, ms = 900) => { await page.evaluate((x) => { location.hash = x; }, h); await t.sleep(ms); };
  const text = () => page.evaluate(() => document.querySelector('#app').innerText);
  await t.sleep(600);
  const cache = await page.evaluate(() => JSON.parse(localStorage.getItem('mbh.cache.departures') || 'null'));
  t.expect(cache && cache.docs && cache.docs.length >= 8, 'live snapshot cached');
  // age the cache 3 hours
  await page.evaluate(() => { const c = JSON.parse(localStorage.getItem('mbh.cache.departures')); c.at = Date.now() - 3 * 3600e3; localStorage.setItem('mbh.cache.departures', JSON.stringify(c)); });
  await page.addInitScript(() => {
    const orig = window.claude;
    window.claude = { use: (n) => n === 'db' ? new Promise((r) => setTimeout(() => r(null), 60)) : orig.use(n) };
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await t.sleep(900);
  let s = await text();
  t.expect(/Mardi Himal/.test(s) && /cached 3 h ago/.test(s), 'agenda: cached rows + "cached 3 h ago"');
  await go('#home');
  s = await text();
  t.expect(/cached 3 h ago/.test(s) && (await page.$$('.dep')).length > 0, 'home: cached rows with stale note');
  await go('#trek-mardi-himal');
  s = await text();
  t.expect(!/No fixed dates yet/.test(s) && (await page.$$('[data-live="departures"] .dep')).length === 2 && /cached/.test(s), 'trek page: cached rows');
  await go('#departure-mardi-himal-20261016');
  s = await text();
  t.expect(!/no longer listed/i.test(s) && /2 of 8 spots left|2 spots left/.test(s), 'departure: cached spots, not "no longer listed"');
  t.log(s.slice(0, 400).replace(/\n/g, ' | '));
  await go('#book-mardi-himal-20261016');
  const lbl = await page.$eval('.book__submit', (b) => b.textContent);
  t.expect(lbl === 'Send request on WhatsApp', 'booking falls back to WhatsApp without db: ' + lbl);
  await page.keyboard.press('Escape'); await t.sleep(400);
  await go('#departure-langtang-20261212');
  t.expect(/no longer listed/i.test(await text()), 'an id missing from the cache says "no longer listed"');
  await go('#my-trips');
  const mt = await text();
  t.expect(/can’t be read in this view/.test(mt) && !/not signed in/.test(mt), 'my trips, signed in without db: does not claim "not signed in"');
  return { ok: true };
}

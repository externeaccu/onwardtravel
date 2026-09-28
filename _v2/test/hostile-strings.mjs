// Hostile/long database strings on every route: nothing may be injected as markup, and long
// single-word values (emails, names, notes) must not cause horizontal overflow at 390px.
//   node test/hostile-strings.mjs      (exit 0 = clean)
import { runScenario, startServer } from './harness.mjs';
import { readFileSync } from 'node:fs';
const seed = JSON.parse(readFileSync(new URL('./seed.json', import.meta.url), 'utf8'));
const P = (tag) => `"'><img src=x data-xss="${tag}" onerror="window.__xss=(window.__xss||[]).concat('${tag}')"><b data-xss="${tag}">`;
seed['departures/mardi-himal-20261016'].note = P('depnote');
seed['departures/poon-hill-20261010'].price = P('price');
seed['departures/abc-poon-20261024'].start = '2026-10-24' ;
seed['departures/x-evil'] = { trekId: P('trekid'), start: '2026-10-30', days: P('days'), capacity: 8, spotsLeft: 8, price: 100, status: 'open', note: P('evilnote'), manualPax: 0, createdAt: 1, updatedAt: 1 };
seed['settings/site'] = { whatsapp: P('wa'), email: P('email'), heroNote: P('hero'), heroNoteSetAt: 1, heroNoteUntil: '2020-01-01', updatedAt: 1 };
const evilItem = (id) => ({ id: P('itemid') , departureId: 'mardi-himal-20261016', trekId: 'mardi-himal', start: '2026-10-16', name: P('name'), email: P('bemail'), whatsapp: P('bwa'), pax: 1, note: P('bnote'), status: 'requested', createdAt: 1790500000000, updatedAt: 1790500000000 });
seed['bookings/u_evil'] = { items: [evilItem('e1'), Object.assign(evilItem('e2'), { status: 'confirmed', departureId: P('depid'), trekId: P('trek2') })] };
seed['bookings/u_test_1'] = { items: [evilItem('m1')] };
const server = await startServer();
let failures = 0;
const routes = ['#home', '#agenda', '#treks', '#trek-mardi-himal', '#departure-mardi-himal-20261016', '#book-mardi-himal-20261016', '#my-trips', '#about', '#admin', '#admin-departures', '#admin-bookings', '#admin-settings', '#admin-departure-mardi-himal-20261016', '#admin-departure-x-evil', '#departure-x-evil'];
for (const role of ['owner', 'interact']) for (const r of routes) {
  const res = await runScenario({ role, width: 390, route: r, mock: { seed }, server, scenario: { default: async (page, t) => {
    await t.sleep(1500);
    // expand admin rows / all filter to render everything
    await page.evaluate(() => { document.querySelectorAll('[data-act="expand"]').forEach((b) => b.click()); const all = document.querySelector('.chip[data-val="all"]'); if (all) all.click(); });
    await t.sleep(300);
    return page.evaluate(() => ({ xss: window.__xss || [], injected: Array.from(document.querySelectorAll('[data-xss]')).map((e) => e.tagName + ':' + e.getAttribute('data-xss')) }));
  } } });
  const bad = (res.result && (res.result.xss.length || res.result.injected.length)) || res.errors.length || res.thrown;
  if (bad) failures++;
  console.log((bad ? 'FAIL ' : 'ok   ') + role + ' ' + r + ' ' + JSON.stringify(res.result) + (res.errors.length ? ' ' + res.errors.join(' | ') : '') + (res.thrown ? ' THREW ' + res.thrown.split('\n')[0] : ''));
}
server.stop();
console.log(failures ? failures + ' route(s) failed' : 'hostile strings: clean');
process.exit(failures ? 1 : 0);

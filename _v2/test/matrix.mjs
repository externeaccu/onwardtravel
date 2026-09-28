// Integration matrix: every route × role × width with no scenario beyond a settle wait.
// Collects console/page/HTTP errors, horizontal overflow, and classes emitted by JS that
// styles.css never mentions (JS/CSS contract drift). Full-page screenshots go to --shots.
//
//   node test/matrix.mjs [--shots test/shots/matrix] [--only home,admin] [--widths 390,1440] [--settle 1500]
import { runScenario, startServer } from './harness.mjs';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']);
  return acc;
}, []));
const seed = JSON.parse(readFileSync(new URL('./seed.json', import.meta.url), 'utf8'));
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const cssClasses = new Set((css.match(/\.[a-zA-Z_][\w-]*/g) || []).map((c) => c.slice(1)));

const ROUTES = ['#home', '#treks', '#trek-mardi-himal', '#trek-ebc-gokyo', '#agenda', '#departure-mardi-himal-20261016',
  '#book-mardi-himal-20261016', '#my-trips', '#about', '#admin', '#admin-departures', '#admin-bookings', '#admin-settings'];
const ROLES = [['none', null], ['none', seed], ['interact', seed], ['owner', seed]];
const widths = (args.widths || '390,1440').split(',').map(Number);
const only = args.only ? args.only.split(',') : null;
const settle = Number(args.settle || 1500);
const shots = args.shots;
if (shots) mkdirSync(shots, { recursive: true });

const jobs = [];
for (const [role, sd] of ROLES) for (const w of widths) for (const r of ROUTES) {
  if (only && !only.some((o) => r.slice(1).startsWith(o))) continue;
  jobs.push({ role, seed: sd, width: w, route: r });
}

const scenario = {
  default: async (page, t) => {
    await t.sleep(settle);
    const info = await page.evaluate(() => {
      const cls = new Set();
      document.querySelectorAll('[class]').forEach((el) => {
        const c = el.getAttribute('class');
        if (typeof c === 'string') c.split(/\s+/).filter(Boolean).forEach((x) => cls.add(x));
      });
      // elements wider than the viewport (a hint for overflow even when clipped)
      const vw = document.documentElement.clientWidth;
      const wide = [];
      document.querySelectorAll('#app *, #tabbar *, #ctabar *, #topbar *').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > vw + 1 || r.left < -1)) {
          const st = getComputedStyle(el);
          let p = el.parentElement, clipped = false;
          while (p) { const ps = getComputedStyle(p); if (/(auto|scroll|hidden)/.test(ps.overflowX)) { clipped = true; break; } p = p.parentElement; }
          if (!clipped && st.position !== 'fixed' && !el.closest('.sr-only')) wide.push((el.className && el.className.baseVal === undefined ? el.className : el.tagName) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
        }
      });
      return { classes: Array.from(cls), wide: wide.slice(0, 6), title: document.title, h1: (document.querySelector('.view__title') || {}).textContent || '' };
    });
    const unknown = info.classes.filter((c) => !cssClasses.has(c));
    if (shots) {
      // walk the page so lazy images load, then return to the top for the capture
      await page.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } window.scrollTo(0, 0); });
      await t.sleep(250);
    }
    if (shots) await page.screenshot({ path: path.join(shots, `${t.role}${t.seeded ? '-seed' : ''}-${t.width}-${t.route.slice(1)}.png`), fullPage: true });
    return { unknown, wide: info.wide, title: info.title, h1: info.h1.trim().slice(0, 60) };
  },
};

const server = await startServer();
const conc = Number(args.conc || 6);
let idx = 0, bad = 0;
const unknownAll = new Map();
const results = [];
async function worker() {
  while (idx < jobs.length) {
    const j = jobs[idx++];
    const sc = { default: (page, t) => { t.route = j.route; t.seeded = !!j.seed; return scenario.default(page, t); } };
    const r = await runScenario({ role: j.role, width: j.width, route: j.route, scenario: sc, mock: j.seed ? { seed: j.seed } : {}, server, name: j.role });
    results.push([j, r]);
  }
}
await Promise.all(Array.from({ length: conc }, worker));
server.stop();
results.sort((a, b) => jobs.indexOf(a[0]) - jobs.indexOf(b[0]));
for (const [j, r] of results) {
  const tag = `${j.role}${j.seed ? '+seed' : ''} ${j.width} ${j.route}`;
  const res = r.result || {};
  (res.unknown || []).forEach((c) => { if (!unknownAll.has(c)) unknownAll.set(c, tag); });
  const problems = [...r.errors];
  if (r.thrown) problems.push('THREW ' + r.thrown.split('\n')[0]);
  if (res.wide && res.wide.length) problems.push('wide: ' + res.wide.join(' | '));
  if (problems.length) bad++;
  console.log((problems.length ? 'FAIL ' : 'ok   ') + tag + '  [' + (res.title || '') + ' / ' + (res.h1 || '') + ']' + (problems.length ? '\n     ' + problems.join('\n     ') : ''));
}
console.log('\nClasses in DOM not found in styles.css:', unknownAll.size ? '' : 'none');
for (const [c, where] of unknownAll) console.log('  .' + c + '  (first seen ' + where + ')');
console.log(`\n${jobs.length - bad}/${jobs.length} clean`);
process.exit(bad ? 1 : 0);

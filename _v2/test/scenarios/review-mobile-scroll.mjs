// Review: scroll each route viewport by viewport (realistic phone view: sticky header + fixed bars).
import path from 'node:path';
import { mkdirSync } from 'node:fs';
const ROUTES = ['#home','#treks','#trek-poon-hill','#trek-annapurna-tilicho','#trek-ebc-gokyo','#agenda','#departure-mardi-himal-20261016','#book-mardi-himal-20261016','#my-trips','#about','#admin','#admin-departures','#admin-departure-mardi-himal-20261016','#admin-bookings','#admin-settings'];
const DIR = 'test/shots/review-mobile/scroll';
export default async function (page, t) {
  mkdirSync(DIR, { recursive: true });
  const only = process.env.ROUTES ? process.env.ROUTES.split(',') : ROUTES;
  const themes = process.env.THEMES ? process.env.THEMES.split(',') : ['light'];
  const out = {};
  for (const theme of themes) {
    await page.evaluate((th) => localStorage.setItem('mbh.theme', JSON.stringify(th)), theme);
    for (const r of only) {
      await page.evaluate((h) => { location.hash = h; }, r);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.addStyleTag({content:'html{scroll-behavior:auto!important}'});
      await t.sleep(1200);
      const H = await page.evaluate(() => document.documentElement.scrollHeight);
      out[r + ':' + theme] = H;
      let i = 0;
      for (let y = 0; y < H; y += 700) {
        await page.evaluate((yy) => window.scrollTo(0, yy), y);
        await t.sleep(350);
        await page.screenshot({ path: path.join(DIR, r.slice(1) + '-' + theme + '-' + String(i++).padStart(2, '0') + '.png') });
        if (i > 12) break;
      }
      await page.evaluate(() => window.scrollTo(0, 1e6)); await t.sleep(350);
      await page.screenshot({ path: path.join(DIR, r.slice(1) + '-' + theme + '-zz-end.png') });
    }
  }
  return out;
}

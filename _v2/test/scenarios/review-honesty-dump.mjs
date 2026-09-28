// Review: dump visible text + photo alts/captions for every public route, and screenshot.
import { writeFileSync } from 'node:fs';
export default async function (page, t) {
  const routes = ['home','treks','agenda','about','my-trips','admin','trek-poon-hill','trek-mardi-himal','trek-langtang','trek-abc-poon','trek-annapurna-tilicho','trek-manaslu-circuit','trek-manaslu-tsum','trek-ebc-gokyo','departure-mardi-himal-20261016','book-mardi-himal-20261016','departure-annapurna-tilicho-20261101','admin-departures','admin-bookings','admin-settings'];
  const out = {};
  for (const r of routes) {
    await page.evaluate((h) => { location.hash = h; }, '#' + r);
    await t.sleep(r.startsWith('book') ? 900 : 4800);
    out[r] = await page.evaluate(() => {
      const txt = (document.querySelector('#app').innerText + '\n---SHEET---\n' + (document.querySelector('#sheet-root').innerText||'') + '\n---CTA---\n' + (document.querySelector('#ctabar').hidden ? '' : document.querySelector('#ctabar').innerText));
      const imgs = [...document.querySelectorAll('img')].map(i => ({src: i.getAttribute('src'), alt: i.alt, fig: (i.closest('figure') && i.closest('figure').innerText) || '', title: i.title}));
      const btns = [...document.querySelectorAll('button, a.btn, .btn')].map(b => b.innerText.trim()).filter(Boolean);
      const guides = [...document.querySelectorAll('.elev__guide, [class*="guide"]')].map(g => g.getAttribute('class') + ':' + (g.textContent||'').trim());
      const skel = document.querySelectorAll('#app .skel').length;
      return { txt, imgs, btns, guides, skel, sw: document.documentElement.scrollWidth };
    });
    await t.shot(r);
    await page.evaluate(() => { const s = document.querySelector('#sheet-root .sheet'); if (s) { const b = s.querySelector('[data-close], .sheet__close'); if (b) b.click(); } });
    await t.sleep(200);
  }
  writeFileSync(process.env.DUMP || '/tmp/dump.json', JSON.stringify(out, null, 1));
  return { n: Object.keys(out).length };
}

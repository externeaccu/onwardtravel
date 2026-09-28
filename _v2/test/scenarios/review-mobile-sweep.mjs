// Review sweep: every route, light + dark, viewport + full-page shots, plus layout diagnostics.
import path from 'node:path';
const ROUTES = ['#home','#treks','#trek-poon-hill','#trek-annapurna-tilicho','#trek-ebc-gokyo','#agenda','#departure-mardi-himal-20261016','#book-mardi-himal-20261016','#my-trips','#about','#admin','#admin-departures','#admin-departure-mardi-himal-20261016','#admin-bookings','#admin-settings'];
const DIR = 'test/shots/review-mobile';
export default async function (page, t) {
  const out = {};
  const only = process.env.ROUTES ? process.env.ROUTES.split(',') : ROUTES;
  const themes = process.env.THEMES ? process.env.THEMES.split(',') : ['light','dark'];
  for (const theme of themes) {
    await page.evaluate((th) => localStorage.setItem('mbh.theme', JSON.stringify(th)), theme);
    for (const r of only) {
      await page.evaluate((h) => { location.hash = h; }, r);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await t.sleep(1200);
      const name = r.slice(1) + '-' + theme;
      await page.evaluate(() => window.scrollTo(0, 0));
      await t.sleep(150);
      await page.screenshot({ path: path.join(DIR, name + '.png') });
      await page.screenshot({ path: path.join(DIR, name + '-full.png'), fullPage: true });
      if (theme === themes[0]) {
        const diag = await page.evaluate(() => {
          const vis = (e) => { const s = getComputedStyle(e); const b = e.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && b.width > 0 && b.height > 0; };
          const desc = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '') + ' "' + (e.textContent || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40) + '"';
          const small = [];
          document.querySelectorAll('a[href],button,input,select,textarea,summary,[role=button],[tabindex="0"],label').forEach((e) => {
            if (!vis(e)) return; if (e.closest('svg') && e.tagName !== 'a') {}
            if (e.tagName === 'LABEL' && !e.querySelector('input[type=checkbox],input[type=radio]')) return;
            if (e.tagName === 'INPUT' && (e.type === 'checkbox' || e.type === 'radio') && e.closest('label')) return;
            if (e.tagName === 'INPUT' && e.type === 'hidden') return;
            const b = e.getBoundingClientRect();
            if (b.width < 44 || b.height < 44) small.push(desc(e) + ' ' + Math.round(b.width) + 'x' + Math.round(b.height));
          });
          // SVG interactive
          document.querySelectorAll('svg [role=button], svg [tabindex]').forEach((e) => { const b = e.getBoundingClientRect(); if (b.width && (b.width < 44 || b.height < 44)) small.push('SVG ' + desc(e) + ' ' + Math.round(b.width) + 'x' + Math.round(b.height)); });
          const clipped = [];
          document.querySelectorAll('#app *').forEach((e) => {
            if (!vis(e) || e.closest('svg')) return; const s = getComputedStyle(e);
            if (e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0 && /hidden|clip/.test(s.overflowX) ) clipped.push(desc(e) + ' sw=' + e.scrollWidth + ' cw=' + e.clientWidth + ' to=' + s.textOverflow);
            const b = e.getBoundingClientRect(); if (b.right > innerWidth + 1 && !e.closest('[class*=strip],[class*=scroll],[class*=rail],[class*=chips]')) clipped.push('OFFRIGHT ' + desc(e) + ' right=' + Math.round(b.right));
          });
          const tb = document.querySelector('#tabbar'); const ct = document.querySelector('#ctabar');
          const bars = [tb, ct, document.querySelector('.admin-tabs'), document.querySelector('.admin__fab')].filter((x) => x && vis(x)).map((x) => ({ d: desc(x).slice(0, 60), top: Math.round(x.getBoundingClientRect().top), h: Math.round(x.getBoundingClientRect().height), pos: getComputedStyle(x).position }));
          const body = getComputedStyle(document.body);
          const app = document.getElementById('app');
          return { small: small.slice(0, 40), nsmall: small.length, clipped: clipped.slice(0, 20), bars, bodyPB: body.paddingBottom, appPB: getComputedStyle(app).paddingBottom, docH: document.documentElement.scrollHeight, h1: Array.from(document.querySelectorAll('h1,h2')).slice(0, 4).map((h) => h.textContent.trim().slice(0, 40)) };
        });
        // scroll to bottom: is last content hidden behind bars?
        const bottom = await page.evaluate(async () => {
          window.scrollTo(0, document.documentElement.scrollHeight); await new Promise((r) => setTimeout(r, 300));
          const bars = ['#tabbar', '#ctabar', '.admin-tabs'].map((s) => document.querySelector(s)).filter((x) => x && getComputedStyle(x).display !== 'none' && !x.hidden && x.getBoundingClientRect().height > 0);
          const barTop = Math.min(innerHeight, ...bars.filter((b) => getComputedStyle(b).position === 'fixed').map((b) => b.getBoundingClientRect().top));
          // deepest visible leaf content in #app
          let maxB = 0, who = '';
          document.querySelectorAll('#app *').forEach((e) => { if (e.children.length) return; const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden') return; const b = e.getBoundingClientRect(); if (b.height && b.bottom > maxB) { maxB = b.bottom; who = e.tagName + '.' + e.className + ' ' + (e.textContent || '').trim().slice(0, 30); } });
          return { barTop: Math.round(barTop), lastContentBottom: Math.round(maxB), who };
        });
        await page.screenshot({ path: path.join(DIR, name + '-bottom.png') });
        out[r] = { ...diag, bottom };
      }
    }
  }
  return out;
}

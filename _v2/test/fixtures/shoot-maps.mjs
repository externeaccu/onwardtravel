// Screenshot + behavioural checks for maps.js against test/fixtures/map-preview.html.
//   node test/fixtures/shoot-maps.mjs
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const URL = 'file://' + path.join(HERE, 'map-preview.html');
const SHOTS = path.join(HERE, '..', 'shots');
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const problems = [];

async function session(width, { theme = 'light', reduced = 'no-preference' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 720 ? 844 : 900 }, deviceScaleFactor: 1, reducedMotion: reduced, colorScheme: theme });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  // Google Fonts cannot load over file:// through the sandbox proxy; the page falls back to system fonts.
  page.on('console', m => { if (m.type() === 'error' && !/ERR_CERT_AUTHORITY_INVALID|fonts\.g/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(URL);
  await page.waitForTimeout(400);
  return { ctx, page, errors };
}

// Pairwise label-overlap check using real rendered bboxes (labels vs labels, labels vs markers).
const OVERLAP_CHECK = () => {
  const out = [];
  document.querySelectorAll('.rmap').forEach((rmap, mi) => {
    const svg = rmap.querySelector('.rmap__svg');
    const rects = [];
    svg.querySelectorAll('.rmap__label').forEach(t => { const b = t.getBBox(); rects.push({ kind: 'label', txt: t.textContent, x0: b.x, y0: b.y, x1: b.x + b.width, y1: b.y + b.height }); });
    svg.querySelectorAll('.rmap__dot, .rmap__tri, .rmap__via').forEach(m => { const b = m.getBBox(); rects.push({ kind: 'marker', txt: m.parentNode.getAttribute('aria-label'), x0: b.x, y0: b.y, x1: b.x + b.width, y1: b.y + b.height }); });
    const vb = svg.viewBox.baseVal;
    for (let i = 0; i < rects.length; i++) {
      const a = rects[i];
      if (a.kind === 'label' && (a.x0 < 0 || a.y0 < 0 || a.x1 > vb.width || a.y1 > vb.height)) out.push(`map#${mi} label outside svg: ${a.txt}`);
      for (let j = i + 1; j < rects.length; j++) {
        const b = rects[j];
        if (a.kind === 'marker' && b.kind === 'marker') continue;
        // labels share a line-box with their own elev second line: allow vertical touching by requiring real overlap > 1px
        const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
        if (ox > 1 && oy > 1) out.push(`map#${mi} overlap: [${a.kind}] ${a.txt} × [${b.kind}] ${b.txt} (${ox.toFixed(0)}×${oy.toFixed(0)})`);
      }
    }
  });
  return out;
};

for (const width of [390, 1440]) {
  const { ctx, page, errors } = await session(width);
  // scroll through so every IntersectionObserver fires, then back to top
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(2200);
  const status = await page.textContent('#fx-status');
  console.log(`[${width}] ${status}`);

  const visible = await page.evaluate(() => [...document.querySelectorAll('.rmap')].map(r => r.classList.contains('is-visible')));
  if (!visible.every(Boolean)) problems.push(`[${width}] not every .rmap got .is-visible: ${visible}`);

  const overlaps = await page.evaluate(OVERLAP_CHECK);
  overlaps.forEach(o => problems.push(`[${width}] ${o}`));

  const hscroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (hscroll) problems.push(`[${width}] horizontal scroll`);

  // --- highlightDay on the synthetic map (rest-day merge, drive leg) ---
  const hl = await page.evaluate(() => {
    const m = window.__fx.maps.long;
    const root = m.el;
    const q = s => root.querySelector(s);
    const res = {};
    m.highlightDay(4);                         // rest day → same marker as day 3
    res.activeAria4 = q('.rmap__marker.is-active')?.getAttribute('aria-label');
    res.ring2OnActive4 = !!q('.rmap__marker.is-active .rmap__ring2');
    res.dimCount = root.querySelectorAll('.rmap__marker.is-dim').length;
    res.done4 = q('.rmap__line--done').getAttribute('d');
    res.card4 = q('.rmap__daycard').hidden ? null : q('.rmap__daycard-title').textContent + ' | ' + q('.rmap__daycard-facts').textContent;
    res.profileActive4 = q('.elev__dot--active')?.getAttribute('cx');
    res.hair4 = q('.elev__hair').getAttribute('visibility');
    m.highlightDay(6);
    res.activeAria6 = q('.rmap__marker.is-active')?.getAttribute('aria-label');
    res.num6 = q('.rmap__marker.is-active .rmap__num')?.textContent;
    m.highlightDay(7);
    res.activeAria7 = q('.rmap__marker.is-active')?.getAttribute('aria-label');
    res.offset7 = (() => { const a = [...root.querySelectorAll('.rmap__marker')].filter(g => /Alpine Village/.test(g.getAttribute('aria-label'))); return a.map(g => g.querySelector('.rmap__dot').getAttribute('cx') + ',' + g.querySelector('.rmap__dot').getAttribute('cy')); })();
    m.highlightDay(8);
    res.done8HasDrive = q('.rmap__line--done').getAttribute('d');
    res.travelD = q('.rmap__line--travel').getAttribute('d');
    m.highlightDay(null);
    res.clearedActive = root.querySelectorAll('.rmap__marker.is-active, .rmap__marker.is-dim').length;
    res.clearedDone = q('.rmap__line--done').getAttribute('d');
    res.clearedCard = q('.rmap__daycard').hidden;
    res.clearedHair = q('.elev__hair').getAttribute('visibility');
    // static map: no interaction attrs, dated labels, no daycard/profile
    const s = window.__fx.maps.static.el;
    res.staticClass = s.className;
    res.staticTabindex = s.querySelectorAll('[tabindex],[role=button]').length;
    res.staticLabels = [...s.querySelectorAll('.rmap__label')].map(t => t.textContent);
    res.staticHasCard = !!s.querySelector('.rmap__daycard');
    res.staticHasProfile = !!s.querySelector('.elev');
    // docked profile ticks/guide/hits
    res.guide = !!q('.elev__guide') && q('.elev__guide-label')?.textContent;
    res.poonGuide = !!window.__fx.maps.poon.el.querySelector('.elev__guide');
    res.hits = root.querySelectorAll('.elev__hit').length;
    res.spikes = root.querySelectorAll('.elev__spike').length;
    res.mapSpikes = root.querySelectorAll('.rmap__tri').length;
    res.scale = q('.rmap__scale-text').textContent;
    res.legend = q('.rmap__legend').textContent;
    res.ariaSet = [...root.querySelectorAll('.rmap__marker')].map(g => g.getAttribute('aria-label'));
    return res;
  });
  console.log(`[${width}] highlight`, JSON.stringify(hl, null, 1));
  if (!/Days 3–4, Alpine Village/.test(hl.activeAria4 || '')) problems.push(`[${width}] rest-day merge failed: ${hl.activeAria4}`);
  if (!hl.ring2OnActive4) problems.push(`[${width}] merged marker lacks ring2`);
  if (!hl.done4) problems.push(`[${width}] done path empty at day 4`);
  if (!hl.card4 || !/Day 4 · Acclimatisation/.test(hl.card4) || /hrs/.test(hl.card4)) problems.push(`[${width}] daycard wrong: ${hl.card4}`);
  if (!hl.profileActive4 || hl.hair4 !== 'visible') problems.push(`[${width}] profile highlight failed`);
  if (!/Days 5–6, High Kharka/.test(hl.activeAria6 || '') || hl.num6 !== '5–6') problems.push(`[${width}] explicit dup merge failed: ${hl.activeAria6} ${hl.num6}`);
  if (!/Day 7, Alpine Village/.test(hl.activeAria7 || '')) problems.push(`[${width}] repeat marker not night for day 7: ${hl.activeAria7}`);
  if (hl.offset7.length !== 2 || hl.offset7[0] === hl.offset7[1]) problems.push(`[${width}] repeat not offset: ${hl.offset7}`);
  if (!hl.travelD || hl.done8HasDrive.includes(hl.travelD.slice(-12))) problems.push(`[${width}] drive leg wrong: travel=${hl.travelD} done8=${hl.done8HasDrive}`);
  if (hl.clearedActive !== 0 || hl.clearedDone !== '' || hl.clearedCard !== true || hl.clearedHair !== 'hidden') problems.push(`[${width}] clear failed`);
  if (!/rmap--static/.test(hl.staticClass) || hl.staticTabindex !== 0 || hl.staticHasCard || hl.staticHasProfile) problems.push(`[${width}] static mode wrong`);
  if (!hl.staticLabels.some(l => /^D1 · 16 Oct$|^Riverside · 16 Oct$/.test(l))) problems.push(`[${width}] dated labels wrong: ${hl.staticLabels}`);
  if (!hl.guide || hl.poonGuide) problems.push(`[${width}] 4,000 m guide rule wrong (long=${hl.guide}, poon=${hl.poonGuide})`);
  if (hl.hits !== 8 || hl.spikes !== 2 || hl.mapSpikes !== 2) problems.push(`[${width}] counts wrong hits=${hl.hits} spikes=${hl.spikes} tri=${hl.mapSpikes}`);

  // --- click delegation: marker click and profile hit click call onDaySelect with source ---
  await page.evaluate(() => { window.__fx.selections.length = 0; });
  await page.locator('#map-long .rmap__marker[data-day="2"]').click({ force: true });
  await page.locator('#map-long .elev__hit[data-day="5"]').click({ force: true });
  const sel = await page.evaluate(() => window.__fx.selections);
  if (JSON.stringify(sel) !== JSON.stringify([{ trek: 'long', d: 2, src: 'map' }, { trek: 'long', d: 5, src: 'profile' }])) problems.push(`[${width}] onDaySelect wrong: ${JSON.stringify(sel)}`);
  // keyboard: focus marker 3 and press Enter
  await page.focus('#map-long .rmap__marker[data-day="3"]');
  await page.keyboard.press('Enter');
  const kb = await page.evaluate(() => window.__fx.selections.at(-1));
  if (!kb || kb.d !== 3 || kb.src !== 'map') problems.push(`[${width}] keyboard select failed: ${JSON.stringify(kb)}`);
  await page.evaluate(() => window.__fx.maps.long.highlightDay(6));

  await page.screenshot({ path: path.join(SHOTS, `maps-${width}-light.png`), fullPage: true });
  for (const [name, sel] of [['poon', '#map-poon'], ['long', '#map-long'], ['static', '#map-static'], ['hero', '#hero-long'], ['langtang', '#real > div:nth-child(3)'], ['tilicho', '#real > div:nth-child(4)'], ['tsum', '#real > div:nth-child(7)'], ['ebc', '#real > div:nth-child(8)']]) {
    await page.locator(sel).screenshot({ path: path.join(SHOTS, `map-${width}-${name}.png`) });
  }

  // dark theme via data-theme attribute (no rebuild → recolour live)
  await page.click('#fx-theme');
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(SHOTS, `maps-${width}-dark.png`), fullPage: true });
  await page.locator('#map-long').screenshot({ path: path.join(SHOTS, `map-${width}-long-dark.png`) });
  await page.locator('#real > div:nth-child(8)').screenshot({ path: path.join(SHOTS, `map-${width}-ebc-dark.png`) });

  // --- destroy(): idempotent, clears container, kills listeners ---
  const des = await page.evaluate(() => {
    const c = document.getElementById('map-long');
    const m = window.__fx.maps.long;
    m.destroy(); m.destroy();
    m.highlightDay(2);                           // no throw after destroy
    const s = document.getElementById('map-static'); window.__fx.maps.static.destroy();
    const h = window.__fx.profiles.hero; h.destroy(); h.destroy();
    return { longEmpty: c.innerHTML === '', staticEmpty: s.innerHTML === '', heroEmpty: document.getElementById('hero-long-svg').innerHTML === '' };
  });
  if (!des.longEmpty || !des.staticEmpty || !des.heroEmpty) problems.push(`[${width}] destroy left DOM: ${JSON.stringify(des)}`);

  errors.forEach(e => problems.push(`[${width}] ${e}`));
  await ctx.close();
}

// --- reduced motion: immediate final state, no dasharray setup ---
{
  const { ctx, page, errors } = await session(390, { reduced: 'reduce' });
  const rm = await page.evaluate(() => {
    const r = window.__fx.maps.poon.el;
    return { visible: r.classList.contains('is-visible'), dash: r.querySelector('.rmap__line--walk').getAttribute('stroke-dasharray'), heroDrawn: window.__fx.profiles.hero.el.classList.contains('is-drawn'), heroDash: window.__fx.profiles.hero.el.querySelector('.elev__line').getAttribute('stroke-dasharray') };
  });
  console.log('[reduced]', JSON.stringify(rm));
  if (!rm.visible || rm.dash !== null || !rm.heroDrawn || rm.heroDash !== null) problems.push(`reduced-motion bypass wrong: ${JSON.stringify(rm)}`);
  errors.forEach(e => problems.push(`[reduced] ${e}`));
  await ctx.close();
}

// --- resize rebuild: width change rebuilds without re-animating ---
{
  const { ctx, page, errors } = await session(1440);
  await page.waitForTimeout(1500);
  const before = await page.evaluate(() => window.__fx.maps.poon.el.querySelector('.rmap__svg').getAttribute('viewBox'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => { const r = window.__fx.maps.poon.el; return { vb: r.querySelector('.rmap__svg').getAttribute('viewBox'), visible: r.classList.contains('is-visible'), dash: r.querySelector('.rmap__line--walk').getAttribute('stroke-dasharray') }; });
  console.log('[resize]', before, '→', JSON.stringify(after));
  if (before === after.vb || !after.visible || after.dash !== null) problems.push(`resize rebuild wrong: ${before} → ${JSON.stringify(after)}`);
  errors.forEach(e => problems.push(`[resize] ${e}`));
  await ctx.close();
}

await browser.close();
if (problems.length) { console.log('\nPROBLEMS:\n' + problems.join('\n')); process.exit(1); }
console.log('\nALL CHECKS PASSED');

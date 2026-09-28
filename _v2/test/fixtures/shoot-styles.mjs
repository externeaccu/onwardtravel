// Scratch: screenshot styles-preview.html at 390/1440 in both themes and report overflow.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import net from 'node:net';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const V2 = path.resolve(HERE, '..', '..');
const OUT = path.join(HERE, 'shots');
mkdirSync(OUT, { recursive: true });

const port = await new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: V2, stdio: 'ignore' });
for (let i = 0; i < 40; i++) { try { const r = await fetch(`http://127.0.0.1:${port}/index.html`); if (r.ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const base = `http://127.0.0.1:${port}/test/fixtures/styles-preview.html`;
const variants = [];
for (const width of [390, 1440]) for (const theme of ['light', 'dark']) variants.push({ width, theme, q: '' }, { width, theme, q: '&sheet=' + (width < 720 ? 'full' : '1') });

for (const v of variants) {
  const ctx = await browser.newContext({ viewport: { width: v.width, height: v.width < 720 ? 844 : 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`${base}?theme=${v.theme}${v.q}`, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(600);
  const info = await page.evaluate(() => {
    const doc = document.documentElement;
    const wide = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.right > innerWidth + 1 && r.width > 0 && getComputedStyle(el).position !== 'fixed') wide.push(el.className + ' ' + Math.round(r.right));
    }
    return { scrollW: doc.scrollWidth, innerW: innerWidth, bodyW: document.body.scrollWidth, wide: wide.slice(0, 12),
      fontOk: document.fonts.check('16px "DM Sans"') && document.fonts.check('16px "DM Serif Display"') };
  });
  const name = `${v.width}-${v.theme}${v.q ? '-sheet' : ''}`;
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: !v.q });
  console.log(name, JSON.stringify(info), errs.length ? errs : '');
  await ctx.close();
}
await browser.close();
server.kill();

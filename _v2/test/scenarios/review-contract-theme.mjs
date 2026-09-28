// Review: theme matrix — OS scheme x data-theme; body background, color-scheme, token completeness.
export default async (page, t) => {
  const out = [];
  for (const os of ['light', 'dark']) for (const attr of [null, 'light', 'dark']) {
    await page.emulateMedia({ colorScheme: os });
    await page.evaluate((a) => { if (a) document.documentElement.setAttribute('data-theme', a); else document.documentElement.removeAttribute('data-theme'); }, attr);
    await t.sleep(150);
    out.push(await page.evaluate(({ os, attr }) => {
      const cs = getComputedStyle(document.documentElement), bs = getComputedStyle(document.body);
      const names = ['--bg','--surface','--text','--brand','--accent','--rule','--ghost','--map-paper'];
      return { os, attr, scheme: cs.colorScheme, bodyBg: bs.backgroundColor, text: bs.color, toks: names.map((n) => cs.getPropertyValue(n).trim()).join(' ') };
    }, { os, attr }));
    await t.shot(`theme-os-${os}-attr-${attr || 'none'}`);
  }
  // theme button cycles
  const btn = await page.$('.iconbtn--theme');
  const seq = [];
  if (btn) for (let i = 0; i < 3; i++) { await btn.click(); await t.sleep(100); seq.push(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))); }
  return { out, seq };
};

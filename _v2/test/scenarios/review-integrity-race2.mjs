import base from './review-integrity-race.mjs';
export default async function (page, t) { await page.evaluate(() => { window.__BOBPAX = 2; window.__GAP = 0; }); return base(page, t); }

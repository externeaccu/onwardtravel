// Review: run another scenario (REVIEW_INNER env) with throwing localStorage/sessionStorage.
export default async (page, t) => {
  await page.addInitScript(() => {
    for (const k of ['localStorage', 'sessionStorage']) {
      Object.defineProperty(window, k, { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } });
    }
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await t.sleep(500);
  const mod = await import(new URL('./' + process.env.REVIEW_INNER, import.meta.url));
  return (mod.default)(page, t);
};

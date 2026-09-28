// Playwright harness for the V2 artifact. Serves ../ (the v2 dir) on a local port,
// injects the window.claude mock before page scripts, and runs a scenario.
//
//   node test/run.mjs --role owner --width 390 --route '#agenda' --scenario test/scenarios/smoke.mjs
//
// A scenario module exports:  export default async function (page, t) { ... return {...} }
// where t = { role, width, log(msg), shot(name), expect(cond, msg), sleep(ms) }.
// Console errors, page errors and HTTP >= 400 (excluding fonts.googleapis) are collected automatically.

import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import net from 'node:net';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const V2_DIR = path.resolve(HERE, '..');
export const MOCK_SRC = readFileSync(path.join(HERE, 'claude-mock.js'), 'utf8');

async function freePort() {
  return new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
}

export async function startServer() {
  const port = await freePort();
  // Text files are served as UTF-8: the published platform wraps index.html in a skeleton that
  // declares the charset, so the harness must not fall back to windows-1252 for the fragment.
  const py = [
    'import http.server, sys',
    'H = http.server.SimpleHTTPRequestHandler',
    "H.extensions_map.update({'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml'})",
    "http.server.test(HandlerClass=H, port=int(sys.argv[1]), bind='127.0.0.1')",
  ].join('\n');
  const proc = spawn('python3', ['-c', py, String(port)], { cwd: V2_DIR, stdio: 'ignore' });
  // wait until it answers
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/index.html`); if (r.ok) break; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  return { port, url: `http://127.0.0.1:${port}`, stop: () => proc.kill() };
}

export async function runScenario({ role = 'owner', width = 390, height, route = '', scenario, mock = {}, shotsDir, name = 'run', server }) {
  const own = !server; if (own) server = await startServer();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const vp = { width, height: height || (width < 720 ? 844 : 900) };
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  const errors = [], logs = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  // Google Fonts is unreachable through the sandbox proxy (TLS error); like the response and
  // requestfailed filters below, its resource-load console message is not an app error.
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const src = (m.location() && m.location().url) || '';
    if (/favicon\.ico|Failed to load resource: the server responded with a status of 404/.test(m.text())) return;
    if (/fonts\.(googleapis|gstatic)/.test(src) && /Failed to load resource/.test(m.text())) return;
    errors.push('console.error: ' + m.text());
  });
  page.on('response', r => { const u = r.url(); if (r.status() >= 400 && !/fonts\.(googleapis|gstatic)|favicon\.ico/.test(u)) errors.push(`http ${r.status()} ${u}`); });
  page.on('requestfailed', r => { const u = r.url(); if (!/fonts\.(googleapis|gstatic)/.test(u)) errors.push(`requestfailed ${u}`); });

  const mockCfg = Object.assign({ role, id: 'u_test_1', name: 'Patrick', delayMs: 60 }, mock);
  await page.addInitScript(`window.__MBH_MOCK = ${JSON.stringify(mockCfg)};\n` + MOCK_SRC);

  const t = {
    role, width, errors,
    log: (m) => logs.push(m),
    shot: async (label) => { if (!shotsDir) return; const f = path.join(shotsDir, `${name}-${label}.png`); await page.screenshot({ path: f, fullPage: false }); logs.push('shot ' + f); },
    expect: (cond, msg) => { if (!cond) errors.push('EXPECT FAILED: ' + msg); else logs.push('ok: ' + msg); },
    sleep: (ms) => page.waitForTimeout(ms),
  };

  let result = null, thrown = null;
  try {
    await page.goto(`${server.url}/index.html${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    if (scenario) {
      const mod = typeof scenario === 'string' ? await import(path.resolve(scenario)) : scenario;
      result = await (mod.default || mod)(page, t);
    }
    const hOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    t.expect(!hOverflow, 'no horizontal overflow at ' + width);
  } catch (e) { thrown = e.stack || String(e); }
  await browser.close();
  if (own) server.stop();
  return { name, role, width, route, result, errors, logs, thrown };
}

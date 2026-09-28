import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import path from 'node:path';
const port = 8765 + Math.floor(Math.random()*1000);
const server = spawn('python3', ['-m','http.server',String(port),'--bind','127.0.0.1'], { cwd: process.cwd(), stdio:'ignore' });
await new Promise(r=>setTimeout(r,600));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const OUT = 'test/fixtures/shots';
const jobs = [[390,'light'],[1440,'light'],[390,'dark'],[1440,'dark']];
for (const [width, theme] of jobs) {
  const seg = width < 720 ? 1300 : 1000;
  const page = await (await browser.newContext({ viewport:{width,height:seg}, deviceScaleFactor:1 })).newPage();
  await page.goto(`http://127.0.0.1:${port}/test/fixtures/styles-preview.html?theme=${theme}`, { waitUntil:'networkidle' }).catch(()=>{});
  await page.waitForTimeout(500);
  const h = await page.evaluate(()=>document.body.scrollHeight);
  const n = Math.ceil(h/seg);
  for (let i=0;i<n;i++) {
    await page.screenshot({ path: path.join(OUT, `seg-${width}-${theme}-${String(i).padStart(2,'0')}.png`), fullPage:true, clip:{x:0,y:i*seg,width,height:Math.min(seg,h-i*seg)} });
  }
  console.log(width, theme, 'segments', n, 'height', h);
}
await browser.close(); server.kill();

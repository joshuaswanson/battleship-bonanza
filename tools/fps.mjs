import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 760 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const wait = (t) => new Promise((r) => setTimeout(r, t));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
for (const map of ['bay', 'jungle']) {
  await page.evaluate((m) => { window.__bb.map = m; }, map);
  await page.evaluate(() => document.getElementById('btn-play').click());
  await wait(200);
  await page.evaluate(() => document.getElementById('btn-start').click());
  await page.evaluate(() => { window.__bb.autopilot = true; });
  await wait(6000);
  const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); }));
  console.log(map, 'fps', fps);
  await page.evaluate(() => document.getElementById('btn-pause')?.click());
  await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
}
await browser.close();

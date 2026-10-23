import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 760 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const wait = (t) => new Promise((r) => setTimeout(r, t));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await page.evaluate((m) => { window.__bb.map = m; }, process.argv[2] ?? 'bay');
await page.evaluate(() => document.getElementById('btn-play').click());
await new Promise((r) => setTimeout(r, 1400)); // PLAYWAIT
await wait(200);
await page.evaluate(() => document.getElementById('btn-start').click());
await new Promise((r) => setTimeout(r, 1400));
await page.evaluate(() => document.getElementById('btn-go').click());
await new Promise((r) => setTimeout(r, 1400));
await page.evaluate(() => { window.__bb.autopilot = true; });
await wait(9000);
await page.screenshot({ path: `tools/shots/wake-chase-${process.argv[2] ?? 'bay'}.png` });
await page.evaluate(() => {
  const p = window.__bb.race.player; window.__bb.freeCam = true;
  const c = window.__bb.camera; c.position.set(p.pos.x - Math.sin(p.heading) * 6, p.pos.y + 30, p.pos.z - Math.cos(p.heading) * 6);
  c.lookAt(p.pos.x - Math.sin(p.heading) * 22, p.pos.y, p.pos.z - Math.cos(p.heading) * 22);
});
await wait(60);
await page.screenshot({ path: `tools/shots/wake-top-${process.argv[2] ?? 'bay'}.png` });
await browser.close();

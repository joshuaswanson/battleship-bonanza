import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1000, height: 640 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const wait = (t) => new Promise((r) => setTimeout(r, t));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await page.evaluate(() => { window.__bb.map = 'bay'; });
await page.evaluate(() => document.getElementById('btn-play').click());
await wait(200);
await page.evaluate(() => document.getElementById('btn-start').click());
await wait(6000);
await page.evaluate(() => {
  const p = window.__bb.race.player; p.air = { t: 0, dur: 30, peak: 30, jet: false };
});
await wait(800);
await page.evaluate(() => {
  const p = window.__bb.race.player; window.__bb.freeCam = true;
  const fx = Math.sin(p.heading), fz = Math.cos(p.heading), lx = Math.cos(p.heading), lz = -Math.sin(p.heading);
  const c = window.__bb.camera; c.position.set(p.pos.x - fx * 8 + lx * 5, p.pos.y - 2.5, p.pos.z - fz * 8 + lz * 5); c.lookAt(p.pos.x - fx * 3, p.pos.y - 0.8, p.pos.z - fz * 3);
});
await wait(100);
await page.screenshot({ path: 'tools/shots/prop.png' });
await browser.close();
